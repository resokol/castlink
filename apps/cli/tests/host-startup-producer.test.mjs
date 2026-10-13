import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture} from './host-startup-producer-fixture.mjs';
test('protected normal completion publishes descriptor and durable RUN then returns terminal epoch',()=>fixture(async f=>{
 const result=await f.runProducer();assert.equal(result.code,0,result.out+result.err);
 const response=JSON.parse(result.out),descriptor=JSON.parse(fs.readFileSync(f.file)),desired=JSON.parse(fs.readFileSync(f.desiredFile));
 assert.equal(response.generation.epoch,1);assert.equal(response.closedProcessNonce,'a'.repeat(64));assert.deepEqual(descriptor,f.descriptor);assert.equal(desired.desired,'RUN');assert.equal(desired.source,'verified-setup');assert.equal(desired.associationDigest,response.associationDigest);
 assert.equal(fs.statSync(f.file).mode&0o777,0o600);assert.equal(fs.statSync(f.desiredFile).mode&0o777,0o600);
 const state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.start,0);assert.equal(state.stop,0);assert.ok(state.http.every(x=>x.method==='GET'));assert.ok(state.control.every(x=>x.request.operation==='status'));
 assert.equal(result.err,'');assert.ok(!result.out.includes('PRIVATE_CONTROL_SECRET'));
}));
for(const [label,patch] of Object.entries({
 'SQL still pending':{sql:'pending'},'owner bytes differ':{ownerMismatch:true},
 'version differs':{badVersion:true},'foreign resources':{foreign:true},
 'engine changes inside operation':{engineFlip:true},'private binary differs':{badHash:true},
 'runtime restarts before publication':{restartOnStatus:2},'control reply is lost':{controlError:true},
}))test(label+' refuses publication and retains uncertainty',()=>fixture(async f=>{
 await f.change(patch);const result=await f.runProducer();assert.equal(result.code,4);assert.equal(result.out,'host-producer-unverified\n');assert.equal(result.err,'');
 assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);assert.equal(fs.existsSync(f.scope+'/active'),true);
 const state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.start,0);assert.equal(state.stop,0);assert.ok(state.control.every(x=>x.request.operation==='status'));assert.ok((state.http??[]).every(x=>x.method==='GET'));
}));
test('stale generation cannot acquire or publish',()=>fixture(async f=>{
 fs.writeFileSync(f.scope+'/epoch.json',JSON.stringify({epoch:1}),{mode:0o600});const result=await f.runProducer();assert.equal(result.code,4);assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);assert.equal(fs.existsSync(f.scope+'/active'),false);
}));
test('descriptor fsync failure leaves partial publication fenced without RUN or secret errors',()=>fixture(async f=>{
 const prefix=`const originalOpen=fs.openSync,originalSync=fs.fsyncSync;let publication;fs.openSync=(file,...args)=>{const fd=originalOpen(file,...args);if(file===${JSON.stringify(f.file)})publication=fd;return fd};fs.fsyncSync=fd=>{if(fd===publication)throw Error('PRIVATE_SECRET_fsync');return originalSync(fd)};`;
 const result=await f.runProducer({},prefix);assert.equal(result.code,4);assert.equal(result.out,'host-producer-unverified\n');assert.equal(result.err,'');assert.equal(fs.existsSync(f.file),true);assert.equal(fs.existsSync(f.desiredFile),false);assert.equal(fs.existsSync(f.scope+'/active'),true);
 assert.equal((await f.serviceRun(0)).code,4);
}));
test('restart during terminal publication cannot release RUN authority',()=>fixture(async f=>{
 await f.change({restartOnStatus:3});const result=await f.runProducer();assert.equal(result.code,4);assert.equal(fs.existsSync(f.file),true);assert.equal(JSON.parse(fs.readFileSync(f.desiredFile)).desired,'RUN');assert.equal(fs.existsSync(f.scope+'/active'),true);
 const owner=fs.readFileSync(f.scope+'/active/owner.json');const activation=await f.run('reconcile');assert.equal(JSON.parse(activation.out).outcome,'unknown');assert.equal(JSON.parse(activation.out).lease,'unknown');assert.ok(fs.readFileSync(f.scope+'/active/owner.json').equals(owner));const state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.sealed,true);assert.equal(state.start,0);assert.ok(state.control.every(x=>x.request.operation==='status'));
}));
test('producer actual child lease excludes retained start-services until verified release',()=>fixture(async f=>{
 const held=f.state+'.producer-held',proceed=f.state+'.producer-continue';
 const prefix=`const originalWrite=fs.writeFileSync;let waited=false;fs.writeFileSync=(file,bytes,...args)=>{const result=originalWrite(file,bytes,...args);if(!waited&&file===process.env.FIXTURE_STATE&&JSON.parse(bytes).http?.length){waited=true;originalWrite(${JSON.stringify(held)},'held');const deadline=Date.now()+10000;while(!fs.existsSync(${JSON.stringify(proceed)})){if(Date.now()>deadline)throw Error('fixture timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10)}}return result};`;
 const child=f.launchProducer({},prefix),deadline=Date.now()+8000;
 try{while(!fs.existsSync(held)){assert.ok(Date.now()<deadline,'producer acquired lease and reached GET');await new Promise(r=>setTimeout(r,10))}
  assert.equal(fs.existsSync(f.scope+'/active'),true);assert.equal((await f.serviceRun(0)).code,4);assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);
 }finally{fs.writeFileSync(proceed,'continue')}
 const result=await child.done;assert.equal(result.code,0,result.out+result.err);assert.equal(fs.existsSync(f.scope+'/active'),false);assert.equal(JSON.parse(fs.readFileSync(f.scope+'/epoch.json')).epoch,1);
}));
test('missing protected normal completion cannot manufacture RUN',()=>fixture(async f=>{
 fs.unlinkSync(f.request.completion.attempt.path);const result=await f.runProducer();assert.equal(result.code,4);assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);assert.equal(fs.existsSync(f.scope+'/active'),true);
}));
test('missing private state anchor never auto-initializes',()=>fixture(async f=>{
 const anchor=f.descriptor.control.stateDir+'.initialized';fs.unlinkSync(anchor);const result=await f.runProducer();assert.equal(result.code,4);assert.equal(fs.existsSync(anchor),false);assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);
 const state=JSON.parse(fs.readFileSync(f.state));assert.deepEqual(state.control,[]);assert.equal(state.start,0);assert.equal(state.stop,0);
}));
test('alternate caller principal and scope cannot enter target lease',()=>fixture(async f=>{
 for(const generation of [{...f.request.generation,principal:process.getuid()+1},{...f.request.generation,scope:f.scope+'-alias'}]){const result=await f.runProducer({generation});assert.equal(result.code,4);assert.equal(fs.existsSync(f.scope+'/active'),false)}
 assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);
}));
test('selected endpoint differs inside held lease and blocks publication',()=>fixture(async f=>{
 const result=await f.runProducer({generation:{...f.request.generation,endpoint:'unix:///foreign'}});assert.equal(result.code,4);assert.equal(fs.existsSync(f.scope+'/active'),true);assert.equal(fs.existsSync(f.file),false);assert.equal(fs.existsSync(f.desiredFile),false);assert.deepEqual(JSON.parse(fs.readFileSync(f.state)).control,[]);
}));
test('published normal RUN drives accepted autonomous activation and terminal STOP without recreate',()=>fixture(async f=>{
 const original=JSON.parse(fs.readFileSync(f.state)),identities=original.containers.map(c=>c.Id);
 assert.equal((await f.runProducer()).code,0);
 const activated=JSON.parse((await f.run('reconcile')).out);assert.equal(activated.outcome,'open');assert.equal(activated.lease,'released');
 let state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.sealed,false);assert.equal(state.start,0);assert.deepEqual(state.containers.map(c=>c.Id),identities);
 const seal=state.control.find(x=>x.request.operation==='seal').request,unseal=state.control.find(x=>x.request.operation==='unseal').request;
 assert.equal(seal.processNonce,'a'.repeat(64));assert.equal(unseal.processNonce,seal.processNonce);assert.equal(unseal.epoch,seal.epoch);assert.deepEqual(unseal.binding,seal.binding);
 const stopped=JSON.parse((await f.run('stop')).out);assert.equal(stopped.outcome,'stopped');assert.equal(stopped.lease,'released');assert.equal(JSON.parse(fs.readFileSync(f.desiredFile)).desired,'STOP');
 state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.sealed,true);assert.equal(state.stop,1);assert.ok(state.containers.every(c=>!c.Running));assert.deepEqual(state.containers.map(c=>c.Id),identities);
 const controlCount=state.control.length;assert.equal(JSON.parse((await f.run('reconcile')).out).outcome,'stopped');state=JSON.parse(fs.readFileSync(f.state));assert.equal(state.start,0);assert.equal(state.control.length,controlCount);
}));
