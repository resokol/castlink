import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,symlink} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {nodeTargetLease,pythonTargetLease} from '../dist/target-operation.js';
const association={schemaVersion:1,root:'/private/castlink',installationId:'12345678-1234-4123-8123-123456789abc',engine:'fixture-engine',kind:'start',epoch:0};
function child(executable,args,input){const p=spawn(executable,args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.stdin.end(input);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',(code,signal)=>resolve({code,signal,out,err}));});return{p,done};}
async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-target-lease-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
function program(language,root,body){
 // Inject actual-process protocol fixtures; no fixture scope override is exposed
 // through production input schemas or installed target helper entry points.
 if(language==='node')return `const os=require('node:os');os.userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(root)}});${nodeTargetLease}\nleaseEngine=()=>({engine:'fixture-engine',endpoint:'unix:///fixture'});const a=${JSON.stringify({...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')})};${body}`;
 return `import pwd,os,json\nclass Principal: pw_uid=os.getuid();pw_dir=${JSON.stringify(root)}\npwd.getpwuid=lambda _:Principal()\n${pythonTargetLease}\ndef lease_engine(): return {'engine':'fixture-engine','endpoint':'unix:///fixture'}\na=json.loads(${JSON.stringify(JSON.stringify({...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')}))})\n${body}`;
}
function run(language,root,body){return language==='node'?child(process.execPath,['-e',program(language,root,body)]):child('python3',['-c',program(language,root,body)]);}
for(const language of ['node','python']){
 test(`${language} target lease successful terminal release advances epoch and rejects stale continuation`,()=>fixture(async root=>{
 const body=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);releaseTargetOperation(l,true);`:`l=acquire_target_operation(a)\ndispatch_target_operation(l)\nrelease_target_operation(l,True)`;
 assert.equal((await run(language,root,body).done).code,0);
 const scope=path.join(root,'.castlink-target-operations');assert.equal(JSON.parse(await readFile(path.join(scope,'epoch.json'),'utf8')).epoch,1);
 const stale=language==='node'?`acquireTargetOperation(a);`:`acquire_target_operation(a)`;assert.notEqual((await run(language,root,stale).done).code,0);assert.equal(await stat(path.join(scope,'active')).then(()=>true,()=>false),false);
 }));
 test(`${language} competing profiles and roots share domain; signal retains uncertain dispatched owner`,()=>fixture(async root=>{
 const body=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);console.log('HELD');setInterval(()=>{},1000);`:`import time\nl=acquire_target_operation(a)\ndispatch_target_operation(l)\nprint('HELD',flush=True)\ntime.sleep(60)`;
 const first=run(language,root,body);await new Promise((resolve,reject)=>{first.p.stdout.once('data',resolve);first.p.once('error',reject);first.p.once('exit',()=>reject(Error('owner exited before HELD')));});
 const secondBody=language==='node'?`a.root='/another/root';acquireTargetOperation(a);require('fs').writeFileSync(${JSON.stringify(path.join(root,'effect'))},'unsafe');`:`a['root']='/another/root'\nacquire_target_operation(a)\nopen(${JSON.stringify(path.join(root,'effect'))},'w').write('unsafe')`;
 assert.notEqual((await run(language,root,secondBody).done).code,0);first.p.kill('SIGTERM');await first.done;
 assert.notEqual((await run(language,root,secondBody).done).code,0);assert.equal(await stat(path.join(root,'effect')).then(()=>true,()=>false),false);
 assert.ok(await stat(path.join(root,'.castlink-target-operations','active','owner.json')));
 }));
 test(`${language} incomplete acquisition and failed POST remain blocking; no PID or age recovery`,()=>fixture(async root=>{
 const scope=path.join(root,'.castlink-target-operations');await mkdir(scope,{mode:0o700});await mkdir(path.join(scope,'active'),{mode:0o700});
 const body=language==='node'?`acquireTargetOperation(a);`:`acquire_target_operation(a)`;assert.notEqual((await run(language,root,body).done).code,0);assert.ok(await stat(path.join(scope,'active')));
 }));
 test(`${language} nonterminal release cannot remove owned generation`,()=>fixture(async root=>{
 const body=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);releaseTargetOperation(l,false);`:`l=acquire_target_operation(a)\ndispatch_target_operation(l)\nrelease_target_operation(l,False)`;
 assert.notEqual((await run(language,root,body).done).code,0);assert.ok(await stat(path.join(root,'.castlink-target-operations','active','owner.json')));
 }));
}
for(const language of ['node','python'])test(`${language} release cleanup never removes a successor generation`,()=>fixture(async root=>{
 const body=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);const original=leaseFs.unlinkSync;leaseFs.unlinkSync=p=>{if(p.includes('/retired-')){acquireTargetOperation({...a,epoch:1});throw Error('cleanup-failed')}return original(p)};try{releaseTargetOperation(l,true)}catch{};`:`l=acquire_target_operation(a)\ndispatch_target_operation(l)\noriginal=lease_os.unlink\ndef cleanup(p):\n if '/retired-' in p:\n  acquire_target_operation(dict(a,epoch=1))\n  raise ValueError('cleanup-failed')\n return original(p)\nlease_os.unlink=cleanup\ntry: release_target_operation(l,True)\nexcept ValueError: pass`;
 assert.equal((await run(language,root,body).done).code,0);
 const owner=JSON.parse(await readFile(path.join(root,'.castlink-target-operations','active','owner.json'),'utf8'));assert.equal(owner.epoch,1);
}));
test('Node owner blocks Python contender in the same target domain',()=>fixture(async root=>{
 const first=run('node',root,`const l=acquireTargetOperation(a);dispatchTargetOperation(l);console.log('HELD');setInterval(()=>{},1000);`);
 await new Promise((resolve,reject)=>{first.p.stdout.once('data',resolve);first.p.once('error',reject);first.p.once('exit',()=>reject(Error('owner exited before HELD')));});
 try{assert.notEqual((await run('python',root,`acquire_target_operation(a)`).done).code,0);}finally{first.p.kill('SIGTERM');await first.done;}
}));
for(const language of ['node','python'])test(`${language} a surviving effectful descendant keeps uncertain generation exclusive`,()=>fixture(async root=>{
 const marker=path.join(root,'first-owner-late-effect'),foreign=path.join(root,'second-owner-effect');
 const childNode=`setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'first'),300);`;
 const childPython=`import time;time.sleep(.3);open(${JSON.stringify(marker)},'w').write('first')`;
 const body=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);const c=leaseChild.spawn(process.execPath,['-e',${JSON.stringify(childNode)}],{stdio:'ignore',detached:true});c.unref();console.log('HELD');setInterval(()=>{},1000);`:`import subprocess,time\nl=acquire_target_operation(a)\ndispatch_target_operation(l)\nsubprocess.Popen(['python3','-c',${JSON.stringify(childPython)}],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)\nprint('HELD',flush=True)\ntime.sleep(60)`;
 const first=run(language,root,body);await new Promise((resolve,reject)=>{first.p.stdout.once('data',resolve);first.p.once('error',reject);first.p.once('exit',()=>reject(Error('owner exited before HELD')));});first.p.kill('SIGTERM');await first.done;
 const contender=language==='node'?`acquireTargetOperation(a);require('fs').writeFileSync(${JSON.stringify(foreign)},'second');`:`acquire_target_operation(a)\nopen(${JSON.stringify(foreign)},'w').write('second')`;
 assert.notEqual((await run(language,root,contender).done).code,0);
 const deadline=Date.now()+5000;while(!await stat(marker).then(()=>true,()=>false)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(await readFile(marker,'utf8'),'first');assert.equal(await stat(foreign).then(()=>true,()=>false),false);assert.ok(await stat(path.join(root,'.castlink-target-operations','active','owner.json')));
}));
for(const language of ['node','python'])test(`${language} epoch advance between hint and atomic acquisition prevents stale effect`,()=>fixture(async root=>{
 const readMarker=path.join(root,'epoch-read'),gate=path.join(root,'continue'),effect=path.join(root,'stale-effect');
 const body=language==='node'?`const original=targetOperationEpoch;let paused=false;targetOperationEpoch=scope=>{const value=original(scope);if(!paused){paused=true;require('fs').writeFileSync(${JSON.stringify(readMarker)},'read');while(!require('fs').existsSync(${JSON.stringify(gate)}))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}return value};const l=acquireTargetOperation(a);dispatchTargetOperation(l);require('fs').writeFileSync(${JSON.stringify(effect)},'unsafe');`:`import time\noriginal=target_operation_epoch\npaused=False\ndef hint(scope):\n global paused\n value=original(scope)\n if not paused:\n  paused=True\n  open(${JSON.stringify(readMarker)},'w').write('read')\n  while not os.path.exists(${JSON.stringify(gate)}): time.sleep(.01)\n return value\ntarget_operation_epoch=hint\nl=acquire_target_operation(a)\ndispatch_target_operation(l)\nopen(${JSON.stringify(effect)},'w').write('unsafe')`;
 const stale=run(language,root,body);const deadline=Date.now()+5000;while(!await stat(readMarker).then(()=>true,()=>false)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(await stat(readMarker));
 const predecessor=language==='node'?`const l=acquireTargetOperation(a);dispatchTargetOperation(l);releaseTargetOperation(l,true);`:`l=acquire_target_operation(a)\ndispatch_target_operation(l)\nrelease_target_operation(l,True)`;
 assert.equal((await run(language,root,predecessor).done).code,0);await writeFile(gate,'continue');assert.notEqual((await stale.done).code,0);assert.equal(await stat(effect).then(()=>true,()=>false),false);
 assert.equal(JSON.parse(await readFile(path.join(root,'.castlink-target-operations','epoch.json'),'utf8')).epoch,1);
}));
for(const stream of ['stdout','stderr'])test(`Python bounds actual Docker ${stream} while capturing and normalizes secret bytes`,()=>fixture(async root=>{
 const bin=path.join(root,'bin');await mkdir(bin,{mode:0o700});await writeFile(path.join(bin,'docker'),`#!${process.execPath}\nprocess.${stream}.write('PRIVATE_FIXTURE'.repeat(20000));setInterval(()=>{},1000);`,{mode:0o700});
 let source=program('python',root,`try:\n lease_engine()\nexcept BaseException:\n print('target-operation-unverified')\n raise SystemExit(4)`);
 // Exercise the production read function, not the lease-engine protocol shim.
 source=source.replace("def lease_engine(): return {'engine':'fixture-engine','endpoint':'unix:///fixture'}\n",'');
 source=`import os\nos.environ['PATH']=${JSON.stringify(bin)}+os.pathsep+os.environ['PATH']\n`+source;
 const started=Date.now(),result=await child('python3',['-c',source]).done;assert.ok(Date.now()-started<2500,'capture must terminate at byte cap, before the 10-second process timeout');assert.equal(result.code,4);assert.equal(result.out.trim(),'target-operation-unverified');assert.equal(result.err,'');assert.equal(result.out.includes('PRIVATE_FIXTURE'),false);
}));
test('Node private record growth is rejected without reading beyond 8193 bytes',()=>fixture(async root=>{
 const file=path.join(root,'record.json');await writeFile(file,JSON.stringify({token:'owned'}),{mode:0o600});
 const body=`const file=${JSON.stringify(file)};let captured=0,injected=false;const grow=()=>{if(!injected){injected=true;leaseFs.appendFileSync(file,' '.repeat(1048576))}};const originalRead=leaseFs.readSync,originalReadFile=leaseFs.readFileSync;leaseFs.readSync=(fd,b,...args)=>{grow();const n=originalRead(fd,b,...args);captured+=n;return n};leaseFs.readFileSync=(fd,...args)=>{grow();const b=originalReadFile(fd,...args);captured+=b.length;return b};let refused=false;try{leaseRecord(file)}catch{refused=true}console.log(JSON.stringify({refused,captured}));`;
 const result=await run('node',root,body).done;assert.equal(result.code,0);const observed=JSON.parse(result.out);assert.equal(observed.refused,true);assert.ok(observed.captured<=8193,`captured ${observed.captured} bytes`);
}));
test('Node private record replacement between lstat and open is rejected',()=>fixture(async root=>{
 const file=path.join(root,'record.json');await writeFile(file,JSON.stringify({token:'owned'}),{mode:0o600});
 const body=`const file=${JSON.stringify(file)},originalOpen=leaseFs.openSync;let replaced=false;leaseFs.openSync=(p,...args)=>{if(p===file&&!replaced){replaced=true;leaseFs.renameSync(file,file+'.retired');leaseFs.writeFileSync(file,JSON.stringify({token:'other'}),{mode:384})}return originalOpen(p,...args)};let refused=false;try{leaseRecord(file)}catch{refused=true}console.log(JSON.stringify({refused}));`;
 const result=await run('node',root,body).done;assert.equal(result.code,0);assert.equal(JSON.parse(result.out).refused,true);
}));

test('Node dangling epoch record is unknown and cannot reset the operation generation',()=>fixture(async root=>{const scope=path.join(root,'.castlink-target-operations');await mkdir(scope,{mode:0o700});await symlink(path.join(root,'missing-record'),path.join(scope,'epoch.json'));const effect=path.join(root,'effect'),result=await run('node',root,`const l=acquireTargetOperation(a);dispatchTargetOperation(l);leaseFs.writeFileSync(${JSON.stringify(effect)},'unsafe');`).done;assert.notEqual(result.code,0);assert.equal(await stat(effect).then(()=>true,()=>false),false);}));

for(const language of ['node','python'])for(const boundary of ['principal','scope','dispatch'])test(`${language} expected ${boundary} switch refuses before target effect`,()=>fixture(async root=>{
 const effect=path.join(root,'forbidden-effect');
 const body=language==='node'?`if(${JSON.stringify(boundary)}==='principal')a.principal++;if(${JSON.stringify(boundary)}==='scope')a.scope+='/foreign';const l=acquireTargetOperation(a);if(${JSON.stringify(boundary)}==='dispatch')require('os').userInfo=()=>({uid:process.getuid()+1,homedir:${JSON.stringify(root)}});dispatchTargetOperation(l);require('fs').writeFileSync(${JSON.stringify(effect)},'unsafe');`:`if ${JSON.stringify(boundary)}=='principal': a['principal']+=1\nif ${JSON.stringify(boundary)}=='scope': a['scope']+='/foreign'\nl=acquire_target_operation(a)\nif ${JSON.stringify(boundary)}=='dispatch':\n class Changed: pw_uid=os.getuid()+1;pw_dir=${JSON.stringify(root)}\n pwd.getpwuid=lambda _:Changed()\ndispatch_target_operation(l)\nopen(${JSON.stringify(effect)},'w').write('unsafe')`;
 assert.notEqual((await run(language,root,body).done).code,0);assert.equal(await stat(effect).then(()=>true,()=>false),false);
 if(boundary!=='dispatch')assert.equal(await stat(path.join(root,'.castlink-target-operations')).then(()=>true,()=>false),false);
}));
