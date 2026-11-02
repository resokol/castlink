'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {editableRefusalVerified,waitForEditableSnapshot}=require('./preview-fixture.cjs');
const originalBinding='a'.repeat(64),freshBinding='b'.repeat(64);
test('editable focus refusal requires actual rejection and unchanged PDF position',()=>{
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_FOREGROUND',{unchanged:true}),true);
  for(const error of [undefined,null,'WINDOW_SLIDES_UNAVAILABLE','WINDOW_SLIDES_COMMAND'])assert.equal(editableRefusalVerified(error,{unchanged:true}),false);
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_FOREGROUND',{unchanged:false}),false);
});
function snapshotSequence(results){
  let time=0,reads=0;const failures=[];
  return {options:{now:()=>time,wait:async ms=>{time+=ms;},recordFailure:value=>failures.push(value),timeoutMs:300},
    read:async()=>{reads++;return results[Math.min(reads-1,results.length-1)];},failures,
    get reads(){return reads;},get time(){return time;}};
}
test('search transition observes the real editable snapshot after transient owned-window readiness loss',async()=>{
  const unavailable={ok:false,error:'owned-window-not-ready',ownedProcessValid:true};
  const editable={ok:true,focusRole:'AXTextField',observations:['marker:1:286:159:370:26']};
  const sequence=snapshotSequence([unavailable,{ok:true,focusRole:'AXGroup'},editable]);
  assert.equal(typeof waitForEditableSnapshot,'function');
  assert.equal(await waitForEditableSnapshot(sequence.read,sequence.options),editable);
  assert.deepEqual(sequence.failures,[unavailable]);
});
test('search transition fails immediately when owned process identity is lost or unproven',async()=>{
  assert.equal(typeof waitForEditableSnapshot,'function');
  for(const ownedProcessValid of [false,undefined]){
    const sequence=snapshotSequence([{ok:false,error:'owned-window-not-ready',ownedProcessValid},{ok:true,focusRole:'AXTextField'}]);
    await assert.rejects(waitForEditableSnapshot(sequence.read,sequence.options),/Owned Preview AX snapshot unavailable: owned-window-not-ready/);
    assert.equal(sequence.reads,1);
  }
});
test('search transition does not retry unrelated AX failures',async()=>{
  assert.equal(typeof waitForEditableSnapshot,'function');
  const sequence=snapshotSequence([{ok:false,error:'owned-tree-unavailable',ownedProcessValid:true},{ok:true,focusRole:'AXTextField'}]);
  await assert.rejects(waitForEditableSnapshot(sequence.read,sequence.options),/owned-tree-unavailable/);
  assert.equal(sequence.reads,1);
});
test('search transition has one deadline even when readiness and focus remain unavailable',async()=>{
  assert.equal(typeof waitForEditableSnapshot,'function');
  for(const snapshot of [{ok:false,error:'owned-window-not-ready',ownedProcessValid:true},{ok:true,focusRole:'AXGroup'}]){
    const sequence=snapshotSequence([snapshot]);
    await assert.rejects(waitForEditableSnapshot(sequence.read,sequence.options),/Preview search did not expose actual editable focus/);
    assert.equal(sequence.time,300);
    assert.equal(sequence.reads,4);
  }
});
test('search transition rejects an editable snapshot completed after its deadline',async()=>{
  let time=0;
  await assert.rejects(waitForEditableSnapshot(async()=>{
    time=301;return {ok:true,focusRole:'AXTextField'};
  },{now:()=>time,timeoutMs:300}),/readiness deadline/);
});
test('stale editable binding needs independently verified live replacement and persistent stale status',()=>{
  const proof={unchanged:true,oldStatus:'WINDOW_SLIDES_STALE',freshBinding,originalBinding,ownedWindowVerified:true};
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_STALE',proof),true);
  for(const change of [{unchanged:false},{oldStatus:undefined},{oldStatus:'WINDOW_SLIDES_FOREGROUND'},{freshBinding:originalBinding},{freshBinding:'invalid'},{originalBinding:undefined},{ownedWindowVerified:false}]){
    assert.equal(editableRefusalVerified('WINDOW_SLIDES_STALE',{...proof,...change}),false);
  }
});
