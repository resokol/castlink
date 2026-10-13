// Disposable databases and private temporary server data only: not container persistence proof.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFile,writeFile,mkdtemp,chmod,rm,lstat,unlink,mkdir}=require('node:fs/promises');
const {existsSync}=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');const path=require('node:path'),os=require('node:os');const {Pool}=require('pg');
const root=path.resolve(__dirname,'../../..'),helper=path.join(root,'scripts/setup-database-v1.mjs'),ownerHelper=path.join(root,'scripts/setup-owner-v1.mjs');
const observerHelper=path.join(root,'scripts/setup-observe-v1.mjs');
const url=process.env.TEST_DATABASE_URL;if(!url)throw Error('Disposable TEST_DATABASE_URL required');
const selected=new URL(url);if(!['127.0.0.1','localhost'].includes(selected.hostname)||selected.pathname!=='/castlink_test')throw Error('Only explicit local disposable castlink_test is allowed');
const {fixture,prepared,complete,browserLifecycle,child,refused}=require('./runtime-observer-pg-fixture.cjs');
const runtimeHelper=path.join(root,'scripts/runtime-startup-observe-v1.mjs');
async function runtime(f,extra={},databaseUrl=f.env.DATABASE_URL){return child([process.env.RUNTIME_OBSERVER_RED_BASELINE==='1'?observerHelper:runtimeHelper],{...f.env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_DATA_DIR:f.data},JSON.stringify({schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://127.0.0.1',serverName:'studio',...extra}));}
function accepted(r,f){assert.equal(r.code,0,r.stdout+r.stderr);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),{schemaVersion:1,contract:'castlink-runtime-authority-v1',installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://127.0.0.1',serverName:'studio',sql:'verified',setup:'complete',authority:'verified'});assert.doesNotMatch(r.stdout,/ownerAccess|csa2\.|token|Hash|expires|principal|accessVersion|postgresql:/);}
test('expired consumed browser session cannot revoke completed runtime authority',()=>fixture(async f=>{await prepared(f);await complete(f);await browserLifecycle(f,'consume');await f.pool.query("UPDATE castlink_control.platform_credentials SET expires_at=to_timestamp(1) WHERE kind='session'");refused(await f.observe());accepted(await runtime(f),f);}));
for(const operation of ['revoke-session','revoke-version'])test('canonical '+operation+' preserves original evidence but public access refuses runtime authority',()=>fixture(async f=>{
 await prepared(f);await complete(f);const original=(await f.pool.query("SELECT owner_receipt FROM public.castlink_setup_bootstrap")).rows[0].owner_receipt,bytes=await readFile(f.output);
 await browserLifecycle(f,operation);const row=(await f.pool.query('SELECT token_hash,kind,principal_id,issued_by,access_version,expires_at FROM castlink_control.platform_credentials WHERE token_hash=$1',[original.tokenHash])).rows[0];
 assert.equal(row.kind,'invite');assert.equal(row.principal_id,original.principalId);assert.equal(row.access_version,original.accessVersion);assert.equal(Number(row.expires_at),original.expiresAt);assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM public.castlink_setup_bootstrap')).rows[0].owner_receipt,original);assert.ok((await readFile(f.output)).equals(bytes));
 refused(await f.observe());accepted(await runtime(f),f);
}));
test('unused original invite naturally expires without changing runtime association',()=>fixture(async f=>{
 await prepared(f);await complete(f);const source=`process.argv=[process.execPath,'/fixture-expired-clock'];const actual=Date.now;Date.now=()=>actual()+3600000;const m=await import(${JSON.stringify(path.join(root,'scripts/runtime-startup-observe-v1.mjs'))});await m.runtimeObserverMain();`;
 const request={schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://127.0.0.1',serverName:'studio'};
 const env={...f.env,STUDIOLINK_DATA_DIR:f.data};accepted(await child(['--input-type=module','-e',source],env,JSON.stringify(request)),f);
 const strict=`process.argv=[process.execPath,'/fixture-expired-clock'];const actual=Date.now;Date.now=()=>actual()+3600000;const m=await import(${JSON.stringify(observerHelper)});await m.observerMain();`;refused(await child(['--input-type=module','-e',strict],env,JSON.stringify(request)));
}));
async function retainedSnapshot(f){const tables=['public.castlink_setup_bootstrap','public.castlink_installations','public.castlink_rooms','castlink_control.accounts','castlink_control.organizations','castlink_control.organization_members','castlink_control.nodes','castlink_control.studios','castlink_control.rooms','castlink_control.platform_access','castlink_control.platform_credentials','castlink_control.participant_blocks'];const result=[];for(const table of tables)result.push((await f.pool.query(`SELECT to_jsonb(t) AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows);return JSON.stringify(result);}
test('runtime observer actual SELECT-only role preserves complete SQL snapshot and private SHA/mtime',()=>fixture(async f=>{
 await prepared(f);await complete(f);await browserLifecycle(f,'revoke-version');const role=await f.createRole();await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT SELECT ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; ALTER ROLE ${role.name} SET default_transaction_read_only=on`);
 const file=path.join(f.data,'runtime','castlink-setup.json'),before=await retainedSnapshot(f),source=await readFile(f.output),setup=await readFile(file),sourceStat=await lstat(f.output),setupStat=await lstat(file);
 accepted(await runtime(f,{},role.url),f);accepted(await runtime(f,{},role.url),f);assert.equal(await retainedSnapshot(f),before);assert.equal(createHash('sha256').update(await readFile(f.output)).digest('hex'),createHash('sha256').update(source).digest('hex'));assert.ok((await readFile(file)).equals(setup));assert.equal((await lstat(f.output)).mtimeMs,sourceStat.mtimeMs);assert.equal((await lstat(file)).mtimeMs,setupStat.mtimeMs);
}));
for(const drift of ['bootstrap installation','bootstrap node','bootstrap content','receipt origin','receipt principal','original missing','original foreign','private bytes','private mode','pending setup','foreign completion','shared installation','shared node','foreign platform only'])test('runtime refuses '+drift+' without SQL or filesystem repair',()=>fixture(async f=>{
 await prepared(f);await complete(f);const sql={
 'bootstrap installation':'UPDATE public.castlink_setup_bootstrap SET installation_id=gen_random_uuid()',
 'bootstrap node':"UPDATE public.castlink_setup_bootstrap SET node_id='foreign'",
 'bootstrap content':"UPDATE public.castlink_setup_bootstrap SET content_hash=repeat('a',64)",
 'receipt origin':`UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{origin}','"https://foreign.example"')`,
 'receipt principal':"UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{principalId}',to_jsonb(gen_random_uuid()::text))",
 'original missing':"DELETE FROM castlink_control.platform_credentials WHERE kind='invite'",
 'original foreign':"UPDATE castlink_control.platform_credentials SET principal_id=gen_random_uuid() WHERE kind='invite'",
 'shared installation':'INSERT INTO public.castlink_installations(installation_id) VALUES(gen_random_uuid())',
 'shared node':"INSERT INTO castlink_control.nodes(node_id,name,region,node_type) VALUES('foreign','foreign','foreign','self-hosted')",
 'foreign platform only':"DELETE FROM castlink_control.platform_credentials; INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES(repeat('f',64),'session',gen_random_uuid(),'foreign',now()+interval '1 hour')",
 };if(sql[drift])await f.pool.query(sql[drift]);if(drift==='private bytes')await writeFile(f.output,'PRIVATE_FOREIGN');if(drift==='private mode')await chmod(f.output,0o644);if(drift==='pending setup')await unlink(path.join(f.data,'runtime','castlink-setup.json'));if(drift==='foreign completion')await writeFile(path.join(f.data,'runtime','castlink-setup.json'),JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'foreign',mode:'public'}));
 const before=await retainedSnapshot(f),bytes=await readFile(f.output),state=await readFile(path.join(f.data,'runtime','castlink-setup.json')).catch(()=>null),stat=await lstat(f.output);const r=await runtime(f);refused(r,drift==='original missing'||drift==='foreign platform only'?'runtime-original-owner-evidence-missing':'runtime-authority-refused');assert.equal(JSON.parse(r.stdout).contract,'castlink-runtime-authority-v1');assert.equal(await retainedSnapshot(f),before);assert.ok((await readFile(f.output)).equals(bytes));assert.equal((await lstat(f.output)).mtimeMs,stat.mtimeMs);assert.deepEqual(await readFile(path.join(f.data,'runtime','castlink-setup.json')).catch(()=>null),state);
}));
test('no runtime flag creates an alternative public or private observer authority',()=>fixture(async f=>{await prepared(f);await complete(f);refused(await f.observe({runtime:true}));refused(await runtime(f,{runtime:true}),'runtime-authority-refused');}));
