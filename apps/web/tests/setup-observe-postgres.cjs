// Disposable databases and private temporary server data only: not container persistence proof.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFile,writeFile,mkdtemp,chmod,rm,lstat,unlink,mkdir}=require('node:fs/promises');
const {existsSync}=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');const path=require('node:path'),os=require('node:os');const {Pool}=require('pg');
const root=path.resolve(__dirname,'../../..'),helper=path.join(root,'scripts/setup-database-v1.mjs'),ownerHelper=path.join(root,'scripts/setup-owner-v1.mjs');
const observerHelper=path.join(root,'scripts/setup-observe-v1.mjs');
const url=process.env.TEST_DATABASE_URL;if(!url)throw Error('Disposable TEST_DATABASE_URL required');
const selected=new URL(url);if(!['127.0.0.1','localhost'].includes(selected.hostname)||selected.pathname!=='/castlink_test')throw Error('Only explicit local disposable castlink_test is allowed');
async function fixture(run){
 const roles=[],admin=new Pool({connectionString:url,max:1}),db='owner_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE DATABASE ${db}`);
 const connection=new URL(url);connection.pathname='/'+db;
 const pool=new Pool({connectionString:connection.href,max:2}),id=randomUUID(),nodeId='srv-'+id.replaceAll('-','');
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
test('actual SQL/owner/setup observer has only SELECT permissions and makes no receipt or filesystem effects',()=>fixture(async f=>{
 await prepared(f);const role=await f.createRole();await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT SELECT ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; ALTER ROLE ${role.name} SET default_transaction_read_only=on`);
 const before=await snapshot(f),bytes=await readFile(f.output),stat=await lstat(f.output);observed(await f.observe({},role.url));assert.ok(await snapshot(f)===before,'Read-only observer mutated private retained SQL');assert.ok((await readFile(f.output)).equals(bytes),'Read-only observer mutated protected source bytes');assert.equal((await lstat(f.output)).mtimeMs,stat.mtimeMs);assert.equal(await readFile(path.join(f.data,'runtime','castlink-setup.json')).then(()=>true,()=>false),false);
}));
test('actual protected completed name/mode is verified; foreign setup is refused without replacement',()=>fixture(async f=>{
 await prepared(f);const dir=path.join(f.data,'runtime');await mkdir(dir,{mode:0o700});const file=path.join(dir,'castlink-setup.json'),state={schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'studio',mode:'public'};await writeFile(file,JSON.stringify(state),{mode:0o600});observed(await f.observe(),'invite','complete');await writeFile(file,JSON.stringify({...state,serverName:'foreign'}));refused(await f.observe(),'setup-observation-refused');assert.equal(JSON.parse(await readFile(file)).serverName,'foreign');
}));
for(const setup of ['pending','complete'])for(const drift of ['schema','migration','seed','ledger DDL','receipt','version','file','missing file','foreign credential'])test(`actual ${setup} ${drift} refuses read-only observation with fixed redacted output`,()=>fixture(async f=>{
 await prepared(f);if(setup==='complete')await complete(f);
 const sql={schema:'ALTER TABLE public.castlink_rooms ADD COLUMN unexpected text',migration:'DELETE FROM public.castlink_schema_migrations WHERE version=2',seed:"UPDATE castlink_control.nodes SET node_type='edge'",'ledger DDL':'ALTER TABLE public.castlink_setup_bootstrap ADD COLUMN unknown text',receipt:"UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{origin}','\"https://foreign.example\"')",version:"UPDATE castlink_control.platform_access SET access_version='foreign' WHERE access_key='super_admin_v2'",'foreign credential':"INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES(repeat('a',64),'session',gen_random_uuid(),'foreign',now()+interval '1 hour')"};
 if(sql[drift])await f.pool.query(sql[drift]);if(drift==='file')await writeFile(f.output,'PRIVATE');if(drift==='missing file')await unlink(f.output);const before=await snapshot(f);refused(await f.observe(),'setup-observation-refused');assert.ok(await snapshot(f)===before,'Read-only observer mutated private retained SQL');
}));
async function redeem(f){
 const source=`const fs=require('node:fs'),webRequire=require('node:module').createRequire(require('node:path').resolve('apps/web/package.json')),ts=webRequire('typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);const store=require('./apps/web/lib/control-plane-store.ts'),platform=require('./apps/web/lib/platform-credentials.ts');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{try{const url=new URL(fs.readFileSync(JSON.parse(input).filePath,'utf8').trim()),invite=new URLSearchParams(url.hash.slice(1)).get('access');if(!await platform.redeemPlatformInvite(invite))process.exitCode=1;}catch{process.exitCode=1;}finally{await store.closeControlPlanePool();}});`;
 const r=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',source],{cwd:root,env:f.env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));p.stdin.end(JSON.stringify({filePath:f.output}));});assert.equal(r.code,0);assert.equal(r.out,'');assert.equal(r.err,'');
}
test('real platform redemption establishes session proof while prepareOwner still refuses consumed invitation',()=>fixture(async f=>{
 await prepared(f);await redeem(f);const before=await snapshot(f);observed(await f.observe(),'session');assert.ok(await snapshot(f)===before,'Read-only observer mutated private retained SQL');refused(await f.owner({phase:'retained'}),'owner-invite-consumed');assert.ok(await snapshot(f)===before,'Read-only observer mutated private retained SQL');
 await f.pool.query("UPDATE castlink_control.platform_credentials SET expires_at=to_timestamp(1) WHERE kind='session'");refused(await f.observe(),'setup-observation-refused');
}));
test('expired unused invitation cannot establish owner access even with matching expired SQL receipt',()=>fixture(async f=>{
 await prepared(f);await f.pool.query("UPDATE castlink_control.platform_credentials SET expires_at=to_timestamp(1); UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{expiresAt}','1000')");const before=await snapshot(f);refused(await f.observe(),'setup-observation-refused');assert.ok(await snapshot(f)===before,'Read-only observer mutated private retained SQL');
}));

async function complete(f){
 const dir=path.join(f.data,'runtime');await mkdir(dir,{mode:0o700});
 const file=path.join(dir,'castlink-setup.json');await writeFile(file,JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'studio',mode:'public'}),{mode:0o600});return file;
}
async function runtimeRoomsAndKick(f){
 // Exercise the same PostgreSQL room backend and identity revocation used by the app.
 const source=`const fs=require('node:fs'),webRequire=require('node:module').createRequire(require('node:path').resolve('apps/web/package.json')),ts=webRequire('typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);const {Pool}=webRequire('pg'),store=require('./apps/web/lib/control-plane-store.ts'),{PostgresRoomStoreBackend}=require('./apps/web/lib/postgres-room-store.ts'),{blockNodeParticipant}=require('./apps/web/lib/node-admission-store.ts'),p=new Pool({connectionString:process.env.DATABASE_URL});(async()=>{try{await new PostgresRoomStoreBackend(p).update('studio-default',()=>[{name:'runtime-room',passwordHash:'runtime-password-hash',guestInviteVersion:'runtime-revocation'}]);await blockNodeParticipant(process.env.CASTLINK_NODE_ID,'runtime-room','removed-guest');}catch{process.exitCode=1;}finally{await p.end();await store.closeControlPlanePool();}})();`;
 const r=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',source],{cwd:root,env:f.env,stdio:['ignore','pipe','pipe']}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,out:Buffer.concat(out).toString(),err:Buffer.concat(err).toString()}));});assert.equal(r.code,0);assert.equal(r.out,'');assert.equal(r.err,'');
 await f.pool.query("INSERT INTO castlink_control.rooms(room_id,studio_id,name) VALUES('runtime-control-room','studio-default','runtime-room')");
}
async function retainedSnapshot(f){
 const tables=['public.castlink_setup_bootstrap','public.castlink_installations','public.castlink_rooms','castlink_control.accounts','castlink_control.organizations','castlink_control.organization_members','castlink_control.nodes','castlink_control.studios','castlink_control.rooms','castlink_control.platform_access','castlink_control.platform_credentials','castlink_control.participant_blocks'];
 const sql=[];for(const table of tables)sql.push((await f.pool.query(`SELECT to_jsonb(t) AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows);return JSON.stringify(sql);
}
test('completed installation observes actual runtime rooms and participant kick with consumed owner session read-only',()=>fixture(async f=>{
 await prepared(f);await redeem(f);const file=await complete(f);await runtimeRoomsAndKick(f);
 const role=await f.createRole();await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT SELECT ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; ALTER ROLE ${role.name} SET default_transaction_read_only=on`);
 const before=await retainedSnapshot(f),source=await readFile(f.output),state=await readFile(file),stat=await lstat(file);
 observed(await f.observe({},role.url),'session','complete');observed(await f.observe({},role.url),'session','complete');
 assert.equal(await retainedSnapshot(f),before);assert.ok((await readFile(f.output)).equals(source));assert.ok((await readFile(file)).equals(state));assert.equal((await lstat(file)).mtimeMs,stat.mtimeMs);
 // Completed observation never relaxes initial migration/seed or owner issuance.
 refused(await f.invoke('seed'),'database-contract-refused');refused(await f.owner({phase:'retained'}));assert.equal(await retainedSnapshot(f),before);
}));
for(const drift of ['pending rooms','pending blocks','foreign room studio','foreign installation','foreign ledger','missing footprint','missing completion','foreign completion'])test(`runtime retained boundary refuses ${drift} without changing retained state`,()=>fixture(async f=>{
 await prepared(f);await redeem(f);let file;if(!drift.startsWith('pending'))file=await complete(f);
 if(drift==='pending blocks')await f.pool.query("INSERT INTO castlink_control.participant_blocks(node_id,media_room,identity,expires_at) VALUES($1,'runtime-room','removed-guest',now()+interval '1 hour')",[f.request.nodeId]);else await runtimeRoomsAndKick(f);
 const sql={'foreign room studio':"UPDATE public.castlink_rooms SET studio_id='foreign-studio'",'foreign installation':"INSERT INTO public.castlink_installations(installation_id) VALUES(gen_random_uuid())",'foreign ledger':"UPDATE public.castlink_setup_bootstrap SET installation_id=gen_random_uuid()",'missing footprint':"UPDATE castlink_control.organization_members SET role='admin'"};
 if(sql[drift])await f.pool.query(sql[drift]);if(drift==='missing completion')await unlink(file);if(drift==='foreign completion')await writeFile(file,JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'foreign',mode:'public'}));
 const before=await retainedSnapshot(f),source=await readFile(f.output);refused(await f.observe(),'setup-observation-refused');assert.equal(await retainedSnapshot(f),before);assert.ok((await readFile(f.output)).equals(source));
}));
