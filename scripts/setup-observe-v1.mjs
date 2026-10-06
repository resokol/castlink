// Strict public setup/browser access observer; runtime has a separate fixed contract.
import {createRequire} from 'node:module';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {fail,keys,uuid,hash,validate,directory,readPrivate,observeSetupFile,ledger,completedTopology} from './setup-observer-internal-v1.mjs';
export {observeSetupFile} from './setup-observer-internal-v1.mjs';

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
