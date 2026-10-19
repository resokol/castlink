const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStopSession } = require('../src/stop-session.cjs');
const state = {captureId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',sharing:true,visible:true,stopping:false,failed:false,locale:'ru',labels:{title:'Panel',stop:'STOP',stopping:'Stopping',stopError:'Retry'}};
test('hidden panel keeps capture/hotkey and STOP is scoped and single flight', () => {
  const sent=[], views=[], notifications=[];let registered=0,unregistered=0;
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:s=>notifications.push(s),register:()=>{registered++;return true;},unregister:()=>unregistered++});
  session.update(state);assert.equal(registered,1);
  session.hide();assert.equal(sent.length,0);assert.equal(views.at(-1).visible,false);assert.equal(unregistered,0);
  session.stop();session.stop();assert.deepEqual(sent,[state.captureId]);
  session.update({...state,stopping:false,failed:true});session.stop();assert.equal(sent.length,2);
  session.reset();session.stop();assert.equal(sent.length,2);assert.equal(unregistered,1);
});
test('stopped capture ids are retired; late updates cannot reopen or stop a new share', () => {
  const views=[],sent=[];
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:()=>{},register:()=>true,unregister:()=>{}});
  session.update(state);session.update({...state,sharing:false});
  session.update({...state,captureId:'11111111-2222-4333-8444-555555555555'});
  assert.equal(session.update(state),false);session.stop();assert.equal(sent.at(-1),'11111111-2222-4333-8444-555555555555');
  session.reset();
});
test('shortcut conflict is visible without disabling the button', () => {
  const views=[],sent=[];
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:()=>{},register:()=>false,unregister:()=>{}});
  session.update(state);assert.equal(views.at(-1).shortcutAvailable,false);session.stop();assert.equal(sent.length,1);session.reset();
});
