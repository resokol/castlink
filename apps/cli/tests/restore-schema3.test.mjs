import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {restoreSupport,restoreTarget} from '../dist/restore-target.js';
import {createColdRestore} from '../dist/restore.js';

const require=createRequire(import.meta.url),installationId='12345678-1234-4234-8234-123456789abc';
const setup=await readFile(new URL('../../../scripts/setup-database-v1.mjs',import.meta.url),'utf8');
const migrationFiles=JSON.parse(setup.match(/const files=(\{[\s\S]*?\});/)[1].replaceAll("'",'"').replace(/,\s*}/,'}'));
const contentHash=createHash('sha256').update(JSON.stringify(migrationFiles)).digest('hex');
const bootstrap={singleton:true,installation_id:installationId,node_id:'srv-'+installationId.replaceAll('-',''),content_hash:contentHash,migration_attempted:true,migrations_verified:true,seed_attempted:true,seed_verified:true};
const tables=['public.castlink_schema_migrations','public.castlink_installations','public.castlink_setup_bootstrap','public.castlink_rooms','public.castlink_server_staff_access','public.castlink_caster_slots','public.castlink_guest_admissions','castlink_control.accounts','castlink_control.organizations','castlink_control.organization_members','castlink_control.nodes','castlink_control.studios','castlink_control.rooms','castlink_control.platform_access','castlink_control.platform_credentials','castlink_control.participant_blocks'];
const dumpData=Buffer.from(tables.map(t=>t==='public.castlink_rooms'?`COPY ${t} (installation_id, studio_id, name, password_hash, password_ciphertext, studio_only, transfer_room_id, admin_access_version, guest_invite_version, viewer_access_version, output_access_version, diagnostic_creation_id, diagnostic_revision, creator_access_id, studio_password_hash, slot_association_id) FROM stdin;\n\\.\n`:t.startsWith('public.castlink_')&&['public.castlink_server_staff_access','public.castlink_caster_slots','public.castlink_guest_admissions'].includes(t)?`COPY ${t} (installation_id, scope, state) FROM stdin;\nfixture-installation\tfixture-scope\t{"grant":"${t}"}\n\\.\n`:`COPY ${t} (value) FROM stdin;\nretained\n\\.\n`).join('\n'));
const security=new Function('require',restoreSupport+';return security;')(require);
const snapshotCode=restoreTarget.slice(restoreTarget.indexOf(' const identitySql='),restoreTarget.indexOf(' const webEntries='));
function snapshot({versions='1,2,3,4,5,6',record=[bootstrap],canonical='probe',hooks='t',schema='same schema',data=dumpData}={}){
 const calls=[],probe=Error('canonical-schema-query-reached');
 const docker=(args)=>{calls.push(args);if(args.includes('psql')){const sql=args.at(-1);if(sql.includes('current_database()'))return Buffer.from('castlink|castlink|'+installationId+'|'+installationId);if(sql.includes('pg_event_trigger'))return Buffer.from(hooks);if(sql.includes('string_agg(version'))return Buffer.from(versions);if(sql.includes('content_hash'))return Buffer.from(JSON.stringify(record));if(sql.includes('json_agg')){if(canonical==='probe')throw probe;return Buffer.from(canonical)}throw Error('unexpected-query')}
 if(args.includes('pg_dump'))return Buffer.from('current dump');if(args.includes('--schema-only'))return Buffer.from(schema);if(args.includes('--data-only'))return data;throw Error('unexpected-command')};
 const run=new Function('require','r','pg','backupSchema','backupSecurity',restoreSupport+'\n'+snapshotCode+'\nreturn sqlSnapshot();');
 return {calls,probe,run:()=>run(name=>name==='node:child_process'?{execFileSync:(executable,args)=>{assert.equal(executable,'docker');return docker(args)}}:require(name),{installationId},{Id:'1'.repeat(64)},'same schema',security(dumpData))};
}

test('current schema3 ledger and exact completed bootstrap reach the canonical schema guard',()=>{
 const s=snapshot();assert.throws(s.run,e=>e===s.probe);assert.equal(s.calls.some(a=>a.includes('pg_dump')),false);
});
test('legacy schema2 refuses before any database dump or effect',()=>{
 const s=snapshot({versions:'1,2'});assert.throws(s.run,/cold-restore-unverified/);assert.equal(s.calls.some(a=>a.includes('pg_dump')),false);
});
test('schema3 refuses foreign incomplete duplicated or incorrect bootstrap provenance',()=>{
 for(const record of [[{...bootstrap,content_hash:'b'.repeat(64)}],[{...bootstrap,installation_id:'foreign'}],[{...bootstrap,node_id:'srv-foreign'}],[],[bootstrap,bootstrap],...['singleton','migration_attempted','migrations_verified','seed_attempted','seed_verified'].map(k=>[{...bootstrap,[k]:false}])]){
  const s=snapshot({record});assert.throws(s.run,/cold-restore-unverified/);assert.equal(s.calls.some(a=>a.includes('pg_dump')),false);
 }
});
test('equally foreign live and backup schema cannot satisfy the fixed schema3 fingerprint',()=>{
 const s=snapshot({canonical:'[]'});assert.throws(s.run,/cold-restore-unverified/);assert.equal(s.calls.some(a=>a.includes('pg_dump')),false);
});
test('execution hooks refuse before schema/provenance queries or dump',()=>{
 const s=snapshot({hooks:'f'});assert.throws(s.run,/cold-restore-unverified/);assert.equal(s.calls.length,1);assert.match(s.calls[0].at(-1),/pg_event_trigger/);assert.equal(s.calls.some(a=>a.includes('pg_dump')),false);
});
test('fixed restore schema3 migration hashes match actual setup source bytes and fingerprint',async()=>{
 const contract=new Function('require',restoreSupport+';return restoreDatabaseContract;')(require);
 assert.equal(contract.contract,'castlink-restore-schema3-v1');assert.deepEqual(contract.files,migrationFiles);assert.equal(contract.contentHash,contentHash);
 assert.equal(contract.schemaSHA256,setup.match(/const expectedSchema='([a-f0-9]+)'/)[1]);
 for(const [file,digest]of Object.entries(contract.files))assert.equal(createHash('sha256').update(await readFile(new URL('../../../infrastructure/'+file,import.meta.url))).digest('hex'),digest);
 const schemaHelper=await readFile(new URL('../../../scripts/setup-database-schema.mjs',import.meta.url),'utf8');
 const canonicalQuery=schemaHelper.match(/const result = await client.query\(`([\s\S]*?)`\);/)[1];
 assert.equal(contract.schemaQuery,'SELECT coalesce(json_agg(snapshot), \'[]\'::json)::text FROM ('+canonicalQuery+') snapshot;');
});
test('library refusal diagnoses the current schema3 requirement and legacy boundary without effects',async()=>{
 let effects=0;
 await assert.rejects(()=>createColdRestore({request:{target:{kind:'local'}}},{},{run:async()=>effects++},{lock:async()=>effects++}),e=>e.code===4&&/schema3/.test(e.message)&&/Legacy schema2/.test(e.message));
 assert.equal(effects,0);
});

for(const table of ['public.castlink_server_staff_access','public.castlink_caster_slots','public.castlink_guest_admissions'])test(`security projection preserves every ${table} grant and refuses missing state`,()=>{
 const original=security(dumpData),changed=Buffer.from(dumpData.toString().replace(`{"grant":"${table}"}`,`{"grant":"revoked-${table}"}`));
 assert.notEqual(security(changed),original);
 const malformed=Buffer.from(dumpData.toString().replace(`COPY ${table} (installation_id, scope, state) FROM stdin;`,`COPY ${table} (installation_id, scope, value) FROM stdin;`));
 assert.throws(()=>security(malformed),/cold-restore-unverified/);
});
for(const column of ['creator_access_id','studio_password_hash','slot_association_id'])test(`security projection requires room ${column}`,()=>{
 assert.throws(()=>security(Buffer.from(dumpData.toString().replace(', '+column,''))),/cold-restore-unverified/);
});
