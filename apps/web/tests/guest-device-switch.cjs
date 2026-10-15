const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {switchGuestMicrophoneDevice,switchGuestCameraDevice,guestDeviceState,switchGuestOutputDevice}=require('../lib/guest-device-switch.ts');
const choices={audioDeviceId:'old',audioProfile:'raw',height:720,micGain:100,listenGain:100};
function makeRoom({muted=false,absent=false}={}){
 const room={state:'connected',calls:[],active:'old'};
 const track={isMuted:muted,constraints:{sampleRate:48000},native:{deviceId:'old',noiseSuppression:false,echoCancellation:false,autoGainControl:false,voiceIsolation:false},mediaStreamTrack:{enabled:!muted},getSourceTrackSettings(){return this.native;},async restartTrack(options){assert.equal(room.pub,undefined,'microphone detached during native restart');room.calls.push(['restart',options]);if(room.failRestart){room.failRestart--;throw new Error('restart failure');}this.native={...this.native,...options,deviceId:room.ignoreDevice?'old':options.deviceId.exact};this.mediaStreamTrack.enabled=!this.isMuted;if(room.afterRestart)room.afterRestart(options);},stop(){room.calls.push(['stop']);}};
 room.track=track;room.pub=absent?undefined:{track,options:{source:'microphone',red:true,dtx:false,stopMicTrackOnMute:false}};
 room.getActiveDevice=()=>room.active;room.switchActiveDevice=async(kind,id)=>{assert.equal(kind,'audioinput');if(!room.track.isMuted)assert.equal(room.pub,undefined,'live microphone default updated only detached');else room.track.constraints.deviceId={exact:id};room.calls.push(['default',id]);room.active=id;return true;};
 room.localParticipant={get isMicrophoneEnabled(){return !!room.pub&&!track.isMuted;},getTrackPublication:source=>source==='microphone'?room.pub:undefined,async unpublishTrack(target,stop){assert.equal(target,track);assert.equal(stop,false);room.pub=undefined;room.calls.push(['unpublish']);},async publishTrack(target,options){assert.equal(target,track);if(room.failPublish){room.failPublish--;throw new Error('publish failure');}room.pub={track,options};room.calls.push(['publish',target.isMuted]);}};
 return room;
}
function makeCameraRoom({muted=false,absent=false}={}){
 const room=makeRoom({muted,absent});room.track.codec='av1';room.track.mediaStreamTrack.applyConstraints=async options=>{assert.equal(options.width,undefined,'camera native aspect must not be forced');room.calls.push(['cameraConstraints',options]);};room.track.native.width=1920;room.track.native.height=1080;room.track.native.frameRate=30;
 room.localParticipant.getTrackPublication=source=>source==='camera'?room.pub:undefined;
 Object.defineProperty(room.localParticipant,'isCameraEnabled',{get(){return !!room.pub&&!room.track.isMuted;}});
 room.switchActiveDevice=async(kind,id)=>{assert.equal(kind,'videoinput');if(!room.track.isMuted)assert.equal(room.pub,undefined);else room.track.constraints.deviceId={exact:id};room.active=id;return true;};
 if(room.pub)room.pub.options={source:'camera',videoCodec:'av1',simulcast:false,scalabilityMode:'L3T3_KEY',backupCodec:false};
 const nativePublish=room.localParticipant.publishTrack;room.localParticipant.publishTrack=async(track,options)=>{await nativePublish(track,options);track.codec=options.videoCodec;};
 return room;
}
(async()=>{
 const room=makeRoom();assert.equal(await switchGuestMicrophoneDevice(room,()=>choices,'new',()=>true),'applied');assert.equal(room.track.native.deviceId,'new');assert.equal(room.track.native.noiseSuppression,false);assert.equal(room.pub.options.dtx,false);assert.equal(room.pub.options.red,true);assert.equal(room.pub.options.stopMicTrackOnMute,false);
 const muted=makeRoom({muted:true});assert.equal(await switchGuestMicrophoneDevice(muted,()=>choices,'new',()=>true),'saved');assert.equal(muted.track.isMuted,true);assert.equal(muted.track.mediaStreamTrack.enabled,false);assert.equal(muted.track.native.deviceId,'old','muted microphone keeps its prior native capture');assert.deepEqual(muted.track.constraints.deviceId,{exact:'new'});assert.equal(muted.calls.some(call=>['unpublish','restart','publish'].includes(call[0])),false,'muted microphone only defers the selected device');
 const absent=makeRoom({absent:true});assert.equal(await switchGuestMicrophoneDevice(absent,()=>choices,'new',()=>true),'saved');assert.equal(absent.pub,undefined);assert.equal(absent.calls.some(call=>call[0]==='restart'||call[0]==='publish'),false,'off absent mic only updates device default');
 for(const camera of [false,true]){
  const original=camera?makeCameraRoom():makeRoom();original.localParticipant.sid='PA-original';original.failPublish=1;original.afterRestart=options=>{if(options.deviceId.exact==='old')original.localParticipant.sid='PA-rejoined';};
  const change=camera?switchGuestCameraDevice:switchGuestMicrophoneDevice;await assert.rejects(change(original,()=>choices,'new',()=>true),/publish failure/);assert.equal(original.pub,undefined,'rollback capture crossing SID must never republish old track into new session');assert.equal(original.calls.filter(call=>call[0]==='publish').length,0);assert.equal(original.calls.filter(call=>call[0]==='stop').length,1);
 }
 const sdk=require('livekit-client');
 for(const kind of ['audioinput','videoinput']){
  const source=kind==='audioinput'?sdk.Track.Source.Microphone:sdk.Track.Source.Camera;
  const deferredTrack={isMuted:true,_constraints:{deviceId:{exact:'old'}},_mediaStreamTrack:{enabled:false,getSettings:()=>({deviceId:'old'})},restartTrack:async()=>assert.fail('muted SDK track must not acquire native capture')};
  deferredTrack.setDeviceId=(...args)=>sdk.LocalAudioTrack.prototype.setDeviceId.call(deferredTrack,...args);
  const publication={source,track:deferredTrack,...(kind==='audioinput'?{audioTrack:deferredTrack}:{videoTrack:deferredTrack})};
  const deferredRoom={state:'connected',options:{audioCaptureDefaults:{deviceId:'old'},videoCaptureDefaults:{deviceId:'old'}},localParticipant:{sid:'PA-muted',activeDeviceMap:new Map([[kind,'old']]),isMicrophoneEnabled:false,isCameraEnabled:false,getTrackPublication:requested=>requested===source?publication:undefined,audioTrackPublications:new Map(kind==='audioinput'?[['mic',publication]]:[]),videoTrackPublications:new Map(kind==='videoinput'?[['camera',publication]]:[])},emit(){},getActiveDevice(requested){return this.localParticipant.activeDeviceMap.get(requested);},switchActiveDevice(...args){return sdk.Room.prototype.switchActiveDevice.call(this,...args);}};
  const change=kind==='audioinput'?switchGuestMicrophoneDevice:switchGuestCameraDevice;
  assert.equal(await change(deferredRoom,()=>choices,'deferred',()=>true),'saved');
  assert.deepEqual(deferredTrack._constraints.deviceId,{exact:'deferred'});assert.equal(deferredTrack.pendingDeviceChange,true);assert.equal(deferredTrack._mediaStreamTrack.enabled,false);assert.equal(deferredRoom.localParticipant.getTrackPublication(source),publication,'installed SDK keeps muted publication intact');
  let current=true;const originalSwitch=deferredRoom.switchActiveDevice;
  deferredRoom.switchActiveDevice=async(...args)=>{const result=await originalSwitch.apply(deferredRoom,args);if(args[1]==='expired')current=false;return result;};
  await assert.rejects(change(deferredRoom,()=>({...choices,audioDeviceId:'deferred',videoDeviceId:'deferred'}),'expired',()=>current),/устарел/);
  assert.deepEqual(deferredTrack._constraints.deviceId,{exact:'deferred'},'expired muted request restores the prior deferred choice without capture');
 }
 const sharing=makeRoom({absent:true});sharing.options={audioCaptureDefaults:{deviceId:'old'},videoCaptureDefaults:{deviceId:'old'}};sharing.localParticipant.activeDeviceMap=new Map([['audioinput','old'],['videoinput','old']]);sharing.getActiveDevice=kind=>sharing.localParticipant.activeDeviceMap.get(kind);sharing.localParticipant.audioTrackPublications=new Map([['shareAudio',{source:sdk.Track.Source.ScreenShareAudio}]]);sharing.localParticipant.videoTrackPublications=new Map([['shareVideo',{source:sdk.Track.Source.ScreenShare}]]);sharing.emit=()=>{};sharing.switchActiveDevice=(...args)=>sdk.Room.prototype.switchActiveDevice.call(sharing,...args);
 assert.equal(await switchGuestMicrophoneDevice(sharing,()=>choices,'saved-mic',()=>true),'saved');assert.equal(sharing.getActiveDevice('audioinput'),'old','installed SDK keeps active map stale while screen-share audio exists');assert.deepEqual(sharing.options.audioCaptureDefaults.deviceId,{exact:'saved-mic'});
 assert.equal(await switchGuestCameraDevice(sharing,()=>choices,'saved-camera',()=>true),'saved');assert.equal(sharing.getActiveDevice('videoinput'),'old','installed SDK keeps active map stale while screen-share video exists');assert.deepEqual(sharing.options.videoCaptureDefaults.deviceId,{exact:'saved-camera'});assert.equal(sharing.pub,undefined);assert.equal(sharing.calls.length,0,'only future capture defaults change while sharing');
 const stale=makeRoom();await assert.rejects(switchGuestMicrophoneDevice(stale,()=>choices,'new',()=>false),/устарел/);assert.equal(stale.calls.length,0);
 for(const camera of [false,true]){
  const change=camera?switchGuestCameraDevice:switchGuestMicrophoneDevice;
  const factory=camera?makeCameraRoom:makeRoom;
  const interrupted=factory();interrupted.localParticipant.sid='PA-original';let valid=true;
  const originalSwitch=interrupted.switchActiveDevice;
  interrupted.switchActiveDevice=async(kind,id)=>{const result=await originalSwitch(kind,id);if(id==='new')valid=false;return result;};
  await assert.rejects(change(interrupted,()=>choices,'new',()=>valid),/устарел/);
  assert.equal(interrupted.calls.some(call=>call[0]==='restart'&&call[1].deviceId.exact==='new'),false,'expiry during default update must not start fresh capture');
  assert.equal(interrupted.active,'old','expired update restores the prior capture default');
  const absentInterrupted=factory({absent:true});absentInterrupted.localParticipant.sid='PA-original';valid=true;
  const absentSwitch=absentInterrupted.switchActiveDevice;
  absentInterrupted.switchActiveDevice=async(kind,id)=>{const result=await absentSwitch(kind,id);if(id==='new')valid=false;return result;};
  await assert.rejects(change(absentInterrupted,()=>choices,'new',()=>valid),/устарел/);
  assert.equal(absentInterrupted.active,'old','off-device request must roll back a default changed after expiry');
  assert.equal(absentInterrupted.pub,undefined);
  const rejoined=factory();rejoined.localParticipant.sid='PA-original';
  const rejoinedSwitch=rejoined.switchActiveDevice;
  rejoined.switchActiveDevice=async(kind,id)=>{const result=await rejoinedSwitch(kind,id);if(id==='new')rejoined.localParticipant.sid='PA-rejoined';return result;};
  await assert.rejects(change(rejoined,()=>choices,'new',()=>true),/устарел/);
  assert.equal(rejoined.calls.some(call=>call[0]==='restart'),false,'helper independently binds capture to the initial participant SID');
 }
 const dishonest=makeRoom();dishonest.ignoreDevice=true;await assert.rejects(switchGuestMicrophoneDevice(dishonest,()=>choices,'new',()=>true),/не подтвердил/);assert.equal(dishonest.pub.track,dishonest.track);assert.equal(dishonest.active,'old');
 const failed=makeRoom();failed.failPublish=1;await assert.rejects(switchGuestMicrophoneDevice(failed,()=>choices,'new',()=>true),/publish failure/);assert.equal(failed.track.native.deviceId,'old');assert.equal(failed.track.isMuted,false);assert.equal(failed.track.mediaStreamTrack.enabled,true);assert.equal(failed.pub.track,failed.track);
 const failedCapture=makeRoom();failedCapture.failRestart=1;await assert.rejects(switchGuestMicrophoneDevice(failedCapture,()=>choices,'new',()=>true),/restart failure/);assert.equal(failedCapture.track.native.deviceId,'old');assert.equal(failedCapture.pub.track,failedCapture.track);
 const camera=makeCameraRoom();assert.equal(await switchGuestCameraDevice(camera,()=>({...choices,videoDeviceId:'old',videoCodec:'av1'}),'new',()=>true),'applied');assert.equal(camera.track.native.deviceId,'new');assert.equal(camera.track.codec,'av1');assert.equal(camera.calls.find(call=>call[0]==='restart')[1].resolution,undefined,'new camera never inherits prior width');assert.deepEqual(camera.calls.find(call=>call[0]==='restart')[1].height,{ideal:720});assert.equal(camera.pub.options.scalabilityMode,'L3T3_KEY');assert.equal(camera.pub.options.backupCodec,false);
 const offCamera=makeCameraRoom({muted:true});assert.equal(await switchGuestCameraDevice(offCamera,()=>choices,'new',()=>true),'saved');assert.equal(offCamera.track.isMuted,true);assert.equal(offCamera.track.mediaStreamTrack.enabled,false);assert.equal(offCamera.track.native.deviceId,'old','off camera keeps its prior native capture');assert.deepEqual(offCamera.track.constraints.deviceId,{exact:'new'});assert.equal(offCamera.calls.length,0,'muted camera is neither restarted nor republished');
 const noCamera=makeCameraRoom({absent:true});assert.equal(await switchGuestCameraDevice(noCamera,()=>choices,'new',()=>true),'saved');assert.equal(noCamera.pub,undefined);assert.equal(noCamera.calls.length,0,'absent camera does not acquire or publish');
 const failedCamera=makeCameraRoom();failedCamera.failPublish=1;await assert.rejects(switchGuestCameraDevice(failedCamera,()=>choices,'new',()=>true),/publish failure/);assert.equal(failedCamera.track.native.deviceId,'old');assert.equal(failedCamera.track.codec,'av1');assert.equal(failedCamera.pub.options.videoCodec,'av1');
 const lyingCamera=makeCameraRoom();lyingCamera.ignoreDevice=true;await assert.rejects(switchGuestCameraDevice(lyingCamera,()=>choices,'new',()=>true),/не подтвердил/);assert.equal(lyingCamera.pub.track,lyingCamera.track);
 Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 Chrome/140.0.0.0',mediaDevices:{enumerateDevices:async()=>[{kind:'audioinput',deviceId:'named',label:'Allowed'},{kind:'videoinput',deviceId:'hidden',label:''},{kind:'audioinput',deviceId:'',label:'Opaque'}]}}});
 global.HTMLMediaElement=class{};const inventory=await guestDeviceState(room,choices);assert.deepEqual(inventory.devices,[{kind:'audioinput',deviceId:'named',label:'Allowed'}]);assert.equal(inventory.outputSupported,false);
 await assert.rejects(switchGuestOutputDevice(room,'new',()=>true),/не поддерживает/);
 global.HTMLMediaElement.prototype.setSinkId=async function(){};
 const elements=[{sinkId:'default',isConnected:true,async setSinkId(id){this.sinkId=id;}},{sinkId:'default',isConnected:true,fail:true,async setSinkId(id){if(id==='bad'&&this.fail){this.fail=false;throw new Error('second sink rejected');}this.sinkId=id;}}];
 global.document={querySelectorAll:()=>elements,createElement:()=>new HTMLMediaElement()};
 const output={state:'connected',options:{audioOutput:{deviceId:'default'}},localParticipant:{sid:'PA-1',activeDeviceMap:new Map([['audiooutput','default']])},remoteParticipants:new Map(),emit(){},getActiveDevice(kind){return this.localParticipant.activeDeviceMap.get(kind);},switchActiveDevice(...args){return sdk.Room.prototype.switchActiveDevice.call(this,...args);}};
 elements.forEach((element,i)=>output.remoteParticipants.set(String(i),{trackPublications:new Map([['audio',{kind:'audio',track:{attachedElements:[element]}}]]),setAudioOutput:async({deviceId})=>element.setSinkId(deviceId)}));
 await assert.rejects(switchGuestOutputDevice(output,'bad',()=>true),/second sink rejected/);assert.equal(output.getActiveDevice('audiooutput'),'default');assert.deepEqual(elements.map(element=>element.sinkId),['default','default'],'partial native output failure restores all sinks despite stale active map');

 console.log('PASS: exact active mic/camera verification, camera AV1 options and native aspect retained, installed SDK muted/absent deferred defaults with no capture, expired defaults restored, expiry/SID checks before acquisition, original audio processing/publications retained, native/output failure rollback and permission-limited inventory');
})().catch(error=>{console.error(error);process.exitCode=1;});
