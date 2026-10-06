import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,chmod,lstat,link} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';

const request={schemaVersion:1,installationId:'11111111-1111-4111-8111-111111111111',nodeId:'srv-11111111111141118111111111111111',origin:'https://127.0.0.1',serverName:'studio'};
async function fixture(run){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-setup-observe-'));try{await mkdir(path.join(root,'runtime'),{mode:0o700});await run(root);}finally{await rm(root,{recursive:true,force:true});}}
async function api(){const module=await import('../../../scripts/setup-observe-v1.mjs').catch(()=>({}));assert.equal(typeof module.observeSetupFile,'function','read-only protected setup observer is missing');return module;}
test('setup observation reads absent state without creating a file or lock',()=>fixture(async root=>{
 const {observeSetupFile}=await api();assert.equal(await observeSetupFile(root,request),'pending');assert.equal(await readFile(path.join(root,'runtime','castlink-setup.json')).then(()=>true,()=>false),false);
}));

test('setup observation accepts only the exact completed public name association',()=>fixture(async root=>{
 const {observeSetupFile}=await api(),file=path.join(root,'runtime','castlink-setup.json');
 await writeFile(file,JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'studio',mode:'public'}),{mode:0o600});assert.equal(await observeSetupFile(root,request),'complete');
 for(const change of [{serverName:'foreign'},{mode:'edge'},{completedAt:'invalid'},{schemaVersion:2},{extra:'private'}]){
  await writeFile(file,JSON.stringify({schemaVersion:1,completedAt:'2026-10-06T00:00:00.000Z',serverName:'studio',mode:'public',...change}));await assert.rejects(()=>observeSetupFile(root,request));
 }
}));
test('setup observer refuses symlink, permissive file and retained concurrent lock without mutation',()=>fixture(async root=>{
 const {observeSetupFile}=await api(),file=path.join(root,'runtime','castlink-setup.json');await writeFile(path.join(root,'other'),'{}',{mode:0o600});await symlink(path.join(root,'other'),file);await assert.rejects(()=>observeSetupFile(root,request));await rm(file);
 await writeFile(file,JSON.stringify({schemaVersion:1}),{mode:0o644});await chmod(file,0o644);await assert.rejects(()=>observeSetupFile(root,request));await chmod(file,0o600);assert.equal(await observeSetupFile(root,request),'pending');await writeFile(path.join(root,'runtime','castlink-setup.lock'),'PRIVATE',{mode:0o600});await assert.rejects(()=>observeSetupFile(root,request));assert.equal(await readFile(path.join(root,'runtime','castlink-setup.lock'),'utf8'),'PRIVATE');
}));

async function targetApi(){return import('../dist/setup-verification.js');}
const valid={...request,contract:'castlink-setup-target-v1',release:'1.0.0-rc.2',productVersion:'1.0.0',tls:'verified',version:'verified',sql:'verified',ownerAccess:'invite',setup:'pending'};
for(const productVersion of ['01.0.0','1.0.0-01','1.0.0-alpha..1','1.0.0..'])test(`semantic productVersion ${productVersion} is refused even in exit-zero target metadata`,async()=>{
 const {observeSetupTarget}=await targetApi();await assert.rejects(()=>observeSetupTarget({...request,release:valid.release,complete:false},{run:async()=>({code:0,stdout:JSON.stringify({...valid,productVersion}),stderr:''})},false),e=>e.code===3);
});
for(const failure of ['extra','duplicate','sql','tls','complete','lost','stderr'])test(`invalid ${failure} response cannot become verified observation or disclose raw helper output`,async()=>{
 const {observeSetupTarget}=await targetApi();let o={...valid},stdout;
 if(failure==='extra')o.PRIVATE='csa2.'+'z'.repeat(43);if(failure==='sql')o.sql='pending';if(failure==='tls')o.tls='pending';
 stdout=JSON.stringify(o);if(failure==='duplicate')stdout=stdout.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1');
 const executor={run:async()=>{if(failure==='lost')throw Error('postgresql://PRIVATE');return{code:0,stdout,stderr:failure==='stderr'?'PRIVATE':''};}};
 await assert.rejects(()=>observeSetupTarget({...request,release:valid.release,complete:failure==='complete'},executor,false),e=>e.code===3&&!/PRIVATE|csa2\.|postgresql/.test(e.message));
});
async function captureFixture(run){await fixture(async scope=>{
 const root=path.join(scope,'bundle');await mkdir(root,{mode:0o700});const fileHashes={};
 for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml']){const text=name+'\n';await writeFile(path.join(root,name),text,{mode:0o600});fileHashes[name]=createHash('sha256').update(text).digest('hex');}
 const ownerFile=path.join(scope,'owner-invite.txt'),text=request.origin+'/super-admin#access=csa2.'+'a'.repeat(43)+'\n';await writeFile(ownerFile,text,{mode:0o600});
 const req={schemaVersion:1,installationId:request.installationId,nodeId:request.nodeId,origin:request.origin,root,fileHashes,ownerFile,ownerSHA:null};
 const {LocalExecutor}=await import('../dist/executors/local.js');await run({scope,req,executor:new LocalExecutor(),text});
});}
for(const remote of [false,true]){
 test(`${remote?'Python':'Node'} captures bounded private associations against retained bundle hashes without contents or effects`,()=>captureFixture(async f=>{
  const module=await targetApi();assert.equal(typeof module.captureSetupAssociations,'function','fixed private association capture missing');const before=await lstat(f.req.ownerFile),o=await module.captureSetupAssociations(f.req,f.executor,remote);
  for(const [name,a] of Object.entries(o.files)){const s=await lstat(path.join(f.req.root,name));assert.equal(a.ino,s.ino);assert.equal(a.dev,s.dev);assert.equal(a.mode,0o600);assert.equal(a.sha256,f.req.fileHashes[name]);}
  assert.equal(o.ownerAssociation.ino,before.ino);assert.equal(o.ownerAssociation.sha256,createHash('sha256').update(f.text).digest('hex'));assert.equal((await lstat(f.req.ownerFile)).mtimeMs,before.mtimeMs);assert.doesNotMatch(JSON.stringify(o),/csa2\.|#access|CASTLINK_SETUP_TOKEN/);
  assert.deepEqual(await module.captureSetupAssociations({...f.req,ownerSHA:o.ownerAssociation.sha256},f.executor,remote),o);
 }));
 for(const drift of ['hash','owner','symlink','mode','hardlink','directory'])test(`${remote?'Python':'Node'} private association capture refuses ${drift} drift`,()=>captureFixture(async f=>{
  const module=await targetApi();assert.equal(typeof module.captureSetupAssociations,'function');let req=f.req;
  if(drift==='hash')await writeFile(path.join(req.root,'web.env'),'PRIVATE');
  if(drift==='owner'){const o=await module.captureSetupAssociations(req,f.executor,remote);req={...req,ownerSHA:o.ownerAssociation.sha256};await writeFile(req.ownerFile,request.origin+'/super-admin#access=csa2.'+'z'.repeat(43)+'\n');}
  if(drift==='symlink'){await rm(path.join(req.root,'web.env'));await symlink(req.ownerFile,path.join(req.root,'web.env'));}
  if(drift==='mode')await chmod(req.ownerFile,0o644);
  if(drift==='hardlink')await link(req.ownerFile,path.join(f.scope,'linked'));
  if(drift==='directory')await chmod(req.root,0o755);
  await assert.rejects(()=>module.captureSetupAssociations(req,f.executor,remote),e=>e.code===3&&!/PRIVATE|csa2\./.test(e.message));
 }));
}
// Real files grow after the real held-fd stat. Instrumentation counts the bytes
// actually read, so rejecting only after an unbounded allocation still fails.
for(const phase of ['capture','target','server'])for(const growing of [true,false])test(`${phase} private fd ${growing?'growth after stat':'initial oversize'} is refused within the running byte cap`,()=>captureFixture(async f=>{
 const cap=phase==='server'?2048:1048576,target=phase==='server'?path.join(f.scope,'runtime','castlink-setup.json'):path.join(f.req.root,'compose.yaml'),metrics=path.join(f.scope,'read-metrics.json'),preload=path.join(f.scope,'bounded-read-preload.cjs');
 if(phase==='server')await writeFile(target,JSON.stringify({schemaVersion:1}),{mode:0o600});
 if(!growing)await writeFile(target,Buffer.alloc(cap+1024,32),{mode:0o600});
 await writeFile(preload,`const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),target=${JSON.stringify(target)},metrics=${JSON.stringify(metrics)},cap=${cap},growing=${growing};let bytes=0,grown=false;const descriptors=new Set(),open=fs.openSync,stat=fs.fstatSync,read=fs.readSync,readFile=fs.readFileSync,append=fs.appendFileSync;function grow(){if(growing&&!grown){grown=true;append(target,Buffer.alloc(cap+1024,32));}}fs.openSync=function(p,...args){const fd=open.call(this,p,...args);if(p===target)descriptors.add(fd);return fd;};fs.fstatSync=function(fd,...args){const s=stat.call(this,fd,...args);if(descriptors.has(fd))grow();return s;};fs.readSync=function(fd,...args){const n=read.call(this,fd,...args);if(descriptors.has(fd))bytes+=n;return n;};fs.readFileSync=function(p,...args){const before=bytes,b=readFile.call(this,p,...args);if(descriptors.has(p)||p===target)bytes=Math.max(bytes,before+Buffer.byteLength(b));return b;};const asyncOpen=fsp.open;fsp.open=async function(p,...args){const h=await asyncOpen.call(this,p,...args);if(p===target){const stat=h.stat.bind(h),read=h.read.bind(h),readFile=h.readFile.bind(h);h.stat=async(...args)=>{const s=await stat(...args);grow();return s;};h.read=async(...args)=>{const r=await read(...args);bytes+=r.bytesRead;return r;};h.readFile=async(...args)=>{const b=await readFile(...args);bytes+=Buffer.byteLength(b);return b;};}return h;};process.on('exit',()=>fs.writeFileSync(metrics,JSON.stringify({bytes,grown})));process.env.PATH=${JSON.stringify(path.join(f.scope,'bin'))}+path.delimiter+process.env.PATH;`,{mode:0o600});
 const {LocalExecutor}=await import('../dist/executors/local.js'),executor={run:r=>new LocalExecutor().run({...r,args:['--require',preload,...r.args]})},module=await targetApi();
 if(phase==='capture')await assert.rejects(()=>module.captureSetupAssociations(f.req,executor,false),e=>e.code===3&&!/PRIVATE|csa2\./.test(e.message));
 else if(phase==='target'){
  // Fixed Docker inspect fixture only; growth refusal must happen before any
  // network request or other Docker operation.
  await mkdir(path.join(f.scope,'bin'),{mode:0o700});await writeFile(path.join(f.scope,'bin','docker'),`#!${process.execPath}\nconst a=process.argv.slice(2);if(a[0]!=='inspect')process.exit(9);console.log(JSON.stringify({Id:a.at(-1),Image:'sha256:'+(a.at(-1)[0]==='a'?'a':'c').repeat(64),Running:true}));\n`,{mode:0o700});
  const files={};for(const [name,sha256] of Object.entries(f.req.fileHashes)){const s=await lstat(path.join(f.req.root,name));files[name]={dev:s.dev,ino:s.ino,mode:0o600,sha256};}const s=await lstat(f.req.ownerFile),ownerAssociation={dev:s.dev,ino:s.ino,mode:0o600,sha256:createHash('sha256').update(f.text).digest('hex')};
  const req={...request,release:'1.0.0',root:f.req.root,files,ownerFile:f.req.ownerFile,ownerAssociation,webContainerId:'a'.repeat(64),caddyContainerId:'c'.repeat(64),webImageId:'sha256:'+'a'.repeat(64),caddyImageId:'sha256:'+'c'.repeat(64),complete:false,attempt:null};await assert.rejects(()=>module.observeSetupTarget(req,executor,false),e=>e.code===3&&!/PRIVATE|csa2\./.test(e.message));
 }else{
  const script=`import(${JSON.stringify(new URL('../../../scripts/setup-observe-v1.mjs',import.meta.url).href)}).then(m=>m.observeSetupFile(${JSON.stringify(f.scope)},${JSON.stringify(request)})).then(()=>{console.log(JSON.stringify({refused:false}));},()=>{console.log(JSON.stringify({refused:true}));});`,r=await executor.run({executable:process.execPath,args:['-e',script]});assert.equal(r.code,0);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),{refused:true});
 }
 const actual=JSON.parse(await readFile(metrics,'utf8'));assert.equal(actual.grown,growing);assert.ok(actual.bytes<=(growing?cap+1:0),`Private fd allocated ${actual.bytes} bytes beyond running cap ${cap}`);
}));
