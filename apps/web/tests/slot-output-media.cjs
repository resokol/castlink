const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);

const appRoot = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(appRoot, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));

class FakeVideo {
  constructor(frame) { this.parentElement=frame; this.style={}; this.videoWidth=1920; this.videoHeight=1080; this.listeners=new Map(); this.savedStyle=null; }
  addEventListener(name,fn) { this.listeners.set(name,fn); }
  removeEventListener(name) { this.listeners.delete(name); }
  getAttribute() { return this.savedStyle; }
  setAttribute(_name,value) { this.savedStyle=value; }
  removeAttribute() { this.savedStyle=null; this.style={}; }
}
class FakeMutationObserver {
  constructor(fn) { this.fn=fn; FakeMutationObserver.instances.push(this); }
  observe() {}
  disconnect() { this.disconnected=true; }
  fire() { if(!this.disconnected)this.fn(); }
}
FakeMutationObserver.instances=[];
class FakeResizeObserver { constructor(fn){this.fn=fn;} observe(){} unobserve(){} disconnect(){} }

function makeFixture(sourceMode, abortSignal = AbortSignal, pendingBody = false) {
  const eventNames=['TrackSubscribed','TrackPublished','ParticipantConnected','ParticipantDisconnected','ParticipantMetadataChanged','TrackUnsubscribed','TrackMuted','TrackUnmuted','Reconnected','Disconnected'];
  const RoomEvent=Object.fromEntries(eventNames.map(name=>[name,name]));
  const Track={Kind:{Video:'video',Audio:'audio'},Source:{Camera:'camera',Microphone:'microphone',ScreenShare:'screen_share',ScreenShareAudio:'screen_share_audio'}};
  const VideoQuality={LOW:0,MEDIUM:1,HIGH:2};
  const calls={quality:[],attached:[],subscribed:[],requests:[]},timers=[],documentClasses=new Set();
  const frame={clientWidth:1280,clientHeight:720},cameraVideo=new FakeVideo(frame),screenVideo=new FakeVideo(frame);
  const videos=[];
  const videoContainer={current:{querySelectorAll:()=>videos.slice()}};
  const target={sessionId:'session-a',identity:'guest-a',generation:4,participantSid:'PA-A'};
  const participant={identity:target.identity,sid:target.participantSid,metadata:JSON.stringify({admissionId:target.sessionId,admissionGeneration:target.generation,studioImageTransform:{zoom:2,panX:.1,cropLeft:.2,rotation:12}}),trackPublications:new Map()};
  const camera=makePublication('camera',cameraVideo,calls),screen=makePublication('screen_share',screenVideo,calls);
  participant.trackPublications.set('camera',camera);participant.trackPublications.set('screen',screen);
  class Room extends EventEmitter {
    constructor(){super();this.state='disconnected';this.localParticipant={identity:'output-client'};this.remoteParticipants=new Map([[participant.identity,participant]]);Room.instance=this;}
    async connect(){this.state='connected';}
    async disconnect(){this.state='disconnected';}
    async startAudio(){}
  }
  const slots=[],pendingEffects=[];let cursor=0;
  const React={
    begin(){cursor=0;},
    useRef(initial){const i=cursor++;return slots[i] ||= {current:initial};},
    useState(initial){const i=cursor++;slots[i] ||= {value:initial};return [slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(old&&deps?.every((value,index)=>Object.is(value,old.deps?.[index])))return;pendingEffects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
    flushEffects(){while(pendingEffects.length)pendingEffects.shift()();},
  };
  const mediaBindings={
    attach(track){calls.attached.push(track.source);videos.push(track.source==='camera'?cameraVideo:screenVideo);},
    detach(track){calls.attached=calls.attached.filter(x=>x!==track.source);const v=track.source==='camera'?cameraVideo:screenVideo;const i=videos.indexOf(v);if(i>=0)videos.splice(i,1);},
    clear(){videos.length=0;calls.attached.length=0;},
    resumeAudio:async()=>'playing',
  };
  const videoRotationModule={exports:{}};
  vm.runInNewContext(compile('lib/video-rotation.ts'),{
    module:videoRotationModule,exports:videoRotationModule.exports,
    require:name=>({
      react:React,'livekit-client':{Room,RoomEvent},
      './studio-image-transform':require('../lib/studio-image-transform.ts'),
      './video-fit':require('../lib/video-fit.ts'),
    }[name]),
    HTMLVideoElement:FakeVideo,MutationObserver:FakeMutationObserver,ResizeObserver:FakeResizeObserver,console,
  });
  const pageModule={exports:{}},deps={
    react:React,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    'next/navigation':{useParams:()=>({slotId:'slot-a'}),useSearchParams:()=>({get:key=>key==='studioId'?'studio-a':key==='source'?sourceMode:null})},
    'livekit-client':{Room,RoomEvent,Track,VideoQuality},
    '@/lib/output-track-bindings':{createOutputTrackBindings:()=>mediaBindings},
    '@/lib/slot-output-controller':require('../lib/slot-output-controller.ts'),
    '@/lib/livekit-url':{getLiveKitUrl:()=> 'wss://example.invalid'},
    '@/components/I18nProvider':{useI18n:()=>({t:value=>value})},
    '@/lib/video-rotation':videoRotationModule.exports,
    './output.module.css':{default:{output:'qa-output',status:'qa-status'}},
  };
  let snapshot={revision:1,phase:'assigned',target,source:sourceMode};
  vm.runInNewContext(compile('app/output/slot/[slotId]/page.tsx'),{
    module:pageModule,exports:pageModule.exports,require:name=>deps[name],
    crypto:{randomUUID:()=> 'output-client'},URLSearchParams,AbortController,AbortSignal:abortSignal,
    setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeout:timer=>{if(timer)timer.cancelled=true;},
    fetch:async(url, options)=>{calls.requests.push({url,signal:options.signal});return {ok:true,json:async()=>{if(pendingBody)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));return {room:'room-a',token:'opaque',snapshot};}};},
    window:{location:{hash:'#access=slot-token'},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{}},
    document:{documentElement:{classList:{add:value=>documentClasses.add(value),remove:value=>documentClasses.delete(value)}}},console,
  });
  const wrapper=pageModule.exports.default(),element=wrapper.props.children;
  const render=()=>{React.begin();element.type(element.props);React.flushEffects();};
  const mount=()=>{render();slots[0].current=videoContainer.current;React.flushEffects();};
  const flushTimers=async()=>{await tick();await tick();};
  return {Room,RoomEvent,Track,VideoQuality,calls,timers,target,participant,camera,screen,cameraVideo,screenVideo,videos,videoContainer,
    documentClasses,get snapshot(){return snapshot;},setSnapshot(value){snapshot=value;},render,mount,flushTimers,unmount:()=>slots.forEach(slot=>slot?.cleanup?.()),room:()=>Room.instance};
}
function makePublication(source,video,calls) {
  return {source,kind:'video',track:{source,kind:'video'},isSubscribed:false,isMuted:false,
    setSubscribed(value){this.isSubscribed=value;},setVideoQuality(value){calls.quality.push([source,value]);}};
}

async function testSource(sourceMode, abortSignal) {
  const f=makeFixture(sourceMode, abortSignal);f.mount();await f.flushTimers();f.render();f.room().emit(f.RoomEvent.TrackSubscribed);f.render();
  assert.equal(f.calls.requests.length,1,`${sourceMode} sends the output request even without AbortSignal static helpers`);
  assert.equal(f.calls.requests[0].signal.aborted,false,'completed request is not aborted');
  assert.ok(f.timers.some(timer=>timer.ms===8000&&timer.cancelled),'completed request clears its timeout');
  const expected=sourceMode==='camera'?'camera':'screen_share',other=sourceMode==='camera'?'screen_share':'camera';
  assert.ok(f.calls.quality.some(([source,quality])=>source===expected&&quality===f.VideoQuality.HIGH),`${sourceMode} output asks LiveKit for its highest available layer`);
  assert.equal(f.calls.quality.some(([source])=>source===other),false,`${sourceMode} output leaves the other publication quality untouched`);
  return f;
}
(async()=>{
  for(const source of ['camera','screen']){
    const f=await testSource(source);
    assert.ok(f.calls.attached.length>0,'assigned source is attached before departure');
    f.room().remoteParticipants.delete(f.target.identity);
    f.room().emit(f.RoomEvent.ParticipantDisconnected,f.participant);
    assert.equal(f.videos.length,0,`${source} departure removes the old decoded frame immediately, before the next poll`);
    f.room().remoteParticipants.set(f.target.identity,f.participant);
    f.room().emit(f.RoomEvent.Reconnected);
    assert.ok(f.videos.length>0,`${source} reconnect restores the assigned source`);
    assert.ok(f.documentClasses.has('studiolink-output-document'),'slot output makes the document transparent');
    f.unmount();
    assert.equal(f.documentClasses.has('studiolink-output-document'),false,'leaving output restores normal document styling');
  }
  for(const source of ['camera','screen']){
    for(const reason of ['timeout','unmount']){
      const f=makeFixture(source,{},true);f.mount();await f.flushTimers();
      assert.equal(f.calls.requests.length,1,'request headers arrived while body is pending');
      assert.equal(f.calls.requests[0].signal.aborted,false,'body initially remains active');
      if(reason==='timeout')f.timers.find(timer=>timer.ms===8000).fn();else f.unmount();
      await f.flushTimers();
      assert.equal(f.calls.requests[0].signal.aborted,true,`${source} ${reason} cancels response body`);
      assert.equal(f.calls.attached.length,0,'cancelled body never attaches media');
      assert.equal(f.timers.some(timer=>timer.ms===1000),reason==='timeout','only active output retries after cancellation');
    }
  }
  // vMix/CEF engines can have AbortController without AbortSignal.any/timeout.
  await testSource('camera', {});
  await testSource('screen', {});
  const camera=await testSource('camera');
  assert.match(camera.cameraVideo.style.transform,/scale\(2, 2\)/,'assigned camera output applies saved caster zoom/position');
  assert.match(camera.cameraVideo.style.transform,/translate\(10%/,'saved camera pan is applied');
  assert.match(camera.cameraVideo.style.clipPath,/20%/,'saved camera crop is applied');
  assert.match(camera.cameraVideo.style.transform,/rotate\(12deg\)/,'saved image rotation is applied');
  camera.room().emit(camera.RoomEvent.TrackPublished);
  camera.room().emit(camera.RoomEvent.Reconnected);
  assert.ok(camera.calls.quality.filter(([source,quality])=>source==='camera'&&quality===camera.VideoQuality.HIGH).length>=3,'republish and reconnect reapply highest layer request');

  // A replacement SID no longer matches the assigned output snapshot.
  camera.participant.sid='PA-REPLACEMENT';
  camera.room().emit(camera.RoomEvent.ParticipantMetadataChanged);camera.render();
  assert.equal(camera.cameraVideo.style.transform,undefined,'replacement SID loses the old session transform');
  assert.equal(camera.cameraVideo.style.clipPath,undefined,'replacement SID loses the old session crop');

  // Unassignment removes the participant and clears any remaining inline styling.
  camera.room().remoteParticipants.delete(camera.target.identity);
  camera.room().emit(camera.RoomEvent.ParticipantDisconnected);camera.render();
  assert.equal(camera.cameraVideo.style.transform,undefined,'unassignment clears camera transform');

  const screen=await testSource('screen');
  assert.equal(screen.screenVideo.style.transform,undefined,'screen output has no caster camera transform');
  assert.equal(screen.screenVideo.style.clipPath,undefined,'screen output has no caster camera crop');
  assert.equal(screen.cameraVideo.style.transform,undefined,'screen output does not transform the camera publication');
  assert.ok(screen.calls.quality.some(([source,quality])=>source==='screen_share'&&quality===screen.VideoQuality.HIGH));
  screen.room().emit(screen.RoomEvent.Reconnected);
  assert.ok(screen.calls.quality.filter(([source,quality])=>source==='screen_share'&&quality===screen.VideoQuality.HIGH).length>=2,'reconnect reapplies highest layer request');
  console.log('PASS slot output: authenticated caster transforms, camera/screen isolation, highest layer on subscribe and reconnect');
})().catch(error=>{console.error(error);process.exitCode=1;});
