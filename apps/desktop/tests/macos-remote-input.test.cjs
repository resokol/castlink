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
