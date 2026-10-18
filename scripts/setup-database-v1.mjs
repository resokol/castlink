// Fixed installer image contract. No SQL, URL, program or credential arguments.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {schemaHash,assertNoExecutionHooks} from './setup-database-schema.mjs';
import {seedDefaultTransaction} from './control-plane-seed-transaction.mjs';

const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),{Pool}=require('pg');
const files={
 'postgres/001_rooms.sql':'f0ca87783a416607b204ac9f5bfa28cc75d2f85794f7e68e50658ffd694994fe',
 'postgres/002_studio_scope.sql':'e2250019544e0fc24b70cbadfbb2094fd33ac4340a9d1b38276ce817f17fce38',
 'postgres/003_diagnostic_room_revision.sql':'a3e5269441170af5446bb36d034eaa79053cd141f5fdd0ee6832de3da750eeaa',
 'postgres/004_room_creator_access.sql':'acb7f1097ff134c9a0692120a2611f85d44f7877fad522a1bd7fa13b6e0219d5',
 'postgres/005_server_staff_access.sql':'05cdbe55faaa1724ebca26d92dfebdae043118aeb83df66ee2fb1985020615d8',
 'postgres/006_caster_slots.sql':'ec6dc423b34238f3786c5d5caf2c2af1213717cc26670b9f73224b6a21bf0eb6',
 'control-plane/001_multitenant.sql':'b67129753ee06d8646cc93afba205a01603b13d62173d1ec18f9fd6ef692dd15',
 'control-plane/002_super_admin.sql':'5fcf035164caa398fb8a34017520102c60b08b3496f79bb2d44653639463c799',
 'control-plane/003_node_operational_state.sql':'0564fb4c6ddd3930c8541bb4e11728f758a9d9526b650824de42e701ba7975fc',
 'control-plane/004_platform_credentials.sql':'218376ddc37a21271b0ed1198b761bfb9e568a6da92442aea9e4b3a527b77c8c',
 'control-plane/005_node_operations.sql':'daa78388eb6892a3c0d91354ed7b337c1f54610d7808526d9d655b1ec472fc1f',
};
const expectedSchema='1792dd1cc939a122bb67f16fac66dfa901f72314c05910f542c94d84037b90a1';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const contentHash=hash(JSON.stringify(files));
const refusal=()=>{throw Error('refused');};
const relationSql=`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f') AND (n.nspname='castlink_control' OR n.nspname='public' AND c.relname<>'castlink_setup_bootstrap')`;
const ledgerSql=`CREATE TABLE public.castlink_setup_bootstrap (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 installation_id uuid NOT NULL,node_id text NOT NULL,content_hash text NOT NULL,
 migration_attempted boolean NOT NULL DEFAULT false,migrations_verified boolean NOT NULL DEFAULT false,
 seed_attempted boolean NOT NULL DEFAULT false,seed_verified boolean NOT NULL DEFAULT false)`;
export const tables=['public.castlink_schema_migrations','public.castlink_installations','public.castlink_rooms',
 'public.castlink_server_staff_access','public.castlink_caster_slots','public.castlink_guest_admissions',
 'castlink_control.accounts','castlink_control.organizations','castlink_control.organization_members',
 'castlink_control.nodes','castlink_control.studios','castlink_control.rooms','castlink_control.platform_access',
 'castlink_control.platform_credentials','castlink_control.participant_blocks'];
const defaults={organizationId:'org-default',studioId:'studio-default',accountId:'account-owner',nodeName:'Primary Node',nodeType:'self-hosted',nodeRegion:'local'};

async function input(){
 if(process.argv.length!==2)refusal();
 let bytes=0,chunks=[];for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>2048)refusal();chunks.push(chunk);}
 const raw=Buffer.concat(chunks).toString('utf8'),r=JSON.parse(raw);
 if(!r||Array.isArray(r)||Object.keys(r).sort().join(',')!=='installationId,nodeId,phase,schemaVersion'||r.schemaVersion!==1||!['migrations','seed'].includes(r.phase)||typeof r.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-',''))refusal();
 // CLI uses canonical JSON; duplicates, escaped aliases and extra whitespace
 // cannot create a second interpretation of this fixed private protocol.
 if(raw!==JSON.stringify(r))refusal();
 const e=process.env,url=e.DATABASE_URL?.trim();
 if(!url||e.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim()&&e.CASTLINK_CONTROL_PLANE_DATABASE_URL.trim()!==url||e.STUDIOLINK_INSTALLATION_ID!==r.installationId||e.CASTLINK_NODE_ID!==r.nodeId||e.CASTLINK_DEPLOYMENT_MODEL!=='self-hosted'||e.STUDIOLINK_DEFAULT_STUDIO_ID!=='studio-default')refusal();
 for(const [key,value] of Object.entries({CASTLINK_DEFAULT_ORGANIZATION_ID:'org-default',CASTLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ACCOUNT_ID:'account-owner',CASTLINK_NODE_TYPE:'self-hosted'}))if(e[key]!==undefined&&e[key]!==value)refusal();
 return{r,url};
}
export async function scripts(){
 const all=[];
 for(const dir of ['postgres','control-plane']){
  const base=path.resolve('infrastructure',dir),names=(await readdir(base)).filter(n=>/^\d.*\.sql$/.test(n)).sort();
  if(JSON.stringify(names)!==JSON.stringify(Object.keys(files).filter(n=>n.startsWith(dir+'/')).map(n=>n.slice(dir.length+1))))refusal();
  for(const name of names){const sql=await readFile(path.join(base,name),'utf8');if(hash(sql)!==files[dir+'/'+name])refusal();all.push(sql);}
 }
 return all;
}
export async function schema(client){
 if(await schemaHash(client)!==expectedSchema)refusal();
 const versions=await client.query('SELECT version FROM public.castlink_schema_migrations ORDER BY version');
 if(JSON.stringify(versions.rows)!==JSON.stringify([{version:1},{version:2},{version:3},{version:4},{version:5},{version:6}]))refusal();
 const access=await client.query("SELECT access_key FROM castlink_control.platform_access ORDER BY access_key");
 if(JSON.stringify(access.rows)!==JSON.stringify([{access_key:'super_admin'},{access_key:'super_admin_v2'}]))refusal();
}
async function seedObservation(client,r){
 await absentAccess(client);return seedTopology(client,r);
}
export async function seedTopology(client,r){
 // Exact bootstrap topology. Unrelated identities are never adopted or overwritten.
 const observations={};
 const checks={
  installations:["public.castlink_installations","installation_id=$1",[r.installationId]],
  accounts:["castlink_control.accounts","account_id='account-owner'",[]],
  organizations:["castlink_control.organizations","organization_id='org-default'",[]],
  memberships:["castlink_control.organization_members","organization_id='org-default' AND account_id='account-owner' AND role='owner'",[]],
  nodes:["castlink_control.nodes","node_id=$1 AND node_type='self-hosted'",[r.nodeId]],
  studios:["castlink_control.studios","studio_id='studio-default' AND organization_id='org-default' AND assignment_mode='pinned' AND assigned_node_id=$1",[r.nodeId]],
 };
 for(const [key,[table,condition,args]] of Object.entries(checks)){
  const count=await client.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE ${condition})::int AS matched FROM ${table}`,args);
  if(count.rows[0].total!==1||count.rows[0].matched!==1)refusal();observations[key]=1;
 }
 // Installer does not import JSON-room passwords. A fresh SQL source is empty;
 // even same-id preexisting rooms require a separate explicit store migration.
 for(const table of ['public.castlink_rooms','castlink_control.rooms'])if((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0)refusal();
 observations.rooms=0;return observations;
}
async function emptySeed(client){
 for(const table of ['public.castlink_installations','public.castlink_rooms','castlink_control.accounts','castlink_control.organizations','castlink_control.organization_members','castlink_control.nodes','castlink_control.studios','castlink_control.rooms','castlink_control.platform_credentials','castlink_control.participant_blocks'])if((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0)refusal();
 await absentAccess(client);
}
async function absentAccess(client){
 // Required both before and AFTER writes, and on every verified seed retry.
 // Existing access is operator-owned state; refuse it, never reset/adopt it.
 for(const table of ['castlink_control.platform_credentials','castlink_control.participant_blocks'])if((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0)refusal();
 const access=await client.query("SELECT access_key,access_version FROM castlink_control.platform_access ORDER BY access_key");
 if(JSON.stringify(access.rows)!==JSON.stringify([{access_key:'super_admin',access_version:''},{access_key:'super_admin_v2',access_version:''}]))refusal();
}
async function bootstrap(){
 const {r,url}=await input(),sql=await scripts();
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:3000,statement_timeout:10000,application_name:'castlink-setup-database-v1'});
 let client;
 try{
  client=await pool.connect();await client.query('SET search_path TO pg_catalog,public');
  if(Number((await client.query('SHOW server_version_num')).rows[0].server_version_num)<160000||Number((await client.query('SHOW server_version_num')).rows[0].server_version_num)>=170000)refusal();
  // One DATABASE-scoped session lock covers both phase transactions and durable
  // attempt commits. Foreign installation IDs cannot race to claim a pristine DB.
  await client.query('SELECT pg_advisory_lock(1128352843,1)');
  await assertNoExecutionHooks(client);
  // Only after rejecting public routines/hooks may canonical unqualified SQL
  // create its application tables in public instead of the system namespace.
  await client.query('SET search_path TO public,pg_catalog');
  const exists=(await client.query("SELECT to_regclass('public.castlink_setup_bootstrap') AS t")).rows[0].t;
  if(!exists){
   if(r.phase!=='migrations'||(await client.query(relationSql)).rows[0].n!==0)refusal();
   await client.query('BEGIN');await client.query(ledgerSql);
   await client.query('INSERT INTO public.castlink_setup_bootstrap(singleton,installation_id,node_id,content_hash,migration_attempted) VALUES(true,$1,$2,$3,true)',[r.installationId,r.nodeId,contentHash]);await client.query('COMMIT');
  }
  const rows=await client.query('SELECT * FROM public.castlink_setup_bootstrap');
  if(rows.rowCount!==1)refusal();const record=rows.rows[0];
  if(record.singleton!==true||record.installation_id!==r.installationId||record.node_id!==r.nodeId||record.content_hash!==contentHash||record.migration_attempted!==true)refusal();
  if(!record.migrations_verified){
   if(r.phase!=='migrations'||record.seed_attempted||record.seed_verified||(await client.query(relationSql)).rows[0].n!==0)refusal();
   await client.query('BEGIN');for(const statement of sql)await client.query(statement);await schema(client);
   await client.query('UPDATE public.castlink_setup_bootstrap SET migrations_verified=true');await client.query('COMMIT');
  }
  // Lock actual relations as well: direct SQL writers/DDL cannot interleave the
  // observed schema/topology checks and default writes in this transaction.
  await client.query('BEGIN');await client.query('LOCK TABLE '+tables.join(',')+' IN ACCESS EXCLUSIVE MODE');await schema(client);
  let seed=null;
  if(r.phase==='seed'){
   if(record.seed_verified)seed=await seedObservation(client,r);
   else{
    await emptySeed(client);
    // Durable attempt before seed effects, with session advisory lock retained.
    await client.query('UPDATE public.castlink_setup_bootstrap SET seed_attempted=true');await client.query('COMMIT');
    await client.query('BEGIN');await client.query('LOCK TABLE '+tables.join(',')+' IN ACCESS EXCLUSIVE MODE');await schema(client);await emptySeed(client);
    await client.query('INSERT INTO public.castlink_installations(installation_id) VALUES($1)',[r.installationId]);
    const rooms=await client.query("SELECT name,studio_only FROM public.castlink_rooms WHERE installation_id=$1 AND studio_id='studio-default' ORDER BY sort_order,name",[r.installationId]);
    await seedDefaultTransaction(client,{...defaults,nodeId:r.nodeId},rooms);
    seed=await seedObservation(client,r);await client.query('UPDATE public.castlink_setup_bootstrap SET seed_verified=true');
   }
  }
  await client.query('COMMIT');
  return{schemaVersion:1,contract:'castlink-database-v1',phase:r.phase,installationId:r.installationId,nodeId:r.nodeId,migrations:{roomVersions:[1,2,3,4,5,6],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed};
 }finally{
  if(client){await client.query('ROLLBACK').catch(()=>{});await client.query('SELECT pg_advisory_unlock(1128352843,1)').catch(()=>{});client.release();}await pool.end();
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
try{console.log(JSON.stringify(await bootstrap()));}catch{
 // Never serialize SQL, credentials, dependency errors or process output.
 console.log(JSON.stringify({schemaVersion:1,contract:'castlink-database-v1',ok:false,diagnosis:'database-contract-refused'}));process.exitCode=3;
}
}
