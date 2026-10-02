const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const {EventEmitter}=require('node:events');let cleanup,mutation;const observed=new Set();
const geometry={applyContainedVideoFit(video,frame,angle){video.style.angle=angle;}};
const moduleValue={exports:{}};
class Video {constructor(frame){this.parentElement=frame;this.listeners=new Map();this.style={};this.saved=null;}getAttribute(){return this.saved;}setAttribute(_,v){this.saved=v;}removeAttribute(){this.saved=null;}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k){this.listeners.delete(k);}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/video-rotation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleValue,exports:moduleValue.exports,require:n=>({'react':{useState:()=>[0,()=>{}],useEffect:f=>cleanup=f()},'livekit-client':{RoomEvent:{ParticipantMetadataChanged:'metadata',ParticipantConnected:'join',TrackSubscribed:'sub'}},'./video-fit':geometry}[n]),HTMLVideoElement:Video,ResizeObserver:class{constructor(f){}observe(v){observed.add(v);}unobserve(v){observed.delete(v);}disconnect(){observed.clear();}},MutationObserver:class{constructor(f){mutation=f;}observe(){}disconnect(){}},console});
const root={videos:[],querySelectorAll(){return this.videos;}};
const room=new EventEmitter();room.localParticipant={identity:'local'};room.remoteParticipants=new Map([['guest-one',{metadata:'{"videoRotation":90}'}]]);
moduleValue.exports.useVideoRotation(room,'guest-one',{current:root});
for(let i=0;i<100;i++){
 const frame={},video=new Video(frame);root.videos=[video];mutation();assert.equal(video.style.angle,90);assert.equal(observed.size,1);assert.equal(video.listeners.size,2);
 root.videos=[];mutation();assert.equal(observed.size,0,'old frame not retained');assert.equal(video.listeners.size,0,'old video listeners removed before next republish');
}
cleanup();assert.equal(room.eventNames().length,0);
console.log('PASS: rotation releases old video/frame listeners in 100 republish cycles and removes room listeners');
