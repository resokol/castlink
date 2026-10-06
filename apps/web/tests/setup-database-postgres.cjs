// Isolated databases only; never applies bootstrap to TEST_DATABASE_URL itself.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFile,writeFile,mkdtemp,cp,rm}=require('node:fs/promises');
const {existsSync}=require('node:fs');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const os=require('node:os');
const {Pool}=require('pg');
const root=path.resolve(__dirname,'../../..'),helper=path.join(root,'scripts/setup-database-v1.mjs');
const url=process.env.TEST_DATABASE_URL;
if(!url)throw Error('TEST_DATABASE_URL required (disposable PostgreSQL 16)');
async function fixture(run){
 const roles=[],admin=new Pool({connectionString:url,max:1}),db='bootstrap_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE DATABASE ${db}`);
 const connection=new URL(url);connection.pathname='/'+db;
 const pool=new Pool({connectionString:connection.href,max:2}),id=randomUUID(),nodeId='srv-'+id.replaceAll('-','');
 const request={schemaVersion:1,installationId:id,nodeId,phase:'migrations'};
 const env={...process.env,DATABASE_URL:connection.href,CASTLINK_CONTROL_PLANE_DATABASE_URL:connection.href,STUDIOLINK_INSTALLATION_ID:id,CASTLINK_NODE_ID:nodeId,CASTLINK_DEPLOYMENT_MODEL:'self-hosted',STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default'};
 async function invoke(phase='migrations',extra={},cwd=root,identity=id,databaseUrl=connection.href){
  assert.ok(existsSync(helper),'versioned observed SQL helper missing');
  return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[helper],{cwd,env:{...env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_INSTALLATION_ID:identity,CASTLINK_NODE_ID:'srv-'+identity.replaceAll('-','')}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(JSON.stringify({...request,phase,...extra}));});
 }
 async function createRole(){
  const name='bootstrap_role_'+randomUUID().replaceAll('-',''),password=randomUUID().replaceAll('-','');
  await admin.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}'`);roles.push(name);await admin.query(`GRANT CONNECT ON DATABASE ${db} TO ${name}`);
  const roleUrl=new URL(connection.href);roleUrl.username=name;roleUrl.password=password;return{name,database:db,url:roleUrl.href};
 }
 try{await run({pool,request,env,invoke,createRole});}finally{await pool.end();for(let n=0;n<100;n++){const active=await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[db]);if(active.rows[0].n===0)break;await new Promise(r=>setTimeout(r,20));}await admin.query(`DROP DATABASE ${db}`);for(const role of roles)await admin.query(`DROP ROLE ${role}`);await admin.end();}
}
function observed(r,phase){assert.equal(r.code,0,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.contract,'castlink-database-v1');assert.equal(o.phase,phase);assert.deepEqual(o.migrations,{roomVersions:[1,2,3],controlVersions:[1,2,3,4,5],schema:true,hashes:true});return o;}
function refused(r){assert.equal(r.code,3);assert.equal(r.stderr,'');assert.ok(r.stdout.length<2048);assert.equal(JSON.parse(r.stdout).ok,false);assert.doesNotMatch(r.stdout,/postgresql:|PRIVATE_FIXTURE|SELECT |INSERT |password|token_hash/i);}
test('actual helper applies and observes all eight migrations before guarded seed; retries preserve credentials and identity',()=>fixture(async f=>{
 const migrations=observed(await f.invoke(),'migrations');assert.equal(migrations.seed,null);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
 const seed=observed(await f.invoke('seed'),'seed');assert.deepEqual(seed.seed,{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0});
 const rows=await f.pool.query('SELECT installation_id FROM castlink_installations');assert.equal(rows.rows[0].installation_id,f.request.installationId);
 const topology=await f.pool.query('SELECT node_type,assignment_mode,assigned_node_id FROM castlink_control.nodes JOIN castlink_control.studios ON assigned_node_id=node_id');assert.deepEqual(topology.rows,[{node_type:'self-hosted',assignment_mode:'pinned',assigned_node_id:f.request.nodeId}]);
 observed(await f.invoke(),'migrations');observed(await f.invoke('seed'),'seed');
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
}));
test('seed cannot skip actual migrations even on a pristine database',()=>fixture(async f=>{refused(await f.invoke('seed'));assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_rooms') AS t")).rows[0].t,null);}));
test('foreign input and environment mismatch refuse before SQL',()=>fixture(async f=>{refused(await f.invoke('migrations',{installationId:randomUUID()}));assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);refused(await f.invoke('migrations',{arbitrarySQL:'PRIVATE_FIXTURE'}));}));
test('changed/truncated/unexpected migration files are rejected before DB mutation',()=>fixture(async f=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'castlink-bootstrap-sql-'));
 try{await cp(path.join(root,'infrastructure'),path.join(dir,'infrastructure'),{recursive:true});const file=path.join(dir,'infrastructure/control-plane/004_platform_credentials.sql'),original=await readFile(file,'utf8');
  for(const sql of [original+'\n-- modified',original.slice(0,80)]){await writeFile(file,sql);refused(await f.invoke('migrations',{},dir));assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);}
  await writeFile(file,original);await writeFile(path.join(dir,'infrastructure/control-plane/006_unknown.sql'),'SELECT 1;');refused(await f.invoke('migrations',{},dir));
 }finally{await rm(dir,{recursive:true,force:true});}
}));
for(const [name,sql] of [
 ['column',"ALTER TABLE castlink_control.platform_credentials DROP COLUMN issued_by"],
 ['primary key',"ALTER TABLE castlink_rooms DROP CONSTRAINT castlink_rooms_pkey"],
 ['foreign key',"ALTER TABLE castlink_control.studios DROP CONSTRAINT studios_assigned_node_id_fkey"],
 ['check',"ALTER TABLE castlink_control.nodes DROP CONSTRAINT nodes_state_check"],
 ['index',"DROP INDEX castlink_control.platform_credentials_expiry"],
 ['default',"ALTER TABLE castlink_rooms ALTER COLUMN studio_id SET DEFAULT 'foreign'"],
 ['room version',"DELETE FROM castlink_schema_migrations WHERE version=2"],
 ['hash association',"UPDATE castlink_setup_bootstrap SET content_hash=repeat('f',64)"],
])test(`verified ledger cannot hide missing/tampered actual ${name}; neither migration nor seed repairs it`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');await f.pool.query(sql);refused(await f.invoke());refused(await f.invoke('seed'));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.accounts')).rows[0].n,0);
}));
test('unassociated preexisting schema is never adopted from room ledger alone',()=>fixture(async f=>{await f.pool.query(await readFile(path.join(root,'infrastructure/postgres/001_rooms.sql'),'utf8'));refused(await f.invoke());assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);}));
for(const [name,sql,args] of [
 ['installation','INSERT INTO castlink_installations(installation_id) VALUES($1)',[randomUUID()]],
 ['account',"INSERT INTO castlink_control.accounts(account_id,display_name) VALUES('account-owner','PRIVATE_FIXTURE')",[]],
 ['organization',"INSERT INTO castlink_control.organizations(organization_id,name) VALUES('org-default','PRIVATE_FIXTURE')",[]],
 ['node',"INSERT INTO castlink_control.nodes(node_id,name,region,node_type) VALUES('node-primary','PRIVATE_FIXTURE','local','cloud')",[]],
])test(`guard refuses foreign/unassociated ${name} before default seed writes`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');await f.pool.query(sql,args);refused(await f.invoke('seed'));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.studios')).rows[0].n,0);
}));
for(const [name,sql] of [
 ['type',"UPDATE castlink_control.nodes SET node_type='cloud'"],
 ['assignment',"UPDATE castlink_control.studios SET assignment_mode='auto'"],
 ['membership',"UPDATE castlink_control.organization_members SET role='member'"],
 ['installation',"DELETE FROM castlink_installations"],
 ['studio',"DELETE FROM castlink_control.studios"],
])test(`seed retry refuses changed ${name} and never silently resets topology`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');observed(await f.invoke('seed'),'seed');await f.pool.query(sql);refused(await f.invoke('seed'));
}));
test('failed migration durably records attempt, rolls back all SQL, and retries safely',()=>fixture(async f=>{
 const role=await f.createRole();await f.pool.query(`GRANT CREATE ON SCHEMA public TO ${role.name}`);
 // No application execution hooks: a real permission error on control schema
 // CREATE occurs after the durable reservation and two room migration effects.
 refused(await f.invoke('migrations',{},root,f.request.installationId,role.url));
 const row=(await f.pool.query('SELECT migration_attempted,migrations_verified FROM castlink_setup_bootstrap')).rows[0];assert.deepEqual(row,{migration_attempted:true,migrations_verified:false});assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_rooms') AS t")).rows[0].t,null);
 await f.pool.query(`GRANT CREATE ON DATABASE ${role.database} TO ${role.name}`);observed(await f.invoke('migrations',{},root,f.request.installationId,role.url),'migrations');
}));
test('failed seed durably records attempt, rolls back defaults, and retries without reissuing owner access',()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');const role=await f.createRole();await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT ALL ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; REVOKE INSERT ON castlink_control.studios FROM ${role.name}`);
 // Permission denial at studio INSERT follows source/account/org/member/node
 // writes inside the real transaction, while catalog definitions stay canonical.
 refused(await f.invoke('seed',{},root,f.request.installationId,role.url));assert.equal((await f.pool.query('SELECT seed_attempted FROM castlink_setup_bootstrap')).rows[0].seed_attempted,true);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.accounts')).rows[0].n,0);
 await f.pool.query(`GRANT INSERT ON castlink_control.studios TO ${role.name}`);observed(await f.invoke('seed',{},root,f.request.installationId,role.url),'seed');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
}));
test('database singleton lock serializes helpers with same and competing foreign installation identities',()=>fixture(async f=>{
 const all=await Promise.all([f.invoke(),f.invoke()]);all.forEach(r=>observed(r,'migrations'));
 const seeds=await Promise.all([f.invoke('seed'),f.invoke('seed')]);seeds.forEach(r=>observed(r,'seed'));
 refused(await f.invoke('migrations',{installationId:randomUUID()}));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_setup_bootstrap')).rows[0].n,1);
}));

test('competing foreign IDs with matching environments cannot both claim pristine database',()=>fixture(async f=>{
 const other=randomUUID(),otherNode='srv-'+other.replaceAll('-','');
 const results=await Promise.all([f.invoke(),f.invoke('migrations',{installationId:other,nodeId:otherNode},root,other)]);
 assert.equal(results.filter(r=>r.code===0).length,1);assert.equal(results.filter(r=>r.code===3).length,1);
 const winner=JSON.parse(results.find(r=>r.code===0).stdout);const row=(await f.pool.query('SELECT installation_id,node_id FROM castlink_setup_bootstrap')).rows[0];
 assert.deepEqual(row,{installation_id:winner.installationId,node_id:winner.nodeId});
}));
test('actual helper blocks on database advisory guard held by a separate SQL session',()=>fixture(async f=>{
 const lock=await f.pool.connect();await lock.query('SELECT pg_advisory_lock(1128352843,1)');
 let done=false;const work=f.invoke().then(r=>{done=true;return r});let blocked=false;
 try{for(let i=0;i<100;i++){const waits=await f.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='castlink-setup-database-v1' AND wait_event='advisory'");if(waits.rows[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}assert.equal(blocked,true,'helper never entered advisory wait');assert.equal(done,false);}finally{await lock.query('SELECT pg_advisory_unlock(1128352843,1)');lock.release();}
 observed(await work,'migrations');
}));

test('unrelated public tables refuse pristine adoption without touching their rows',()=>fixture(async f=>{
 await f.pool.query("CREATE TABLE unrelated_data(value text); INSERT INTO unrelated_data VALUES('PRIVATE_FIXTURE')");refused(await f.invoke());assert.deepEqual((await f.pool.query('SELECT value FROM unrelated_data')).rows,[{value:'PRIVATE_FIXTURE'}]);assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);
}));
test('same-installation source rooms without guarded seed association refuse implicit adoption',()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');await f.pool.query('INSERT INTO castlink_installations(installation_id) VALUES($1)',[f.request.installationId]);await f.pool.query("INSERT INTO castlink_rooms(installation_id,name) VALUES($1,'foreign-room')",[f.request.installationId]);refused(await f.invoke('seed'));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.accounts')).rows[0].n,0);
}));
test('foreign linked default studio and membership are not overwritten',()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');await f.pool.query("INSERT INTO castlink_control.accounts(account_id) VALUES('foreign-account'); INSERT INTO castlink_control.organizations(organization_id,name) VALUES('foreign-org','PRIVATE_FIXTURE'); INSERT INTO castlink_control.organization_members VALUES('foreign-org','foreign-account','member'); INSERT INTO castlink_control.nodes(node_id,name,region,node_type) VALUES('foreign-node','PRIVATE_FIXTURE','local','cloud'); INSERT INTO castlink_control.studios(studio_id,organization_id,name,assignment_mode,assigned_node_id) VALUES('studio-default','foreign-org','PRIVATE_FIXTURE','auto','foreign-node')");refused(await f.invoke('seed'));assert.deepEqual((await f.pool.query('SELECT organization_id,assignment_mode,assigned_node_id FROM castlink_control.studios')).rows,[{organization_id:'foreign-org',assignment_mode:'auto',assigned_node_id:'foreign-node'}]);
}));

for(const [name,sql] of [
 ['trigger',"CREATE FUNCTION public.inject_access() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES(repeat('a',64),'session',gen_random_uuid(),'PRIVATE_FIXTURE',now()+interval '1 day'); RETURN NEW; END $$; CREATE TRIGGER inject_access AFTER INSERT ON castlink_control.accounts FOR EACH ROW EXECUTE FUNCTION public.inject_access()"],
 ['rule',"CREATE RULE inject_access AS ON INSERT TO castlink_control.accounts DO ALSO UPDATE castlink_control.platform_access SET access_version='PRIVATE_FIXTURE' WHERE access_key='super_admin_v2'"],
 ['function',"CREATE FUNCTION castlink_control.unexpected_hook() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$"],
 ['event trigger',"CREATE FUNCTION public.unexpected_event() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN NULL; END $$; CREATE EVENT TRIGGER unexpected_event ON ddl_command_end EXECUTE FUNCTION public.unexpected_event()"],
])for(const retry of [false,true])test(`review execution ${name} refuses ${retry?'verified retry':'fresh seed'} before writes`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');if(retry)observed(await f.invoke('seed'),'seed');await f.pool.query(sql);refused(await f.invoke('seed'));
 const accounts=(await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.accounts')).rows[0].n;assert.equal(accounts,retry?1:0);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
 assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM castlink_control.platform_access WHERE access_version<>''")).rows[0].n,0);
}));
for(const [name,sql] of [
 ['credential',"INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES(repeat('a',64),'session',gen_random_uuid(),'PRIVATE_FIXTURE',now()+interval '1 day')"],
 ['access version',"UPDATE castlink_control.platform_access SET access_version='PRIVATE_FIXTURE' WHERE access_key='super_admin_v2'"],
 ['participant block',null],
])test(`review verified seed refuses existing ${name} without removing or adopting it`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');observed(await f.invoke('seed'),'seed');if(sql)await f.pool.query(sql);else await f.pool.query("INSERT INTO castlink_control.participant_blocks(node_id,media_room,identity,expires_at) VALUES($1,'PRIVATE_FIXTURE','foreign',now()+interval '1 day')",[f.request.nodeId]);
 refused(await f.invoke('seed'));if(name==='credential')assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,1);if(name==='participant block')assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.participant_blocks')).rows[0].n,1);
}));
test('review pristine schema containing unexpected public function refuses before bootstrap attempt',()=>fixture(async f=>{
 await f.pool.query('CREATE FUNCTION public.unexpected() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');refused(await f.invoke());assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);
}));

for(const phase of ['migrations','seed','verified seed retry'])test(`review disabled internal FK enforcement refuses ${phase} despite preserved definitions`,()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');if(phase==='verified seed retry')observed(await f.invoke('seed'),'seed');
 const before=(await f.pool.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='castlink_control.studios'::regclass AND contype='f' ORDER BY conname")).rows;
 await f.pool.query('ALTER TABLE castlink_control.studios DISABLE TRIGGER ALL');
 assert.deepEqual((await f.pool.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='castlink_control.studios'::regclass AND contype='f' ORDER BY conname")).rows,before);
 // Demonstrate actual missing FK enforcement, then remove only own probe row.
 await f.pool.query("INSERT INTO castlink_control.studios(studio_id,organization_id,name,assigned_node_id) VALUES('foreign-studio','missing-org','probe','missing-node')");
 await f.pool.query("DELETE FROM castlink_control.studios WHERE studio_id='foreign-studio'");
 const internal=await f.pool.query("SELECT tgenabled FROM pg_trigger WHERE tgrelid='castlink_control.studios'::regclass AND tgisinternal");assert.ok(internal.rowCount>0);assert.ok(internal.rows.every(row=>row.tgenabled==='D'));
 refused(await f.invoke(phase==='migrations'?'migrations':'seed'));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.accounts')).rows[0].n,phase==='verified seed retry'?1:0);
}));

test('completed bootstrap with the earlier room migration manifest is refused without automatic migration or adoption',()=>fixture(async f=>{
 observed(await f.invoke(),'migrations');observed(await f.invoke('seed'),'seed');
 const source=await readFile(helper,'utf8'),files={};for(const match of source.matchAll(/^\s*'([^']+)':'([a-f0-9]{64})',?$/gm))if(match[1]!=='postgres/003_diagnostic_room_revision.sql')files[match[1]]=match[2];
 const {createHash}=await import('node:crypto');const oldHash=createHash('sha256').update(JSON.stringify(files)).digest('hex');
 await f.pool.query('UPDATE castlink_setup_bootstrap SET content_hash=$1',[oldHash]);
 const before=(await f.pool.query('SELECT * FROM castlink_setup_bootstrap')).rows;refused(await f.invoke());refused(await f.invoke('seed'));assert.deepEqual((await f.pool.query('SELECT * FROM castlink_setup_bootstrap')).rows,before);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
}));
