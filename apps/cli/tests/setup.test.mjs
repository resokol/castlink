import {test, mock} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,mkdir,writeFile,symlink,chmod} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {FileStateStore} from '../dist/state.js';
import {FileJournal} from '../dist/journal.js';
const setup=await import('../dist/setup.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND'&&error.url?.endsWith('/dist/setup.js'))return {};throw error;});
const prepare=(...args)=>{assert.equal(typeof setup.prepareLocalConfig,'function','protected preparation API must exist');return setup.prepareLocalConfig(...args);};
const manifest=()=>({schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,{reference:`example.org/${name}@sha256:${'a'.repeat(64)}`,architectures:['amd64']}]))});
const steps=['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
function executor(fail=false){return {run:async r=>{
 if(fail)throw Error('raw-sensitive-fixture');
 const stdout=r.input?JSON.stringify({schemaVersion:1,address:true,tcp:[443,7881].map(port=>({port,available:true})),udp:Array.from({length:101},(_,i)=>({port:61000+i,available:true}))}):r.executable===process.execPath?JSON.stringify({platform:'darwin',arch:'x64',osVersion:'14.0'}):r.args[0]==='context'?JSON.stringify('unix:///var/run/docker.sock'):r.args[0]==='compose'?'2.23.1':r.args[0]==='version'?'linux|amd64|28.0.0':'';
 return {code:0,stdout,stderr:'raw-sensitive-fixture'};
}};}
async function fixture(run){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-prepare-'));const store=new FileStateStore(path.join(root,'state'));
 const plan={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},network:'loopback',root:path.join(root,'bundle'),release:'1.0.0-rc.2'},steps:[...steps],blockers:[]};
 const options={release:manifest(),architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:path.join(root,'journal')};
 const call=(e=executor(),s=store)=>prepare(plan,options,e,s);
 try{await run({root,store,plan,options,call});}finally{mock.restoreAll();await rm(root,{recursive:true,force:true});}}
const safe=e=>!String(e).includes('raw-sensitive-fixture');
async function bytes(root){return Promise.all(['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'].map(name=>readFile(path.join(root,'bundle',name),'utf8')));}
test('fresh protected preparation persists identity and verifies only config',()=>fixture(async({call,store,options,root})=>{
 const result=await call();assert.equal(result.profile.installationId,(await store.load('studio')).installationId);
 const files=await bytes(root);assert.ok(files[1].includes(result.profile.installationId));
 assert.equal(JSON.parse(files[0]).services.web.environment.CASTLINK_NODE_ID,result.bundle.nodeId);
 const journal=await new FileJournal(options.journalDirectory).read();for(const step of steps)assert.equal(journal.steps[step],step==='config'?'verified':'pending');
 const secret=/CASTLINK_SETUP_TOKEN=([^\n]+)/.exec(files[1])[1];assert.ok(!JSON.stringify(result).includes(secret));
 assert.equal(result.checks.find(x=>x.id==='config').state,'pass');for(const id of ['services','images','media'])assert.equal(result.checks.find(x=>x.id===id).state,'unverified');
}));
for(const [name,change] of [
 ['blocked',({plan})=>plan.blockers.push('raw-sensitive-fixture')],
 ['remote',({plan})=>plan.request.target={kind:'remote',host:'203.0.113.8',user:'operator',port:22}],
 ['incompatible steps',({plan})=>plan.steps=['config']],
 ['unsupported network',({plan})=>{plan.request.network='internet';plan.request.domain='studio.example.org';}],
 ['release mismatch',({options})=>options.release.release='2.0.0'],
 ['extra request fields',({plan})=>plan.request.secret='raw-sensitive-fixture'],
 ['relative journal',({options})=>options.journalDirectory='relative'],
 ['overlapping journal',({plan,options})=>options.journalDirectory=plan.request.root],
])test(`${name} rejected before writes or executor calls`,()=>fixture(async f=>{change(f);let calls=0;await assert.rejects(f.call({run:async()=>{calls++;throw Error();}}),safe);assert.equal(calls,0);assert.deepEqual(await readdir(f.root),[]);}));
test('failed preflight creates no credentials, profile or journal',()=>fixture(async({call,root})=>{await assert.rejects(call(executor(true)),e=>e.code===3&&safe(e));assert.deepEqual(await readdir(root),[]);}));
test('existing unowned bundle refuses overwrite',()=>fixture(async({call,plan,store})=>{await mkdir(plan.request.root);await writeFile(path.join(plan.request.root,'keep'),'foreign');await assert.rejects(call(),safe);assert.equal(await store.load('studio'),null);assert.equal(await readFile(path.join(plan.request.root,'keep'),'utf8'),'foreign');}));
test('request, release and identity conflicts preserve all bytes',()=>fixture(async({call,plan,options,store,root})=>{
 await call();const original=await bytes(root);
 options.bindIPv4='127.0.0.2';await assert.rejects(call());options.bindIPv4='127.0.0.1';
 options.release.images.web.reference=`example.org/web@sha256:${'b'.repeat(64)}`;await assert.rejects(call());options.release=manifest();
 plan.request.network='lan';options.bindIPv4='192.168.1.20';await assert.rejects(call());plan.request.network='loopback';options.bindIPv4='127.0.0.1';
 const p=await store.load('studio');p.currentRelease='2.0.0';await store.save(p);await assert.rejects(call());p.currentRelease='1.0.0-rc.2';await store.save(p);
 const loaded=store.load.bind(store);store.load=async name=>({...await loaded(name),installationId:'00000000-0000-4000-8000-000000000001'});await assert.rejects(call());store.load=loaded;
 assert.deepEqual(await bytes(root),original);
}));
for(const persisted of [false,true])test(`profile save failure ${persisted?'after':'before'} persistence releases lock and redacts`,()=>fixture(async({store,call,root})=>{
 const original=store.save.bind(store);store.save=async p=>{if(persisted)await original(p);throw Error('raw-sensitive-fixture');};
 await assert.rejects(call(),safe);assert.ok(!(await readdir(root)).includes('bundle'));const p=await store.load('studio');store.save=original;
 const result=await call();if(persisted)assert.equal(result.profile.installationId,p.installationId);
}));
for(const boundary of ['running','verified'])test(`interrupted config ${boundary} boundary preserves identity and credentials on retry`,()=>fixture(async({call,store,root})=>{
 const mark=FileJournal.prototype.mark;mock.method(FileJournal.prototype,'mark',async function(step,state){if(step==='config'&&state===boundary)throw Error('raw-sensitive-fixture');return mark.call(this,step,state);});
 await assert.rejects(call(),safe);const p=await store.load('studio');const original=boundary==='verified'?await bytes(root):null;mock.restoreAll();
 const result=await call();assert.equal(result.profile.installationId,p.installationId);if(original)assert.deepEqual(await bytes(root),original);
}));
test('failure after verified journal persistence still rechecks real files on retry',()=>fixture(async({call,store,root})=>{
 const mark=FileJournal.prototype.mark;mock.method(FileJournal.prototype,'mark',async function(step,state){await mark.call(this,step,state);if(state==='verified')throw Error('raw-sensitive-fixture');});
 await assert.rejects(call(),safe);const before=await bytes(root),id=(await store.load('studio')).installationId;mock.restoreAll();const result=await call();assert.equal(result.profile.installationId,id);assert.deepEqual(await bytes(root),before);
}));
for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'])test(`missing ${name} refuses retry without regenerating`,()=>fixture(async({call,root})=>{await call();const before=await bytes(root);await rm(path.join(root,'bundle',name));await assert.rejects(call(),safe);for(const [i,file] of ['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'].entries())if(file!==name)assert.equal(await readFile(path.join(root,'bundle',file),'utf8'),before[i]);}));
for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'])test(`modified ${name} refuses retry without overwriting`,()=>fixture(async({call,root})=>{await call();const file=path.join(root,'bundle',name);await writeFile(file,'raw-sensitive-fixture');await assert.rejects(call(),safe);assert.equal(await readFile(file,'utf8'),'raw-sensitive-fixture');}));
test('partial materialization preserves identity and blocks regeneration',()=>fixture(async({call,root,store})=>{
 const {default:crypto}=await import('node:crypto');const {syncBuiltinESMExports}=await import('node:module');mock.method(crypto,'randomBytes',()=>{throw Error('raw-sensitive-fixture');});syncBuiltinESMExports();
 try{await assert.rejects(call(),safe);}finally{mock.restoreAll();syncBuiltinESMExports();}
 const id=(await store.load('studio')).installationId;await assert.rejects(call(),safe);assert.equal((await store.load('studio')).installationId,id);assert.deepEqual(await readdir(path.join(root,'bundle')),[]);
}));
test('active lock and concurrent calls fail safely',()=>fixture(async({call,store,root})=>{
 const unlock=await store.lock('studio');await assert.rejects(call(),safe);await unlock();
 const results=await Promise.allSettled([call(),call()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);await bytes(root);
}));
test('lock release errors are redacted',()=>fixture(async({call,store})=>{
 const lock=store.lock.bind(store);store.lock=async name=>{const release=await lock(name);return async()=>{await release();throw Error('raw-sensitive-fixture');};};await assert.rejects(call(),safe);
}));
for(const target of ['bundle','journal','journal.json','compose.yaml','ancestor'])test(`symlink ${target} fails closed`,{skip:process.platform==='win32'},()=>fixture(async({call,root,options,plan})=>{
 const outside=path.join(root,'outside');await mkdir(outside);
 if(target==='ancestor'){const link=path.join(root,'link');await symlink(outside,link);plan.request.root=path.join(link,'bundle');}
 else if(target==='bundle'||target==='journal')await symlink(outside,target==='bundle'?plan.request.root:options.journalDirectory);
 else {await call();const file=target==='journal.json'?path.join(options.journalDirectory,target):path.join(plan.request.root,target);await rm(file);await symlink(path.join(outside,'missing'),file);}
 await assert.rejects(call(),safe);assert.deepEqual(await readdir(outside),[]);
}));
test('unsafe permissions block retry rather than silently repairing',{skip:process.platform==='win32'},()=>fixture(async({call,root})=>{await call();await chmod(path.join(root,'bundle','web.env'),0o644);await assert.rejects(call(),safe);}));
test('removed entire bundle and journal cannot regenerate persisted credentials',()=>fixture(async({call,root,options,store})=>{
 await call();const id=(await store.load('studio')).installationId;await rm(path.join(root,'bundle'),{recursive:true});await rm(options.journalDirectory,{recursive:true});
 await assert.rejects(call(),safe);assert.equal((await store.load('studio')).installationId,id);assert.ok(!(await readdir(root)).includes('bundle'));
}));
test('receipt creation failure leaves complete config private and refuses retry',()=>fixture(async({call,root,store})=>{
 const {default:fs}=await import('node:fs/promises');const {syncBuiltinESMExports}=await import('node:module');const open=fs.open;
 mock.method(fs,'open',async(file,...args)=>{if(String(file).endsWith('receipt.json'))throw Error('raw-sensitive-fixture');return open(file,...args);});syncBuiltinESMExports();
 try{await assert.rejects(call(),safe);}finally{mock.restoreAll();syncBuiltinESMExports();}
 const id=(await store.load('studio')).installationId,original=await readFile(path.join(root,'bundle','web.env'),'utf8');await assert.rejects(call(),safe);
 assert.equal((await store.load('studio')).installationId,id);assert.equal(await readFile(path.join(root,'bundle','web.env'),'utf8'),original);
}));
test('failure after running journal persistence blocks unsafe retry before materialization',()=>fixture(async({call,root,store})=>{
 const mark=FileJournal.prototype.mark;mock.method(FileJournal.prototype,'mark',async function(step,state){await mark.call(this,step,state);throw Error('raw-sensitive-fixture');});
 await assert.rejects(call(),safe);mock.restoreAll();const id=(await store.load('studio')).installationId;await assert.rejects(call(),safe);assert.equal((await store.load('studio')).installationId,id);assert.ok(!(await readdir(root)).includes('bundle'));
}));
test('second profile save failure never starts materialization',()=>fixture(async({call,root,store})=>{
 const save=store.save.bind(store);let saves=0;store.save=async p=>{saves++;if(saves===2)throw Error('raw-sensitive-fixture');await save(p);};await assert.rejects(call(),safe);assert.equal(saves,2);assert.ok(!(await readdir(root)).includes('bundle'));store.save=save;await assert.rejects(call(),safe);
}));
test('untrusted CliError from store cannot leak its message',()=>fixture(async({call,store})=>{
 const {CliError}=await import('../dist/types.js');store.load=async()=>{throw new CliError('raw-sensitive-fixture',4);};await assert.rejects(call(),e=>e.code===4&&safe(e));
}));
test('caller changes after preflight starts cannot change persisted candidate',()=>fixture(async({call,plan,options,root})=>{
 const e=executor(),run=e.run.bind(e);e.run=async r=>{plan.request.root=path.join(root,'attacker');options.bindIPv4='127.0.0.2';options.release.images.web.reference='raw-sensitive-fixture';return run(r);};const result=await call(e);assert.equal(result.profile.request.root,path.join(root,'bundle'));await bytes(root);assert.ok(!(await readdir(root)).includes('attacker'));
}));
for(const kind of ['all-pending journal','unidentified nonempty directory','unidentified empty directory'])test(`foreign ${kind} stays untouched without profile or credentials`,()=>fixture(async({call,root,options,store})=>{
 await mkdir(options.journalDirectory,{mode:0o700});
 const file=path.join(options.journalDirectory,kind==='all-pending journal'?'journal.json':'keep');
 const text=kind==='all-pending journal'?JSON.stringify({schemaVersion:1,steps:Object.fromEntries(steps.map(step=>[step,'pending']))}):'foreign-bytes';
 if(kind!=='unidentified empty directory')await writeFile(file,text,{mode:0o600});
 const entries=await readdir(options.journalDirectory);await assert.rejects(call(),safe);
 assert.equal(await store.load('studio'),null);assert.ok(!(await readdir(root)).includes('bundle'));assert.deepEqual(await readdir(options.journalDirectory),entries);
 if(entries.length)assert.equal(await readFile(file,'utf8'),text);
}));
test('different profiles cannot share one journal even when both observe it missing',()=>fixture(async({root,store,options,plan})=>{
 const other=structuredClone(plan);other.request.profile='other';other.request.root=path.join(root,'other-bundle');
 // Hold both calls at the last read-only preflight response to force overlap.
 let arrivals=0,release;const gate=new Promise(resolve=>release=resolve);
 const e=executor(),run=e.run.bind(e);e.run=async r=>{const result=await run(r);if(r.input){arrivals++;if(arrivals===2)release();await gate;}return result;};
 const results=await Promise.allSettled([prepare(plan,options,e,store),prepare(other,options,e,store)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const winner=results.find(x=>x.status==='fulfilled').value;const owner=JSON.parse(await readFile(path.join(options.journalDirectory,'owner.json'),'utf8'));
 assert.equal(owner.installationId,winner.profile.installationId);assert.deepEqual(owner.request,winner.profile.request);
 const loser=winner.profile.request.profile==='studio'?'other':'studio';assert.equal(await store.load(loser),null);
 assert.ok(!(await readdir(root)).includes(loser==='other'?'other-bundle':'bundle'));
}));
test('identity-only retry refuses foreign ownership without changing persisted ID',()=>fixture(async({call,store,options,root})=>{
 const mark=FileJournal.prototype.mark;mock.method(FileJournal.prototype,'mark',async()=>{throw Error('raw-sensitive-fixture');});await assert.rejects(call(),safe);mock.restoreAll();
 const id=(await store.load('studio')).installationId,file=path.join(options.journalDirectory,'owner.json');await mkdir(options.journalDirectory,{recursive:true,mode:0o700});await writeFile(file,JSON.stringify({schemaVersion:1,installationId:'00000000-0000-4000-8000-000000000001',request:{profile:'foreign'}}),{mode:0o600});const before=await readFile(file,'utf8');
 await assert.rejects(call(),safe);assert.equal((await store.load('studio')).installationId,id);assert.equal(await readFile(file,'utf8'),before);assert.ok(!(await readdir(root)).includes('bundle'));
}));
for(const [file,replace] of [
 ['web.env',text=>text.replace(/STUDIOLINK_INSTALLATION_ID=[^\n]+/,'STUDIOLINK_INSTALLATION_ID=00000000-0000-4000-8000-000000000001')],
 ['postgres.env',text=>text.replace(/POSTGRES_PASSWORD=[^\n]+/,`POSTGRES_PASSWORD=${'a'.repeat(64)}`)],
 ['livekit.yaml',text=>text.replace('"tcp_port": 7881','"tcp_port": 9999')],
])test(`recovery checks real ${file} consistency even when receipt hashes and journal claim success`,()=>fixture(async({call,root})=>{
 await call();const filePath=path.join(root,'bundle',file),receiptPath=path.join(root,'bundle','receipt.json');const changed=replace(await readFile(filePath,'utf8'));
 await writeFile(filePath,changed);const receipt=JSON.parse(await readFile(receiptPath,'utf8'));receipt.hashes[file]=createHash('sha256').update(changed).digest('hex');await writeFile(receiptPath,JSON.stringify(receipt));
 await assert.rejects(call(),safe);assert.equal(await readFile(filePath,'utf8'),changed);
}));
