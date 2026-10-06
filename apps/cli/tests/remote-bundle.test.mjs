import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,stat,rm,writeFile,chmod,symlink,link,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const api=await import('../dist/remote-bundle.js').catch(()=>({}));
const input=()=>({release:{schemaVersion:1,release:'1.0.0',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:`example.org/${n}@sha256:${'a'.repeat(64)}`,architectures:['amd64']}]))},installationId:'00000000-0000-4000-8000-000000000001',architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1'});
const requests=[];
const executor={async run(r){requests.push(r);return await new Promise((resolve,reject)=>{const p=spawn(r.executable,r.args);let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.end(r.input);});}};
async function fixture(fn){const scopeRoot=await mkdtemp(join(tmpdir(),'castlink-remote-'));try{await fn({scopeRoot,directory:join(scopeRoot,'bundle')});}finally{await rm(scopeRoot,{recursive:true,force:true});}}
const call=(o,i=input(),e=executor)=>api.materializeRemoteBundle(i,o,e);
test('remote writer API exists',()=>assert.equal(typeof api.materializeRemoteBundle,'function'));
test('fresh helper creates private consistent files and verified retry preserves all bytes',()=>fixture(async o=>{
 const result=await call(o);const names=['web.env','postgres.env','livekit.yaml','compose.yaml','owner.json','receipt.json'];const before=await Promise.all(names.map(n=>readFile(join(o.directory,n),'utf8')));
 assert.equal((await stat(o.directory)).mode&0o777,0o700);for(const n of names){const s=await stat(join(o.directory,n));assert.equal(s.mode&0o777,0o600);assert.equal(s.nlink,1);}
 const web=Object.fromEntries(before[0].trimEnd().split('\n').map(s=>s.split(/=(.*)/s).slice(0,2)));const pg=Object.fromEntries(before[1].trimEnd().split('\n').map(s=>s.split(/=(.*)/s).slice(0,2)));assert.ok(web.DATABASE_URL.includes(pg.POSTGRES_PASSWORD));assert.equal(JSON.parse(before[2]).keys[web.LIVEKIT_API_KEY],web.LIVEKIT_API_SECRET);
 assert.deepEqual(await call(o),result);assert.deepEqual(await Promise.all(names.map(n=>readFile(join(o.directory,n),'utf8'))),before);assert.ok(!JSON.stringify(result).includes(pg.POSTGRES_PASSWORD));const r=requests.at(-1);assert.equal(r.sensitive,true);assert.equal(r.executable,'python3');assert.ok(!r.args.join('').includes(o.scopeRoot));assert.ok(!Buffer.from(r.input).toString().includes(pg.POSTGRES_PASSWORD));
}));
test('invalid input and credential-marker paths never invoke executor',async()=>{
 let calls=0;const e={run(){calls++;throw Error('unexpected');}};
 for(const o of [{scopeRoot:'/tmp/s',directory:'/tmp/escape'},{scopeRoot:'/tmp/s',directory:'/tmp/s/../x'},{scopeRoot:'/tmp/s',directory:'/tmp/s/__CASTLINK_CREDENTIAL_livekitSecret__'},{scopeRoot:'/tmp/s',directory:'/tmp/s//x'},{scopeRoot:'/tmp/s',directory:'/tmp/s/x\n'}])await assert.rejects(call(o,input(),e),x=>x.code===2);
 for(const i of [{...input(),installationId:'bad'},{...input(),network:'internet'},{...input(),architecture:'x'}])await assert.rejects(call({scopeRoot:'/tmp/s',directory:'/tmp/s/x'},i,e),x=>x.code===2);
 assert.equal(calls,0);
});
test('response lost after durable commit permits verified retry with unchanged credential bytes',()=>fixture(async o=>{
 const lost={async run(r){await executor.run(r);throw Error('SECRET-RAW-TRANSPORT');}};await assert.rejects(call(o,input(),lost),x=>!x.message.includes('SECRET-RAW'));
 const before=await readFile(join(o.directory,'web.env'));await call(o);assert.deepEqual(await readFile(join(o.directory,'web.env')),before);
}));
for(const mutation of ['identity','request','unknown','receipt','owner','missing','semantic','permissions','symlink','hardlink'])test(`retry refuses ${mutation} without overwrite`,()=>fixture(async o=>{
 await call(o);const file=join(o.directory,'web.env');let i=input();
 if(mutation==='identity')i.installationId='00000000-0000-4000-8000-000000000002';
 if(mutation==='request')i.release.images.web.reference=`example.org/web@sha256:${'b'.repeat(64)}`;
 if(mutation==='unknown')await writeFile(join(o.directory,'foreign'),'foreign');
 if(mutation==='receipt')await writeFile(join(o.directory,'receipt.json'),'{}');
 if(mutation==='owner')await writeFile(join(o.directory,'owner.json'),'{}');
 if(mutation==='missing')await unlink(join(o.directory,'postgres.env'));
 if(mutation==='semantic'){
  await writeFile(file,(await readFile(file,'utf8')).replace('CASTLINK_STORAGE_BACKEND=json','CASTLINK_STORAGE_BACKEND=postgres'));
  // Updating receipt hashes must not bypass semantic reconstruction.
  const {createHash}=await import('node:crypto');const receipt=JSON.parse(await readFile(join(o.directory,'receipt.json'),'utf8'));receipt.hashes['web.env']=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(join(o.directory,'receipt.json'),JSON.stringify(receipt));
 }
 if(mutation==='permissions')await chmod(file,0o644);
 if(mutation==='symlink'){const copy=join(o.scopeRoot,'copy');await writeFile(copy,await readFile(file));await unlink(file);await symlink(copy,file);}
 if(mutation==='hardlink')await link(file,join(o.scopeRoot,'linked'));
 const before=await readFile(file);await assert.rejects(call(o,i),x=>x.code===4);assert.deepEqual(await readFile(file),before);
}));
test('unknown empty bundle, missing parent, unsafe scope and ancestor symlinks remain untouched',()=>fixture(async o=>{
 await mkdir(o.directory,{mode:0o700});await assert.rejects(call(o));assert.deepEqual(await import('node:fs/promises').then(m=>m.readdir(o.directory)),[]);
 await assert.rejects(call({...o,directory:join(o.scopeRoot,'absent','bundle')}));
 await chmod(o.scopeRoot,0o755);await assert.rejects(call({...o,directory:join(o.scopeRoot,'second')}));await chmod(o.scopeRoot,0o700);
 const alias=join(o.scopeRoot,'alias');await symlink(o.scopeRoot,alias);await assert.rejects(call({...o,directory:join(alias,'new')}));
}));
test('concurrent actual helpers cannot overwrite or regenerate committed files',()=>fixture(async o=>{
 const outcomes=await Promise.allSettled(Array.from({length:6},()=>call(o)));assert.ok(outcomes.some(x=>x.status==='fulfilled'));const before=await readFile(join(o.directory,'web.env'));await call(o);assert.deepEqual(await readFile(join(o.directory,'web.env')),before);
}));
// Faults wrap stdlib fsync in a fixture process. Production has no injected callbacks/sleeps.
function faultExecutor(stage){return {async run(r){const prefix=`import os\noriginal=os.fsync\ncount=0\ndef fault(fd):\n global count\n count+=1\n original(fd)\n if count==${stage}: raise OSError('PRIVATE-FAULT-CONTENT')\nos.fsync=fault\n`;return executor.run({...r,args:['-c',prefix+r.args[1]]});}};}
for(const [stage,name] of [[1,'directory'],[5,'first config'],[12,'receipt']])test(`durable failure after ${name} is conservative`,()=>fixture(async o=>{
 await assert.rejects(call(o,input(),faultExecutor(stage)),x=>!x.message.includes('PRIVATE-FAULT'));
 const before=await import('node:fs/promises').then(async m=>Object.fromEntries(await Promise.all((await m.readdir(o.directory)).map(async n=>[n,await readFile(join(o.directory,n),'utf8')]))));
 if(stage===12)await call(o);else await assert.rejects(call(o));
 for(const [n,v] of Object.entries(before))assert.equal(await readFile(join(o.directory,n),'utf8'),v);
}));
test('raw executor outputs and exceptions are redacted and unexpected JSON is rejected',()=>fixture(async o=>{
 for(const result of [{code:1,stdout:'RAW-SECRET',stderr:'RAW-SECRET'},{code:0,stdout:'RAW-SECRET',stderr:''},{code:0,stdout:'{"schemaVersion":1,"schemaVersion":1}',stderr:''},{code:0,stdout:'{"schemaVersion":1,"\\u0073chemaVersion":1}',stderr:''},{code:0,stdout:'x'.repeat(2049),stderr:''},{code:0,stdout:'{}',stderr:''}])await assert.rejects(call(o,input(),{async run(){return result;}}),x=>!x.message.includes('RAW-SECRET')&&x.code===4);
 await assert.rejects(call(o,input(),{async run(){throw Error('RAW-SECRET');}}),x=>!x.message.includes('RAW-SECRET'));
}));
test('actual helper rejects oversized and duplicate stdin schemas without creating paths',()=>fixture(async o=>{
 await call(o);const r=requests.at(-1);const payload=Buffer.from(r.input).toString();
 for(const raw of ['x'.repeat(131073),payload.replace('{','{"schemaVersion":1,'),payload.replace('{','{"\\u0073chemaVersion":1,'),payload.replace('"schemaVersion":1','"schemaVersion":true')]){const x=await executor.run({...r,input:Buffer.from(raw)});assert.equal(x.code,4);assert.equal(x.stderr,'');assert.equal(x.stdout,'{"schemaVersion":1,"error":"diagnosis-required"}');}
}));
for(const artifact of ['owner.json','receipt.json'])test(`rejects boolean schema version in ${artifact}`,()=>fixture(async o=>{
 await call(o);const file=join(o.directory,artifact);const content=JSON.parse(await readFile(file,'utf8'));content.schemaVersion=true;await writeFile(file,JSON.stringify(content));await assert.rejects(call(o));
}));
test('input extra schema fields rejected before executor',async()=>{
 let calls=0;await assert.rejects(call({scopeRoot:'/tmp/s',directory:'/tmp/s/x'},{...input(),extra:'PRIVATE-SECRET'},{run(){calls++;throw Error();}}),x=>x.code===2);assert.equal(calls,0);
});
test('selected SshExecutor uses fixed OpenSSH command and stdin seam with actual local Python helpers',()=>fixture(async o=>{
 const {SshExecutor}=await import('../dist/executors/ssh.js');const transport={async run(r){assert.equal(r.executable,'ssh');assert.equal(r.sensitive,true);assert.ok(r.args.includes('StrictHostKeyChecking=yes'));assert.ok(!r.args.join('').includes(o.scopeRoot));const cmd=r.args.at(-1);assert.ok(cmd.startsWith("python3 -c '"));const program=cmd.slice(12,-1).replaceAll("'\\''","'");return executor.run({executable:'python3',args:['-c',program],input:r.input,sensitive:true});}};
 const selected=new SshExecutor({kind:'remote',host:'host.example',user:'ubuntu',port:22},transport);const first=await call(o,input(),selected);assert.deepEqual(await call(o,input(),selected),first);
}));
test('bounded successful response schema rejects nested duplicates and extra fields',()=>fixture(async o=>{
 await call(o);const base=await executor.run(requests.at(-1));const data=JSON.parse(base.stdout);
 const variants=[JSON.stringify({...data,schemaVersion:true}),JSON.stringify({...data,extra:'PRIVATE-SECRET'}),base.stdout.replace('"hashes": {','"hashes": {"web.env":"'+'a'.repeat(64)+'",'),base.stdout.replace('"hashes": {','"hashes": {"\\u0077eb.env":"'+'a'.repeat(64)+'",'),JSON.stringify({...data,hashes:[]}),JSON.stringify({...data,hashes:{...data.hashes,'compose.yaml':'b'.repeat(64)}})];
 for(const stdout of variants)await assert.rejects(call(o,input(),{async run(){return {...base,stdout};}}),x=>x.code===4&&!x.message.includes('PRIVATE-SECRET'));
 await call(o);
}));
test('Unicode, spaces, dollar and shell syntax are literal POSIX paths',()=>fixture(async o=>{
 const options={...o,directory:join(o.scopeRoot,'bundle Юникод $VAR $(echo x)')};const r=await call(options);assert.equal(r.composePath,join(options.directory,'compose.yaml'));assert.deepEqual(await call(options),r);
}));
test('verified retry must confirm durability before claiming success',()=>fixture(async o=>{
 await call(o);const before=await readFile(join(o.directory,'web.env'));await assert.rejects(call(o,input(),faultExecutor(1)));assert.deepEqual(await readFile(join(o.directory,'web.env')),before);await call(o);
}));
for(const metadata of ['release','nodeVersion','release-architectures','image-architectures'])test(`completed retry rejects metadata-only ${metadata} change without touching artifacts`,()=>fixture(async o=>{
 await call(o);const names=['owner.json','receipt.json','postgres.env','web.env','livekit.yaml','compose.yaml'];const before=await Promise.all(names.map(n=>readFile(join(o.directory,n))));const changed=input();
 if(metadata==='release')changed.release.release='1.0.1';
 if(metadata==='nodeVersion')changed.release.nodeVersion='22.24.0';
 if(metadata==='release-architectures'){changed.release.architectures.push('arm64');for(const image of Object.values(changed.release.images))image.architectures.push('arm64');}
 if(metadata==='image-architectures')changed.release.images.web.architectures.push('arm64');
 await assert.rejects(call(o,changed),error=>error.code===4);
 assert.deepEqual(await Promise.all(names.map(n=>readFile(join(o.directory,n)))),before);await call(o);assert.deepEqual(await Promise.all(names.map(n=>readFile(join(o.directory,n)))),before);
}));
test('read-only bundle observer performs no fsync while verified materializer retry retains durability checks',()=>fixture(async o=>{
 await call(o);const before=await readFile(join(o.directory,'web.env'));
 assert.equal(typeof api.observeRemoteBundle,'function');
 const denyEffects={run:r=>executor.run({...r,args:['-c',`import os\ndef deny(*args,**kwargs): raise RuntimeError('readonly effect')\nos.fsync=deny;os.mkdir=deny;os.write=deny\n${r.args[1]}`]})};
 const result=await api.observeRemoteBundle(input(),o,denyEffects);assert.equal(result.installationId,input().installationId);
 assert.deepEqual(await readFile(join(o.directory,'web.env')),before);
 await assert.rejects(api.materializeRemoteBundle(input(),o,denyEffects,true),e=>e.code===4);
 await api.materializeRemoteBundle(input(),o,executor,true);
}));
