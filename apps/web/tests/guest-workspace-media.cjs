const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const EventEmitter=require('node:events');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const extension of ['.ts','.tsx'])Module._extensions[extension]=(module,filename)=>module._compile(transpile(fs.readFileSync(filename,'utf8')),filename);
const audio=require('../lib/guest-audio.ts');
const media=require('../lib/guest-media.ts');
const recovery=require('../lib/reconnect-status.ts');
const noop=()=>{};
const component=()=>null;
let context;
const react={
  useState(initial){const scope=context,index=scope.cursor++;if(!(index in scope.hooks))scope.hooks[index]=typeof initial==='function'?initial():initial;scope.setters ||= [];scope.setters[index] ||= value=>{scope.hooks[index]=typeof value==='function'?value(scope.hooks[index]):value;};return[scope.hooks[index],scope.setters[index]];},
  useRef(initial){const index=context.cursor++;if(!(index in context.hooks))context.hooks[index]={current:initial};return context.hooks[index];},
  useEffect(effect,deps){const scope=context,index=scope.cursor++,old=scope.hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[index]={deps,cleanup:effect()};});},
};
function renderer(fn){const scope={cursor:0,hooks:[],effects:[]};return{render(props){context=scope;scope.cursor=0;const result=fn(props);while(scope.effects.length)scope.effects.shift()();return result;},unmount(){for(const hook of scope.hooks)hook?.cleanup?.();}};}
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setTimeout(resolve,2));};
const RoomEvent=new Proxy({}, {get:(_,key)=>key});
const Track={Source:{Microphone:'microphone',Camera:'camera'},Kind:{Video:'video'}};
let latestRoom;
class Room extends EventEmitter{
  constructor(){super();latestRoom=this;this.state='disconnected';this.remoteParticipants=new Map();this.name='test-room';this.calls=[];this.publications={};this.activeDevices={audioinput:'default',videoinput:'system-cam'};
    const room=this;
    this.localParticipant={
      getTrackPublication:source=>room.publications[source],
      get isMicrophoneEnabled(){return !!room.publications.microphone&&!room.publications.microphone.track.isMuted;},
      get isCameraEnabled(){return !!room.publications.camera&&!room.publications.camera.track.isMuted;},
      async setMicrophoneEnabled(enabled,capture,publish){room.calls.push(['mic',enabled,capture,publish]);if(room.failMic){room.failMic=false;throw new Error('test microphone failure');}return room.setTrack('microphone',enabled,capture,publish);},
      async setCameraEnabled(enabled,capture){room.calls.push(['cam',enabled,capture]);return room.setTrack('camera',enabled,capture);},
      async unpublishTrack(track,stop){room.calls.push(['unpublish',track.source,stop]);if(room.publications[track.source]?.track===track)delete room.publications[track.source];if(stop)track.stop();room.emit(RoomEvent.LocalTrackUnpublished,{track});if(room.onUnpublish)room.onUnpublish();},
      async publishTrack(track,options){room.calls.push(['publish',track.source,options]);const publication={track,options,get isMuted(){return track.isMuted;}};room.publications[track.source]=publication;room.emit(RoomEvent.LocalTrackPublished,publication);return publication;},
      async publishData(){},
    };
  }
  async setTrack(source,enabled,capture={},options={}){
    let publication=this.publications[source];
    if(!enabled){if(publication){publication.track.isMuted=true;this.emit(RoomEvent.TrackMuted,publication);}return publication;}
    if(publication){publication.track.isMuted=false;this.emit(RoomEvent.TrackUnmuted,publication);return publication;}
    if(source==='camera'&&!capture.deviceId&&this.activeDevices.videoinput==='default')throw new Error('OverconstrainedError: exact video deviceId default is invalid');
    const room=this,kind=source==='microphone'?'audioinput':'videoinput';
    const track={source,isMuted:false,stopped:0,constraints:{...capture},stop(){this.stopped++;},async applyConstraints(next){this.constraints={...this.constraints,...next};},mediaStreamTrack:{getSettings:()=>({deviceId:room.activeDevices[kind],channelCount:1,sampleRate:48000}),async applyConstraints(){},get enabled(){return !track.isMuted;}}};
    publication={track,options,get isMuted(){return track.isMuted;}};this.publications[source]=publication;this.emit(RoomEvent.LocalTrackPublished,publication);return publication;
  }
  async connect(url,token,options){this.calls.push(['connect',url,token,options]);this.state='connected';this.emit(RoomEvent.Connected);}
  async disconnect(){this.calls.push(['disconnect']);for(const publication of Object.values(this.publications))publication.track.stop();this.publications={};this.state='disconnected';this.emit(RoomEvent.Disconnected);}
  async switchActiveDevice(kind,id){this.calls.push(['device',kind,id]);this.activeDevices[kind]=id;return true;}
  async startAudio(){}
}
class ConnectionError extends Error{static cancelled(message){return new ConnectionError(message);}}
const sdk={Room,RoomEvent,Track,VideoQuality:{HIGH:2},DisconnectReason:{PARTICIPANT_REMOVED:4},ConnectionError,ConnectionErrorReason:{Timeout:1,InternalError:2}};
let transferOptions;
const mocked={
  '@/components/AppChrome':{AppFooterSlot:component},'@/components/RoomConference':{RoomConference:component},
  '@/components/GuestAvCheck':{GuestAvCheck:component},'@/components/GuestAudioProfileSelector':{GuestAudioProfileSelector:component},
  '@/lib/guest-audio':audio,'@/lib/guest-media':media,'@/components/MediaDevicePicker':{MediaDevicePicker:component},
  '@/lib/room-mode':{useRoomMode:()=>({studioOnly:false})},'@/lib/fullscreen':{toggleElementFullscreen:noop},
  '@/lib/studio-video-recovery':{watchStudioVideo:()=>noop},'@/lib/video-quality':{DEFAULT_GUEST_VIDEO_BITRATE_KBPS:6000},
  '@/lib/guest-video-bitrate':{watchGuestVideoBitrate:()=>noop},'@/lib/livekit-url':{getLiveKitUrl:()=> 'wss://room.example.test'},
  '@/lib/personal-monitoring':{usePersonalMonitoring:()=>({participants:[],preferences:{},videoEnabled:()=>true})},
  '@/components/MonitoringControls':{MonitoringControls:component},'@/lib/rtc-telemetry':{startRoomTelemetry:()=>noop},
  '@/lib/client-transfer':{readTransferSnapshot:()=>undefined,clearTransferSnapshot:noop},
  '@/lib/use-session-transfer':{useSessionTransfer:options=>{transferOptions=options;return{view:{}};},reserveStatusText:()=>''},
  '@/lib/talkback-policy':{parseGuestMediaCommand:payload=>payload},'@/lib/reconnect-status':recovery,
};
const params=new URLSearchParams();
const originalLoad=Module._load;
Module._load=function(name,...rest){
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='livekit-client')return sdk;
  if(name==='next/navigation')return{useSearchParams:()=>params};
  if(name==='@livekit/components-react')return{StartAudio:component,RoomContext:{Provider:component}};
  if(name in mocked)return mocked[name];
  return originalLoad.call(this,name,...rest);
};
mocked['@/lib/connection-route']=require('../lib/connection-route.ts');
const {GuestMicrophoneButton}=require('../components/GuestMicrophoneButton.tsx');
mocked['@/components/GuestMicrophoneButton']={GuestMicrophoneButton};
const filename=require.resolve('../components/GuestWorkspace.tsx');
const workspaceModule=new Module(filename,module);workspaceModule.paths=module.paths;
workspaceModule._compile(transpile(fs.readFileSync(filename,'utf8').replace('function RoomConnector(', 'export function RoomConnector(')),filename);
Module._load=originalLoad;
const {GuestWorkspace,RoomConnector}=workspaceModule.exports;
global.window={setTimeout,clearTimeout,location:{origin:'https://room.example.test'}};
global.document={addEventListener:noop,removeEventListener:noop,createElement:()=>({getContext:()=>null})};
Object.defineProperty(global,'navigator',{configurable:true,value:{hardwareConcurrency:4,platform:'test',mediaDevices:{enumerateDevices:async()=>[],addEventListener:noop,removeEventListener:noop}}});
let tokenRequests=0;
global.fetch=async url=>({ok:true,json:async()=>url.startsWith('/api/token')?(tokenRequests++,{token:'same-session-token',identity:'guest-test',connectionRoutes:{relay:{configured:true,transport:'udp'}}}):{exists:true}});

(async()=>{
  const workspace=renderer(GuestWorkspace),connector=renderer(RoomConnector);
  const props={initialRoomName:'test-room',initialStudioId:'test-studio'};
  let tree=workspace.render(props);await settle();tree=workspace.render(props);
  nodes(tree).find(node=>node.type==='input').props.onChange({target:{value:'Guest'}});
  tree=workspace.render(props);nodes(tree).find(node=>node.type==='button'&&node.props.children==='Продолжить').props.onClick();
  tree=workspace.render(props);await settle();tree=workspace.render(props);
  const av=nodes(tree).find(node=>node.props?.onJoin);assert.ok(av);
  av.props.onJoin({height:720,micGain:100,listenGain:100,audioDeviceId:'selected-mic',videoDeviceId:'selected-cam',audioEnabled:false,videoEnabled:false,audioProfile:'speech'});
  tree=workspace.render(props);let connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);await settle();
  tree=workspace.render(props);connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);
  const room=latestRoom;
  assert.equal(room.publications.microphone,undefined);assert.equal(room.publications.camera,undefined);
  const profile=nodes(tree).find(node=>node.props?.onChange&&node.props?.value==='speech'&&node.type!== 'select');assert.ok(profile);
  profile.props.onChange('raw');
  room.emit(RoomEvent.DataReceived,{source:'microphone',enabled:true});
  await settle();tree=workspace.render(props);
  const enabled=room.calls.find(call=>call[0]==='mic'&&call[1]===true);
  assert.equal(enabled[2].noiseSuppression,false,'queued studio enable sees the newly committed raw profile before another render');
  assert.equal(enabled[3].dtx,false);assert.equal(room.publications.microphone.options.red,true);
  assert.equal(room.activeDevices.audioinput,'selected-mic');
  const currentProfile=nodes(tree).find(node=>node.props?.onChange&&node.props?.value==='raw'&&node.type!=='select');
  room.onUnpublish=()=>{room.onUnpublish=undefined;room.state='reconnecting';room.emit(RoomEvent.Reconnecting);};
  currentProfile.props.onChange('speech');await settle();
  assert.equal(room.publications.microphone,undefined,'network loss in profile republish gap cleans detached capture');
  room.state='connected';room.emit(RoomEvent.Reconnected);await settle();tree=workspace.render(props);
  assert.equal(room.publications.microphone.track.constraints.noiseSuppression,false,'SDK reconnect restores only the missing microphone using the committed old profile');
  assert.equal(room.publications.microphone.options.dtx,false);
  assert.equal(room.calls.filter(call=>call[0]==='connect').length,1,'ordinary SDK reconnect does not create a second initial join');
  const microphoneControl=nodes(tree).find(node=>node.props?.microphoneControl).props.microphoneControl;
  const microphone=renderer(GuestMicrophoneButton);let button=microphone.render(microphoneControl.props);
  room.failMic=true;
  button.props.onClick();await settle();button=microphone.render(microphoneControl.props);
  assert.equal(button.props['aria-pressed'],true,'failed mute must not spoof the toolbar state');
  button.props.onClick();await settle();button=microphone.render(microphoneControl.props);
  assert.equal(button.props['aria-pressed'],false,'toolbar follows confirmed mute');
  assert.equal(room.publications.microphone.track.isMuted,true);
  tree=workspace.render(props);
  const picker=nodes(tree).find(node=>node.props?.microphoneId&&node.props?.permissionInputs);
  picker.props.onChange({microphoneId:'replacement-mic'});
  tree=workspace.render(props);connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);await settle();
  assert.equal(room.activeDevices.audioinput,'replacement-mic','changing selected mic while muted stores the future device without unmuting');
  assert.equal(room.publications.microphone.track.isMuted,true);
  await room.localParticipant.setCameraEnabled(true);await room.localParticipant.setCameraEnabled(false);
  tree=workspace.render(props);
  const route=nodes(tree).find(node=>node.type==='select'&&node.props['aria-label']==='Маршрут подключения');
  assert.equal(route.props.value,'auto');assert.equal(nodes(route).find(node=>node.props?.value==='relay').props.disabled,false);
  assert.ok(nodes(tree).some(node=>node.type==='p'&&String(node.props.children).includes('UDP')));
  const priorMic=room.publications.microphone.track;
  route.props.onChange({target:{value:'relay'}});await settle();tree=workspace.render(props);
  connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);await settle();tree=workspace.render(props);
  const connections=room.calls.filter(call=>call[0]==='connect');
  assert.equal(connections.length,2,'deliberate route change creates exactly one new media join');
  assert.equal(connections[0][2],connections[1][2],'same participant token is retained');
  assert.equal(connections[1][3].rtcConfig.iceTransportPolicy,'relay');
  assert.equal(tokenRequests,1,'route changes do not create another identity');
  assert.equal(room.publications.microphone,undefined,'muted microphone remains disabled after route reconnect');
  assert.equal(room.publications.camera,undefined,'muted camera remains disabled after route reconnect');
  assert.ok(priorMic.stopped>0,'previous capture is cleaned during deliberate reconnect');
  const snapshot=await transferOptions.snapshot();
  assert.equal(snapshot.settings.choices.audioProfile,'raw');assert.equal(snapshot.settings.choices.connectionRoute,'relay');
  assert.equal(snapshot.settings.choices.audioDeviceId,'replacement-mic');assert.equal(snapshot.settings.choices.videoDeviceId,'selected-cam');
  assert.equal(snapshot.settings.choices.audioEnabled,false);assert.equal(snapshot.settings.choices.videoEnabled,false);
  microphone.unmount();connector.unmount();workspace.unmount();await settle();

  const systemRoom=new Room(),systemConnector=renderer(RoomConnector);
  const systemChoices={height:720,micGain:100,listenGain:100,audioEnabled:false,videoEnabled:false,videoDeviceId:''};
  const statuses=[],errors=[];
  let status=recovery.initialRecoveryStatus();
  systemConnector.render({room:systemRoom,token:'camera-off-session',choices:systemChoices,choicesRef:{current:systemChoices},mediaGeneration:{current:0},connectionRoutes:{relay:{configured:false}},attempt:0,onConnectionStatus:update=>{status=typeof update==='function'?update(status):update;statuses.push(status);},onRemoteChange:noop,onRemoved:noop,onDeviceError:error=>errors.push(error),videoEnabled:()=>true});
  await settle();
  assert.equal(statuses.at(-1).phase,'connected');
  assert.equal(systemRoom.publications.camera,undefined,'camera-off entry does not acquire the default camera');
  await systemRoom.localParticipant.setCameraEnabled(true);
  assert.equal(systemRoom.localParticipant.isCameraEnabled,true,'stock toolbar can later enable the browser-selected system camera');
  assert.equal(systemRoom.publications.camera.track.mediaStreamTrack.getSettings().deviceId,'system-cam');
  assert.equal(errors.filter(Boolean).length,0);
  assert.equal(systemRoom.calls.some(call=>call[0]==='device'&&call[1]==='videoinput'&&call[2]==='default'),false,'blank camera choice never becomes an exact default pseudo-device');
  systemConnector.unmount();await settle();
  console.log('PASS: production guest workspace applies raw mode to queued enable, confirms toolbar mute, preserves muted devices/profile across same-identity relay reconnect and transfer snapshot');
})().catch(error=>{console.error(error);process.exitCode=1;});
