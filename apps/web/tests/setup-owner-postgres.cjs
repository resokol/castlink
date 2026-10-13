// Disposable databases and private temporary server data only: not container persistence proof.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFile,writeFile,mkdtemp,chmod,rm,lstat,unlink,mkdir}=require('node:fs/promises');
const {existsSync}=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');const path=require('node:path'),os=require('node:os');const {Pool}=require('pg');
const root=path.resolve(__dirname,'../../..'),helper=path.join(root,'scripts/setup-database-v1.mjs'),ownerHelper=path.join(root,'scripts/setup-owner-v1.mjs');
const url=process.env.TEST_DATABASE_URL;if(!url)throw Error('Disposable TEST_DATABASE_URL required');
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
 async function createRole(){
  const name='bootstrap_role_'+randomUUID().replaceAll('-',''),password=randomUUID().replaceAll('-','');
  await admin.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}'`);roles.push(name);await admin.query(`GRANT CONNECT ON DATABASE ${db} TO ${name}`);
  const roleUrl=new URL(connection.href);roleUrl.username=name;roleUrl.password=password;return{name,database:db,url:roleUrl.href};
 }
 async function owner(extra={}, databaseUrl=connection.href, raw){
 const input={schemaVersion:1,installationId:id,nodeId,origin:'https://owner.example',phase:'initial',...extra};
 assert.ok(existsSync(ownerHelper),'protected owner helper missing');
 return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[ownerHelper],{cwd:root,env:{...env,DATABASE_URL:databaseUrl,CASTLINK_CONTROL_PLANE_DATABASE_URL:databaseUrl,STUDIOLINK_DATA_DIR:data}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(raw??JSON.stringify(input));});
 }
 const output=path.join(data,'.castlink-owner',id,'owner-invite.txt');
 try{await run({pool,request,env,invoke,createRole,owner,output,data});}finally{await pool.end();for(let n=0;n<100;n++){const active=await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[db]);if(active.rows[0].n===0)break;await new Promise(r=>setTimeout(r,20));}await admin.query(`DROP DATABASE ${db}`);for(const role of roles)await admin.query(`DROP ROLE ${role}`);await admin.end();await rm(data,{recursive:true,force:true});}
}

async function seed(f){for(const phase of ['migrations','seed']){const r=await f.invoke(phase);assert.equal(r.code,0,r.stdout);}}
function ok(r){assert.equal(r.code,0,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.contract,'castlink-owner-v1');assert.equal(o.status,'verified');assert.doesNotMatch(r.stdout,/csa2\.|#access|token_hash|principal|access_version|postgresql:|PRIVATE/);return o;}
function refused(r,diagnosis){assert.equal(r.code,3,r.stdout+r.stderr);assert.equal(r.stderr,'');const o=JSON.parse(r.stdout);assert.equal(o.ok,false);if(diagnosis)assert.equal(o.diagnosis,diagnosis);assert.doesNotMatch(r.stdout,/csa2\.|#access|token_hash|postgresql:|PRIVATE|SELECT |INSERT /);return o;}
test('owner issues one protected durable invitation and verifies exact SQL on retry',()=>fixture(async f=>{
 await seed(f);const o=ok(await f.owner());assert.equal(o.filePath,f.output);assert.equal(o.origin,'https://owner.example');assert.equal(o.installationId,f.request.installationId);
 const text=await readFile(f.output,'utf8'),u=new URL(text.trim()),token=new URLSearchParams(u.hash.slice(1)).get('access');assert.match(token,/^csa2\.[A-Za-z0-9_-]{43}$/);assert.equal(u.pathname,'/super-admin');assert.equal((await lstat(f.output)).mode&0o777,0o600);
 const c=(await f.pool.query('SELECT * FROM castlink_control.platform_credentials')).rows;assert.equal(c.length,1);assert.equal(c[0].token_hash,createHash('sha256').update(token).digest('hex'));assert.equal(c[0].kind,'invite');assert.equal(c[0].issued_by,null);
 assert.ok(o.expiresAt>Date.now());assert.ok(o.expiresAt<=Date.now()+900000);assert.deepEqual(ok(await f.owner()),o);assert.equal(await readFile(f.output,'utf8'),text);
}));

test('real credential INSERT denial rolls back access version, preserves attempt and file, retries same credential',()=>fixture(async f=>{
 await seed(f);await f.pool.query('ALTER TABLE public.castlink_setup_bootstrap ADD COLUMN owner_receipt jsonb');const role=await f.createRole();
 await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT ALL ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; REVOKE INSERT ON castlink_control.platform_credentials FROM ${role.name}`);
 refused(await f.owner({},role.url));const before=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;
 assert.equal(before.status,'attempted');const text=await readFile(f.output,'utf8');assert.equal((await f.pool.query("SELECT access_version FROM castlink_control.platform_access WHERE access_key='super_admin_v2'")).rows[0].access_version,'');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);
 await f.pool.query(`GRANT INSERT ON castlink_control.platform_credentials TO ${role.name}`);ok(await f.owner({phase:'retained'},role.url));assert.equal(await readFile(f.output,'utf8'),text);const after=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;assert.deepEqual(after,{...before,status:'verified'});
}));
test('same database concurrent issuance and retries retain one credential and invite file',()=>fixture(async f=>{await seed(f);const results=await Promise.all([f.owner(),f.owner(),f.owner()]);results.forEach(ok);assert.deepEqual(JSON.parse(results[0].stdout),JSON.parse(results[1].stdout));assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,1);}));
for(const drift of ['missing','partial','permissions','symlink','hardlink'])test(`recorded ${drift} protected file refuses without replacement`,()=>fixture(async f=>{
 await seed(f);ok(await f.owner());const before=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;
 if(drift==='missing')await unlink(f.output);
 if(drift==='partial')await writeFile(f.output,'https://owner.example/super-admin#access=partial\n');
 if(drift==='permissions')await chmod(f.output,0o644);
 if(drift==='symlink'){await unlink(f.output);await require('node:fs/promises').symlink('/dev/null',f.output);}
 if(drift==='hardlink')await require('node:fs/promises').link(f.output,path.join(f.data,'other'));
 refused(await f.owner(),drift==='missing'?'owner-file-incomplete':'owner-file-conflict');assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt,before);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,1);
}));
for(const drift of ['consumed','expired','foreign version','foreign credential','deleted credential','foreign receipt','ledger DDL','topology','schema'])test(`actual ${drift} state refuses and never reissues`,()=>fixture(async f=>{
 await seed(f);ok(await f.owner());const text=await readFile(f.output,'utf8');
 const sql={consumed:'UPDATE castlink_control.platform_credentials SET consumed_at=now()',expired:"UPDATE castlink_control.platform_credentials SET expires_at=to_timestamp(1); UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{expiresAt}','1000')",'foreign version':"UPDATE castlink_control.platform_access SET access_version='foreign' WHERE access_key='super_admin_v2'",'foreign credential':"INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES(repeat('a',64),'session',gen_random_uuid(),'foreign',now())",'deleted credential':'DELETE FROM castlink_control.platform_credentials','foreign receipt':"UPDATE public.castlink_setup_bootstrap SET owner_receipt=jsonb_set(owner_receipt,'{principalId}',to_jsonb(gen_random_uuid()::text))",'ledger DDL':'ALTER TABLE public.castlink_setup_bootstrap ADD COLUMN foreign_column text',topology:"UPDATE castlink_control.nodes SET node_type='cloud'",schema:'ALTER TABLE castlink_control.platform_credentials DROP COLUMN issued_by'}[drift];await f.pool.query(sql);
 const before=await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap');refused(await f.owner(),drift==='expired'?'owner-invite-expired':drift==='consumed'?'owner-invite-consumed':undefined);assert.equal(await readFile(f.output,'utf8'),text);assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows,before.rows);
}));
test('no owner before seeded observed topology or for initial foreign access',()=>fixture(async f=>{
 refused(await f.owner());assert.equal(await existsSync(f.output),false);assert.equal((await f.invoke()).code,0);refused(await f.owner());assert.equal((await f.invoke('seed')).code,0);
 await f.pool.query("UPDATE castlink_control.platform_access SET access_version='foreign' WHERE access_key='super_admin_v2'");refused(await f.owner(),'owner-database-conflict');assert.equal(existsSync(f.output),false);assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='public.castlink_setup_bootstrap'::regclass AND attname='owner_receipt'")).rows[0].n,0);
}));
for(const origin of ['http://owner.example','https://owner.example/','https://owner.example/path','https://owner.example#access=secret','https://user:secret@owner.example'])test(`noncanonical origin refuses before SQL (${origin.split('#')[0]})`,()=>fixture(async f=>{refused(await f.owner({origin}),'owner-contract-refused');assert.equal((await f.pool.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t,null);}));
test('duplicate, noncanonical and extra sensitive stdin keys refuse before SQL',()=>fixture(async f=>{for(const raw of ['{"schemaVersion":1,"schemaVersion":1}',JSON.stringify({schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://owner.example',sql:'PRIVATE'}),' '+JSON.stringify({schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://owner.example',phase:'initial'})])refused(await f.owner({},undefined,raw),'owner-contract-refused');}));

test('lost SQL COMMIT reply retains committed credential and recovers exact private invitation',()=>fixture(async f=>{
 await seed(f);const net=require('node:net');let lost=false;const sockets=new Set();
 const upstream=new URL(url),proxy=net.createServer(down=>{
  const up=net.connect(Number(upstream.port||5432),upstream.hostname);sockets.add(up);sockets.add(down);let front=Buffer.alloc(0),back=Buffer.alloc(0),startup=true,commits=0,dropping=false;
  down.on('error',()=>{});up.on('error',()=>down.destroy());down.on('close',()=>{up.destroy();sockets.delete(down);sockets.delete(up);});
  down.on('data',chunk=>{
   front=Buffer.concat([front,chunk]);
   while(front.length>=(startup?4:5)){
    const length=startup?front.readInt32BE(0):front.readInt32BE(1)+1;if(front.length<length)break;
    const frame=front.subarray(0,length);front=front.subarray(length);
    if(startup)startup=false;else if(frame[0]===81&&frame.subarray(5,-1).toString()==='COMMIT'){commits++;if(commits===2&&!lost)dropping=true;}
    up.write(frame);
   }
  });
  up.on('data',chunk=>{back=Buffer.concat([back,chunk]);while(back.length>=5){const length=back.readInt32BE(1)+1;if(back.length<length)break;const frame=back.subarray(0,length);back=back.subarray(length);if(dropping){if(frame[0]===90){lost=true;down.destroy();up.destroy();}}else down.write(frame);}});
 });
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const proxyUrl=new URL(url);proxyUrl.port=String(proxy.address().port);proxyUrl.searchParams.set('sslmode','disable');
 // Keep the isolated fixture database selected through the proxy.
 const db=(await f.pool.query('SELECT current_database() AS db')).rows[0].db;proxyUrl.pathname='/'+db;
 try{refused(await f.owner({},proxyUrl.href));assert.equal(lost,true);const before=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;assert.equal(before.status,'verified');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,1);const text=await readFile(f.output,'utf8');ok(await f.owner());assert.equal(await readFile(f.output,'utf8'),text);assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt,before);
 }finally{for(const socket of sockets)socket.destroy();await new Promise(r=>proxy.close(r));}
}));
test('durable SQL attempt with missing file stays incomplete after actual SQL failure',()=>fixture(async f=>{
 await seed(f);await f.pool.query('ALTER TABLE public.castlink_setup_bootstrap ADD COLUMN owner_receipt jsonb');const role=await f.createRole();await f.pool.query(`GRANT USAGE ON SCHEMA public,castlink_control TO ${role.name}; GRANT ALL ON ALL TABLES IN SCHEMA public,castlink_control TO ${role.name}; REVOKE INSERT ON castlink_control.platform_credentials FROM ${role.name}`);
 refused(await f.owner({},role.url));const before=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;await unlink(f.output);refused(await f.owner(),'owner-file-incomplete');assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt,before);assert.equal(existsSync(f.output),false);
}));
test('private filesystem refusal does not issue credentials or durable owner attempt',()=>fixture(async f=>{
 await seed(f);await mkdir(path.join(f.data,'.castlink-owner'),{mode:0o755});await chmod(path.join(f.data,'.castlink-owner'),0o755);refused(await f.owner(),'owner-file-conflict');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='public.castlink_setup_bootstrap'::regclass AND attname='owner_receipt'")).rows[0].n,0);
}));
test('database export factoring preserves zero-access seed verification after issued owner',()=>fixture(async f=>{
 await seed(f);ok(await f.owner());const r=await f.invoke('seed');assert.equal(r.code,3);assert.equal(JSON.parse(r.stdout).diagnosis,'database-contract-refused');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,1);
}));
test('manual server CLI behavior remains protected, installer dispatch emits metadata only',()=>fixture(async f=>{
 await seed(f);const file=path.join(f.data,'manual-invite.txt');const run=(args,input)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(root,'scripts/super-admin-owner.mjs'),...args],{cwd:root,env:{...f.env,STUDIOLINK_DATA_DIR:f.data}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',code=>resolve({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(input);});
 const manual=await run(['--origin','https://owner.example','--output',file]);assert.equal(manual.code,0);assert.match(manual.stdout,/Owner invitation saved/);assert.doesNotMatch(manual.stdout,/csa2\.|#access/);assert.match(await readFile(file,'utf8'),/#access=csa2\./);assert.equal((await lstat(file)).mode&0o777,0o600);refused(await run(['--installer-v1'],JSON.stringify({schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://owner.example',phase:'initial'})),'owner-database-conflict');
}));
test('real filesystem write limit after durable attempt leaves incomplete file and refuses replacement',()=>fixture(async f=>{
 await seed(f);const input={schemaVersion:1,installationId:f.request.installationId,nodeId:f.request.nodeId,origin:'https://owner.example',phase:'initial'};
 const r=await new Promise((resolve,reject)=>{const p=spawn('bash',['-c','ulimit -f 0; exec "$1" "$2"','owner-file-failure',process.execPath,ownerHelper],{cwd:root,env:{...f.env,STUDIOLINK_DATA_DIR:f.data}}),out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));p.on('error',reject);p.on('close',(code,signal)=>resolve({code,signal,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));p.stdin.end(JSON.stringify(input));});
 assert.ok(r.code!==0);assert.doesNotMatch(r.stdout+r.stderr,/csa2\.|#access|postgresql:/);const before=(await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt;assert.equal(before.status,'attempted');assert.equal(await readFile(f.output,'utf8'),'');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);refused(await f.owner(),'owner-file-conflict');assert.equal(await readFile(f.output,'utf8'),'');assert.deepEqual((await f.pool.query('SELECT owner_receipt FROM castlink_setup_bootstrap')).rows[0].owner_receipt,before);
}));
test('actual platform redeem creates session then owner retry reports consumed without replacement',()=>fixture(async f=>{
 await seed(f);ok(await f.owner());const text=await readFile(f.output,'utf8');
 const source=`const fs=require('node:fs'),webRequire=require('node:module').createRequire(require('node:path').resolve('apps/web/package.json')),ts=webRequire('typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);const store=require('./apps/web/lib/control-plane-store.ts'),platform=require('./apps/web/lib/platform-credentials.ts');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{try{const url=new URL(fs.readFileSync(JSON.parse(input).filePath,'utf8').trim()),invite=new URLSearchParams(url.hash.slice(1)).get('access');if(!await platform.redeemPlatformInvite(invite))process.exitCode=1;}catch{process.exitCode=1;}finally{await store.closeControlPlanePool();}});`;
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',source],{cwd:root,env:f.env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',c=>{assert.equal(out,'');assert.equal(err,'');resolve(c);});p.stdin.end(JSON.stringify({filePath:f.output}));});assert.equal(code,0);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,2);refused(await f.owner(),'owner-invite-consumed');assert.equal(await readFile(f.output,'utf8'),text);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,2);
}));
test('retained installer call cannot issue when its durable SQL owner attempt is absent',()=>fixture(async f=>{await seed(f);refused(await f.owner({phase:'retained'}),'owner-attempt-incomplete');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);assert.equal(existsSync(f.output),false);}));
test('retained retry refuses missing SQL attempt and source after actual data loss without fresh issuance',()=>fixture(async f=>{await seed(f);ok(await f.owner());await f.pool.query("UPDATE castlink_setup_bootstrap SET owner_receipt=NULL; DELETE FROM castlink_control.platform_credentials; UPDATE castlink_control.platform_access SET access_version='' WHERE access_key='super_admin_v2'");await unlink(f.output);refused(await f.owner({phase:'retained'}),'owner-attempt-incomplete');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM castlink_control.platform_credentials')).rows[0].n,0);assert.equal(existsSync(f.output),false);}));
