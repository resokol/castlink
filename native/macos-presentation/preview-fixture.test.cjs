'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {editableRefusalVerified}=require('./preview-fixture.cjs');
const originalBinding='a'.repeat(64),freshBinding='b'.repeat(64);
test('editable focus refusal requires actual rejection and unchanged PDF position',()=>{
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_FOREGROUND',{unchanged:true}),true);
  for(const error of [undefined,null,'WINDOW_SLIDES_UNAVAILABLE','WINDOW_SLIDES_COMMAND'])assert.equal(editableRefusalVerified(error,{unchanged:true}),false);
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_FOREGROUND',{unchanged:false}),false);
});
test('stale editable binding needs independently verified live replacement and persistent stale status',()=>{
  const proof={unchanged:true,oldStatus:'WINDOW_SLIDES_STALE',freshBinding,originalBinding,ownedWindowVerified:true};
  assert.equal(editableRefusalVerified('WINDOW_SLIDES_STALE',proof),true);
  for(const change of [{unchanged:false},{oldStatus:undefined},{oldStatus:'WINDOW_SLIDES_FOREGROUND'},{freshBinding:originalBinding},{freshBinding:'invalid'},{originalBinding:undefined},{ownedWindowVerified:false}]){
    assert.equal(editableRefusalVerified('WINDOW_SLIDES_STALE',{...proof,...change}),false);
  }
});
