// Fixed private installer protocol. No bearer/SQL/URLs in arguments or output.
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {scripts,schema,seedTopology,contentHash,tables} from './setup-database-v1.mjs';
import {assertNoExecutionHooks} from './setup-database-schema.mjs';
import {OwnerRefusal,refuse,exists,ownerFile,readInvite,writeInvite} from './setup-owner-protected.mjs';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{Pool}=require('pg');
const hash=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k.split(',').sort().join(',');
export function validateRequest(r){
 if(!keys(r,'schemaVersion,installationId,nodeId,origin,phase')||r.schemaVersion!==1||!['initial','retained'].includes(r.phase)||!uuid(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-',''))refuse('owner-contract-refused');
 let u;try{u=new URL(r.origin);}catch{refuse('owner-contract-refused');}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.origin!==r.origin)refuse('owner-contract-refused');
 return r;
}
// The application schema excludes only this internal table; validate its exact
// columns, constraints, indexes and RLS before accepting or extending its DDL.
async function ledgerDDL(c,extended){
 const x=(await c.query(`SELECT c.relkind,c.relrowsecurity,c.relforcerowsecurity,
 (SELECT json_agg(json_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT json_agg(json_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
 (SELECT json_agg(json_build_array(i.relname,pg_get_indexdef(x.indexrelid),x.indisvalid,x.indisready) ORDER BY i.relname) FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=c.oid) AS indexes
 FROM pg_class c WHERE c.oid=to_regclass('public.castlink_setup_bootstrap')`)).rows[0];
 const col=(n,t,nn,d=null)=>[n,t,nn,d,'',''];
 const expected={relkind:'r',relrowsecurity:false,relforcerowsecurity:false,columns:[col('singleton','boolean',true,'true'),col('installation_id','uuid',true),col('node_id','text',true),col('content_hash','text',true),...['migration_attempted','migrations_verified','seed_attempted','seed_verified'].map(n=>col(n,'boolean',true,'false')),...(extended?[col('owner_receipt','jsonb',false)]:[])],constraints:[['castlink_setup_bootstrap_pkey','p','PRIMARY KEY (singleton)',true,false,false],['castlink_setup_bootstrap_singleton_check','c','CHECK (singleton)',true,false,false]],indexes:[['castlink_setup_bootstrap_pkey','CREATE UNIQUE INDEX castlink_setup_bootstrap_pkey ON public.castlink_setup_bootstrap USING btree (singleton)',true,true]]};
 if(!isDeepStrictEqual(x,expected))refuse('owner-database-conflict');
}
async function receipt(c,r){
 const rows=await c.query('SELECT * FROM public.castlink_setup_bootstrap');if(rows.rowCount!==1)refuse('owner-database-conflict');const b=rows.rows[0];
 if(b.singleton!==true||b.installation_id!==r.installationId||b.node_id!==r.nodeId||b.content_hash!==contentHash||!b.migration_attempted||!b.migrations_verified||!b.seed_attempted||!b.seed_verified)refuse('owner-database-conflict');
 const o=b.owner_receipt;if(o!==null&&o!==undefined){
  if(!keys(o,'schemaVersion,attemptId,origin,expiresAt,tokenHash,principalId,accessVersion,status')||o.schemaVersion!==1||!uuid(o.attemptId)||!uuid(o.principalId)||!uuid(o.accessVersion)||o.origin!==r.origin||!Number.isSafeInteger(o.expiresAt)||!/^[a-f0-9]{64}$/.test(o.tokenHash)||!['attempted','verified'].includes(o.status))refuse('owner-database-conflict');
 }
 return o;
}
async function topology(c,r){await schema(c);await seedTopology(c,r);if((await c.query('SELECT count(*)::int AS n FROM castlink_control.participant_blocks')).rows[0].n!==0)refuse('owner-database-conflict');}
async function access(c,o){
 const a=(await c.query('SELECT access_key,access_version FROM castlink_control.platform_access ORDER BY access_key')).rows;
 const all=(await c.query('SELECT token_hash,kind,principal_id,issued_by,access_version,expires_at,consumed_at FROM castlink_control.platform_credentials')).rows;
 const empty=isDeepStrictEqual(a,[{access_key:'super_admin',access_version:''},{access_key:'super_admin_v2',access_version:''}])&&all.length===0;
 if(empty)return false;
 if(!o||!isDeepStrictEqual(a,[{access_key:'super_admin',access_version:''},{access_key:'super_admin_v2',access_version:o.accessVersion}]))refuse('owner-database-conflict');
 const recorded=all.filter(row=>row.token_hash===o.tokenHash);if(recorded.length!==1)refuse('owner-database-conflict');const row=recorded[0];if(row.token_hash!==o.tokenHash||row.kind!=='invite'||row.principal_id!==o.principalId||row.issued_by!==null||row.access_version!==o.accessVersion||Number(row.expires_at)!==o.expiresAt)refuse('owner-database-conflict');
 // Real redemption retains the consumed invite and creates platform sessions.
 // Recognize only sessions belonging to this recorded principal/version.
 if(row.consumed_at!==null&&all.every(x=>x===row||x.kind==='session'&&x.principal_id===o.principalId&&x.access_version===o.accessVersion&&x.issued_by===null))refuse('owner-invite-consumed');
 if(all.length!==1||row.consumed_at!==null)refuse('owner-database-conflict');return true;
}
async function fileProof(file,o){
 if(!await exists(file))refuse('owner-file-incomplete');
 let text,u,token;try{text=await readInvite(file);u=new URL(text.trim());token=new URLSearchParams(u.hash.slice(1)).get('access');}catch(e){if(e instanceof OwnerRefusal)throw e;refuse('owner-file-conflict');}
 const expected=new URL('/super-admin',o.origin);expected.hash=new URLSearchParams({access:token}).toString();
 if(typeof token!=='string'||!/^csa2\.[A-Za-z0-9_-]{43}$/.test(token)||hash(token)!==o.tokenHash||text!==expected.href+'\n')refuse('owner-file-conflict');
}
export async function prepareOwner({request:r,connectionString,dataDirectory}){
 validateRequest(r);await scripts();const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:3000,statement_timeout:10000,application_name:'castlink-setup-owner-v1'});
 // pg also emits asynchronous connection errors. Handle them privately; query
 // rejection still reaches the fixed public diagnosis without a stack trace.
 pool.on('error',()=>{});let c;
 try{
  c=await pool.connect();c.on('error',()=>{});await c.query('SET search_path TO pg_catalog,public');
  const version=Number((await c.query('SHOW server_version_num')).rows[0].server_version_num);if(version<160000||version>=170000)refuse('owner-database-conflict');
  await c.query('SELECT pg_advisory_lock(1128352843,1)');await assertNoExecutionHooks(c);
  // Do not extend a foreign or partially migrated ledger.
  const extended=(await c.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid=to_regclass('public.castlink_setup_bootstrap') AND attname='owner_receipt' AND NOT attisdropped")).rows[0].n===1;
  await ledgerDDL(c,extended);
  await c.query('BEGIN');await c.query('LOCK TABLE public.castlink_setup_bootstrap,'+tables.join(',')+' IN ACCESS EXCLUSIVE MODE');
  await topology(c,r);let o=await receipt(c,r);let issued=await access(c,o);
  const file=await ownerFile(dataDirectory,r.installationId);
  if(!o){
   if(r.phase!=='initial')refuse('owner-attempt-incomplete');
   if(issued||await exists(file))refuse('owner-file-conflict');
   if(!extended)await c.query('ALTER TABLE public.castlink_setup_bootstrap ADD COLUMN owner_receipt jsonb');
   const token=`csa2.${randomBytes(32).toString('base64url')}`;
   o={schemaVersion:1,attemptId:randomUUID(),origin:r.origin,expiresAt:Date.now()+900000,tokenHash:hash(token),principalId:randomUUID(),accessVersion:randomUUID(),status:'attempted'};
   await c.query('UPDATE public.castlink_setup_bootstrap SET owner_receipt=$1',[o]);await c.query('COMMIT');
   // This session retains the singleton advisory lock across durable attempt,
   // fsync and credential commit. A missing file on retry is never regenerated.
   const u=new URL('/super-admin',r.origin);u.hash=new URLSearchParams({access:token}).toString();await writeInvite(file,u.href+'\n');
  }else{await c.query('COMMIT');if(o.status==='verified'&&!issued)refuse('owner-database-conflict');}
  await fileProof(file,o);if(o.expiresAt<=Date.now())refuse('owner-invite-expired');
  await c.query('BEGIN');await c.query('LOCK TABLE public.castlink_setup_bootstrap,'+tables.join(',')+' IN ACCESS EXCLUSIVE MODE');
  await ledgerDDL(c,true);await topology(c,r);if(!isDeepStrictEqual(await receipt(c,r),o))refuse('owner-database-conflict');issued=await access(c,o);await fileProof(file,o);
  if(!issued){
   await c.query("UPDATE castlink_control.platform_access SET access_version=$1,updated_at=now() WHERE access_key='super_admin_v2' AND access_version=''",[o.accessVersion]);
   await c.query("INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at) VALUES($1,'invite',$2,$3,to_timestamp($4::double precision/1000))",[o.tokenHash,o.principalId,o.accessVersion,o.expiresAt]);
  }
  o={...o,status:'verified'};await c.query('UPDATE public.castlink_setup_bootstrap SET owner_receipt=$1',[o]);await c.query('COMMIT');
  // Lost COMMIT replies remain retryable through the same file and SQL receipt.
  await c.query('BEGIN');await c.query('LOCK TABLE public.castlink_setup_bootstrap,'+tables.join(',')+' IN ACCESS EXCLUSIVE MODE');await ledgerDDL(c,true);await topology(c,r);if(!isDeepStrictEqual(await receipt(c,r),o)||!await access(c,o))refuse('owner-database-conflict');await fileProof(file,o);if(o.expiresAt<=Date.now())refuse('owner-invite-expired');await c.query('COMMIT');
  return{schemaVersion:1,contract:'castlink-owner-v1',installationId:r.installationId,nodeId:r.nodeId,filePath:file,origin:r.origin,status:'verified',expiresAt:o.expiresAt};
 }finally{if(c){await c.query('ROLLBACK').catch(()=>{});await c.query('SELECT pg_advisory_unlock(1128352843,1)').catch(()=>{});c.release();}await pool.end();}
}
export async function installerMain(){
 try{
  let size=0,chunks=[];for await(const b of process.stdin){size+=b.length;if(size>2048)refuse('owner-contract-refused');chunks.push(b);}const raw=Buffer.concat(chunks).toString('utf8');let r;try{r=JSON.parse(raw);}catch{refuse('owner-contract-refused');}validateRequest(r);if(raw!==JSON.stringify(r))refuse('owner-contract-refused');
  const e=process.env,url=e.DATABASE_URL?.trim();if(!url||e.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim()&&e.CASTLINK_CONTROL_PLANE_DATABASE_URL.trim()!==url||e.STUDIOLINK_INSTALLATION_ID!==r.installationId||e.CASTLINK_NODE_ID!==r.nodeId||e.CASTLINK_DEPLOYMENT_MODEL!=='self-hosted'||e.STUDIOLINK_DEFAULT_STUDIO_ID!=='studio-default'||!e.STUDIOLINK_DATA_DIR)refuse('owner-contract-refused');
  for(const [key,value] of Object.entries({CASTLINK_DEFAULT_ORGANIZATION_ID:'org-default',CASTLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ACCOUNT_ID:'account-owner',CASTLINK_NODE_TYPE:'self-hosted'}))if(e[key]!==undefined&&e[key]!==value)refuse('owner-contract-refused');
  console.log(JSON.stringify(await prepareOwner({request:r,connectionString:url,dataDirectory:e.STUDIOLINK_DATA_DIR})));
 }catch(e){console.log(JSON.stringify({schemaVersion:1,contract:'castlink-owner-v1',ok:false,diagnosis:e instanceof OwnerRefusal?e.diagnosis:'owner-contract-refused'}));process.exitCode=3;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==2){console.log(JSON.stringify({schemaVersion:1,contract:'castlink-owner-v1',ok:false,diagnosis:'owner-contract-refused'}));process.exitCode=3;}else await installerMain();}
