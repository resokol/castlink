import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
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
