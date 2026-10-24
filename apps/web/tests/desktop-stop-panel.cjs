const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const {desktopScreenBridge,createDesktopStopPanel}=load('../lib/desktop-stop-panel.ts');
const labels={locale:'ru',title:'Panel',stop:'STOP',stopping:'Stopping',stopError:'Retry'};
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  assert.equal(desktopScreenBridge({}),undefined);assert.equal(desktopScreenBridge({castlinkDesktop:{version:2}}),undefined);
  let actual='10000000-0000-4000-8000-000000000001';let listener,stateListener,updates=[],stops=0,sharing=true,release,fail=false,detached=0;const states=[];
  const bridge={update:async value=>{updates.push(value);},onStop:fn=>{listener=fn;return()=>{detached++;listener=undefined;};},onState:fn=>{stateListener=fn;return()=>{detached++;stateListener=undefined;};}};
  assert.equal(desktopScreenBridge({castlinkDesktop:{version:1,screenShare:bridge}}),bridge);
  const panel=createDesktopStopPanel({bridge,labels,getCaptureId:()=>actual,isSharing:()=>sharing,onStateChange:s=>states.push(s),stop:async()=>{stops++;if(fail)throw Error('failure');await new Promise(r=>release=r);sharing=false;}});
  assert.equal(await panel.open(),true);const first=updates.at(-1).captureId;assert.equal(first,actual);
  listener('old');await tick();assert.equal(stops,0);listener(first);listener(first);assert.equal(stops,1);release();await tick();assert.equal(updates.at(-1).sharing,false);
  sharing=true;actual='10000000-0000-4000-8000-000000000002';await panel.open();const second=updates.at(-1).captureId;assert.notEqual(first,second);listener(first);assert.equal(stops,1);
  stateListener({captureId:second,state:'closed'});assert.equal(states.at(-1),'closed');assert.equal(sharing,true);
  fail=true;listener(second);await tick();assert.equal(updates.at(-1).failed,true);assert.equal(updates.at(-1).stopping,false);
  actual=undefined;panel.sync();await tick();assert.equal(await panel.open(),false,'untagged canvas cannot reopen an earlier physical capture panel');panel.dispose();await tick();assert.equal(detached,2);assert.equal(updates.at(-1).sharing,false);assert.equal(await panel.open(),false);
  console.log('desktop stop adapter: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
