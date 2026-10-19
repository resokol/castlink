const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{EventEmitter}=require('node:events');
const events={LocalTrackUnpublished:'unpublished',Disconnected:'disconnected'};
class LocalVideoTrack{constructor(raw){this.mediaStreamTrack=raw;}stop(){this.mediaStreamTrack.stop();}}
const moduleUnderTest={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/co-presentation-client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports,require:()=>({LocalVideoTrack,RoomEvent:events,Track:{Source:{ScreenShare:'screen_share'}}}),WeakSet,AbortSignal,setInterval,clearInterval});
const {createCanvasPresentationCapture,isCoPresentationTrack}=moduleUnderTest.exports;
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function fixture(){
 const room=new EventEmitter();room.state='connected';const pubs=new Map(),unpublished=[],published=[],states=[];let barrier;
 const camera={name:'camera',live:true},mic={name:'mic',live:true};pubs.set('camera',camera);pubs.set('microphone',mic);
 room.localParticipant={getTrackPublication:source=>pubs.get(source),async publishTrack(track,options){published.push({track,options});if(barrier)await barrier.promise;pubs.set(options.source,{track});},async unpublishTrack(track){unpublished.push(track);for(const [source,pub]of pubs)if(pub.track===track){pubs.delete(source);room.emit('unpublished',pub);}}};
 const raw=new EventTarget();raw.readyState='live';raw.stop=()=>{raw.readyState='ended'};
 const canvas={getContext(){return{save(){},restore(){},resetTransform(){},drawImage(){}}},captureStream(rate){assert.equal(rate,5);return{getVideoTracks:()=>[raw],getTracks:()=>[raw]}}};
 const capture=createCanvasPresentationCapture(room,state=>states.push(state));
 return{room,pubs,unpublished,published,states,raw,canvas,capture,camera,mic,hold(){barrier=deferred();return barrier;}};
}
(async()=>{
 let f=fixture();assert.equal(await f.capture.start(f.canvas,()=>true),true);assert.equal(f.published.length,1);const track=f.published[0].track;
 assert.equal(f.published[0].options.source,'screen_share');assert.ok(isCoPresentationTrack(track));assert.equal(f.capture.isSharing(),true);
 await f.capture.stop();assert.equal(f.raw.readyState,'ended');assert.deepEqual(f.unpublished,[track]);assert.equal(f.pubs.get('camera'),f.camera);assert.equal(f.pubs.get('microphone'),f.mic);assert.ok(!isCoPresentationTrack(track));f.capture.dispose();
 f=fixture();f.pubs.set('screen_share',{track:{existing:true}});await assert.rejects(f.capture.start(f.canvas,()=>true));assert.equal(f.published.length,0);f.capture.dispose();
 f=fixture();assert.equal(await f.capture.start(f.canvas,()=>false),false);assert.equal(f.raw.readyState,'ended');assert.equal(f.published.length,0);f.capture.dispose();
 for(const teardown of ['stop','dispose','disconnect','file-change']){
  f=fixture();let current=true;const held=f.hold();const started=f.capture.start(f.canvas,()=>current);await new Promise(r=>setImmediate(r));
  if(teardown==='stop')await f.capture.stop();else if(teardown==='dispose')f.capture.dispose();else if(teardown==='disconnect'){f.room.state='disconnected';f.room.emit('disconnected');}else{current=false;await f.capture.stop();}
  held.resolve();assert.equal(await started,false,teardown);assert.equal(f.raw.readyState,'ended');assert.equal(f.pubs.has('screen_share'),false,'late publication removed');assert.equal(f.pubs.get('camera'),f.camera);assert.equal(f.pubs.get('microphone'),f.mic);f.capture.dispose();
 }
 f=fixture();await f.capture.start(f.canvas,()=>true);await f.room.localParticipant.unpublishTrack(f.published[0].track);assert.equal(f.capture.isSharing(),false,'SDK external unpublish ends own capture');assert.equal(f.raw.readyState,'ended');assert.equal(f.states.at(-1),false);f.capture.dispose();
 f=fixture();await f.capture.start(f.canvas,()=>true);f.raw.readyState='ended';f.raw.dispatchEvent(new Event('ended'));await new Promise(r=>setImmediate(r));assert.equal(f.capture.isSharing(),false);assert.equal(f.pubs.has('screen_share'),false);f.capture.dispose();
 f=fixture();f.canvas.getContext=()=>({save(){},restore(){},resetTransform(){},drawImage(){throw Error('Canvas draw failed');}});assert.equal(await f.capture.start(f.canvas,()=>true),false,'failed first refresh must not report an active share');assert.equal(f.capture.isSharing(),false);assert.equal(f.raw.readyState,'ended');assert.deepEqual(f.states,[false]);assert.equal(f.pubs.has('screen_share'),false);f.capture.dispose();
 console.log('PASS silent canvas-only publication, occupied-screen refusal, screen-only stop, SDK unpublish/end cleanup and late-publish cancellation after stop/dispose/disconnect/file change');
})().catch(error=>{console.error(error);process.exitCode=1;});
