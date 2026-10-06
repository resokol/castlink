import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const api=await import('../test-cli-ci.mjs').catch(()=>({}));
const legacy=['private-control-config.test.mjs','private-control-services.test.mjs','private-control-setup.test.mjs'],files=[...legacy,'ordinary.test.mjs','windows.test.mjs'];
test('explicit CI partition executes every file once and keeps exactly three fixed-identity families separate',()=>{assert.equal(typeof api.partitionCliTests,'function');const p=api.partitionCliTests(files,true);assert.deepEqual(p.legacy,legacy);assert.deepEqual(p.common,['ordinary.test.mjs','windows.test.mjs']);assert.deepEqual([...p.common,...p.legacy].sort(),files.toSorted());assert.deepEqual(api.partitionCliTests(files,false),{common:files.toSorted(),legacy:[]});assert.throws(()=>api.partitionCliTests(files.slice(1),true));});
test('real identity records require finite UID/GID and unsupported developer actors never gain sudo',()=>{assert.equal(typeof api.requireActorIdentity,'function');assert.deepEqual(api.requireActorIdentity(1000,1000),{uid:1000,gid:1000});for(const ids of [[1001,1000],[1000,1001],[NaN,1000],[-1,1000]])assert.throws(()=>api.requireActorIdentity(...ids));});
test('CI identity command is fixed sudo/setpriv with cleared groups and bounded canonical Node entry only',()=>{assert.equal(typeof api.identityCommand,'function');const c=api.identityCommand('/opt/node/bin/node','/checkout/scripts/test-cli-ci.mjs',{uid:1001,gid:1001});assert.equal(c.executable,'/usr/bin/sudo');assert.deepEqual(c.args,['-n','--','/usr/bin/setpriv','--reuid=1000','--regid=1000','--clear-groups','--','/usr/bin/env','-i','PATH=/opt/node/bin','LANG=C.UTF-8','CI=true','GITHUB_ACTIONS=true','CASTLINK_CI_FIXED_ACTOR=1','CASTLINK_CI_NODE_UID=1001','/opt/node/bin/node','/checkout/scripts/test-cli-ci.mjs','--legacy-private-control-actor']);assert.equal(api.identityCommand('/opt/node/bin/node','/checkout/scripts/test-cli-ci.mjs',{uid:1000,gid:1000}).executable,'/opt/node/bin/node');assert.throws(()=>api.identityCommand('node','/checkout/scripts/test-cli-ci.mjs',{uid:1001,gid:1001}));});
test('sanitized identity actor carries no caller credentials or Docker endpoints and only Node PATH',()=>{assert.equal(typeof api.actorEnvironment,'function');const e=api.actorEnvironment('/opt/node/bin/node',1001);assert.deepEqual(Object.keys(e).sort(),['CASTLINK_CI_FIXED_ACTOR','CASTLINK_CI_NODE_UID','CI','GITHUB_ACTIONS','LANG','PATH']);assert.equal(e.PATH,'/opt/node/bin');assert.equal(e.CASTLINK_CI_FIXED_ACTOR,'1');});
test('both suite results are required and failures cannot become success',()=>{assert.equal(typeof api.suiteResult,'function');assert.equal(api.suiteResult(0,0),0);for(const statuses of [[1,0],[0,1],[null,0],[0,null]])assert.equal(api.suiteResult(...statuses),1);});

test('CI partition is explicit Linux opt-in; platform or marker drift refuses',()=>{assert.doesNotThrow(()=>api.validateCiMode('linux','x64',{CI:'true',GITHUB_ACTIONS:'true'}));for(const [platform,arch,env] of [['win32','x64',{CI:'true',GITHUB_ACTIONS:'true'}],['linux','arm64',{CI:'true',GITHUB_ACTIONS:'true'}],['linux','x64',{CI:'true'}]])assert.throws(()=>api.validateCiMode(platform,arch,env));});

test('actual executable admission accepts private bytes and rejects aliases and writable executable bytes',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'castlink-ci-admission-')),exe=path.join(dir,'node');
 try{
  fs.writeFileSync(exe,'benign fixture bytes',{mode:0o700});assert.equal(api.admitExecutable(exe),exe);
  fs.symlinkSync(exe,path.join(dir,'alias'));assert.throws(()=>api.admitExecutable(path.join(dir,'alias')));
  fs.chmodSync(exe,0o720);assert.throws(()=>api.admitExecutable(exe));fs.chmodSync(exe,0o700);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('fixed admission diagnostics retain phase and finite reason but no paths, environment or stack',()=>{
 assert.equal(typeof api.admissionDiagnostic,'function');
 const unknown=api.admissionDiagnostic(Object.assign(Error('PRIVATE_SECRET_BYTES /private/path'),{code:'EACCES'}),'closure');
 assert.deepEqual(unknown,{schemaVersion:1,phase:'closure',reason:'io-permission'});
 assert.equal(JSON.stringify(unknown).includes('PRIVATE_SECRET_BYTES'),false);
 assert.equal(api.admissionDiagnostic(Error('secret'),'arbitrary-secret-phase').phase,'unknown');
 assert.equal(api.admissionDiagnostic(Object.assign(Error('secret'),{code:'SECRET'}),'node-admission').reason,'io-other');
});
test('actual compiled repository closure is admitted; missing required output and foreign output refuse finitely',()=>{
 assert.equal(typeof api.checkCliClosure,'function');
 assert.doesNotThrow(()=>api.checkCliClosure());
 const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),compiled=path.join(repository,'apps/cli/dist/service-target-runner.js'),moved=compiled+'.retained.js';
 fs.renameSync(compiled,moved);
 try{let thrown;try{api.checkCliClosure();}catch(e){thrown=e;}assert.ok(thrown);assert.deepEqual(api.admissionDiagnostic(thrown,'closure'),{schemaVersion:1,phase:'closure',reason:'io-missing'});}finally{fs.renameSync(moved,compiled);}
 const foreign=path.join(repository,'apps/cli/dist/foreign-non-code.fixture');fs.writeFileSync(foreign,'PRIVATE_SECRET_BYTES',{flag:'wx',mode:0o600});
 try{let thrown;try{api.checkCliClosure();}catch(e){thrown=e;}assert.ok(thrown);assert.deepEqual(api.admissionDiagnostic(thrown,'closure'),{schemaVersion:1,phase:'closure',reason:'closure-unexpected-entry'});assert.equal(JSON.stringify(api.admissionDiagnostic(thrown,'closure')).includes('PRIVATE_SECRET_BYTES'),false);}finally{fs.unlinkSync(foreign);}
 const dir=fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'castlink-ci-closure-'));
 try{let thrown;try{api.checkCliClosure(dir);}catch(e){thrown=e;}assert.ok(thrown);assert.deepEqual(api.admissionDiagnostic(thrown,'closure'),{schemaVersion:1,phase:'closure',reason:'io-missing'});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('running Linux Node is staged from its held kernel inode as shared read-only tool bytes, not global chmod',()=>{
 assert.equal(typeof api.stageRunningNode,'function');
 const parent=path.dirname(fileURLToPath(import.meta.url)),before=fs.statSync(process.execPath);
 const staged=api.stageRunningNode(parent);
 try{
  assert.equal(fs.statSync(staged.directory).mode&0o777,0o711);
  assert.equal(fs.statSync(staged.node).mode&0o777,0o555);
  assert.equal(fs.statSync(staged.node).uid,process.getuid());
  assert.equal(fs.statSync(staged.node).size,before.size);
  assert.equal(staged.sha256,api.runningNodeSha256());
  assert.equal(api.admitExecutable(staged.node),staged.node);
  assert.deepEqual(fs.readdirSync(staged.directory),['node']);
  assert.equal(fs.statSync(process.execPath).mode,before.mode);
  // Simulate the measured CI mode on ONLY this owned copy, never the global toolcache.
  fs.chmodSync(staged.node,0o777);assert.throws(()=>api.admitExecutable(staged.node));
  const source=new URL('../test-cli-ci.mjs',import.meta.url).href;
  const code=`import {stageRunningNode,admitExecutable} from ${JSON.stringify(source)};const s=stageRunningNode(${JSON.stringify(parent)});try{admitExecutable(s.node);console.log(JSON.stringify({sha256:s.sha256,uid:process.getuid(),gid:process.getgid()}));}finally{s.dispose();}`;
  const result=JSON.parse(execFileSync(staged.node,['--input-type=module','-e',code],{env:{},encoding:'utf8',timeout:10000,maxBuffer:4096}));
  assert.equal(result.sha256,staged.sha256);assert.equal(result.uid,process.getuid());assert.equal(result.gid,process.getgid());
 }finally{staged.dispose();}
 assert.equal(fs.existsSync(staged.directory),false);
});

test('tool staging refuses a group-writable non-sticky parent without creating a candidate',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'castlink-ci-staging-parent-'));
 try{fs.chmodSync(dir,0o770);assert.throws(()=>api.stageRunningNode(dir));assert.deepEqual(fs.readdirSync(dir),[]);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
