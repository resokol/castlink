import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {mkdtemp,mkdir,writeFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {coldRuntimeObservation,updateTarget} from '../dist/update-target.js';
const require=createRequire(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const id='12345678-1234-4234-8234-123456789abc';
const input={installationId:id,nodeId:'srv-'+id.replaceAll('-',''),origin:'https://example.test',serverName:'Fixture',release:'1.0.0-proof.current3'};
const authority={schemaVersion:1,contract:'castlink-runtime-authority-v1',installationId:id,nodeId:input.nodeId,origin:input.origin,serverName:input.serverName,sql:'verified',setup:'complete',authority:'verified'};
async function runtime(value=authority){
 const handlers={},output=[],imports=[];let exit;
 const context={require:()=>({}),process:{env:{DATABASE_URL:'private-fixture'},stdin:{on:(k,v)=>handlers[k]=v},exit:n=>{exit=n;throw Error('refused')}},console:{log:s=>output.push(JSON.parse(s))},fetch:async()=>({status:200,json:async()=>({buildId:input.release,version:input.release,productVersion:'1.0.0'})}),AbortSignal,
  importFixture:async specifier=>{imports.push(specifier);return {observeRuntimeAuthority:async()=>value,observeServer:async()=>({...value,ownerAccess:'invite'})}}};
 new vm.Script(coldRuntimeObservation.replace(/import\('([^']+)'\)/,'globalThis.importFixture("$1")')).runInNewContext(context);
 handlers.data(JSON.stringify(input));await handlers.end().catch(()=>{});return {imports,output,exit};
}
test('cold runtime uses immutable private runtime authority without public invite admission',async()=>{
 const r=await runtime();assert.deepEqual(r.imports,['/app/scripts/runtime-startup-observe-v1.mjs']);assert.equal(r.exit,undefined);assert.equal(r.output.length,1);assert.equal(r.output[0].authority,'verified');assert.equal(Object.hasOwn(r.output[0],'ownerAccess'),false);
});
test('cold runtime refuses wrong incomplete or foreign private authority observations',async()=>{
 for(const value of [{...authority,authority:'unverified'},{...authority,contract:'castlink-setup-observe-v1'},{...authority,installationId:'foreign'},{...authority,nodeId:'foreign'},{...authority,origin:'https://foreign.test'},{...authority,setup:'pending'},{...authority,extra:'private'}]){const r=await runtime(value);assert.equal(r.exit,4);assert.equal(r.output.length,0)}
});

const setup=await readFile(new URL('../../../scripts/setup-database-v1.mjs',import.meta.url),'utf8');
const files=JSON.parse(setup.match(/const files=(\{[\s\S]*?\});/)[1].replaceAll("'",'"').replace(/,\s*}/,'}'));
const helpers=['setup-database-v1.mjs','setup-database-schema.mjs','runtime-startup-observe-v1.mjs','setup-observer-internal-v1.mjs','control-plane-seed-transaction.mjs'];
const sources=Object.fromEntries(await Promise.all([...Object.keys(files).map(n=>'infrastructure/'+n),...helpers.map(n=>'scripts/'+n),'scripts/setup-observe-v1.mjs'].map(async n=>[n,await readFile(new URL('../../../'+n,import.meta.url))])));
const expected=Object.fromEntries([...Object.keys(files).map(n=>['infrastructure/'+n,files[n]]),...helpers.map(n=>['scripts/'+n,hash(sources['scripts/'+n])])]);
const prefix=updateTarget.split('let updateInput=')[0];
function image(copies=sources){const visited=[];const run=new Function('require','copies','visited',prefix+';copyFile=(id,name)=>{visited.push(name);if(!copies[name])throw Error("missing-source-file");return copies[name]};return imageContract("fixture");');return {visited,run:()=>run(require,copies,visited)}}
test('source and candidate image contracts pin exact current3 SQL and the complete private runtime helper closure',()=>{
 const r=image();assert.deepEqual(r.run(),expected);assert.equal(r.visited.length,13);
});
test('image contract rejects modified or missing migration and private helper bytes',()=>{
 for(const name of ['infrastructure/postgres/003_diagnostic_room_revision.sql',...helpers.map(n=>'scripts/'+n)]){const changed={...sources,[name]:Buffer.concat([sources[name],Buffer.from('\n-- modified fixture')])};assert.throws(image(changed).run,/cold-restore-unverified/);const missing={...sources};delete missing[name];assert.throws(image(missing).run)}
});
test('current3 SQL guard observes exact ledger/bootstrap before dumping any authoritative data',()=>{
 const fragment=updateTarget.slice(updateTarget.indexOf(' function sqlSnapshot(){'),updateTarget.indexOf(' function runtime(',updateTarget.indexOf(' function sqlSnapshot(){')));
 const calls=[],probe=Error('canonical-schema-query-reached'),contentHash=hash(Buffer.from(JSON.stringify(files)));
 const fakeRequire=n=>n==='node:child_process'?{execFileSync:(_,args)=>{calls.push(args);if(args.includes('psql')){const sql=args.at(-1);if(sql.includes('pg_event_trigger'))return Buffer.from('t');if(sql.includes('string_agg(version'))return Buffer.from('1,2,3');if(sql.includes('content_hash'))return Buffer.from(JSON.stringify([{singleton:true,installation_id:id,node_id:input.nodeId,content_hash:contentHash,migration_attempted:true,migrations_verified:true,seed_attempted:true,seed_verified:true}]));if(sql.includes('json_agg'))throw probe;throw Error('unexpected-query')}throw Error('dump-before-current-contract')}}:require(n);
 const run=new Function('require','pg','id',prefix+fragment+';return sqlSnapshot();');assert.throws(()=>run(fakeRequire,{Id:'a'.repeat(64)},id),e=>e===probe);assert.equal(calls.some(a=>a.includes('pg_dump')),false);
});
test('current3 SQL rejects legacy ledger foreign bootstrap unsafe hooks and schema drift before dump',()=>{
 const fragment=updateTarget.slice(updateTarget.indexOf(' function sqlSnapshot(){'),updateTarget.indexOf(' function runtime(',updateTarget.indexOf(' function sqlSnapshot(){')));
 const bootstrap={singleton:true,installation_id:id,node_id:input.nodeId,content_hash:hash(Buffer.from(JSON.stringify(files))),migration_attempted:true,migrations_verified:true,seed_attempted:true,seed_verified:true};
 for(const change of ['legacy-ledger','foreign-installation','wrong-content-hash','incomplete-seed','unsafe-hook','schema-drift']){
  const calls=[],b={...bootstrap};if(change==='foreign-installation')b.installation_id='foreign';if(change==='wrong-content-hash')b.content_hash='a'.repeat(64);if(change==='incomplete-seed')b.seed_verified=false;
  const fakeRequire=n=>n==='node:child_process'?{execFileSync:(_,args)=>{calls.push(args);if(!args.includes('psql'))throw Error('unexpected-dump');const sql=args.at(-1);if(sql.includes('pg_event_trigger'))return Buffer.from(change==='unsafe-hook'?'f':'t');if(sql.includes('string_agg(version'))return Buffer.from(change==='legacy-ledger'?'1,2':'1,2,3');if(sql.includes('content_hash'))return Buffer.from(JSON.stringify([b]));if(sql.includes('json_agg'))return Buffer.from('[]');throw Error('unexpected-query')}}:require(n);
  const run=new Function('require','pg','id',prefix+fragment+';return sqlSnapshot();');assert.throws(()=>run(fakeRequire,{Id:'a'.repeat(64)},id),/cold-restore-unverified/);assert.equal(calls.some(a=>a.includes('pg_dump')),false,change);
 }
});
test('metadata write faults retain partial intent, authoritative profile and held owner without a success checkpoint',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'castlink-update-schema3-metadata-'));
 const start=updateTarget.indexOf("failurePhase='metadata-commit';"),end=updateTarget.indexOf("\n record('checkpoint.json'",start),fragment=updateTarget.slice(start,end),caught=updateTarget.slice(updateTarget.lastIndexOf(' }catch')).replace(/\}\);\s*$/,'');
 assert.ok(start>0&&end>start);
 try{for(const boundary of ['owner.json','setup-completion.json','scope-services']){
  const base=path.join(directory,boundary),home=path.join(base,'home'),scope=path.join(home,'.castlink-target-operations'),active=path.join(scope,'active'),root=path.join(base,'bundle'),journal=path.join(base,'journal'),attempt=path.join(base,'attempt'),profilePath=path.join(base,'profile','profile.json');
  for(const d of [base,home,scope,active,root,journal,attempt,path.dirname(profilePath)])await mkdir(d,{mode:0o700});
  const owner={principal:process.getuid(),scope,epoch:0,nonce:'metadata-fixture'},ownerFile=path.join(active,'owner.json');await writeFile(ownerFile,JSON.stringify(owner),{mode:0o600});
  const p={installationId:id,request:{root,release:'1.0.0'},currentRelease:'1.0.0'},profileBytes=Buffer.from(JSON.stringify(p));await writeFile(profilePath,profileBytes,{mode:0o600});
  const oldReceipt=Buffer.from(JSON.stringify({schemaVersion:1,installationId:id,release:'prior'}));
  for(const n of ['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'])await writeFile(path.join(root,n),n==='receipt.json'?oldReceipt:'{}',{mode:0o600});
  await writeFile(path.join(journal,'setup-completion.json'),JSON.stringify({schemaVersion:1}),{mode:0o600});
  for(const n of ['services-'+id+'.json','resources-'+id+'.json'])await writeFile(path.join(scope,n),'{}',{mode:0o600});
  await writeFile(path.join(attempt,'intent.json'),JSON.stringify({schemaVersion:1,fixtureOnly:true}),{mode:0o600});
  const lease={active,scope,owner,stat:await stat(active)},next={release:'1.0.1',images:Object.fromEntries(['postgres','web','livekit','caddy'].map(s=>[s,{reference:'fixture/'+s+'@sha256:'+'b'.repeat(64)}]))};
  const q={next,preparation:{},input:{architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1'},profilePath},state={exit:null,writes:[]};
  const prelude=`leaseOs.userInfo=()=>({uid:process.getuid(),homedir:home});let failureDirectory=attempt,failurePhase='cold-post';const privateExpected=new Map(),post={containers:[],volumes:[],networks:[]},priorRuntime={},candidateRuntime={},auth='retained-auth',sourceMigration={},newWeb={Id:'candidate-web'},newContract={},ownerAttempt={},g={engine:'fixture-engine',endpoint:'unix:///fixture'};
   const nativeAtomic=atomic;atomic=(name,bytes)=>{if(boundary==='scope-services'?name===path.join(scope,'services-'+id+'.json'):name===path.join(journal,boundary))throw Error('PRIVATE_METADATA_FAULT');nativeAtomic(name,bytes);state.writes.push(name)};
   docker=()=>Buffer.from(JSON.stringify({Id:'fixture-image',RepoDigests:[]}));serviceConfig=()=>{throw Error('Unexpected post predicate')};
   const record=(name,value)=>fs.writeFileSync(path.join(attempt,name),JSON.stringify(value)+'\\n',{flag:'wx',mode:384});`;
  const run=new Function('require','home','scope','root','journal','attempt','id','p','q','lease','boundary','state','process',prefix+prelude+'try{'+fragment+caught);
  run(require,home,scope,root,journal,attempt,id,p,q,lease,boundary,state,{getuid:process.getuid,exit:n=>{state.exit=n}});
  assert.equal(state.exit,4);assert.deepEqual(await readFile(profilePath),profileBytes);assert.deepEqual(JSON.parse(await readFile(ownerFile)),owner);
  assert.notDeepEqual(await readFile(path.join(root,'receipt.json')),oldReceipt);assert.ok(state.writes.length>=1);
  assert.deepEqual(JSON.parse(await readFile(path.join(attempt,'failure.json'))),{schemaVersion:1,contract:'castlink-cold-release-failure-v1',phase:'metadata-commit'});
  assert.equal((await stat(path.join(attempt,'failure.json'))).mode&511,0o600);
  for(const name of ['checkpoint.json','receipt.json'])await assert.rejects(readFile(path.join(attempt,name)),e=>e.code==='ENOENT');
  assert.deepEqual(JSON.parse(await readFile(path.join(attempt,'intent.json'))),{schemaVersion:1,fixtureOnly:true});
 }}finally{await rm(directory,{recursive:true,force:true})}
});
