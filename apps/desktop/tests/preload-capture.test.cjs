const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function preload(){
  const updates=[],listeners=new Set(),tracks=[];let originalCalls=0;
  class Track extends EventTarget{constructor(kind){super();this.kind=kind;this.readyState='live';}stop(){this.readyState='ended';}}
  const camera=new Track('video'),microphone=new Track('audio');
  const device={async getDisplayMedia(){originalCalls++;const video=new Track('video');tracks.push(video);return {getTracks:()=>[video],getVideoTracks:()=>[video]};}};
  const window={};const context=vm.createContext({window,navigator:{mediaDevices:device},crypto:require('node:crypto').webcrypto,Event,setTimeout,clearTimeout,console});
  const electron={contextBridge:{exposeInMainWorld:(key,value)=>window[key]=value,executeInMainWorld:({func,args=[]})=>vm.runInContext('('+func.toString()+')',context)(...args)},ipcRenderer:{invoke:async(channel,value)=>{if(channel==='castlink:audio-info')return null;if(channel==='castlink:audio-begin')return 'request';updates.push({channel,value});return true;},on:(_channel,fn)=>listeners.add(fn),removeListener:(_channel,fn)=>listeners.delete(fn)}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>electron,process:{argv:['--castlink-role=client','--castlink-locale=ru']},console});
  return {window,device,updates,tracks,camera,microphone,listeners,get originalCalls(){return originalCalls;},stop:id=>{for(const listener of [...listeners])listener({},id);}};
}
test('preload opens STOP for raw getDisplayMedia without server adapter and stops only its screen',async()=>{
  const state=preload();const stream=await state.device.getDisplayMedia({video:true});
  assert.equal(state.originalCalls,1);assert.equal(state.updates.length,1,'native panel opens without web adapter');
  const opened=state.updates[0].value;assert.equal(opened.sharing,true);assert.equal(opened.visible,true);
  let ended=0;stream.getVideoTracks()[0].addEventListener('ended',()=>ended++);
  state.stop('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');assert.equal(stream.getVideoTracks()[0].readyState,'live');
  state.stop(opened.captureId);assert.equal(stream.getVideoTracks()[0].readyState,'ended');assert.equal(ended,1,'SDK receives ended as with OS stop');
  assert.equal(state.camera.readyState,'live');assert.equal(state.microphone.readyState,'live');
  assert.equal(state.updates.at(-1).value.sharing,false);assert.equal(state.listeners.size,0);
});
test('programmatic screen stop removes native panel without synthesizing a second SDK stop',async()=>{
  const state=preload();const stream=await state.device.getDisplayMedia();let ended=0;stream.getVideoTracks()[0].addEventListener('ended',()=>ended++);
  stream.getVideoTracks()[0].stop();assert.equal(state.updates.at(-1).value.sharing,false);assert.equal(state.listeners.size,0);assert.equal(ended,0);
});
