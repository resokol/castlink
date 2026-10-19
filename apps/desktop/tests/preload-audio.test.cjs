'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture({resumeFails=false,videoFails=false}={}){
 const events=new Map(),calls=[],contexts=[],videos=[];let sequence=0;
 class Track extends EventTarget{constructor(kind){super();this.kind=kind;this.readyState='live';}stop(){this.readyState='ended';}}
 const mic=new Track('audio'),camera=new Track('video');
 const stream=()=>{const tracks=[new Track('video')];videos.push(tracks[0]);return {getTracks:()=>[...tracks],getVideoTracks:()=>tracks.filter(t=>t.kind==='video'),getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),addTrack:t=>tracks.push(t)};};
 class AudioContext{
  constructor(options){assert.equal(options.sampleRate,48000);contexts.push(this);this.state='suspended';}
  createMediaStreamDestination(){this.audio=new Track('audio');return {stream:{getAudioTracks:()=>[this.audio]}};}
  createScriptProcessor(size,inputs,outputs){assert.equal(size,2048);assert.equal(inputs,0,'no microphone input');assert.equal(outputs,2);return this.processor={connect:destination=>{this.connected=destination;},disconnect:()=>{this.disconnected=true;}};}
  async resume(){if(resumeFails)throw Error('resume failed');this.state='running';}
  async close(){this.closed=true;this.state='closed';}
 }
 const window={},devices={async getDisplayMedia(){if(videoFails)throw Error('video backend failed');return stream();}},context=vm.createContext({window,navigator:{mediaDevices:devices},crypto:require('node:crypto').webcrypto,Event,AudioContext,Float32Array,Uint8Array,console});
 const electron={contextBridge:{exposeInMainWorld:(key,value)=>window[key]=value,executeInMainWorld:({func,args=[]})=>vm.runInContext('('+func.toString()+')',context)(...args)},ipcRenderer:{invoke:async(channel,value)=>{calls.push({channel,value});return channel==='castlink:audio-begin'?'display-request':channel==='castlink:audio-info'?{id:'audio-'+(++sequence),sampleRate:48000,channels:2}:true;},on:(channel,fn)=>{if(!events.has(channel))events.set(channel,new Set());events.get(channel).add(fn);},removeListener:(channel,fn)=>events.get(channel)?.delete(fn)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>electron,process:{argv:['--castlink-role=client','--castlink-locale=ru']},console});
 return {devices,calls,contexts,mic,camera,videos,emit:(channel,value)=>{for(const fn of [...events.get(channel)||[]])fn({},value);},listenerCount:()=>[...events.values()].reduce((count,set)=>count+set.size,0),read(context,frames=4){const channels=[new Float32Array(frames),new Float32Array(frames)];context.processor.onaudioprocess({outputBuffer:{getChannelData:i=>channels[i]}});return channels.map(c=>Array.from(c));}};
}
test('PCM is routed only into the screen audio track; wrong capture and malformed frames stay silent',async()=>{
 const f=fixture(),stream=await f.devices.getDisplayMedia({video:true,audio:true});assert.deepEqual(stream.getTracks().map(t=>t.kind),['video','audio']);
 const bytes=new Uint8Array(new Float32Array([.25,-.25,.5,-.5]).buffer);
 f.emit('castlink:audio-data',{id:'old',frames:2,pcm:bytes});f.emit('castlink:audio-data',{id:'audio-1',frames:2,pcm:new Uint8Array(2)});assert.deepEqual(f.read(f.contexts[0]),[[0,0,0,0],[0,0,0,0]]);
 f.emit('castlink:audio-data',{id:'audio-1',frames:2,pcm:bytes});assert.deepEqual(f.read(f.contexts[0]),[[.25,.5,0,0],[-.25,-.5,0,0]]);
 const captureId=f.calls.find(call=>call.channel==='castlink:screen-update').value.captureId;f.emit('castlink:screen-stop',captureId);
 assert.ok(stream.getTracks().every(t=>t.readyState==='ended'));assert.equal(f.mic.readyState,'live');assert.equal(f.camera.readyState,'live');assert.equal(f.contexts[0].closed,true);assert.equal(f.contexts[0].disconnected,true);assert.equal(f.listenerCount(),0);assert.equal(f.calls.filter(c=>c.channel==='castlink:audio-stop').length,1);
});
test('native source ended stops only its exact screen and audio; stale source ended is ignored',async()=>{
 const f=fixture(),stream=await f.devices.getDisplayMedia();let sdkEnded=0;stream.getVideoTracks()[0].addEventListener('ended',()=>sdkEnded++);
 f.emit('castlink:audio-ended',{id:'old'});assert.ok(stream.getTracks().every(t=>t.readyState==='live'));
 f.emit('castlink:audio-ended',{id:'audio-1'});assert.ok(stream.getTracks().every(t=>t.readyState==='ended'));assert.equal(sdkEnded,1);assert.equal(f.mic.readyState,'live');assert.equal(f.listenerCount(),0);
});
test('failed AudioContext startup stops native capture and all newly acquired tracks',async()=>{
 const f=fixture({resumeFails:true});await assert.rejects(f.devices.getDisplayMedia(),/resume failed/);assert.equal(f.videos[0].readyState,'ended');assert.equal(f.contexts[0].closed,true);assert.equal(f.listenerCount(),0);assert.equal(f.calls.filter(c=>c.channel==='castlink:audio-stop').length,1);assert.equal(f.mic.readyState,'live');
});

test('Chromium capture failure cancels its exact pending native audio request',async()=>{const f=fixture({videoFails:true});await assert.rejects(f.devices.getDisplayMedia(),/video backend failed/);const cancel=f.calls.find(call=>call.channel==='castlink:audio-cancel');assert.equal(cancel.value,'display-request');assert.equal(f.calls.some(call=>call.channel==='castlink:audio-info'),false);assert.equal(f.mic.readyState,'live');});
