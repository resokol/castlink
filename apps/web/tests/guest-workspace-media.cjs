require('./i18n-fixture.cjs');
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
const {GUEST_MEDIA_SETTINGS_TOPIC}=require('../lib/guest-media-control.ts');
const noop=()=>{};
const component=()=>null;
let context;
const react={
  useState(initial){const scope=context,index=scope.cursor++;if(!(index in scope.hooks))scope.hooks[index]=typeof initial==='function'?initial():initial;scope.setters ||= [];scope.setters[index] ||= value=>{scope.hooks[index]=typeof value==='function'?value(scope.hooks[index]):value;};return[scope.hooks[index],scope.setters[index]];},
  useRef(initial){const index=context.cursor++;if(!(index in context.hooks))context.hooks[index]={current:initial};return context.hooks[index];},
  useEffect(effect,deps){const scope=context,index=scope.cursor++,old=scope.hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[index]={deps,cleanup:effect()};});},
};
function renderer(fn){const scope={cursor:0,hooks:[],effects:[]};return{render(props){context=scope;scope.cursor=0;const result=fn(props);while(scope.effects.length)scope.effects.shift()();return result;},unmount(){for(const hook of scope.hooks)hook?.cleanup?.();}};}
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes([node.props?.children,node.props?.extraControls,node.props?.settingsControl])];
const settle=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setTimeout(resolve,2));};
const RoomEvent=new Proxy({}, {get:(_,key)=>key});
const Track={Source:{Microphone:'microphone',Camera:'camera'},Kind:{Video:'video'}};
let latestRoom;
class Room extends EventEmitter{
  constructor(){super();latestRoom=this;this.state='disconnected';this.remoteParticipants=new Map();this.name='test-room';this.calls=[];this.publications={};this.activeDevices={audioinput:'default',videoinput:'system-cam'};
    const room=this;
    this.localParticipant={
      sid:'PA-0',
      getTrackPublication:source=>room.publications[source],
      get isMicrophoneEnabled(){return !!room.publications.microphone&&!room.publications.microphone.track.isMuted;},
      get isScreenShareEnabled(){return !!room.publications.screen_share;},
      async setScreenShareEnabled(enabled){room.calls.push(['screen',enabled]);if(!enabled)delete room.publications.screen_share;},
      get isCameraEnabled(){return !!room.publications.camera&&!room.publications.camera.track.isMuted;},
      async setMicrophoneEnabled(enabled,capture,publish){room.calls.push(['mic',enabled,capture,publish]);if(room.failMic){room.failMic=false;throw new Error('test microphone failure');}return room.setTrack('microphone',enabled,capture,publish);},
      async setCameraEnabled(enabled,capture,publish){room.calls.push(['cam',enabled,capture,publish]);return room.setTrack('camera',enabled,capture,publish);},
      async unpublishTrack(track,stop){room.calls.push(['unpublish',track.source,stop]);if(room.publications[track.source]?.track===track)delete room.publications[track.source];if(stop)track.stop();room.emit(RoomEvent.LocalTrackUnpublished,{track});if(room.onUnpublish)room.onUnpublish();},
      async publishTrack(track,options){room.calls.push(['publish',track.source,options]);const publication={track,options,get isMuted(){return track.isMuted;}};track.codec=options.videoCodec;room.publications[track.source]=publication;room.emit(RoomEvent.LocalTrackPublished,publication);return publication;},
      async publishData(payload,options){room.dataCalls ||= [];room.dataCalls.push({info:JSON.parse(new TextDecoder().decode(payload)),options});if(room.failClientInfo)throw Error("diagnostic send failed");},
    };
  }
  async setTrack(source,enabled,capture={},options={}){
    let publication=this.publications[source];
    if(!enabled){if(publication){publication.track.isMuted=true;this.emit(RoomEvent.TrackMuted,publication);}return publication;}
    if(publication){publication.track.isMuted=false;this.emit(RoomEvent.TrackUnmuted,publication);return publication;}
    if(source==='camera'&&!capture.deviceId&&this.activeDevices.videoinput==='default')throw new Error('OverconstrainedError: exact video deviceId default is invalid');
    const room=this,kind=source==='microphone'?'audioinput':'videoinput';
    const track={source,codec:source==='camera'?options.videoCodec:undefined,isMuted:false,stopped:0,constraints:{...capture},getSourceTrackSettings(){return{deviceId:room.activeDevices[kind],channelCount:1,sampleRate:48000,noiseSuppression:room.omitNoiseSuppression?undefined:this.constraints.noiseSuppression,autoGainControl:this.constraints.autoGainControl,echoCancellation:this.constraints.echoCancellation,voiceIsolation:this.constraints.voiceIsolation};},stop(){this.stopped++;},async applyConstraints(next){this.constraints={...this.constraints,...next};},async restartTrack(next){assert.equal(room.publications[source],undefined,'fresh mic capture remains unpublished during restart');this.constraints={...next};},mediaStreamTrack:{getSettings:()=>track.getSourceTrackSettings(),async applyConstraints(options){track.nativeConstraints=options;},get enabled(){return !track.isMuted;}}};
    publication={track,options,get isMuted(){return track.isMuted;}};this.publications[source]=publication;this.emit(RoomEvent.LocalTrackPublished,publication);return publication;
  }
  async connect(url,token,options){this.calls.push(['connect',url,token,options]);if(this.kickOnRelay&&options.rtcConfig?.iceTransportPolicy==='relay'){this.kickOnRelay=false;this.localParticipant.sid='';this.state='disconnected';this.emit(RoomEvent.Disconnected,sdk.DisconnectReason.PARTICIPANT_REMOVED);throw new Error('participant removed');}if(this.failRelay&&options.rtcConfig?.iceTransportPolicy==='relay'){this.failRelay=false;this.localParticipant.sid='';this.state='disconnected';throw new Error('TURN relay failed');}this.localParticipant.sid=`PA-${this.calls.filter(call=>call[0]==='connect').length}`;this.state='connected';this.emit(RoomEvent.Connected);}
  async disconnect(){this.calls.push(['disconnect']);for(const publication of Object.values(this.publications))publication.track.stop();this.publications={};this.state='disconnected';this.emit(RoomEvent.Disconnected);}
  async switchActiveDevice(kind,id){this.calls.push(['device',kind,id]);this.activeDevices[kind]=id;return true;}
  async startAudio(){}
}
class ConnectionError extends Error{static cancelled(message){return new ConnectionError(message);}}
const sdk={Room,RoomEvent,Track,VideoQuality:{HIGH:2},DisconnectReason:{PARTICIPANT_REMOVED:4},ConnectionError,ConnectionErrorReason:{Timeout:1,InternalError:2}};
let transferOptions;
const gainChanges=[];
const PresentationControls=()=>null;
const mocked={
  '@/lib/remote-pc-client':{ownRemotePcSession:()=>noop,stopOwnedRemotePc:async()=>{},remotePcSnapshot:()=>({sources:[]})},
  '@/lib/remote-pc-sources':{resolveRemotePcScreen:()=>undefined},
  '@/components/GuestSettingsPanel':{GuestSettingsPanel:component},
  '@/components/CoPresentationPanel':{CoPresentationPanel:component},
  '@/lib/use-room-chat-bearer':{useRoomChatBearer:({token})=>token||''},
  '@/lib/guest-admission-client':{readAdmission:()=>undefined},'./GuestWaitingPanel':{GuestWaitingPanel:component},'./PersonalCasterLink':{PersonalCasterLink:component},
  '@/lib/guest-audio-gain':{setGuestMicrophoneGain:async(room,gain)=>{gainChanges.push(gain);return true;},watchGuestMicrophoneGain:()=>noop},
  '@/lib/guest-camera-outbound':{watchGuestCameraOutbound:()=>noop},
  '@/lib/guest-media-control':require('../lib/guest-media-control.ts'),
  '@/lib/remote-pc-client':require('../lib/remote-pc-client.ts'),
  '@/lib/remote-pc-sources':require('../lib/remote-pc-sources.ts'),
  '@/lib/guest-capture-settings':require('../lib/guest-capture-settings.ts'),
  '@/components/PresentationControls':{PresentationControls},
  '@/components/GuestPrivateTalkback':{GuestPrivateTalkback:component},'@/components/GuestRoleOffer':{GuestRoleOffer:component},
  '@/lib/guest-entry-settings':require('../lib/guest-entry-settings.ts'),
  '@/lib/guest-staff-transition':require('../lib/guest-staff-transition.ts'),
  '@/lib/guest-audio-permissions':{watchGuestAudioPermissions:()=>noop},
  '@/lib/guest-resume':require('../lib/guest-resume.ts'),
  '@/components/AppChrome':{AppFooterSlot:component},'@/components/RoomConference':{RoomConference:component},
  '@/components/GuestDeviceRequests':{GuestDeviceRequests:component},'@/lib/guest-device-switch':{switchGuestCameraDevice:async()=>{}},
  '@/components/GuestAvCheck':{GuestAvCheck:component},'@/components/GuestAudioProfileSelector':{GuestAudioProfileSelector:component},
  '@/lib/guest-audio':audio,'@/lib/guest-media':media,'@/components/MediaDevicePicker':{MediaDevicePicker:component},
  '@/lib/room-mode':{useRoomMode:()=>({studioOnly:false})},'@/lib/fullscreen':{toggleElementFullscreen:noop},
  '@/lib/studio-video-recovery':{watchStudioVideo:()=>noop},'@/lib/video-quality':{...require('../lib/video-quality.ts'),DEFAULT_GUEST_VIDEO_BITRATE_KBPS:6000},
  '@/lib/guest-video-bitrate':{watchGuestVideoBitrate:()=>noop},'@/lib/livekit-url':{getLiveKitUrl:()=> 'wss://room.example.test'},
  '@/lib/personal-monitoring':{usePersonalMonitoring:()=>({participants:[],preferences:{},videoEnabled:()=>true})},
  '@/components/MonitoringControls':{MonitoringControls:component},'@/lib/rtc-telemetry':{startRoomTelemetry:()=>noop},
  '@/lib/client-transfer':{readTransferSnapshot:()=>undefined,clearTransferSnapshot:noop},
  '@/lib/use-session-transfer':{useSessionTransfer:options=>{transferOptions=options;return{view:{}};},guestReserveStatusText:()=>null},
  '@/lib/talkback-policy':{parseGuestMediaCommand:payload=>payload?.source?payload:undefined},'@/lib/reconnect-status':recovery,
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
mocked['@/lib/guest-video-codec']=require('../lib/guest-video-codec.ts');
mocked['@/components/GuestCodecCameraButton']={GuestCodecCameraButton:component};
mocked['@/lib/connection-route']=require('../lib/connection-route.ts');
mocked['@/lib/guest-media-control-client']=require('../lib/guest-media-control-client.ts');
const {GuestMicrophoneButton}=require('../components/GuestMicrophoneButton.tsx');
mocked['@/components/GuestMicrophoneButton']={GuestMicrophoneButton};
const filename=require.resolve('../components/GuestWorkspace.tsx');
const workspaceModule=new Module(filename,module);workspaceModule.paths=module.paths;
workspaceModule._compile(transpile(fs.readFileSync(filename,'utf8').replace('function RoomConnector(', 'export function RoomConnector(')),filename);
Module._load=originalLoad;
const {GuestWorkspace,RoomConnector}=workspaceModule.exports;
global.RTCRtpSender={getCapabilities:()=>({codecs:['VP8','H264','AV1'].map(codec=>({mimeType:'video/'+codec}))})};
global.window={setTimeout,clearTimeout,location:{origin:'https://room.example.test'}};
global.document={addEventListener:noop,removeEventListener:noop,createElement:()=>({getContext:()=>null})};
Object.defineProperty(global,'navigator',{configurable:true,value:{hardwareConcurrency:4,platform:'test',mediaDevices:{enumerateDevices:async()=>[],addEventListener:noop,removeEventListener:noop}}});
let tokenRequests=0;
const reports=[];
global.fetch=async(url,options)=>{if(url==='/api/guest-media-control')reports.push(JSON.parse(options.body));return{ok:true,json:async()=>url.startsWith('/api/token')?(tokenRequests++,{token:'same-session-token',identity:'guest-test',connectionRoutes:{relay:{configured:true,transport:'udp'}}}):{exists:true,allowed:true}};};
let sequence=0;
function settings(room,patch,overrides={},sender=undefined){const now=Date.now();const command={id:`settings-${++sequence}`,participantSid:room.localParticipant.sid,issuedAt:now,expiresAt:now+60000,patch,...overrides};room.emit(RoomEvent.DataReceived,new TextEncoder().encode(JSON.stringify(command)),sender,undefined,GUEST_MEDIA_SETTINGS_TOPIC);return command;}

(async()=>{
  const workspace=renderer(GuestWorkspace),connector=renderer(RoomConnector);
  const props={initialRoomName:'test-room',initialStudioId:'test-studio'};
  let tree=workspace.render(props);await settle();tree=workspace.render(props);
  assert.equal(tokenRequests,0,'preflight does not request an identity before explicit connect');
  const av=nodes(tree).find(node=>node.props?.onJoin);assert.ok(av);
  av.props.onJoin({height:720,micGain:100,listenGain:100,audioDeviceId:'selected-mic',videoDeviceId:'selected-cam',audioEnabled:false,videoEnabled:false,audioProfile:'speech'},'Guest');
  tree=workspace.render(props);await settle();tree=workspace.render(props);let connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);await settle();
  tree=workspace.render(props);connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);
  const room=latestRoom;
  assert.equal(nodes(tree).some(node=>node.type===PresentationControls),false,'presentation controls are removed from the guest UI');
  assert.equal(room.publications.microphone,undefined);assert.equal(room.publications.camera,undefined);
  assert.equal(room.dataCalls?.length||0,0,'hardware details are never broadcast without an authorized studio recipient');
  const lateStudio={trackPublications:new Map(),identity:'studio-panel-main',metadata:JSON.stringify({role:'studio-panel',accessRole:'admin'})};
  const unrelated={trackPublications:new Map(),identity:'guest-other',metadata:JSON.stringify({role:'guest'})};
  room.remoteParticipants.set(unrelated.identity,unrelated);room.emit(RoomEvent.ParticipantConnected,unrelated);await settle();
  assert.equal(room.dataCalls?.length||0,0,'another guest never receives client hardware details');
  room.remoteParticipants.set(lateStudio.identity,lateStudio);room.emit(RoomEvent.ParticipantConnected,lateStudio);await settle();
  assert.equal(room.dataCalls?.length,1,'a studio joining after the guest receives current hardware details');
  assert.deepEqual(room.dataCalls.at(-1).options.destinationIdentities,['studio-panel-main']);
  assert.equal(room.dataCalls.at(-1).info.cpu,'4 логических потоков (модель скрыта браузером)');
  assert.equal(room.dataCalls.at(-1).info.gpu,'Недоступно браузеру');assert.equal(room.dataCalls.at(-1).info.platform,'test');
  const promoted={trackPublications:new Map(),identity:'studio-moderator-late',metadata:JSON.stringify({role:'studio-moderator',accessRole:'moderator'})};
  room.remoteParticipants.set(promoted.identity,promoted);room.emit(RoomEvent.ParticipantConnected,promoted);await settle();
  assert.ok(room.dataCalls.every(call=>!call.options.destinationIdentities.includes(promoted.identity)),'moderator panels remain outside hardware recipients');
  promoted.metadata=JSON.stringify({role:'studio-moderator',accessRole:'admin'});room.emit(RoomEvent.ParticipantMetadataChanged,promoted.metadata,promoted);await settle();
  assert.deepEqual(room.dataCalls.at(-1).options.destinationIdentities,['studio-panel-main','studio-moderator-late'],'trusted metadata changes refresh authorized destinations');
  const beforeReconnectInfo=room.dataCalls.length;room.emit(RoomEvent.Reconnected);await settle();
  assert.ok(room.dataCalls.length>beforeReconnectInfo,'guest reconnect resends diagnostics to current staff');
  room.publications.camera={track:{mediaStreamTrack:{label:'Actual system camera',getSettings:()=>({deviceId:'actual-camera'})}}};
  room.emit(RoomEvent.ActiveDeviceChanged,'videoinput','actual-camera');await settle();
  assert.equal(room.dataCalls.at(-1).info.camera,'Actual system camera','camera diagnostics use the actual track when no chosen id matches');
  delete room.publications.camera;
  room.failClientInfo=true;room.emit(RoomEvent.ActiveDeviceChanged,'videoinput','actual-camera');await settle();
  assert.equal(room.state,'connected','diagnostic delivery failure does not fail the media session');room.failClientInfo=false;

  assert.equal(nodes(tree).some(node=>node.type==='select'&&/Режим микрофона|Маршрут подключения/.test(node.props['aria-label']||'')),false,'guest has no studio-only route/profile selectors');
  assert.equal(nodes(tree).some(node=>node.props?.href==='#guest-settings'||node.props?.className?.includes('guest-hover-settings')),false,'guest settings anchor and hover gear are removed');
  assert.ok(nodes(tree).some(node=>node.type==='h2'&&node.props.children==='Собственный мониторинг'));
  room.publications.screen_share={track:{source:'screen_share'}};
  const levelsAndScreen=settings(room,{micGain:0,listenGain:40,screenShareEnabled:false});await settle();tree=workspace.render(props);
  const levelsReport=reports.find(report=>report.commandId===levelsAndScreen.id);assert.equal(levelsReport.state.micGain,0);assert.equal(levelsReport.state.listenGain,40);assert.equal(levelsReport.state.screenShareEnabled,false);assert.deepEqual(gainChanges,[0]);assert.equal(room.publications.microphone,undefined,'remote gain command never opens a disabled microphone');assert.equal(room.calls.at(-1)[0],'screen');
  const privateTalk=nodes(tree).find(node=>node.props?.onReplyBusyChange);assert.ok(privateTalk);privateTalk.props.onReplyBusyChange(true);tree=workspace.render(props);
  assert.equal(nodes(tree).find(node=>node.props?.microphoneControl).props.microphoneControl.props.disabled,true,'only an active PTT reply locks program microphone control');
  room.emit(RoomEvent.DataReceived,{source:'microphone',enabled:true});await settle();assert.equal(room.publications.microphone,undefined,'remote enable cannot expose a private reply to the program room');
  const muteEpoch=privateTalk.props.microphoneMuteEpochRef;assert.equal(muteEpoch,connectorNode.props.microphoneMuteEpochRef,'private restore and remote media handler share the same mute generation');
  room.emit(RoomEvent.DataReceived,{source:'microphone',enabled:false});assert.equal(muteEpoch.current,1,'explicit studio mute invalidates pending private restoration synchronously');await settle();assert.equal(room.publications.microphone,undefined,'muting absent private-gated microphone never captures a replacement');
  const privateProfile=settings(room,{audioProfile:'raw'});await settle();assert.match(reports.find(report=>report.commandId===privateProfile.id).error,/заняты/,'profile changes cannot recapture program microphone during a held PTT reply');privateTalk.props.onReplyBusyChange(false);tree=workspace.render(props);
  const deviceRequests=nodes(tree).find(node=>node.props?.onApplyingChange);assert.ok(deviceRequests,'consent integration present');
  deviceRequests.props.onApplyingChange(true);tree=workspace.render(props);
  const busyCodec=settings(room,{videoCodec:'av1'});await settle();assert.match(reports.find(report=>report.commandId===busyCodec.id).error,/заняты/,'remote codec cannot overlap accepted device mutation');
  deviceRequests.props.onApplyingChange(false);tree=workspace.render(props);
  const offCodec=settings(room,{videoCodec:'h264'});await settle();tree=workspace.render(props);
  const offCodecReport=reports.find(report=>report.commandId===offCodec.id);assert.equal(offCodecReport.state.videoCodec,'h264');assert.equal(offCodecReport.state.videoEnabled,false);assert.equal(offCodecReport.state.actualVideoCodec,undefined);assert.equal(room.publications.camera,undefined,'studio codec selection must not acquire an off camera');
  room.emit(RoomEvent.DataReceived,{source:'camera',enabled:true});await settle();tree=workspace.render(props);
  assert.equal(room.publications.camera.track.codec,'h264','studio camera enable uses confirmed camera-off codec');
  const camera=room.publications.camera.track;
  room.onUnpublish=()=>{room.onUnpublish=undefined;room.emit(RoomEvent.TrackMuted,{track:{source:'camera'}},{sid:'PA-remote-camera'});room.state='reconnecting';room.emit(RoomEvent.Reconnecting);};
  const interruptedCodec=settings(room,{videoCodec:'av1'});await settle();tree=workspace.render(props);
  assert.ok(reports.find(report=>report.commandId===interruptedCodec.id).error,'interrupted codec command must not be acknowledged');
  assert.equal(room.publications.camera,undefined,'interrupted codec leaves the old capture detached');
  assert.equal(nodes(tree).find(node=>node.type===RoomConnector).props.choices.videoEnabled,true,'remote camera mute in a local republish gap cannot overwrite the saved local on state');
  room.state='connected';room.emit(RoomEvent.Reconnected);await settle();tree=workspace.render(props);
  assert.equal(room.publications.camera.track.codec,'h264','reconnect restores camera using the last confirmed codec');
  const restoredCamera=room.publications.camera.track;
  const liveCodec=settings(room,{videoCodec:'av1'});await settle();tree=workspace.render(props);
  assert.ok(camera.stopped>0,'interrupted codec releases the detached old capture');assert.equal(room.publications.camera.track,restoredCamera,'ordinary codec switch preserves exact camera capture');assert.equal(restoredCamera.codec,'av1',JSON.stringify(reports.find(report=>report.commandId===liveCodec.id)));assert.equal(reports.find(report=>report.commandId===liveCodec.id).state.actualVideoCodec,'av1');assert.equal(room.publications.microphone,undefined,'codec-only commands never acquire microphone');
  room.emit(RoomEvent.DataReceived,{source:'camera',enabled:false});await settle();tree=workspace.render(props);
  const rawCommand=settings(room,{audioProfile:'raw'});
  room.emit(RoomEvent.DataReceived,{source:'microphone',enabled:true});
  await settle();tree=workspace.render(props);
  const enabled=room.calls.find(call=>call[0]==='mic'&&call[1]===true);
  assert.equal(enabled[2].noiseSuppression,false,'queued studio enable sees the newly committed raw profile before another render');
  assert.equal(enabled[3].dtx,false);assert.equal(room.publications.microphone.options.red,true);
  assert.equal(room.activeDevices.audioinput,'selected-mic');
  assert.equal(reports.find(report=>report.commandId===rawCommand.id).state.audioProfile,'raw','studio receives confirmed applied profile');
  room.onUnpublish=()=>{room.onUnpublish=undefined;room.emit(RoomEvent.TrackUnmuted,{track:{source:'microphone'}},{sid:'PA-remote-microphone'});room.state='reconnecting';room.emit(RoomEvent.Reconnecting);};
  const interrupted=settings(room,{audioProfile:'speech'});await settle();
  assert.ok(reports.find(report=>report.commandId===interrupted.id).error,'interrupted profile command reports failure instead of success');
  assert.equal(room.publications.microphone,undefined,'network loss in profile republish gap cleans detached capture');
  tree=workspace.render(props);assert.equal(nodes(tree).find(node=>node.type===RoomConnector).props.choices.audioEnabled,true,'remote microphone unmute in a local republish gap cannot overwrite the saved local on state');
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
  const priorMic=room.publications.microphone.track;
  const routeCommand=settings(room,{connectionRoute:'relay'});await settle();tree=workspace.render(props);
  assert.equal(reports.some(report=>report.commandId===routeCommand.id),false,'route is never acknowledged before the new media join succeeds');
  connectorNode=nodes(tree).find(node=>node.type===RoomConnector);connector.render(connectorNode.props);await settle();tree=workspace.render(props);
  const connections=room.calls.filter(call=>call[0]==='connect');
  assert.equal(connections.length,2,'deliberate route change creates exactly one new media join');
  assert.equal(connections[0][2],connections[1][2],'same participant token is retained');
  assert.equal(connections[1][3].rtcConfig.iceTransportPolicy,'relay');
  assert.equal(tokenRequests,1,'route changes do not create another identity');
  assert.equal(room.publications.microphone,undefined,'muted microphone remains disabled after route reconnect');
  assert.equal(room.publications.camera,undefined,'muted camera remains disabled after route reconnect');
  const routeReport=reports.find(report=>report.commandId===routeCommand.id);assert.ok(routeReport);assert.equal(routeReport.state.connectionRoute,'relay');assert.equal(routeReport.state.activeRoute,'relay');assert.equal(routeReport.error,undefined);
  const reportCount=reports.length;
  settings(room,{audioProfile:'speech'},{participantSid:'PA-1'});
  settings(room,{audioProfile:'speech'},{},{identity:'guest-attacker'});
  settings(room,{audioProfile:'speech'},{issuedAt:Date.now()-70000,expiresAt:Date.now()-10000});
  await settle();assert.equal(reports.length,reportCount,'old session, participant-sent and expired controls are ignored');
  assert.ok(priorMic.stopped>0,'previous capture is cleaned during deliberate reconnect');
  const snapshot=await transferOptions.snapshot();
  assert.equal(snapshot.settings.choices.videoCodec,'av1','transfer snapshot retains selected camera codec');assert.equal(snapshot.settings.choices.audioProfile,'raw');assert.equal(snapshot.settings.choices.connectionRoute,'relay');
  assert.equal(snapshot.settings.choices.audioDeviceId,'replacement-mic');assert.equal(snapshot.settings.choices.videoDeviceId,'selected-cam');
  assert.equal(snapshot.settings.choices.audioEnabled,false);assert.equal(snapshot.settings.choices.videoEnabled,false);
  const normalCommand=settings(room,{connectionRoute:'normal'});await settle();tree=workspace.render(props);connector.render(nodes(tree).find(node=>node.type===RoomConnector).props);await settle();tree=workspace.render(props);
  assert.equal(reports.find(report=>report.commandId===normalCommand.id).state.connectionRoute,'normal');
  room.failRelay=true;
  const failedTurn=settings(room,{connectionRoute:'relay'});await settle();tree=workspace.render(props);
  const originalError=console.error;console.error=()=>{};
  connector.render(nodes(tree).find(node=>node.type===RoomConnector).props);await settle();tree=workspace.render(props);
  connector.render(nodes(tree).find(node=>node.type===RoomConnector).props);await settle();tree=workspace.render(props);console.error=originalError;
  const failureReport=reports.find(report=>report.commandId===failedTurn.id);assert.ok(failureReport);assert.match(failureReport.error,/TURN relay failed/);assert.equal(failureReport.state.connectionRoute,'normal');
  const allConnections=room.calls.filter(call=>call[0]==='connect');assert.equal(allConnections.length,5,'failed requested TURN makes exactly one rollback join to prior working route');
  assert.equal(allConnections.at(-1)[3].rtcConfig,undefined,'rollback uses ordinary route rather than retrying failed forced TURN');
  assert.ok(allConnections.every(call=>call[2]==='same-session-token'));assert.equal(tokenRequests,1);
  assert.equal(room.state,'connected');assert.equal(room.publications.microphone,undefined);assert.equal(room.publications.camera,undefined);
  const restored=await transferOptions.snapshot();assert.equal(restored.settings.choices.connectionRoute,'normal');assert.equal(restored.settings.choices.audioProfile,'raw');assert.equal(restored.settings.choices.audioDeviceId,'replacement-mic');
  const beforeKick=room.calls.filter(call=>call[0]==='connect').length;
  room.kickOnRelay=true;
  settings(room,{connectionRoute:'relay'});await settle();tree=workspace.render(props);
  console.error=()=>{};
  connector.render(nodes(tree).find(node=>node.type===RoomConnector).props);await settle();tree=workspace.render(props);
  const afterKickConnector=nodes(tree).find(node=>node.type===RoomConnector);
  if(afterKickConnector){connector.render(afterKickConnector.props);await settle();tree=workspace.render(props);}
  console.error=originalError;
  assert.equal(room.calls.filter(call=>call[0]==='connect').length,beforeKick+1,'staff kick during requested join must prevent rollback/rejoin');
  assert.ok(nodes(tree).some(node=>node.type==='p'&&node.props.children==='Студия отключила вас от комнаты.'),'kick during initial join is surfaced instead of ignored');
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
  const raceRoom=new Room(),raceConnector=renderer(RoomConnector);
  const raceChoices={height:720,micGain:100,listenGain:100,audioEnabled:false,videoEnabled:false};
  const raceRef={current:raceChoices},raceGeneration={current:0};
  raceConnector.render({room:raceRoom,token:'capture-race-session',choices:raceChoices,choicesRef:raceRef,mediaGeneration:raceGeneration,connectionRoutes:{relay:{configured:false}},attempt:0,onConnectionStatus:noop,onRemoteChange:noop,onRemoved:noop,onDeviceError:noop,videoEnabled:()=>true});
  await settle(); await raceRoom.localParticipant.setCameraEnabled(true);
  const native=raceRoom.publications.camera.track.mediaStreamTrack;
  let actual={width:1280,height:720,frameRate:30},releaseRestore,restoreStarted=false;
  native.getSettings=()=>({...actual});native.getConstraints=()=>({height:{ideal:720}});
  native.applyConstraints=async constraints=>{
    if(!restoreStarted){restoreStarted=true;await new Promise(resolve=>{releaseRestore=resolve;});}
    const height=constraints.height?.ideal||720;
    actual={width:constraints.width?.ideal||Math.round(height*16/9),height,frameRate:constraints.frameRate?.ideal||30};
  };
  raceRoom.emit(RoomEvent.Reconnected);await settle();assert.ok(restoreStarted);
  const cameraCapture={mode:'custom',resolution:'1920x1080',frameRate:'25'};
  raceRoom.localParticipant.metadata=JSON.stringify({cameraCapture});
  const newerCapture=mocked['@/lib/guest-video-codec'].switchGuestCameraCapture(raceRoom,cameraCapture,()=>true).then(changed=>{assert.equal(changed,true);raceRef.current={...raceRef.current,cameraCapture};});
  await settle();releaseRestore();await newerCapture;await settle();
  assert.deepEqual(actual,{width:1920,height:1080,frameRate:25},'serialized reconnect restore cannot finish after and overwrite the newer capture command');
  let attempts=0;
  native.applyConstraints=async()=>{attempts++;raceRoom.localParticipant.sid='PA-restored-new';throw new Error('native interrupted');};
  raceRoom.emit(RoomEvent.Reconnected);await settle();
  assert.equal(attempts,1,'reconnect resizeMode fallback cannot retry against a camera restored under another SID');
  raceConnector.unmount();await settle();
  const unsupportedRoom=new Room(),unsupportedConnector=renderer(RoomConnector);
  unsupportedRoom.omitNoiseSuppression=true;
  const unsupportedChoices={height:720,audioEnabled:true,videoEnabled:true,audioProfile:'speech',audioDeviceId:'requested-mic',videoDeviceId:'requested-cam'};
  const unsupportedErrors=[],connectedSettings=[];
  let unsupportedStatus=recovery.initialRecoveryStatus();
  const unsupportedProps={room:unsupportedRoom,token:'unsupported-ns-session',choices:unsupportedChoices,choicesRef:{current:unsupportedChoices},mediaGeneration:{current:0},connectionRoutes:{relay:{configured:false}},attempt:0,onConnectionStatus:update=>{unsupportedStatus=typeof update==='function'?update(unsupportedStatus):update;},onRemoteChange:noop,onRemoved:noop,onDeviceError:error=>unsupportedErrors.push(error),onConnectedSettings:(...args)=>connectedSettings.push(args),videoEnabled:()=>true};
  unsupportedConnector.render(unsupportedProps);await settle();
  unsupportedConnector.render(unsupportedProps);await settle();
  const startupResult={microphoneEnabled:unsupportedRoom.localParticipant.isMicrophoneEnabled,cameraEnabled:unsupportedRoom.localParticipant.isCameraEnabled,cameraCalls:unsupportedRoom.calls.filter(call=>call[0]==='cam'&&call[1]).length,noiseSuppressionState:audio.guestNoiseSuppressionState(unsupportedRoom),cameraDevice:unsupportedRoom.publications.camera?.track.getSourceTrackSettings().deviceId};
  unsupportedConnector.unmount();await settle();
  assert.equal(startupResult.cameraEnabled,true,'unconfirmed microphone processing must not block the requested camera at entry');
  assert.equal(startupResult.cameraCalls,1);
  assert.equal(startupResult.cameraDevice,'requested-cam');
  assert.equal(startupResult.microphoneEnabled,true,'an unsupported processing report must not unexpectedly mute an already published microphone');
  assert.equal(startupResult.noiseSuppressionState,'unavailable');
  assert.equal(unsupportedStatus.phase,'connected');
  assert.match(unsupportedErrors.at(-1),/не подтвердил включение шумоподавления/,'the connected device effect must preserve the explicit processing error');
  assert.match(connectedSettings.at(-1)[3],/не подтвердил включение шумоподавления/,'startup must not acknowledge unconfirmed audio processing as successful');
  const roleWorkspace=renderer(GuestWorkspace),roleConnector=renderer(RoomConnector);
  let roleTree=roleWorkspace.render(props);await settle();roleTree=roleWorkspace.render(props);nodes(roleTree).find(node=>node.props?.onJoin).props.onJoin({height:720,audioEnabled:false,videoEnabled:false,audioDeviceId:'mic',videoDeviceId:'cam'},'New admin');roleTree=roleWorkspace.render(props);await settle();roleTree=roleWorkspace.render(props);const roleRoom=latestRoom;roleConnector.render(nodes(roleTree).find(node=>node.type===RoomConnector).props);await settle();roleTree=roleWorkspace.render(props);
  const liveSources=['camera','microphone','screen_share','screen_share_audio'].map(source=>({source,mediaStreamTrack:{enabled:true,readyState:'live',stop(){this.readyState='ended';}},stop(){this.mediaStreamTrack.stop();}}));roleRoom.localParticipant.trackPublications=new Map(liveSources.map(track=>[track.source,{track}]));for(const track of liveSources)roleRoom.publications[track.source]={track};
  const navigations=[];global.window.location.assign=path=>{assert.equal(roleRoom.state,'disconnected');assert.ok(liveSources.every(track=>track.mediaStreamTrack.readyState==='ended'),'parent role transition stops camera/microphone/display before navigation');navigations.push(path);};
  const offer=nodes(roleTree).find(node=>node.props?.onTransition);assert.ok(offer,'guest role offer uses the parent cleanup handler');const path='/admin?studioId=test-studio&room=test-room';const transition=offer.props.onTransition(path);assert.equal(offer.props.onTransition(path),transition,'double transition click shares one cleanup');await transition;assert.deepEqual(navigations,[path]);roleTree=roleWorkspace.render(props);assert.equal(nodes(roleTree).some(node=>node.type===RoomConnector),false,'accepted transition removes reconnecting guest connector');assert.equal(nodes(roleTree).some(node=>node.props?.onReplyBusyChange),false,'accepted transition unmounts private guest capture');const beforeMedia=roleRoom.calls.length;roleRoom.emit(RoomEvent.Reconnected);roleRoom.emit(RoomEvent.DataReceived,{source:'microphone',enabled:true});await settle();assert.equal(roleRoom.calls.length,beforeMedia,'late reconnect and server enable cannot restart a transitioned guest');roleConnector.unmount();roleWorkspace.unmount();await settle();
  const originalFetch=global.fetch;
  const restoredMedia={audioProfile:'raw',connectionRoute:'relay',videoCodec:'h264',micGain:75,listenGain:25};
  for(const overrides of [{},{micGain:40}]){
    global.fetch=async(url,options)=>{const response=await originalFetch(url,options);if(url.startsWith('/api/token'))return{...response,json:async()=>({...await response.json(),guestSettings:{media:restoredMedia}})};return response;};
    const retainedWorkspace=renderer(GuestWorkspace);let retainedTree=retainedWorkspace.render(props);await settle();retainedTree=retainedWorkspace.render(props);
    nodes(retainedTree).find(node=>node.props?.onJoin).props.onJoin({height:1080,micGain:100,listenGain:100,audioEnabled:false,videoEnabled:false,audioDeviceId:'kept-mic',videoDeviceId:'kept-cam',audioProfile:'speech',videoCodec:'av1',connectionRoute:'auto'},'Retained caster',overrides);
    retainedTree=retainedWorkspace.render(props);await settle();retainedTree=retainedWorkspace.render(props);
    const retainedChoices=nodes(retainedTree).find(node=>node.type===RoomConnector).props.choicesRef.current;
    assert.equal(retainedChoices.audioProfile,'raw');assert.equal(retainedChoices.videoCodec,'h264');assert.equal(retainedChoices.connectionRoute,'relay');assert.equal(retainedChoices.listenGain,25);
    assert.equal(retainedChoices.micGain,overrides.micGain??75,'explicit gain edits win while untouched gain restores from the server');
    assert.equal(retainedChoices.audioDeviceId,'kept-mic');assert.equal(retainedChoices.videoDeviceId,'kept-cam');assert.equal(retainedChoices.audioEnabled,false);assert.equal(retainedChoices.videoEnabled,false,'server setting restoration cannot enable an explicitly disabled device');
    retainedWorkspace.unmount();
  }
  global.fetch=originalFetch;
  const initialRoom=new Room(),initialConnector=renderer(RoomConnector);
  initialRoom.remoteParticipants.set(lateStudio.identity,lateStudio);
  const initialChoices={height:1080,micGain:100,listenGain:100,audioEnabled:false,videoEnabled:false};
  initialConnector.render({room:initialRoom,token:'existing-studio-token',choices:initialChoices,choicesRef:{current:initialChoices},mediaGeneration:{current:0},connectionRoutes:{relay:{configured:false}},attempt:0,onConnectionStatus:noop,onRemoteChange:noop,onRemoved:noop,onDeviceError:noop,videoEnabled:()=>true});await settle();
  assert.ok(initialRoom.dataCalls?.length,'a guest entering an already running studio still announces diagnostics');
  const enumeration=navigator.mediaDevices.enumerateDevices;
  let finishEnumeration;navigator.mediaDevices.enumerateDevices=()=>new Promise(resolve=>{finishEnumeration=resolve;});
  initialRoom.emit(RoomEvent.ActiveDeviceChanged,'videoinput','next-camera');
  assert.equal(typeof finishEnumeration,'function');
  initialConnector.unmount();const beforeCleanupInfo=initialRoom.dataCalls.length;
  finishEnumeration([]);await settle();
  assert.equal(initialRoom.dataCalls.length,beforeCleanupInfo,'late device enumeration cannot publish after leaving the room');
  assert.equal(initialRoom.listenerCount(RoomEvent.ActiveDeviceChanged),0,'diagnostic device listeners are detached on unmount');
  navigator.mediaDevices.enumerateDevices=enumeration;
  const preferenceRoom=new Room(),preferenceConnector=renderer(RoomConnector);
  const preferenceChoices={height:1080,micGain:100,listenGain:100,audioEnabled:false,videoEnabled:true,cameraResolution:'720p',cameraFrameRate:'50'};
  const preferenceRef={current:preferenceChoices};
  const preferenceErrors=[];
  const preferenceProps={room:preferenceRoom,token:'preference-session',choices:preferenceChoices,choicesRef:preferenceRef,mediaGeneration:{current:0},connectionRoutes:{relay:{configured:false}},attempt:0,onConnectionStatus:noop,onRemoteChange:noop,onRemoved:noop,onDeviceError:error=>preferenceErrors.push(error),videoEnabled:()=>true};
  preferenceConnector.render(preferenceProps);await settle();preferenceConnector.render(preferenceProps);await settle();
  assert.equal(preferenceRoom.calls.find(call=>call[0]==='cam'&&call[1])[2].resolution.height.ideal,720,'workspace initial publication keeps guest resolution');
  assert.equal(preferenceRoom.publications.camera.track.nativeConstraints.frameRate.ideal,50,'connected effects keep guest FPS');
  preferenceRoom.emit(RoomEvent.Reconnected);await settle();
  assert.equal(preferenceRoom.publications.camera.track.nativeConstraints.frameRate.ideal,50,'workspace reconnect does not reset guest FPS');
  assert.equal(preferenceRoom.publications.camera.track.nativeConstraints.height.ideal,720,'workspace reconnect does not reset guest resolution');
  preferenceConnector.unmount();
  console.log('PASS: production guest workspace applies raw mode to queued enable, confirms toolbar mute, preserves muted devices/profile across same-identity relay reconnect and transfer snapshot');
})().catch(error=>{console.error(error);process.exitCode=1;});
