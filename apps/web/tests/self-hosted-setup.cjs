require('./i18n-fixture.cjs');
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {generateKeyPairSync, sign} = require('node:crypto');
const ts = require('typescript');

require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,f);
const {publicKey, privateKey} = generateKeyPairSync('ed25519');
// Substitute the signing authority fixture, while testing the real lease verifier and activation persistence.
const keyFile = require.resolve('../lib/license-public-key.generated.ts');
require.cache[keyFile] = {id:keyFile,filename:keyFile,loaded:true,exports:{embeddedLicensePublicKeyPem:publicKey.export({type:'spki',format:'pem'})}};
const {NextRequest} = require('next/server');
const route = require('../app/api/setup/route.ts');
const setup = require('../lib/setup-state.ts');
const originalFetch = global.fetch;
const envNames = ['NODE_ENV','STUDIOLINK_DATA_DIR','CASTLINK_SETUP_TOKEN','CASTLINK_DEPLOYMENT_MODEL','CASTLINK_LICENSE_SERVICE_URL','CASTLINK_SERVER_ID'];
const previous = Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
after(()=>{global.fetch=originalFetch;for(const name of envNames)if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];});
function fixture(model) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-self-hosted-'));
 process.env.NODE_ENV='development';process.env.STUDIOLINK_DATA_DIR=root;process.env.CASTLINK_SETUP_TOKEN='private-setup-fixture';
 process.env.CASTLINK_LICENSE_SERVICE_URL='https://license.fixture.invalid';process.env.CASTLINK_SERVER_ID='server-fixture-0001';
 if(model===undefined)delete process.env.CASTLINK_DEPLOYMENT_MODEL;else process.env.CASTLINK_DEPLOYMENT_MODEL=model;
 let network=0;global.fetch=async()=>{network++;throw new Error('Network disabled private-error-fixture');};
 return {root,network:()=>network,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function request(body={serverName:'Office',mode:'edge'},headers={}) {
 return new NextRequest('https://castlink.fixture/api/setup',{method:'POST',headers:{host:'castlink.fixture',origin:'https://castlink.fixture','content-type':'application/json','x-castlink-setup-token':'private-setup-fixture',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
}
function stateFile(f){return path.join(f.root,'runtime','castlink-setup.json');}

test('GET advertises default self-hosted deployment and setup without identity or secrets',async()=>{
 const f=fixture();try{const response=await route.GET();assert.equal(response.status,200);assert.deepEqual(await response.json(),{needsSetup:true,deploymentModel:'self-hosted'});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(f.network(),0);}finally{f.cleanup();}
});
test('self-hosted setup completes without activation or network and never grants platform access',async()=>{
 const f=fixture();try{const response=await route.POST(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(response.headers.has('set-cookie'),false);assert.equal(f.network(),0);const stored=JSON.parse(fs.readFileSync(stateFile(f),'utf8'));assert.equal(stored.serverName,'Office');assert.equal(stored.mode,'edge');assert.equal(typeof stored.completedAt,'string');assert.doesNotMatch(JSON.stringify(stored),/private-setup-fixture|activation|license|super.admin|credential/i);assert.deepEqual(fs.readdirSync(path.join(f.root,'runtime')),['castlink-setup.json']);const again=await route.POST(request());assert.equal(again.status,409);assert.equal(f.network(),0);assert.equal((await route.GET()).status,200);}finally{f.cleanup();}
});
test('self-hosted setup preserves token, origin, payload and mode gates before persistence',async()=>{
 const f=fixture();try{
  for(const headers of [{'x-castlink-setup-token':''},{'x-castlink-setup-token':'wrong'}])assert.equal((await route.POST(request(undefined,headers))).status,401);
  for(const origin of ['', 'https://foreign.fixture'])assert.equal((await route.POST(request(undefined,{origin}))).status,403);
  for(const body of ['{broken',null,{}, {serverName:'Office',mode:'internet'},{serverName:'',mode:'edge'},{serverName:'x'.repeat(121),mode:'public'}])assert.equal((await route.POST(request(body))).status,400);
  assert.equal((await route.POST(request('x'.repeat(4097)))).status,413);assert.equal(fs.existsSync(stateFile(f)),false);assert.equal(f.network(),0);
 }finally{f.cleanup();}
});
test('simultaneous setup requests commit at most once and never replace the winning state',async()=>{
 const f=fixture();try{const responses=await Promise.all([route.POST(request({serverName:'First',mode:'edge'})),route.POST(request({serverName:'Second',mode:'public'}))]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);const winner=responses[0].status===200?'First':'Second';assert.equal(JSON.parse(fs.readFileSync(stateFile(f),'utf8')).serverName,winner);assert.equal(f.network(),0);assert.equal(fs.existsSync(path.join(f.root,'runtime','castlink-setup.lock')),false);}finally{f.cleanup();}
});
test('an existing setup lock fails closed without removing it or writing state',async()=>{
 const f=fixture();try{const runtime=path.join(f.root,'runtime');fs.mkdirSync(runtime);const lock=path.join(runtime,'castlink-setup.lock');fs.writeFileSync(lock,'existing-owner-fixture');assert.equal((await route.POST(request())).status,409);assert.equal(fs.readFileSync(lock,'utf8'),'existing-owner-fixture');assert.equal(fs.existsSync(stateFile(f)),false);assert.equal(f.network(),0);}finally{f.cleanup();}
});
test('previous completed state is preserved without upgrading or reactivating it',async()=>{
 const f=fixture();try{fs.mkdirSync(path.dirname(stateFile(f)));const raw=JSON.stringify({schemaVersion:1,completedAt:'2026-01-01T00:00:00.000Z',serverName:'Existing',mode:'public'});fs.writeFileSync(stateFile(f),raw);assert.deepEqual(await (await route.GET()).json(),{needsSetup:false,deploymentModel:'self-hosted'});assert.equal((await route.POST(request())).status,409);assert.equal(fs.readFileSync(stateFile(f),'utf8'),raw);assert.equal(f.network(),0);}finally{f.cleanup();}
});
test('explicit legacy retains real signed activation persistence but never returns activation metadata',async()=>{
 const f=fixture('legacy');try{assert.deepEqual(await (await route.GET()).json(),{needsSetup:true,deploymentModel:'legacy'});assert.equal((await route.POST(request())).status,400);let calls=0;
  global.fetch=async(url,options)=>{calls++;assert.equal(String(url),'https://license.fixture.invalid/v1/servers/activate');const body=JSON.parse(options.body);assert.equal(body.activationCode,'activation-fixture');const now=Date.now();const payload={schemaVersion:1,leaseId:'lease-fixture-0001',licenseId:'license-fixture-0001',organizationId:'org-fixture',serverId:body.serverId,installationId:body.installationId,serverType:'self-hosted',issuedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+60000).toISOString(),graceUntil:new Date(now+120000).toISOString(),features:['rooms']};const data=Buffer.from(JSON.stringify(payload));const lease=data.toString('base64url')+'.'+sign(null,data,privateKey).toString('base64url');return new Response(JSON.stringify({serverId:body.serverId,lease}),{status:200,headers:{'content-type':'application/json'}});};
  const response=await route.POST(request({serverName:'Legacy',mode:'public',activationCode:'activation-fixture'}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(calls,1);assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,'runtime','castlink-license.json'),'utf8')).schemaVersion,1);assert.equal(JSON.parse(fs.readFileSync(stateFile(f),'utf8')).serverName,'Legacy');assert.equal(response.headers.has('set-cookie'),false);
 }finally{f.cleanup();}
});
test('activation failures do not expose upstream secrets or complete setup',async()=>{
 const f=fixture('legacy');try{const response=await route.POST(request({serverName:'Legacy',mode:'edge',activationCode:'activation-fixture'}));assert.equal(response.status,400);assert.doesNotMatch(await response.text(),/private-error-fixture|activation-fixture|private-setup-fixture/);assert.equal(fs.existsSync(stateFile(f)),false);assert.equal(fs.existsSync(path.join(f.root,'runtime','castlink-setup.lock')),false);}finally{f.cleanup();}
});

function renderSetupUI(model, loadingError) {
 const vm=require('node:vm');const {createRequire}=require('node:module');const {renderToStaticMarkup}=require('react-dom/server');const file=path.resolve(__dirname,'../app/setup/page.tsx');const localRequire=createRequire(file);
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>name==='react'?{useState:value=>[value===null?(loadingError?null:true):value==='self-hosted'?model:value===''&&loadingError?loadingError:value,()=>{}],useEffect:()=>{}}:name.endsWith('.css')?{}:localRequire(name)});return renderToStaticMarkup(module.exports.default());
}
test('setup UI shows activation and cloud registration only for explicit legacy mode',()=>{
 assert.doesNotMatch(renderSetupUI('self-hosted'),/Код активации|CastLink Cloud|Активировать сервер/);assert.match(renderSetupUI('self-hosted'),/Настроить сервер/);assert.match(renderSetupUI('legacy'),/Код активации/);assert.match(renderSetupUI('legacy'),/CastLink Cloud/);
});
test('setup state loading failure is visible and does not report completion',()=>{
 const html=renderSetupUI('self-hosted','Состояние настройки недоступно');assert.match(html,/Состояние настройки недоступно/);assert.doesNotMatch(html,/SETUP COMPLETE/);
});
test('invalid deployment configuration fails closed without setup or external activation',async()=>{
 const f=fixture('unknown-fixture');try{assert.equal((await route.GET()).status,500);assert.equal((await route.POST(request())).status,500);assert.equal(f.network(),0);assert.equal(fs.existsSync(stateFile(f)),false);}finally{f.cleanup();}
});
test('default and legacy seed pass the deployment node type to the actual database boundary',()=>{
 const f=fixture();try{const {spawnSync}=require('node:child_process');const hook=path.join(f.root,'pg-fixture.cjs'),log=path.join(f.root,'queries.json');fs.writeFileSync(hook,`const Module=require('node:module'),fs=require('node:fs');const original=Module._load,queries=[];class Pool{async query(sql,args=[]){queries.push({sql,args});if(sql.includes('SELECT version'))return{rows:[{version:1},{version:2}]};if(sql.includes('to_regclass'))return{rows:[{studios:true,rooms:true}]};return{rows:[],rowCount:0};}async connect(){return this;}release(){}async end(){fs.writeFileSync(process.env.FIXTURE_QUERY_FILE,JSON.stringify(queries));}}Module._load=function(name,...rest){return name==='pg'?{Pool}:original.call(this,name,...rest);};`);
  for(const [model,type] of [['','self-hosted'],['legacy','cloud']]){const response=spawnSync(process.execPath,['--require',hook,'scripts/control-plane-seed-default.mjs'],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://fixture.invalid/test',CASTLINK_CONTROL_PLANE_DATABASE_URL:'postgresql://fixture.invalid/test',STUDIOLINK_INSTALLATION_ID:'00000000-0000-4000-8000-000000000000',CASTLINK_DEPLOYMENT_MODEL:model,FIXTURE_QUERY_FILE:log}});assert.equal(response.status,0,response.stderr);const query=JSON.parse(fs.readFileSync(log,'utf8')).find(q=>q.sql.includes('INSERT INTO castlink_control.nodes'));assert.equal(query.args[3],type);
   for (const existingType of ['cloud','edge']) {
    const conflictUpdate=query.sql.split('DO UPDATE SET')[1];
    assert.doesNotMatch(conflictUpdate,/\bnode_type\s*=/i,`Default reseed must preserve existing ${existingType} node type`);
   }
  }
 }finally{f.cleanup();}
});
