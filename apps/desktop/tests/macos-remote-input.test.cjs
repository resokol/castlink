'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {PassThrough}=require('node:stream'),{EventEmitter}=require('node:events');
const {createRemotePcInputController}=require('../src/remote-pc-input.cjs');
const {bindSelectedSource}=require('../src/remote-pc-capture.cjs');
const {nativeResourceAvailable,RESOURCE}=require('../src/remote-pc-desktop.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mac-input-'));fs.mkdirSync(path.join(root,'remote-input'));fs.writeFileSync(path.join(root,'remote-input/CastLink.RemoteInput'),RESOURCE,{mode:0o755});
 const commands=[],states=[];let child,args;const controller=createRemotePcInputController({platform:'darwin',resourcesPath:root,onState:value=>states.push(value),now:()=>100000,spawn:(...v)=>{args=v;child=new EventEmitter();for(const k of ['stdin','stdout','stderr'])child[k]=new PassThrough();child.kill=()=>{};let buffer='';child.stdin.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\n')){const i=buffer.indexOf('\n'),c=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);commands.push(c);queueMicrotask(()=>child.stdout.write(JSON.stringify({id:c.id,ok:true,state:{captureId:'mac-capture',geometry:{width:800,height:600,revision:1},ready:true,pointerReady:true,active:c.op==='renew'}})+'\n'));}});return child;}});
 const binding={captureId:'mac-capture',source:{kind:'window',windowId:'42'},video:{width:800,height:600},mapping:{kind:'macos-window'},fullInputPause:true};
 const proof={captureId:'mac-capture',grantId:'grant',revision:1,leaseSerial:1,geometryRevision:1,expiresAt:100700};
 const frame={captureId:'mac-capture',grantId:'grant',revision:1,geometryRevision:1,lane:'reliable',seq:1,moveBarrier:0,expiresAt:100200,event:{type:'heartbeat',pressedKeys:[],pressedButtons:[]}};
 return {controller,commands,states,binding,proof,frame,root,get args(){return args;},get child(){return child;},cleanup:async()=>{await controller.stop();fs.rmSync(root,{recursive:true,force:true});}};
}
test('mac picker binds exact CGWindowID and CGDirectDisplayID, not a Windows HWND or DIP rectangle',()=>{
 assert.deepEqual(bindSelectedSource({id:'window:42:0'},null,'darwin'),{kind:'window',windowId:'42'});
 assert.deepEqual(bindSelectedSource({id:'screen:0:0',display_id:'7'},{getAllDisplays:()=>[{id:7}]},'darwin'),{kind:'screen',displayId:'7'});
 assert.throws(()=>bindSelectedSource({id:'window:4294967296:0'},null,'darwin'));
 assert.throws(()=>bindSelectedSource({id:'screen:0:0',display_id:'8'},{getAllDisplays:()=>[{id:7}]},'darwin'));
});
test('mac main adapter launches fixed helper without shell and preserves lease/replay gate',async()=>{
 const f=fixture();try{
  await f.controller.bind({...f.binding,fullInputPause:false});assert.equal(f.commands[0].fullInputPause,true);assert.equal(f.args[0],path.join(f.root,'remote-input/CastLink.RemoteInput'));assert.deepEqual(f.args[1],[]);assert.equal(f.args[2].shell,false);
  await assert.rejects(f.controller.input(f.frame),{code:'REMOTE_INPUT_LEASE'});
  await assert.rejects(f.controller.activate({...f.proof,expiresAt:100751}),{code:'REMOTE_INPUT_LEASE'});
  await f.controller.activate(f.proof);await f.controller.input(f.frame);await assert.rejects(f.controller.input(f.frame),{code:'REMOTE_INPUT_REPLAY'});
  await f.controller.input({...f.frame,seq:2,event:{type:'text',text:'Привет 中文 😀'}});
  await f.controller.retireAuthority();await assert.rejects(f.controller.input({...f.frame,seq:3}),{code:'REMOTE_INPUT_LEASE'});
  assert.equal(f.commands.filter(c=>c.op==='start').length,1);
 }finally{await f.cleanup();}
});
test('mac adapter rejects cross-platform source and mapping before starting process',async()=>{
 const f=fixture();try{
  for(const binding of [{...f.binding,source:{kind:'window',hwnd:'42'}},{...f.binding,mapping:{kind:'dwm-frame'}},{...f.binding,source:{kind:'window',windowId:'4294967296'}}])await assert.rejects(f.controller.bind(binding),{code:'REMOTE_INPUT_SOURCE'});
  assert.equal(f.args,undefined);
  await f.controller.bind({...f.binding,source:{kind:'screen',displayId:'7'},mapping:{kind:'macos-display'}});
 }finally{await f.cleanup();}
});
test('mac capability requires packaged executable resource marker',()=>{
 const f=fixture();try{assert.equal(nativeResourceAvailable(f.root,'darwin'),true);fs.chmodSync(path.join(f.root,'remote-input/CastLink.RemoteInput'),0o644);assert.equal(nativeResourceAvailable(f.root,'darwin'),false);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
});

test('native Input Monitoring loss retains a finite actionable diagnostic and closes the gate',async()=>{
 const f=fixture();try{
  await f.controller.bind(f.binding);await f.controller.activate(f.proof);await f.controller.input(f.frame);
  f.child.stdout.write(JSON.stringify({event:'state',state:{captureId:'mac-capture',geometry:{width:800,height:600,revision:1},ready:false,pointerReady:false,active:false,needsEmptyReset:true,error:'REMOTE_INPUT_MONITORING_PERMISSION'}})+'\n');
  assert.equal(f.states.at(-1).error,'REMOTE_INPUT_MONITORING_PERMISSION');
  await assert.rejects(f.controller.input({...f.frame,seq:2}),{code:'REMOTE_INPUT_LEASE'});
  // A pending native error must survive sanitization as a finite public code.
  const pending=f.controller.renew({...f.proof,leaseSerial:2});await assert.rejects(pending,{code:'REMOTE_INPUT_LEASE'});
 }finally{await f.cleanup();}
});

test('native fixture fails on real binding defects instead of calling granted permissions unavailable',()=>{
 const {startFailure}=require('../../../native/macos-remote-input/fixture-policy.cjs');
 const granted={screen:true,accessibility:true,inputMonitoring:true};
 assert.deepEqual(startFailure({ok:false,error:'REMOTE_INPUT_SOURCE',diagnostic:{stage:'process-start'}},granted),{status:'FAILED',reason:'REMOTE_INPUT_SOURCE',bindingDiagnostic:{stage:'process-start'}});
 assert.equal(startFailure({ok:true,state:{ready:true,pointerReady:false}},granted).status,'FAILED');
 assert.equal(startFailure({ok:false,error:'REMOTE_INPUT_UNAVAILABLE'},{...granted,screen:false}).status,'NOT VERIFIED');
 assert.equal(startFailure({ok:true,state:{ready:true,pointerReady:true}},granted),null);
});

test('binary corner fiducials prove orientation and geometry without display primary color assumptions',()=>{
 const {assertCornerFiducials}=require('../../../native/macos-remote-input/fixture-policy.cjs');
 const capture={verified:true,width:1280,height:960,sampleColorSpace:'sRGB',markerScheme:'castlink-binary-corners-v1',fiducials:[
  {corner:'top-left',pixels:[[40,40],[88,40]],samples:[[0,0,0],[0,0,0]]},
  {corner:'top-right',pixels:[[1160,40],[1208,40]],samples:[[0,0,0],[1,1,1]]},
  {corner:'bottom-left',pixels:[[40,840],[88,840]],samples:[[1,1,1],[0,0,0]]},
  {corner:'bottom-right',pixels:[[1160,840],[1208,840]],samples:[[1,1,1],[1,1,1]]},
 ]};
 assertCornerFiducials(capture,{width:1280,height:960,scale:2});
 const rejects=change=>{const altered=structuredClone(capture);change(altered);assert.throws(()=>assertCornerFiducials(altered,{width:1280,height:960,scale:2}));};
 rejects(v=>[v.fiducials[1],v.fiducials[2]]=[v.fiducials[2],v.fiducials[1]]);
 rejects(v=>v.fiducials.pop());
 rejects(v=>v.fiducials[1].samples=[[0,0,0],[0,0,0]]);
 rejects(v=>v.fiducials[0].samples=[[1,1,1],[1,1,1]]);
 rejects(v=>v.fiducials[0].samples[0]=[0.5,0.5,0.5]);
 rejects(v=>v.fiducials[0].samples[0]=[0.01684,0.19834,1]);
 rejects(v=>v.fiducials[0].samples[0]=[0.151,0,0]);
 rejects(v=>v.fiducials[1].samples[1]=[0.849,1,1]);
 rejects(v=>v.fiducials[0].pixels[0][0]++);
 rejects(v=>v.width++);
 const permitted=structuredClone(capture);permitted.fiducials[0].samples[0]=[0.149,0.149,0.149];permitted.fiducials[1].samples[1]=[0.851,0.851,0.851];assertCornerFiducials(permitted,{width:1280,height:960,scale:2});
});

test('native watchdog fixture joins independent key-up/state streams and refuses lease-expiry substitutes',async()=>{
 const {waitForReceiverWatchdog}=require('../../../native/macos-remote-input/fixture-policy.cjs');
 let now=500,polls=0,state={active:true,needsEmptyReset:false,ready:true,pointerReady:true,geometry:{revision:5}};
 const up={event:'keyUp',keyCode:8,observedMonotonic:500};
 const result=await waitForReceiverWatchdog({readEvents:()=>[up],readState:()=>state,keyCode:8,afterIndex:0,heartbeatSentMonotonic:0,leaseDeadlineMonotonic:700,geometryRevision:5,now:()=>now,wait:async()=>{now+=25;if(++polls===2)state={...state,active:false,needsEmptyReset:true,error:'REMOTE_INPUT_REPLAY'};},timeoutMs:100});
 assert.equal(polls,2,'observed UP must wait for the independent state pipe');assert.equal(result.keyUpAfterHeartbeatMs,500);assert.equal(result.state.needsEmptyReset,true);
 const paused={...state};
 async function rejected(events,extra={}){let time=500;await assert.rejects(waitForReceiverWatchdog({readEvents:()=>events,readState:()=>paused,keyCode:8,afterIndex:0,heartbeatSentMonotonic:0,leaseDeadlineMonotonic:700,geometryRevision:5,now:()=>time,wait:async()=>{time+=25;},timeoutMs:50,...extra}));}
 await rejected([{...up,observedMonotonic:700}]);
 await rejected([{...up,observedMonotonic:200}]);
 await rejected([up],{afterIndex:1});
 await rejected([up],{geometryRevision:6});
 await rejected([]);
 await rejected([up],{readState:()=>({...paused,active:true,needsEmptyReset:false})});
 await rejected([{...up,observedMonotonic:NaN}]);
});

test('fixture UI barriers wait for newer native geometry and readiness instead of a cross-process sleep',async()=>{
 const {waitForNativeTransition}=require('../../../native/macos-remote-input/fixture-policy.cjs');
 const initial={captureId:'capture',active:true,needsEmptyReset:false,ready:true,pointerReady:true,geometry:{revision:4},rect:{x:10,y:20,width:640,height:480}};
 let state=initial,time=0,polls=0;
 const paused=await waitForNativeTransition({readState:()=>state,captureId:'capture',afterRevision:4,pointerReady:false,phase:'occlude',now:()=>time,wait:async()=>{time+=10;if(++polls===3)state={...initial,active:false,needsEmptyReset:true,pointerReady:false,geometry:{revision:5}};},timeoutMs:100});
 assert.equal(polls,3);assert.equal(paused.geometry.revision,5);
 async function reject(value,extra={}){let clock=0;await assert.rejects(waitForNativeTransition({readState:()=>value,captureId:'capture',afterRevision:4,pointerReady:false,phase:'occlude',now:()=>clock,wait:async()=>{clock+=10;},timeoutMs:30,...extra}));}
 await reject({...paused,geometry:{revision:4}});
 await reject({...paused,active:true});
 await reject({...paused,ready:false});
 await reject({...paused,stopped:true});
 await reject({...paused,needsEmptyReset:false});
 await reject({...paused,captureId:'foreign'});
 await reject(paused,{rect:{x:11,y:20,width:640,height:480}});
 const restored={...paused,geometry:{revision:6},pointerReady:true};
 assert.equal((await waitForNativeTransition({readState:()=>restored,captureId:'capture',afterRevision:5,pointerReady:true,phase:'focus',timeoutMs:30})).geometry.revision,6);
});

test('EOF fixture starts a new helper only after the stopped owned child has closed cleanly',async()=>{
 const {waitForStoppedHelper}=require('../../../native/macos-remote-input/fixture-policy.cjs');
 let close,settled=false;
 const pending=waitForStoppedHelper({closed:new Promise(resolve=>{close=resolve;}),timeoutMs:100}).then(value=>{settled=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false,'Stop acknowledgement is not process exit');
 close({code:0,signal:null});assert.deepEqual(await pending,{code:0,signal:null});
 await assert.rejects(waitForStoppedHelper({closed:Promise.resolve({code:1,signal:null}),timeoutMs:100}));
 await assert.rejects(waitForStoppedHelper({closed:Promise.resolve({code:0,signal:'SIGTERM'}),timeoutMs:100}));
 await assert.rejects(waitForStoppedHelper({closed:new Promise(()=>{}),timeoutMs:5}),/stopped helper did not close/);
});
