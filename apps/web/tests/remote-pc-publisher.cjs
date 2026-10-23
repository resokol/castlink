'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{EventEmitter}=require('node:events');
const pageSource=fs.readFileSync(path.join(__dirname,'../app/remote-pc/publisher/page.tsx'),'utf8');
const helperSource=fs.readFileSync(path.join(__dirname,'../../desktop/src/remote-pc-helper.cjs'),'utf8');
assert.ok(pageSource.includes('Остановка: Ctrl + Alt + Shift + F12'),'publisher must show the actual nonreserved native Stop shortcut');
assert.ok(helperSource.includes("globalShortcut.register('CommandOrControl+Alt+Shift+F12'"));
assert.ok(helperSource.includes("globalShortcut.unregister('CommandOrControl+Alt+Shift+F12'"));
const order=[],rooms=[],elements=[];
const RoomEvent=Object.fromEntries(['Connected','Reconnected','ParticipantConnected','ParticipantDisconnected','ParticipantMetadataChanged','LocalTrackPublished','LocalTrackUnpublished','DataReceived','Disconnected'].map(k=>[k,k]));
class Room extends EventEmitter{
 constructor(){super();rooms.push(this);this.remoteParticipants=new Map([['guest',{identity:'guest-restricted',metadata:JSON.stringify({role:'guest',entrySettings:{noGuestAudio:true}})}]]);this.localParticipant={identity:'helper',sid:'PA_helper',trackPublications:new Map(),setTrackSubscriptionPermissions:(all,permissions)=>{order.push('acl');this.permissions={all,permissions};},publishTrack:async(track,options)=>{order.push('publish');assert.equal(options.source,'screen_share');const publication={trackSid:'TR_video',kind:'video'};this.localParticipant.trackPublications.set('TR_video',publication);this.emit(RoomEvent.LocalTrackPublished);return publication;}};}
 async connect(url,token,options){order.push('connect');assert.equal(token,'refreshed-video-token');assert.equal(options.autoSubscribe,false);assert.equal(this.permissions.all,false);}
 async disconnect(){order.push('disconnect');this.emit(RoomEvent.Disconnected);}
}
const Track={Kind:{Video:'video'},Source:{ScreenShare:'screen_share',ScreenShareAudio:'screen_share_audio'}};
const videoTrack=new EventTarget();videoTrack.stop=()=>order.push('track-stop');
const stream={getVideoTracks:()=>[videoTrack],getTracks:()=>[videoTrack]};
const document={body:{append:v=>elements.push(v)},createElement:()=>Object.assign(new EventTarget(),{videoWidth:800,videoHeight:600,style:{},play:async()=>{},remove(){}})};
const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const mod={exports:{}};cache.set(name,mod.exports);const file=path.join(__dirname,'../lib',name+'.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:n=>n==='livekit-client'?{Room,RoomEvent,Track}:load(n.replace('./','')),document,navigator:{mediaDevices:{getDisplayMedia:async options=>{order.push('capture');assert.equal(options.audio,false);return stream;}}},Uint8Array,Float32Array,TextEncoder,AudioContext:class{},setTimeout,clearTimeout});cache.set(name,mod.exports);return mod.exports;}
(async()=>{
 let onStop,onState,forwarded;const bridge={config:async()=>({captureId:'capture',publisher:{identity:'helper',url:'wss://lk.example',token:'initial-video-token'}}),captured:async value=>{order.push('bound');assert.deepEqual(JSON.parse(JSON.stringify(value)),{captureId:'capture',width:800,height:600});return{publisher:{identity:'helper',url:'wss://lk.example',token:'refreshed-video-token'}};},published:async value=>{order.push('published');assert.equal(value.helperSid,'PA_helper');assert.equal(value.videoTrackSid,'TR_video');},data:async value=>forwarded=value,onStop:fn=>{onStop=fn;return()=>{};},onState:fn=>{onState=fn;return()=>{};},captureStopped:async()=>order.push('capture-ack'),stop:async()=>order.push('native-stop')};
 const stop=await load('remote-pc-publisher').startRemotePublisher(bridge,()=>{});assert.ok(order.indexOf('acl')<order.indexOf('connect'));assert.ok(order.indexOf('bound')<order.indexOf('publish'));assert.equal(order.filter(v=>v==='capture').length,1);
 const room=rooms[0],guest=room.permissions.permissions.find(p=>p.participantIdentity==='guest-restricted');assert.equal(guest.allowAll,false);assert.deepEqual(Array.from(guest.allowedTrackSids),['TR_video']);
 room.emit(RoomEvent.DataReceived,new Uint8Array([1,2]),{sid:'PA_actual'},undefined,'castlink.remote-pc.input.v1');await Promise.resolve();assert.equal(forwarded.senderSid,'PA_actual');assert.equal(forwarded.captureId,'capture');
 onState({state:'sharing',pointerReady:false});onStop();await new Promise(setImmediate);assert.ok(order.indexOf('track-stop')<order.indexOf('capture-ack'));await stop();assert.equal(order.filter(v=>v==='capture').length,1);
 console.log('PASS actual publisher flow: deny-by-default before SFU publication, dynamic noGuestAudio video-only ACL, single native capture, source bind before refreshed token publication, actual sender SID relay, and capture-ended ACK after track stop');
})().catch(error=>{console.error(error);process.exitCode=1;});
