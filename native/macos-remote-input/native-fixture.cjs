'use strict';
// Real macOS child/window/capture fixture. It never injects into another app.
// Run after compiling the helper and fixture; no permissions are changed here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {startFailure}=require('./fixture-policy.cjs');
const root=path.resolve(__dirname,'../..');
const helper=process.argv[2],fixture=process.argv[3],artifact=process.argv[4]||path.join(root,'artifacts/macos-input-native.json');
const evidence={schemaVersion:1,platform:process.platform,arch:process.arch,status:'NOT VERIFIED',checks:[],physicalHolds:'NOT VERIFIED: requires physical keyboard/mouse',spaces:'NOT VERIFIED: requires interactive Space switching',mixedRetinaDisplays:'NOT VERIFIED: requires multiple displays'};
let a,b;
function traceNative(command,reply){evidence.nativeTrace??=[];evidence.nativeTrace.push({command,reply});if(evidence.nativeTrace.length>12)evidence.nativeTrace.shift();}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function processLines(executable,args=[]){
 const child=spawn(executable,args,{shell:false,stdio:['pipe','pipe','pipe']});let buffer='',sequence=0;const pending=new Map(),events=[];
 child.stdout.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\n')){const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);let value;try{value=JSON.parse(line);}catch{continue;}events.push(value);if(pending.has(value.id)){const p=pending.get(value.id);pending.delete(value.id);clearTimeout(p.timer);p.resolve(value);}}});
 child.stderr.resume();child.on('error',error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();});
 return{child,events,request(op,fields={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('native fixture command timeout'));},2500);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,op,...fields})+'\n');});},async until(predicate){for(let count=0;count<400;count++){const value=events.find(predicate);if(value)return value;await delay(25);}throw Error('native fixture event timeout');}};
}
(async()=>{
 try{
  if(process.platform!=='darwin')throw Error('macOS required');
  fs.mkdirSync(path.dirname(artifact),{recursive:true});
  assert.ok(helper&&fixture,'supply compiled helper and NativeFixture paths');
  evidence.helperPermissions=JSON.parse(execFileSync(helper,['--permission-status'],{shell:false,encoding:'utf8',timeout:3000,maxBuffer:2048,stdio:['ignore','pipe','pipe']}));
  for(const key of ['screen','accessibility','inputMonitoring'])assert.equal(typeof evidence.helperPermissions[key],'boolean');
  b=processLines(fixture,[artifact.replace(/\.json$/,'.png')]);const ready=await b.until(v=>v.event==='ready'||v.event==='unavailable');if(ready.event==='unavailable'){evidence.reason=ready.reason;return;}evidence.permissions={screen:ready.screenPermission,accessibility:ready.accessibilityPermission,inputMonitoring:ready.inputMonitoringPermission};evidence.fixtureIdentity=ready.fixtureIdentity;evidence.fixtureGeometry={rect:ready.rect,width:ready.width,height:ready.height,scale:ready.scale};
  a=processLines(helper);
  let r=await a.request('start',{captureId:'native-fixture',source:{kind:'window',windowId:ready.windowId},video:{width:ready.width,height:ready.height},mapping:{kind:'macos-window'},fullInputPause:true});
  evidence.initialNativeState=r.state;evidence.bindingDiagnostic=r.diagnostic;
  const initialFailure=startFailure(r,evidence.helperPermissions);if(initialFailure){Object.assign(evidence,initialFailure);if(evidence.status==='FAILED')process.exitCode=1;return;}
  let state=r.state,seq=0,serial=0,heldKeys=[],heldButtons=[];
  const refresh=()=>{for(const v of a.events)if(v.state)state=v.state;};
  const frame=(event,overrides={})=>{refresh();return{captureId:'native-fixture',grantId:'fixture-grant',revision:1,geometryRevision:state.geometry.revision,lane:'reliable',seq:++seq,moveBarrier:0,expiresAt:Date.now()+500,event,...overrides};};
  const send=async(event,overrides={})=>{const request=frame(event,overrides),result=await a.request('input',request);traceNative({op:'input',type:event.type,...(event.code?{code:event.code}:{}),...(event.down!==undefined?{down:event.down}:{}),seq:request.seq,geometryRevision:request.geometryRevision},result);if(result.state)state=result.state;return result;};
  const renew=async(activate=false,extra={})=>{refresh();const result=await a.request('renew',{captureId:'native-fixture',grantId:'fixture-grant',revision:1,leaseSerial:++serial,geometryRevision:state.geometry.revision,expiresAt:Date.now()+700,activate,...extra});traceNative({op:'renew',activate,serial},result);if(result.state)state=result.state;return result;};
  const arm=async(activate=false)=>{assert.equal((await renew(activate)).ok,true);assert.equal((await send({type:'heartbeat',pressedKeys:heldKeys,pressedButtons:heldButtons})).ok,true);};
  const check=name=>evidence.checks.push(name);
  assert.equal((await send({type:'key',code:'KeyA',down:true,repeat:false})).error,'REMOTE_INPUT_LEASE');seq=0;check('no input before explicit grant');
  assert.equal((await renew(true,{expiresAt:Date.now()+1500})).error,'REMOTE_INPUT_LEASE');check('overlong lease rejected');
  await arm(true);
  let last=await send({type:'key',code:'KeyA',down:true,repeat:false});assert.equal(last.ok,true);heldKeys=['KeyA'];await b.until(v=>v.event==='keyDown'&&v.keyCode===0);
  const before=b.events.length,replay=await a.request('input',frame({type:'key',code:'KeyA',down:true,repeat:false},{seq}));assert.equal(replay.error,'REMOTE_INPUT_REPLAY');seq--;await delay(50);assert.equal(b.events.slice(before).filter(v=>v.event==='keyDown').length,0);assert.equal(replay.state.needsEmptyReset,true);heldKeys=[];await b.until(v=>v.event==='keyUp'&&v.keyCode===0);check('real key delivery and replay rejected without another keyDown; failed command releases and requires fresh receiver reset');
  await arm();const textStart=b.events.length;assert.equal((await send({type:'text',text:'é中文😀'})).ok,true);await delay(150);assert.ok(b.events.slice(textStart).filter(v=>v.event==='keyDown').map(v=>v.characters||'').join('').includes('é中文😀'));check('real Unicode text delivery');
  await arm();assert.equal((await send({type:'button',button:0,down:true,x:32768,y:32768})).ok,true);heldButtons=[0];const mouse=await b.until(v=>v.event==='mouseDown');assert.ok(Math.abs(mouse.x-320)<=3&&Math.abs(mouse.y-240)<=3,JSON.stringify(mouse));assert.equal((await send({type:'button',button:0,down:false,x:32768,y:32768})).ok,true);heldButtons=[];check('normalized pointer maps to actual fixture center in desktop points');
  await arm();assert.equal((await send({type:'key',code:'KeyB',down:true,repeat:false})).ok,true);heldKeys=['KeyB'];await b.until(v=>v.event==='keyDown'&&v.keyCode===11);assert.equal((await a.request('releaseAll')).ok,true);heldKeys=[];await b.until(v=>v.event==='keyUp'&&v.keyCode===11);check('revoke releases native held key');
  const oldRevision=state.geometry.revision;await b.request('move');await delay(150);refresh();assert.ok(state.geometry.revision>oldRevision);assert.equal((await send({type:'key',code:'KeyA',down:true,repeat:false},{geometryRevision:oldRevision})).error,'REMOTE_INPUT_GEOMETRY');seq--;check('window translation invalidates geometry authority');
  await arm();await b.request('occlude');await delay(150);refresh();assert.equal(state.pointerReady,false);const blocked=await send({type:'key',code:'KeyA',down:true,repeat:false});assert.equal(blocked.ok,false);seq--;check('occluded or unfocused window fails closed');
  await b.request('focus');await delay(150);await arm();assert.equal((await send({type:'key',code:'KeyC',down:true,repeat:false})).ok,true);heldKeys=['KeyC'];await b.until(v=>v.event==='keyDown'&&v.keyCode===8);await delay(550);await b.until(v=>v.event==='keyUp'&&v.keyCode===8);heldKeys=[];refresh();assert.equal(state.needsEmptyReset,true);check('independent 500ms receiver watchdog releases held key');
  const capture=await b.request('capture');assert.equal(capture.verified,true,'real ScreenCaptureKit capture unavailable');assert.equal(capture.width,ready.width);assert.equal(capture.height,ready.height);assert.equal(capture.sampleColorSpace,'sRGB','fixture marker comparison must use explicit sRGB');
  const expected=[[1,0,0],[0,1,0],[0,0,1],[1,1,0]];assert.ok(capture.samples.every((rgb,i)=>rgb.length===3&&rgb.every((n,c)=>Math.abs(n-expected[i][c])<0.15)),JSON.stringify(capture.samples));check('real ScreenCaptureKit window crop preserves four corner markers and backing extent');
  await arm();assert.equal((await send({type:'key',code:'KeyE',down:true,repeat:false})).ok,true);await b.until(v=>v.event==='keyDown'&&v.keyCode===14);await a.request('stop');await b.until(v=>v.event==='keyUp'&&v.keyCode===14);check('native stop releases real held key');
  a=processLines(helper);r=await a.request('start',{captureId:'native-fixture',source:{kind:'window',windowId:ready.windowId},video:{width:ready.width,height:ready.height},mapping:{kind:'macos-window'},fullInputPause:true});assert.equal(r.ok,true);state=r.state;seq=0;serial=0;heldKeys=[];heldButtons=[];await arm(true);assert.equal((await send({type:'key',code:'KeyD',down:true,repeat:false})).ok,true);await b.until(v=>v.event==='keyDown'&&v.keyCode===2);a.child.stdin.end();await b.until(v=>v.event==='keyUp'&&v.keyCode===2);check('stdin EOF releases real held key');evidence.status='VERIFIED';
 }catch(error){evidence.status='FAILED';const failed=evidence.nativeTrace?.at(-1);evidence.reason=(failed?JSON.stringify(failed.command)+': ':'')+error.message;if(failed)evidence.failedNativeReply=failed.reply;process.exitCode=1;}
 finally{
  a?.child.stdin.end();b?.child.stdin.end();a?.child.kill();b?.child.kill();fs.mkdirSync(path.dirname(artifact),{recursive:true});fs.writeFileSync(artifact,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
  if(evidence.status==='NOT VERIFIED'&&process.env.CASTLINK_REQUIRE_NATIVE_INPUT==='1')process.exitCode=1;
 }
})();
