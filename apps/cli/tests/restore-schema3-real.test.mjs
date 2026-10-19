// SQL slice only: this does not replace the four-resource cold restore proof.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,statfs} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {restoreSupport,restoreTarget} from '../dist/restore-target.js';
import {fileURLToPath} from 'node:url';
import {fixtureDockerSelector,fixtureCapacityPaths,fixtureDockerEnvironment} from './restore-schema3-fixture.mjs';

const require=createRequire(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
test('actual PG16 current-schema3 snapshot guard preserves auth across same-version SQL restore',{
 skip:process.env.CASTLINK_RESTORE_SCHEMA3_PROOF!=='1',timeout:120000
},async()=>{
 const marker='castlink-restore-schema3-'+randomUUID(),installationId=randomUUID();
 const image='postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea';
 const env=fixtureDockerEnvironment(process.env),selector=fixtureDockerSelector(process.platform);
 const workspace=fileURLToPath(new URL('../../../',import.meta.url)),capacityPaths=fixtureCapacityPaths(process.platform,workspace);
 let selectedVerified=false;
 const docker=(args,input,maxBuffer=64*1024*1024)=>{
  try{return execFileSync('docker',[...selector,...args],{env,input,encoding:null,timeout:15000,maxBuffer,shell:false,stdio:['pipe','pipe','pipe']})}
  catch{throw Error('Owned PG fixture command failed: '+args.slice(0,2).join(' '))}
 };
 const contract=new Function('require',restoreSupport+';return restoreDatabaseContract;')(require);
 const parsers=new Function('require',restoreSupport+';return {schema,security};')(require);
 const snapshotCode=restoreTarget.slice(restoreTarget.indexOf(' const identitySql='),restoreTarget.indexOf(' const webEntries='));
 let pg,checks=0;
 async function reserve(phase,minimumMiB){const f=await statfs(capacityPaths[0]),t=await statfs(capacityPaths[1]),freeMiB=Math.floor(f.bavail*f.bsize/1048576),tmpFreeMiB=Math.floor(t.bavail*t.bsize/1048576);console.log(JSON.stringify({phase,freeMiB,tmpFreeMiB,minimumMiB}));assert.ok(freeMiB>=minimumMiB&&tmpFreeMiB>=128,'Owned PG fixture capacity reserve unavailable')}
 const query=sql=>docker(['exec',pg,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','castlink','-d','castlink','-c',sql],undefined,1048576).toString().trim();
 try{
  // Actual first create used ~577MiB of vfs disk; retain >=300MiB reserve.
  // PGDATA128MiB, run8MiB, tmp8MiB are bounded tmpfs, not extra disk copies.
  await reserve('before-owned-pg',920);
  if(process.platform==='win32')assert.equal(JSON.parse(docker(['context','inspect','desktop-linux','--format','{{json .Endpoints.docker.Host}}']).toString()),'npipe:////./pipe/dockerDesktopLinuxEngine');
  assert.equal(docker(['version','--format','{{.Server.Os}}|{{.Server.Arch}}']).toString().trim(),'linux|amd64');selectedVerified=true;
  let cached;try{cached=JSON.parse(docker(['image','inspect','--format','{{json .}}',image]).toString())}catch{throw Error('Pinned PG image not cached; proof pending. Separate authorized pull required: '+image)}
  assert.equal(cached.Os,'linux');assert.equal(cached.Architecture,'amd64');assert.match(cached.Id,/^sha256:[a-f0-9]{64}$/);
  pg=docker(['run','--detach','--pull','never','--network','none','--read-only','--name',marker,
   '--label','castlink.disposable-proof='+marker,'--memory','256m','--memory-swap','256m','--pids-limit','128',
   '--tmpfs','/var/lib/postgresql/data:rw,size=134217728,mode=700',
   '--tmpfs','/var/run/postgresql:rw,size=8388608,mode=1777','--tmpfs','/tmp:rw,size=8388608,mode=1777',
   '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=castlink','-e','POSTGRES_DB=castlink',image]).toString().trim();
  assert.match(pg,/^[a-f0-9]{64}$/);
  const actual=JSON.parse(docker(['container','inspect','--format','{{json .}}',pg]).toString());
  assert.equal(actual.Image,cached.Id);assert.equal(actual.Config.Labels['castlink.disposable-proof'],marker);
  assert.equal(actual.HostConfig.NetworkMode,'none');assert.deepEqual(actual.HostConfig.PortBindings,{});
  assert.equal(actual.Mounts.some(m=>m.Type==='volume'),false);
  let ready=false;for(let i=0;i<150;i++){try{if(query('SELECT 1;')==='1'){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.equal(ready,true);
  await reserve('owned-pg-ready',300);
  for(const [file,digest]of Object.entries(contract.files)){
   const bytes=await readFile(new URL('../../../infrastructure/'+file,import.meta.url));assert.equal(hash(bytes),digest);query(bytes.toString());
  }
  const node='srv-'+installationId.replaceAll('-','');
  query(`CREATE TABLE public.castlink_setup_bootstrap (
   singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),installation_id uuid NOT NULL,node_id text NOT NULL,content_hash text NOT NULL,
   migration_attempted boolean NOT NULL DEFAULT false,migrations_verified boolean NOT NULL DEFAULT false,
   seed_attempted boolean NOT NULL DEFAULT false,seed_verified boolean NOT NULL DEFAULT false);
   INSERT INTO public.castlink_setup_bootstrap VALUES(true,'${installationId}','${node}','${contract.contentHash}',true,true,true,true);
   INSERT INTO public.castlink_installations(installation_id) VALUES('${installationId}');
   INSERT INTO public.castlink_rooms(installation_id,name,password_hash,guest_invite_version,sort_order,diagnostic_creation_id,diagnostic_revision)
    VALUES('${installationId}','proof-room','fixture-password','fixture-epoch',7,'${randomUUID()}','${randomUUID()}');
   INSERT INTO castlink_control.accounts(account_id) VALUES('account-owner');
   INSERT INTO castlink_control.organizations VALUES('org-default','Default',now());
   INSERT INTO castlink_control.organization_members VALUES('org-default','account-owner','owner');
   INSERT INTO castlink_control.nodes(node_id,name,region,node_type) VALUES('${node}','Fixture','fixture','self-hosted');
   INSERT INTO castlink_control.studios(studio_id,organization_id,name,assigned_node_id,owner_access_version)
    VALUES('studio-default','org-default','Fixture','${node}','fixture-owner');
   UPDATE castlink_control.platform_access SET access_version='fixture-access';
   INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at)
    VALUES('${'a'.repeat(64)}','invite','${installationId}','fixture-access',now()+interval '1 day'),
          ('${'b'.repeat(64)}','session','${installationId}','fixture-access',now()+interval '1 day');`);
  const creatorAccessId=randomUUID(),slotAssociationId=randomUUID();
  query(`UPDATE public.castlink_rooms SET creator_access_id='${creatorAccessId}',studio_password_hash='fixture-studio-password',slot_association_id='${slotAssociationId}' WHERE name='proof-room';
   INSERT INTO public.castlink_server_staff_access VALUES('${installationId}','proof-scope','{"grant":"staff"}');
   INSERT INTO public.castlink_caster_slots VALUES('${installationId}','proof-scope','{"grant":"slot"}');
   INSERT INTO public.castlink_guest_admissions VALUES('${installationId}','proof-scope','{"grant":"admission"}');`);
  const dump=()=>docker(['exec',pg,'pg_dump','--format=custom','--no-owner','--no-acl','--username=castlink','--dbname=castlink']);
  const render=(flag,b)=>docker(['exec','-i',pg,'pg_restore',flag,'--no-owner','--no-acl','--file=/dev/stdout'],b);
  const backup=dump(),backupSchema=parsers.schema(render('--schema-only',backup)),backupSecurity=parsers.security(render('--data-only',backup));
  const runSnapshot=new Function('require','r','pg','backupSchema','backupSecurity',restoreSupport+'\n'+snapshotCode+'\nreturn sqlSnapshot();');
  const nativeRequire=name=>name==='node:child_process'?{execFileSync:(executable,args,options)=>{assert.equal(executable,'docker');return docker(args,options.input,options.maxBuffer)}}:require(name);
  const guard=()=>runSnapshot(nativeRequire,{installationId},{Id:pg},backupSchema,backupSecurity);
  guard();checks++;console.log(JSON.stringify({schema3Accepted:true,schemaSHA256:hash(Buffer.from(JSON.stringify(JSON.parse(query(contract.schemaQuery))))),backupSHA256:hash(backup),protectedAuthSHA256:backupSecurity}));
  query("UPDATE public.castlink_rooms SET sort_order=99 WHERE name='proof-room';");guard();checks++;
  const changes=[
   ['room-creator',`UPDATE public.castlink_rooms SET creator_access_id='${randomUUID()}' WHERE name='proof-room';`,`UPDATE public.castlink_rooms SET creator_access_id='${creatorAccessId}' WHERE name='proof-room';`],
   ['studio-password',"UPDATE public.castlink_rooms SET studio_password_hash='revoked' WHERE name='proof-room';","UPDATE public.castlink_rooms SET studio_password_hash='fixture-studio-password' WHERE name='proof-room';"],
   ['slot-association',`UPDATE public.castlink_rooms SET slot_association_id='${randomUUID()}' WHERE name='proof-room';`,`UPDATE public.castlink_rooms SET slot_association_id='${slotAssociationId}' WHERE name='proof-room';`],
   ['staff-grant',`UPDATE public.castlink_server_staff_access SET state='{"grant":"revoked"}';`,`UPDATE public.castlink_server_staff_access SET state='{"grant":"staff"}';`],
   ['slot-grant',`UPDATE public.castlink_caster_slots SET state='{"grant":"revoked"}';`,`UPDATE public.castlink_caster_slots SET state='{"grant":"slot"}';`],
   ['guest-admission',`UPDATE public.castlink_guest_admissions SET state='{"grant":"revoked"}';`,`UPDATE public.castlink_guest_admissions SET state='{"grant":"admission"}';`],
   ['consumed-invite',"UPDATE castlink_control.platform_credentials SET consumed_at=now() WHERE kind='invite';","UPDATE castlink_control.platform_credentials SET consumed_at=NULL WHERE kind='invite';"],
   ['revoked-session',"UPDATE castlink_control.platform_credentials SET access_version='revoked' WHERE kind='session';","UPDATE castlink_control.platform_credentials SET access_version='fixture-access' WHERE kind='session';"],
   ['participant-block',`INSERT INTO castlink_control.participant_blocks VALUES('${node}','proof-room','blocked',now()+interval '1 day',now());`,'DELETE FROM castlink_control.participant_blocks;'],
   ['owner-grant',"UPDATE castlink_control.organization_members SET role='member';","UPDATE castlink_control.organization_members SET role='owner';"],
   ['foreign-schema','ALTER TABLE public.castlink_rooms ADD COLUMN unexpected text;','ALTER TABLE public.castlink_rooms DROP COLUMN unexpected;'],
   ['wrong-migration-hash',"UPDATE public.castlink_setup_bootstrap SET content_hash='foreign';",`UPDATE public.castlink_setup_bootstrap SET content_hash='${contract.contentHash}';`]
  ];
  for(const [name,change,revert]of changes){query(change);assert.throws(guard,/cold-restore-unverified/);assert.equal(query("SELECT sort_order FROM public.castlink_rooms WHERE name='proof-room';"),'99');query(revert);guard();checks++;console.log('Pre-write refusal: '+name)}
  query("CREATE FUNCTION public.fixture_hook() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';");assert.throws(guard,/cold-restore-unverified/);checks++;
  query('CREATE TRIGGER fixture_hook BEFORE UPDATE ON public.castlink_rooms FOR EACH ROW EXECUTE FUNCTION public.fixture_hook();');assert.throws(guard,/cold-restore-unverified/);checks++;
  query('DROP TRIGGER fixture_hook ON public.castlink_rooms;DROP FUNCTION public.fixture_hook();');guard();
  await reserve('before-same-version-sql-restore',300);
  docker(['exec','-i',pg,'pg_restore','--clean','--if-exists','--single-transaction','--exit-on-error','--no-owner','--no-acl','-U','castlink','-d','castlink'],backup);
  guard();assert.equal(query("SELECT sort_order FROM public.castlink_rooms WHERE name='proof-room';"),'7');assert.equal(parsers.security(render('--data-only',dump())),backupSecurity);checks++;
  for(const [table,column]of [['castlink_rooms','creator_access_id'],['castlink_rooms','studio_password_hash'],['castlink_rooms','slot_association_id'],['castlink_server_staff_access','state'],['castlink_caster_slots','state'],['castlink_guest_admissions','state']]){
   query('ALTER TABLE public.'+table+' DROP COLUMN '+column+';');assert.throws(guard,/cold-restore-unverified/);
   docker(['exec','-i',pg,'pg_restore','--clean','--if-exists','--single-transaction','--exit-on-error','--no-owner','--no-acl','-U','castlink','-d','castlink'],backup);
   guard();checks++;console.log('Missing authorization field refused and exact backup restored: '+table+'.'+column);
  }
  query('DELETE FROM public.castlink_schema_migrations WHERE version=3;');assert.throws(guard,/cold-restore-unverified/);checks++;
  console.log(JSON.stringify({checks,actualSQLRestore:true,authPreserved:true,temporaryPostgresStarted:true,fullColdRestoreProven:false,permanentStackStarted:false}));
 }finally{
  if(selectedVerified){const remaining=docker(['container','ls','--all','--no-trunc','--filter','label=castlink.disposable-proof='+marker,'--format','{{.ID}}']).toString().trim().split('\n').filter(Boolean);assert.ok(remaining.length<=1);
  for(const id of remaining){assert.match(id,/^[a-f0-9]{64}$/);const a=JSON.parse(docker(['container','inspect','--format','{{json .}}',id]).toString());assert.equal(a.Id,id);assert.equal(a.Name,'/'+marker);assert.equal(a.Config.Labels['castlink.disposable-proof'],marker);docker(['rm','--force','--volumes',id]);}
  assert.equal(docker(['container','ls','--all','--filter','label=castlink.disposable-proof='+marker,'--format','{{.ID}}']).toString().trim(),'');
  console.log('Exact owned PG fixture cleanup verified: '+marker);}
 }
});
