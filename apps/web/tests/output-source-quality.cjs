const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
const RoomEvent = Object.fromEntries(['AudioPlaybackStatusChanged','TrackSubscribed','DataReceived','ParticipantDisconnected','TrackUnsubscribed','Reconnecting','Disconnected','TrackPublished','ParticipantConnected','Reconnected'].map(x=>[x,x]));
const Track = { Source:{Camera:'camera',Microphone:'microphone',ScreenShare:'screen',ScreenShareAudio:'screen-audio'},Kind:{Video:'video',Audio:'audio'} };
const settle = ()=>new Promise(resolve=>setImmediate(resolve));
async function check(source, bitrate) {
  let cursor=0; const hooks=[],effects=[],cleanups=[],rooms=[];
  const react={
    useState(initial){const i=cursor++; if(!hooks[i])hooks[i]={value:initial};return[hooks[i].value,value=>hooks[i].value=value];},
    useRef(initial){const i=cursor++;return hooks[i]??={current:initial};},
    useEffect(fn,deps){const i=cursor++,old=hooks[i];if(old&&deps.every((x,j)=>x===old[j]))return;hooks[i]=deps;effects.push(fn);}
  };
  function publication(trackSource) {return {source:trackSource,kind:'video',quality:undefined,dimensions:undefined,setVideoQuality(value){this.quality=value;this.dimensions=undefined;},setVideoDimensions(value){this.dimensions=value;},setSubscribed(value){this.isSubscribed=value;}};}
  const camera=publication('camera'),screen=publication('screen');
  const participant={identity:'guest-one',trackPublications:new Map([['camera',camera],['screen',screen]])};
  class Room extends EventEmitter {
    constructor(options){super();this.options=options;this.remoteParticipants=new Map([['guest-one',participant]]);rooms.push(this);}
    async connect(){this.state='connected';} async startAudio(){} disconnect(){}
  }
  const saved={window:global.window,document:global.document,fetch:global.fetch};
  global.window={location:{href:'https://example.test/output/guest-one'},history:{replaceState(){}},setInterval:()=>1,clearInterval(){}};
  global.document={hidden:false,documentElement:{classList:{add(){},remove(){}}},addEventListener(){},removeEventListener(){}};
  global.fetch=async()=>({ok:true,json:async()=>({token:'test-token'})});
  try{
    const page=load('../app/output/[identity]/page.tsx',{
      react,'next/navigation':{useParams:()=>({identity:'guest-one'}),useSearchParams:()=>new URLSearchParams({source,bitrate:String(bitrate)})},
      'livekit-client':{Room,RoomEvent,Track,VideoQuality:{LOW:0,MEDIUM:1,HIGH:2}},
      '@/components/I18nProvider':{useI18n:()=>({t:x=>x,locale:'en'})},
      '@/lib/video-rotation':{useVideoRotation(){}},
      '@/lib/output-track-bindings':{createOutputTrackBindings:()=>({clear(){},attach(){},detach(){},inspectAudio(){},resumeAudio:async()=>'idle'})},
      '@/lib/livekit-url':{getLiveKitUrl:()=>'wss://example.test'},
      '@/lib/rtc-telemetry':{startRoomTelemetry:()=>()=>{}}
    });
    for(let pass=0;pass<2;pass++){cursor=0;page.default();while(effects.length){const cleanup=effects.shift()();if(cleanup)cleanups.push(cleanup);}await settle();}
    const room=rooms.at(-1),wanted=source==='screen'?screen:camera,other=source==='screen'?camera:screen;
    assert.equal(room.options.adaptiveStream,false);
    assert.equal(wanted.isSubscribed,true);
    assert.equal(other.isSubscribed,undefined,'other source stays unsubscribed');
    assert.equal(wanted.quality,2,'production output requests the highest available layer');
    assert.equal(wanted.dimensions,undefined,'a stale URL bitrate must not cap a 1080 source to 720');
    wanted.quality=undefined;room.emit(RoomEvent.Reconnected);assert.equal(wanted.quality,2,'highest layer restored on reconnect');
    const next=publication(wanted.source);participant.trackPublications.set('replacement',next);
    room.emit(RoomEvent.TrackPublished,next,participant);
    room.emit(RoomEvent.TrackSubscribed,{kind:'video',source:wanted.source},next,participant);
    assert.equal(next.quality,2,'republished camera requests highest layer');
    assert.equal(next.dimensions,undefined);
  }finally{cleanups.reverse().forEach(fn=>fn());Object.assign(global,saved);}
}
(async()=>{for(const source of ['camera','screen'])for(const bitrate of [500,2500,5000])await check(source,bitrate);console.log('PASS legacy output: full source layer at every URL bitrate, reconnect, republish and source isolation');})().catch(error=>{console.error(error);process.exitCode=1;});
