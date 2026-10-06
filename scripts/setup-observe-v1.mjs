// Fixed read-only image contract. This observer never repairs SQL or files.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {lstat,open,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const fail=()=>{throw Error('setup-observation-refused');};
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===names.split(',').sort().join(',');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
function validate(r){
 if(!keys(r,'schemaVersion,installationId,nodeId,origin,serverName')||r.schemaVersion!==1||!uuid(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||typeof r.serverName!=='string'||!r.serverName||r.serverName.trim()!==r.serverName||r.serverName.length>120||/[\x00-\x1f\x7f]/.test(r.serverName))fail();
 const u=new URL(r.origin);if(u.protocol!=='https:'||u.origin!==r.origin||u.username||u.password)fail();return r;
}
async function directory(dir,privateMode){
 if(!path.isAbsolute(dir)||path.resolve(dir)!==dir||dir==='/')fail();let at='/';
 for(const part of dir.split('/').filter(Boolean)){at=path.join(at,part);const s=await lstat(at);if(s.isSymbolicLink()||!s.isDirectory())fail();}
 const s=await lstat(dir);if(s.uid!==process.getuid()||privateMode&&(s.mode&0o777)!==0o700)fail();
}
async function present(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function readPrivate(file){
 const before=await lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.uid!==process.getuid()||(before.mode&0o777)!==0o600||before.nlink!==1||before.size>2048)fail();
 const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const held=await h.stat();if(held.dev!==before.dev||held.ino!==before.ino)fail();const buffer=Buffer.alloc(2049);let size=0;for(;;){const {bytesRead}=await h.read(buffer,size,buffer.length-size,null);if(bytesRead===0)break;size+=bytesRead;if(size>2048)fail();}const raw=buffer.subarray(0,size);const after=await lstat(file);if(after.dev!==held.dev||after.ino!==held.ino||after.size!==raw.length||after.mode!==held.mode||after.mtimeMs!==held.mtimeMs)fail();return raw;}finally{await h.close();}
}
export async function observeSetupFile(data,r){
 validate(r);await directory(data,false);const runtime=path.join(data,'runtime');
 if(!await present(runtime))return 'pending';await directory(runtime,true);
 if(await present(path.join(runtime,'castlink-setup.lock')))fail();
 const file=path.join(runtime,'castlink-setup.json');if(!await present(file))return 'pending';
 const raw=await readPrivate(file),state=JSON.parse(raw.toString('utf8'));
 // Reject duplicate keys as well as extra fields in this small fixed schema.
 const text=raw.toString('utf8');if(text!==JSON.stringify(state)&&text!==JSON.stringify(state,null,2)+'\n')fail();
 if(isDeepStrictEqual(state,{schemaVersion:1}))return 'pending';
 if(!keys(state,'schemaVersion,completedAt,serverName,mode')||state.schemaVersion!==1||state.serverName!==r.serverName||state.mode!=='public'||typeof state.completedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(state.completedAt)||new Date(state.completedAt).toISOString()!==state.completedAt)fail();
 return 'complete';
}
async function ledger(c){
 const x=(await c.query(`SELECT c.relkind,c.relrowsecurity,c.relforcerowsecurity,
 (SELECT json_agg(json_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT json_agg(json_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
 (SELECT json_agg(json_build_array(i.relname,pg_get_indexdef(x.indexrelid),x.indisvalid,x.indisready) ORDER BY i.relname) FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=c.oid) AS indexes
 FROM pg_class c WHERE c.oid=to_regclass('public.castlink_setup_bootstrap')`)).rows[0];
 const col=(n,t,nn,d=null)=>[n,t,nn,d,'',''];
 const expected={relkind:'r',relrowsecurity:false,relforcerowsecurity:false,columns:[col('singleton','boolean',true,'true'),col('installation_id','uuid',true),col('node_id','text',true),col('content_hash','text',true),...['migration_attempted','migrations_verified','seed_attempted','seed_verified'].map(n=>col(n,'boolean',true,'false')),col('owner_receipt','jsonb',false)],constraints:[['castlink_setup_bootstrap_pkey','p','PRIMARY KEY (singleton)',true,false,false],['castlink_setup_bootstrap_singleton_check','c','CHECK (singleton)',true,false,false]],indexes:[['castlink_setup_bootstrap_pkey','CREATE UNIQUE INDEX castlink_setup_bootstrap_pkey ON public.castlink_setup_bootstrap USING btree (singleton)',true,true]]};
 if(!isDeepStrictEqual(x,expected))fail();
}
async function completedTopology(c,r){
 // A protected completed setup may have runtime rooms and participant revocations.
 // Keep the exact seeded authority footprint; never adopt another installation.
 const checks=[
  ['public.castlink_installations','installation_id=$1',[r.installationId]],
  ['castlink_control.accounts',"account_id='account-owner'",[]],
  ['castlink_control.organizations',"organization_id='org-default'",[]],
  ['castlink_control.organization_members',"organization_id='org-default' AND account_id='account-owner' AND role='owner'",[]],
  ['castlink_control.nodes',"node_id=$1 AND node_type='self-hosted'",[r.nodeId]],
  ['castlink_control.studios',"studio_id='studio-default' AND organization_id='org-default' AND assignment_mode='pinned' AND assigned_node_id=$1",[r.nodeId]],
 ];
 for(const [table,condition,args] of checks){
  const x=(await c.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE ${condition})::int AS matched FROM ${table}`,args)).rows[0];
  if(x.total!==1||x.matched!==1)fail();
 }
 for(const [table,condition,args] of [
  ['public.castlink_rooms',"installation_id=$1 AND studio_id='studio-default'",[r.installationId]],
  ['castlink_control.rooms',"studio_id='studio-default'",[]],
  ['castlink_control.participant_blocks','node_id=$1',[r.nodeId]],
 ])if((await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE NOT (${condition})`,args)).rows[0].n!==0)fail();
}
export async function observeServer({request:r,connectionString,dataDirectory}){
 validate(r);const {scripts,schema,seedTopology,contentHash}=await import('./setup-database-v1.mjs');await scripts();const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{Pool}=require('pg');
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:3000,statement_timeout:10000,application_name:'castlink-setup-observe-v1'});pool.on('error',()=>{});let c;
 try{
  c=await pool.connect();c.on('error',()=>{});await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query('SET LOCAL search_path TO pg_catalog,public');
  const version=Number((await c.query('SHOW server_version_num')).rows[0].server_version_num);if(version<160000||version>=170000)fail();
  await schema(c);await ledger(c);
  await directory(dataDirectory,false);const setup=await observeSetupFile(dataDirectory,r);
  if(setup==='complete')await completedTopology(c,r);
  else{await seedTopology(c,r);if((await c.query('SELECT count(*)::int AS n FROM castlink_control.participant_blocks')).rows[0].n!==0)fail();}
  const rows=(await c.query('SELECT * FROM public.castlink_setup_bootstrap')).rows;if(rows.length!==1)fail();const b=rows[0];
  if(b.singleton!==true||b.installation_id!==r.installationId||b.node_id!==r.nodeId||b.content_hash!==contentHash||b.migration_attempted!==true||b.migrations_verified!==true||b.seed_attempted!==true||b.seed_verified!==true)fail();
  const o=b.owner_receipt;
  if(!keys(o,'schemaVersion,attemptId,origin,expiresAt,tokenHash,principalId,accessVersion,status')||o.schemaVersion!==1||!uuid(o.attemptId)||!uuid(o.principalId)||!uuid(o.accessVersion)||o.origin!==r.origin||!Number.isSafeInteger(o.expiresAt)||!/^[a-f0-9]{64}$/.test(o.tokenHash)||o.status!=='verified')fail();
  const access=(await c.query('SELECT access_key,access_version FROM castlink_control.platform_access ORDER BY access_key')).rows;
  if(!isDeepStrictEqual(access,[{access_key:'super_admin',access_version:''},{access_key:'super_admin_v2',access_version:o.accessVersion}]))fail();
  const credentials=(await c.query('SELECT token_hash,kind,principal_id,issued_by,access_version,expires_at,consumed_at FROM castlink_control.platform_credentials')).rows;
  const invites=credentials.filter(x=>x.token_hash===o.tokenHash);if(invites.length!==1)fail();const invite=invites[0];
  if(invite.kind!=='invite'||invite.principal_id!==o.principalId||invite.issued_by!==null||invite.access_version!==o.accessVersion||Number(invite.expires_at)!==o.expiresAt)fail();
  const sessions=credentials.filter(x=>x!==invite);if(sessions.some(x=>x.kind!=='session'||x.principal_id!==o.principalId||x.access_version!==o.accessVersion||x.issued_by!==null||x.consumed_at!==null||!/^[a-f0-9]{64}$/.test(x.token_hash)))fail();
  let ownerAccess;
  if(invite.consumed_at===null){if(sessions.length||o.expiresAt<=Date.now())fail();ownerAccess='invite';}
  else{if(!Number.isFinite(Number(invite.consumed_at))||!sessions.some(x=>Number(x.expires_at)>Date.now()))fail();ownerAccess='session';}
  const base=path.join(dataDirectory,'.castlink-owner'),dir=path.join(base,r.installationId);await directory(base,true);await directory(dir,true);
  if(!isDeepStrictEqual(await readdir(dir),['owner-invite.txt']))fail();const file=path.join(dir,'owner-invite.txt'),raw=await readPrivate(file),text=raw.toString('utf8'),u=new URL(text.trim()),token=new URLSearchParams(u.hash.slice(1)).get('access');
  const expected=new URL('/super-admin',r.origin);expected.hash=new URLSearchParams({access:token}).toString();
  if(typeof token!=='string'||!/^csa2\.[A-Za-z0-9_-]{43}$/.test(token)||hash(token)!==o.tokenHash||text!==expected.href+'\n')fail();
  if(!(await readPrivate(file)).equals(raw)||await observeSetupFile(dataDirectory,r)!==setup)fail();
  await c.query('COMMIT');return{schemaVersion:1,contract:'castlink-setup-observe-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,sql:'verified',ownerAccess,setup};
 }finally{if(c){await c.query('ROLLBACK').catch(()=>{});c.release();}await pool.end();}
}
export async function observerMain(){
 try{
  if(process.argv.length!==2)fail();let size=0,chunks=[];for await(const b of process.stdin){size+=b.length;if(size>2048)fail();chunks.push(b);}const raw=Buffer.concat(chunks).toString('utf8'),r=JSON.parse(raw);validate(r);if(raw!==JSON.stringify(r))fail();
  const e=process.env,url=e.DATABASE_URL?.trim();
  if(!url||e.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim()&&e.CASTLINK_CONTROL_PLANE_DATABASE_URL.trim()!==url||e.STUDIOLINK_INSTALLATION_ID!==r.installationId||e.CASTLINK_NODE_ID!==r.nodeId||e.CASTLINK_DEPLOYMENT_MODEL!=='self-hosted'||e.STUDIOLINK_DEFAULT_STUDIO_ID!=='studio-default'||!e.STUDIOLINK_DATA_DIR)fail();
  for(const [key,value] of Object.entries({CASTLINK_DEFAULT_ORGANIZATION_ID:'org-default',CASTLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ACCOUNT_ID:'account-owner',CASTLINK_NODE_TYPE:'self-hosted'}))if(e[key]!==undefined&&e[key]!==value)fail();
  console.log(JSON.stringify(await observeServer({request:r,connectionString:url,dataDirectory:e.STUDIOLINK_DATA_DIR})));
 }catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-observe-v1',ok:false,diagnosis:'setup-observation-refused'}));process.exitCode=3;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await observerMain();
