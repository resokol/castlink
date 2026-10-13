import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const base=process.env.CASTLINK_TEST_DIST??fileURLToPath(new URL('../dist',import.meta.url));
const api=name=>import(pathToFileURL(base+'/'+name+'.js'));
const internet={domain:'media.customer.net',publicIPv4:'8.8.4.4'};
const request={profile:'direct',target:{kind:'remote',host:'vps.customer.net',user:'operator',port:22},root:'/home/operator/castlink',release:'1.0.0',network:'internet',internet};
const input={release:{schemaVersion:1,release:'1.0.0',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['postgres','web','livekit','caddy'].map(n=>[n,{reference:'registry.customer.net/'+n+'@sha256:'+'a'.repeat(64),architectures:['amd64']}]))},installationId:'00000000-0000-4000-8000-000000000001',architecture:'amd64',network:'internet',bindIPv4:'192.168.50.20',internet,secretFiles:{webEnv:'/private/web.env',postgresEnv:'/private/postgres.env',livekitConfig:'/private/livekit.yaml'}};
test('direct Internet validates canonical exact declaration and saved request',async()=>{
 const {validateInternetConfiguration}=await api('internet-network'),{validateRequest}=await api('plan');
 assert.deepEqual(validateInternetConfiguration(internet),internet);assert.doesNotThrow(()=>validateRequest(request));
 for(const change of [{internet:undefined},{internet:{...internet,extra:true}},{domain:'foreign.customer.net'},{internet:{...internet,turnDomain:undefined}},{internet:{...internet,publicIPv4:'192.0.0.8'}}])assert.throws(()=>validateRequest({...request,...change}));
 assert.throws(()=>validateRequest({...request,extra:true}));assert.throws(()=>validateRequest({...request,network:'lan'}));
});
test('direct bundle uses ACME, admission and only direct ICE ports without TURN artifacts',async()=>{
 const {renderBundle,bundleContents}=await api('bundle'),v=renderBundle(input),m=v.composeModel;
 assert.doesNotMatch(v.caddyText,/tls internal|TURN|turn\.customer/);assert.match(v.caddyText,/forward_auth web:3000/);
 assert.deepEqual(m.services.caddy.ports.map(p=>p.target),[80,443]);assert.equal(m.services.postgres.ports,undefined);assert.equal(m.services.web.ports,undefined);
 assert.equal(m.services.livekit.ports.length,102);assert.equal(m.services.livekit.volumes.length,1);assert.ok(v.checks.every(c=>c.id!=='turn-tls-bootstrap'));
 const credentials=Object.fromEntries(['postgresPassword','livekitKey','livekitSecret','sessionSecret','dataEncryptionKey','setupToken','nodeSecret'].map(k=>[k,k==='livekitKey'?'lk_'+'b'.repeat(32):'b'.repeat(64)]));
 const lk=JSON.parse(bundleContents(input,credentials)['livekit.yaml']);assert.equal(lk.rtc.node_ip,internet.publicIPv4);assert.equal(lk.turn,undefined);
});
test('direct preflight reaches prerequisites; optional TURN stays fail-closed before effects',async()=>{
 const {bundlePrerequisiteChecks}=await api('bundle-preflight'),{serviceContract}=await api('services');let calls=0;
 const executor={run:async()=>{calls++;return {code:1,stdout:'',stderr:''}}};
 const checks=await bundlePrerequisiteChecks(input,executor,true);assert.ok(calls>0);assert.ok(checks.every(c=>c.id!=='turn-tls-bootstrap'));
 calls=0;const turn={...input,internet:{...internet,turnDomain:'turn.customer.net'}};const blocked=await bundlePrerequisiteChecks(turn,executor,true);assert.equal(blocked.find(c=>c.id==='turn-tls-bootstrap').state,'fail');await assert.rejects(()=>serviceContract(turn,'/private/compose.yaml',executor,true),e=>e.code===4);assert.equal(calls,0);
});
test('compiled Python and Node target trust selection validates domain origin while local trust stays private',{skip:process.platform==='win32'},async()=>{
 const {pythonObserver,nodeObserver}=await api('setup-verification-target');
 const python=pythonObserver.slice(0,pythonObserver.lastIndexOf('try:\n raw=sys.stdin'))+`\nr={'origin':'https://media.customer.net'}\nassert ca(r) is None\nassert public_origin(r['origin'])\nassert not public_origin('https://127.0.0.1')\nassert not public_origin('https://192.168.50.20')\nfor bad in ('https://MEDIA.customer.net','https://media.customer.test','https://media.customer.net:443','https://media.customer.net/','https://media.customer.net@evil.customer.net','http://media.customer.net'):\n try: public_origin(bad)\n except Exception: continue\n raise Exception('accepted invalid origin')\n`;
 const py=spawnSync('python3',['-c',python],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);
 const node=nodeObserver.slice(0,nodeObserver.indexOf("let input='';process.stdin"))+`\nif(ca({origin:'https://media.customer.net'})!==null||!publicOrigin('https://media.customer.net')||publicOrigin('https://127.0.0.1'))throw Error();`;
 const js=spawnSync(process.execPath,['-e',node],{encoding:'utf8'});assert.equal(js.status,0,js.stderr);
});
test('direct remote preflight checks exactly ACME/HTTPS and direct ICE bindings',async()=>{
 const {bundlePrerequisiteChecks}=await api('bundle-preflight');const captures=[];
 const executor={run:async r=>{let stdout;if(r.input){const v=JSON.parse(r.input);captures.push(v);stdout=JSON.stringify({schemaVersion:1,address:true,tcp:v.tcp.map(port=>({port,available:true})),udp:v.udp.map(port=>({port,available:true}))})}else if(r.executable==='python3')stdout=JSON.stringify({platform:'linux',distribution:'ubuntu',arch:'x64',osVersion:'24.04'});else if(r.args[0]==='context')stdout=JSON.stringify('unix:///var/run/docker.sock');else if(r.args[0]==='version')stdout='linux|amd64|28.0.0';else stdout='2.23.1';return{code:0,stdout,stderr:''}}};
 const checks=await bundlePrerequisiteChecks(input,executor,true);assert.equal(checks.find(c=>c.id==='ports').state,'pass');assert.deepEqual(captures[0].tcp,[80,443,7881]);assert.deepEqual(captures[0].udp,Array.from({length:101},(_,i)=>61000+i));
 captures.length=0;await bundlePrerequisiteChecks(input,executor,true,['https','ice']);assert.deepEqual(captures[0].tcp,[]);assert.deepEqual(captures[0].udp,[]);
});
test('configuration refuses declaration override before storage or target effects',async()=>{
 const {prepareConfig}=await api('setup');let calls=0;const executor={run:async()=>{calls++;throw Error()}},store={load:async()=>{calls++;throw Error()},lock:async()=>{calls++;throw Error()},save:async()=>{calls++;throw Error()}};
 const plan={schemaVersion:1,request,steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};
 await assert.rejects(()=>prepareConfig(plan,{release:input.release,architecture:'amd64',bindIPv4:input.bindIPv4,journalDirectory:'/tmp/private-journal',remoteScope:'/home/operator',internet:{...internet,publicIPv4:'8.8.8.8'}},executor,store),e=>e.code===4);assert.equal(calls,0);
});
test('saved profile preserves and revalidates exact direct Internet declaration',{skip:process.platform==='win32'},async()=>{
 const {mkdtemp,rm,readFile,writeFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{FileStateStore}=await api('state');const root=await mkdtemp(join(tmpdir(),'castlink-direct-profile-'));
 try{const store=new FileStateStore(root),profile={schemaVersion:1,installationId:input.installationId,request,currentRelease:request.release,secretFilePaths:{}};await store.save(profile);assert.deepEqual(await store.load(request.profile),profile);const file=join(root,request.profile,'profile.json'),text=await readFile(file,'utf8');await writeFile(file,text.replace('"publicIPv4": "8.8.4.4"','"publicIPv4": "127.0.0.1"'));await assert.rejects(()=>store.load(request.profile),e=>e.code===4)}finally{await rm(root,{recursive:true,force:true})}
});
