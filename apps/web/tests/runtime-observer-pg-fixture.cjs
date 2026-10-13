// Disposable databases and private temporary server data only: not container persistence proof.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFile,writeFile,mkdtemp,chmod,rm,lstat,unlink,mkdir}=require('node:fs/promises');
const {existsSync}=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');const path=require('node:path'),os=require('node:os');const {Pool}=require('pg');
const root=path.resolve(__dirname,'../../..'),helper=path.join(root,'scripts/setup-database-v1.mjs'),ownerHelper=path.join(root,'scripts/setup-owner-v1.mjs');
const observerHelper=path.join(root,'scripts/setup-observe-v1.mjs');
const url=process.env.TEST_DATABASE_URL;if(!url)throw Error('Disposable TEST_DATABASE_URL required');
const selected=new URL(url);if(!['127.0.0.1','localhost'].includes(selected.hostname)||selected.pathname!=='/castlink_test')throw Error('Only explicit local disposable castlink_test is allowed');
async function fixture(run,identity){
 const roles=[],admin=new Pool({connectionString:url,max:1}),db='owner_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE DATABASE ${db}`);
 const connection=new URL(url);connection.pathname='/'+db;
 const pool=new Pool({connectionString:connection.href,max:2}),id=identity??randomUUID(),nodeId='srv-'+id.replaceAll('-','');
 const request={schemaVersion:1,installationId:id,nodeId,phase:'migrations'};
 const data=await mkdtemp(path.join(os.tmpdir(),'castlink-owner-data-'));await chmod(data,0o700);
 const env={...process.env,DATABASE_URL:connection.href,CASTLINK_CONTROL_PLANE_DATABASE_URL:connection.href,STUDIOLINK_INSTALLATION_ID:id,CASTLINK_NODE_ID:nodeId,CASTLINK_DEPLOYMENT_MODEL:'self-hosted',STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default'};
 async function invoke(phase='migrations',extra={},cwd=root,identity=id,databaseUrl=connection.href){
  assert.ok(existsSync(helper),'versioned observed SQL helper missing');
  return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[helper],{cwd,env:{...env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_INSTALLATION_ID:identity,CASTLINK_NODE_ID:'srv-'+identity.replaceAll('-','')}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(JSON.stringify({...request,phase,...extra}));});
 }
 async function observe(extra={},databaseUrl=connection.href){
 const request={schemaVersion:1,installationId:id,nodeId,origin:'https://127.0.0.1',serverName:'studio',...extra};
 return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[observerHelper],{cwd:root,env:{...env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_DATA_DIR:data}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(JSON.stringify(request));});
 }
 async function createRole(){
  const name='bootstrap_role_'+randomUUID().replaceAll('-',''),password=randomUUID().replaceAll('-','');
  await admin.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}'`);roles.push(name);await admin.query(`GRANT CONNECT ON DATABASE ${db} TO ${name}`);
  const roleUrl=new URL(connection.href);roleUrl.username=name;roleUrl.password=password;return{name,database:db,url:roleUrl.href};
 }
 async function owner(extra={}, databaseUrl=connection.href, raw){
 const input={schemaVersion:1,installationId:id,nodeId,origin:'https://127.0.0.1',phase:'initial',...extra};
 assert.ok(existsSync(ownerHelper),'protected owner helper missing');
 return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[ownerHelper],{cwd:root,env:{...env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_DATA_DIR:data}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(raw??JSON.stringify(input));});
 }
 const output=path.join(data,'.castlink-owner',id,'owner-invite.txt');
 try{await run({pool,request,env,invoke,createRole,owner,observe,output,data});}finally{await pool.end();for(let n=0;n<100;n++){const active=await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[db]);if(active.rows[0].n===0)break;await new Promise(r=>setTimeout(r,20));}await admin.query(`DROP DATABASE ${db}`);for(const role of roles)await admin.query(`DROP ROLE ${role}`);await admin.end();await rm(data,{recursive:true,force:true});}
}

async function seed(f){for(const phase of ['migrations','seed']){const r=await f.invoke(phase);assert.equal(r.code,0,r.stdout);}}
function ok(r){assert.equal(r.code,0,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.contract,'castlink-owner-v1');assert.equal(o.status,'verified');assert.doesNotMatch(r.stdout,/csa2\.|#access|token_hash|principal|access_version|postgresql:|PRIVATE/);return o;}
function refused(r,diagnosis){assert.equal(r.code,3,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.ok,false);if(diagnosis)assert.equal(o.diagnosis,diagnosis);assert.doesNotMatch(r.stdout,/csa2\.|#access|token_hash|postgresql:|PRIVATE|SELECT |INSERT /);return o;}
function observed(r,ownerAccess='invite',setup='pending'){assert.equal(r.code,0,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.contract,'castlink-setup-observe-v1');assert.equal(o.sql,'verified');assert.equal(o.ownerAccess,ownerAccess);assert.equal(o.setup,setup);assert.equal('ready' in o,false);assert.doesNotMatch(r.stdout,/csa2\.|#access|tokenHash|postgresql:|PRIVATE/);return o;}
async function prepared(f){await seed(f);ok(await f.owner());}
async function snapshot(f){return JSON.stringify((await f.pool.query("SELECT owner_receipt FROM public.castlink_setup_bootstrap")).rows)+JSON.stringify((await f.pool.query('SELECT * FROM castlink_control.platform_credentials ORDER BY token_hash')).rows);}
async function complete(f,serverName='studio'){const dir=path.join(f.data,'runtime');await mkdir(dir,{mode:0o700});await writeFile(path.join(dir,'castlink-setup.json'),JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName,mode:'public'}),{mode:0o600});}
async function browserLifecycle(f,operation){
 const source=`const fs=require('node:fs'),req=require('node:module').createRequire(require('node:path').resolve('apps/web/package.json')),ts=req('typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);const store=require('./apps/web/lib/control-plane-store.ts'),platform=require('./apps/web/lib/platform-credentials.ts');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{try{const q=JSON.parse(input),url=new URL(fs.readFileSync(q.file,'utf8').trim()),invite=new URLSearchParams(url.hash.slice(1)).get('access'),session=await platform.redeemPlatformInvite(invite);if(!session)throw Error();if(q.operation==='revoke-session'){await platform.revokePlatformSession(session.token);if(await platform.readPlatformSession(session.token))throw Error()}if(q.operation==='revoke-version'){await store.rotateSuperAdminAccessVersion();if(await platform.readPlatformSession(session.token))throw Error()}}catch{process.exitCode=1}finally{await store.closeControlPlanePool()}});`;
 const result=await child(['-e',source],f.env,JSON.stringify({file:f.output,operation}));assert.equal(result.code,0);assert.equal(result.stdout+result.stderr,'');
}
function child(args,env,input){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{cwd:root,env}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(input)})}
module.exports={fixture,prepared,complete,browserLifecycle,child,refused,root,observerHelper};
