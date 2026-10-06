// Fixed private runtime authority, never public browser access or a SQL repair.
import {createRequire} from 'node:module';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {keys,uuid,hash,validate,directory,readPrivate,observeSetupFile,ledger,completedTopology} from './setup-observer-internal-v1.mjs';
const fail=()=>{throw Error('runtime-authority-refused')};

export async function observeRuntimeAuthority({request:r,connectionString,dataDirectory}){
 validate(r);const {scripts,schema,contentHash}=await import('./setup-database-v1.mjs');await scripts();
 const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{Pool}=require('pg');
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:3000,statement_timeout:10000,application_name:'castlink-runtime-authority-v1'});pool.on('error',()=>{});let c;
 try{
  c=await pool.connect();c.on('error',()=>{});await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query('SET LOCAL search_path TO pg_catalog,public');
  const version=Number((await c.query('SHOW server_version_num')).rows[0].server_version_num);if(version<160000||version>=170000)fail();
  await schema(c);await ledger(c);await directory(dataDirectory,false);
  if(await observeSetupFile(dataDirectory,r)!=='complete')fail();await completedTopology(c,r);
  const rows=(await c.query('SELECT * FROM public.castlink_setup_bootstrap')).rows;if(rows.length!==1)fail();const b=rows[0];
  if(b.singleton!==true||b.installation_id!==r.installationId||b.node_id!==r.nodeId||b.content_hash!==contentHash||b.migration_attempted!==true||b.migrations_verified!==true||b.seed_attempted!==true||b.seed_verified!==true)fail();
  const o=b.owner_receipt;
  if(!keys(o,'schemaVersion,attemptId,origin,expiresAt,tokenHash,principalId,accessVersion,status')||o.schemaVersion!==1||!uuid(o.attemptId)||!uuid(o.principalId)||!uuid(o.accessVersion)||o.origin!==r.origin||!Number.isSafeInteger(o.expiresAt)||typeof o.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(o.tokenHash)||o.status!=='verified')fail();
  // Retain exact ORIGINAL invite evidence, not the currently valid access grant.
  // Canonical redemption/revocation preserve this row. Never mint or adopt one.
  const original=(await c.query('SELECT token_hash,kind,principal_id,issued_by,access_version,expires_at FROM castlink_control.platform_credentials WHERE token_hash=$1',[o.tokenHash])).rows;
  if(original.length===0)throw Error('runtime-original-owner-evidence-missing');if(original.length!==1)fail();const invite=original[0];
  if(invite.kind!=='invite'||invite.principal_id!==o.principalId||invite.issued_by!==null||invite.access_version!==o.accessVersion||Number(invite.expires_at)!==o.expiresAt)fail();
  const base=path.join(dataDirectory,'.castlink-owner'),dir=path.join(base,r.installationId);await directory(base,true);await directory(dir,true);
  if(!isDeepStrictEqual(await readdir(dir),['owner-invite.txt']))fail();const file=path.join(dir,'owner-invite.txt'),raw=await readPrivate(file),text=raw.toString('utf8'),u=new URL(text.trim()),token=new URLSearchParams(u.hash.slice(1)).get('access');
  const expected=new URL('/super-admin',r.origin);expected.hash=new URLSearchParams({access:token}).toString();
  if(typeof token!=='string'||!/^csa2\.[A-Za-z0-9_-]{43}$/.test(token)||hash(token)!==o.tokenHash||text!==expected.href+'\n')fail();
  if(!(await readPrivate(file)).equals(raw)||await observeSetupFile(dataDirectory,r)!=='complete')fail();
  await c.query('COMMIT');return{schemaVersion:1,contract:'castlink-runtime-authority-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,sql:'verified',setup:'complete',authority:'verified'};
 }finally{if(c){await c.query('ROLLBACK').catch(()=>{});c.release()}await pool.end()}
}

export async function runtimeObserverMain(){
 try{
  if(process.argv.length!==2)fail();let size=0,chunks=[];for await(const b of process.stdin){size+=b.length;if(size>2048)fail();chunks.push(b)}const raw=Buffer.concat(chunks).toString('utf8'),r=JSON.parse(raw);validate(r);if(raw!==JSON.stringify(r))fail();
  const e=process.env,url=e.DATABASE_URL?.trim();
  if(!url||e.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim()&&e.CASTLINK_CONTROL_PLANE_DATABASE_URL.trim()!==url||e.STUDIOLINK_INSTALLATION_ID!==r.installationId||e.CASTLINK_NODE_ID!==r.nodeId||e.CASTLINK_DEPLOYMENT_MODEL!=='self-hosted'||e.STUDIOLINK_DEFAULT_STUDIO_ID!=='studio-default'||!e.STUDIOLINK_DATA_DIR)fail();
  for(const [key,value] of Object.entries({CASTLINK_DEFAULT_ORGANIZATION_ID:'org-default',CASTLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ACCOUNT_ID:'account-owner',CASTLINK_NODE_TYPE:'self-hosted'}))if(e[key]!==undefined&&e[key]!==value)fail();
  console.log(JSON.stringify(await observeRuntimeAuthority({request:r,connectionString:url,dataDirectory:e.STUDIOLINK_DATA_DIR})));
 }catch(error){const diagnosis=error?.message==='runtime-original-owner-evidence-missing'?'runtime-original-owner-evidence-missing':'runtime-authority-refused';console.log(JSON.stringify({schemaVersion:1,contract:'castlink-runtime-authority-v1',ok:false,diagnosis}));process.exitCode=3}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runtimeObserverMain();
