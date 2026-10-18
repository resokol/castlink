const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, file);
(async () => {
  const { replaceStudioPublishedTracks, readStudioDeviceChoices, saveStudioDeviceChoices } = require('../lib/studio-device-session.ts');
  const events = [];
  const oldVideo = {kind:'video', readyState:'live'}, oldAudio={kind:'audio',readyState:'live'};
  const video={mediaStreamTrack:oldVideo,async replaceTrack(track){events.push(['video',track]);this.mediaStreamTrack=track;}};
  const audio={mediaStreamTrack:oldAudio,async replaceTrack(track){events.push(['audio',track]);if(track.fail)throw Error('microphone unavailable');this.mediaStreamTrack=track;}};
  const newVideo={kind:'video',readyState:'live'},newAudio={kind:'audio',readyState:'live'};
  const stream=(v,a)=>({getVideoTracks:()=>[v],getAudioTracks:()=>[a]});
  await replaceStudioPublishedTracks({video,audio},stream(newVideo,newAudio));
  assert.equal(video.mediaStreamTrack,newVideo);assert.equal(audio.mediaStreamTrack,newAudio);
  const failedAudio={kind:'audio',readyState:'live',fail:true};
  await assert.rejects(replaceStudioPublishedTracks({video,audio},stream(oldVideo,failedAudio)),/microphone unavailable/);
  assert.equal(video.mediaStreamTrack,newVideo,'failed microphone switch restores video publication');
  assert.equal(audio.mediaStreamTrack,newAudio,'failed microphone switch retains audio publication');
  assert.equal(events.length,6,'two replacements, failed pair, audio and video rollback');
  video.replaceTrack=async track=>{if(track===newVideo)throw Error('video rollback failed');video.mediaStreamTrack=track;};
  await assert.rejects(replaceStudioPublishedTracks({video,audio},stream(oldVideo,failedAudio)),error=>error.name==='StudioTrackRollbackError','failed rollback is identified for explicit OFF AIR recovery');
  assert.equal(video.mediaStreamTrack,oldVideo,'rollback failure may leave the replacement attached until caller safely stops it');
  const previousBackup={readyState:'live',stop(){}},orphanClone={readyState:'live',stop(){this.readyState='ended';}};
  const backupVideo={mediaStreamTrack:oldVideo,async replaceTrack(track){this.mediaStreamTrack=track;},simulcastCodecs:new Map([['backup',{mediaStreamTrack:previousBackup,sender:{async replaceTrack(){throw Error('backup sender failed');}}}]])};
  await assert.rejects(replaceStudioPublishedTracks({video:backupVideo,audio},stream({...newVideo,clone:()=>orphanClone},newAudio)),error=>error.name==='StudioTrackRollbackError');
  assert.equal(orphanClone.readyState,'ended','failed backup rollback still releases the newly owned clone');
  const values = new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  assert.deepEqual(readStudioDeviceChoices(storage,'one'),{videoDeviceId:'',audioDeviceId:'',outputDeviceId:'default'});
  saveStudioDeviceChoices(storage,'one',{videoDeviceId:'cam',audioDeviceId:'mic',outputDeviceId:'headphones'});
  assert.equal(readStudioDeviceChoices(storage,'one').audioDeviceId,'mic','reentry restores explicit choice');
  assert.equal(readStudioDeviceChoices(storage,'two').audioDeviceId,'','studio choices are isolated');
  assert.doesNotThrow(()=>saveStudioDeviceChoices({setItem(){throw Error('denied');}},'one',{}));
  assert.equal(readStudioDeviceChoices({getItem(){throw Error('denied');}},'one').outputDeviceId,'default');
  const file=ts.createSourceFile('StudioWorkspace.tsx',fs.readFileSync(`${__dirname}/../components/StudioWorkspace.tsx`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let toggle; (function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='toggleOnAir')toggle=n.initializer;ts.forEachChild(n,visit);})(file);
  let prepared=0,published=0;
  const ref=current=>({current});
  const context={studioRole:'primary',studioRoleRef:ref('primary'),videoModeBusyRef:ref(false),previewReadyRef:ref(false),airBusyRef:ref(false),airRequestQueueRef:ref(Promise.resolve()),onAirRef:ref(false),returnStreamRef:ref(undefined),returnPublishedRef:ref({}),returnPublicationRef:ref({}),returnSenderStatsRef:ref({}),refreshRef:ref(async()=>{}),returnVideoCodecRef:ref('vp8'),returnSimulcastRef:ref(true),returnBitrateRef:ref(12000),returnFpsRef:ref(60),
    prepareReturnCapture:async()=>{prepared++;context.returnStreamRef.current=stream(newVideo,newAudio);},setReturnActive(){},returnActiveRef:ref(false),setAirBusy(){},setOnAir(){},setOnAirStatus(){},setStudioControlError(){},persistControlPatch:async()=>{},assertStudioVideoCodecSupported(){},assertPublishedStudioVideoCodec(){},studioVideoPublishOptions:()=>({}),createStudioSenderStatsState:()=>({}),AudioPresets:{musicHighQualityStereo:{}},Track:{Source:{Microphone:'microphone'}},console,
    room:{localParticipant:{trackPublications:new Map(),publishTrack:async track=>{published++;return{track,videoTrack:track};}}}};
  context.studioControlErrorRef=ref('');context.previewRestoreReady=true;context.connectedStudioRoomRef=ref(context.room);context.transferLeavingRef=ref(false);context.returnAudioContextRef=ref(undefined);
  const run=vm.runInNewContext(ts.transpileModule(`(${toggle.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  await run(true);
  assert.equal(prepared,1,'explicit ON AIR prepares capture when preview is stopped');assert.equal(published,2);assert.equal(context.onAirRef.current,true);
  console.log('PASS: direct ON AIR capture, atomic live input replacement/rollback, persistent scoped device choices');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Run the real capture preparation with deterministic browser primitives. A failed
// opening must keep the old program alive; successful replacement retires it last.
(async () => {
  const file=ts.createSourceFile('StudioWorkspace.tsx',fs.readFileSync(`${__dirname}/../components/StudioWorkspace.tsx`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let prepare; (function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='prepareReturnCapture')prepare=n.initializer;ts.forEachChild(n,visit);})(file);
  const ref=current=>({current}); const events=[];
  let fail=false;
  const track=kind=>({kind,readyState:'live',getSettings:()=>({deviceId:kind}),clone:()=>track(kind),stop(){events.push(`stop-${kind}`);this.readyState='ended';}});
  class Stream {
    constructor(tracks=[]){this.tracks=[...tracks];}getTracks(){return this.tracks;}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}addTrack(t){this.tracks.push(t);}removeTrack(t){this.tracks=this.tracks.filter(v=>v!==t);}
  }
  const node=()=>({gain:{value:1},connect(){}});
  let audioRunning=true;
  class Context {
    state=audioRunning?'running':'suspended';resume(){return audioRunning?Promise.resolve():new Promise(()=>{});}close(){events.push('context-close');return Promise.resolve();}createAnalyser(){return {...node(),getFloatTimeDomainData(){}};}createMediaStreamSource(){return node();}createGain(){return node();}createMediaStreamDestination(){return {...node(),stream:new Stream([track('audio')])};}
  }
  const oldStream=new Stream([track('video'),track('audio')]);
  const context={studioRoleRef:ref('primary'),selectedDevicesRef:ref({videoDeviceId:'one',audioDeviceId:'mic'}),returnFpsRef:ref(60),videoSourceRef:ref('camera'),captureInputsRef:ref(undefined),returnRawStreamRef:ref(undefined),captureKeyRef:ref('old'),returnStreamRef:ref(oldStream),captureGenerationRef:ref(0),returnGainRef:ref(100),previewDeviceErrorRef:ref(''),returnPublishedRef:ref({}),onAirRef:ref(true),returnSourceDeviceIdsRef:ref({}),captureDisposeRef:ref(()=>events.push('old-disposed')),returnGainNodeRef:ref(null),outputMuteGainRef:ref(null),outputMutedRef:ref(false),returnPreviewStreamRef:ref(null),returnVideoRef:ref(null),previewReadyRef:ref(true),
    returnAudioContextRef:ref(undefined),resumeStudioReturnAudio:async context=>{assert.equal(context.state,'running');},outputMuteGainsRef:ref(new Set()),privateTalkActiveRef:ref(false),StudioTrackRollbackError:require('../lib/studio-device-session.ts').StudioTrackRollbackError,
    navigator:{mediaDevices:{getUserMedia:async()=>{events.push('open');if(fail)throw Error('device missing');return new Stream([track('video'),track('audio')]);},enumerateDevices:async()=>[]}},
    MediaStream:Stream,AudioContext:Context,Float32Array,DOMException,studioCaptureConstraints:()=>({video:true,audio:true}),connectStudioOutputAudio:(_ctx,_gain,_analyser,monitor)=>({gain:node(),stream:monitor.stream}),
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},setReturnDevices(){},setReturnLevel(){},peakDbfs:()=>-20,METER_FLOOR_DB:-60,setPreviewReady(){},setPreviewCaptureError(){},
    replaceStudioPublishedTracks:async()=>{events.push('replaced');},
  };
  context.room={};context.connectedStudioRoomRef=ref(context.room);context.transferLeavingRef=ref(false);
  const run=vm.runInNewContext(ts.transpileModule(`(${prepare.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  fail=true;await assert.rejects(run(),/device missing/);
  assert.equal(context.returnStreamRef.current,oldStream);assert.ok(!events.includes('old-disposed'));assert.equal(oldStream.getVideoTracks()[0].readyState,'live');
  events.length=0;fail=false;await run();
  assert.deepEqual(events,['open','replaced','old-disposed'],'retire old capture only after publication replacement');
  assert.notEqual(context.returnStreamRef.current,oldStream);assert.equal(context.previewReadyRef.current,true);
  events.length=0;await run();assert.deepEqual(events,[],'same selected devices reuse the prepared stream');
  const oldPrepared=context.returnRawStreamRef.current;
  context.navigator.mediaDevices.getUserMedia=async constraints=>{assert.equal(constraints.video,false,'microphone-only switch must not reopen the camera');assert.ok(constraints.audio);return new Stream([track('audio')]);};
  await run({videoDeviceId:'one',audioDeviceId:'another-mic'});
  assert.equal(context.returnRawStreamRef.current.getVideoTracks()[0].readyState,'live','cloned unchanged camera survives old capture disposal');
  assert.equal(oldPrepared.getVideoTracks()[0].readyState,'ended','release previous raw camera track after clone swap');
  console.log('PASS: actual capture lifecycle preserves old program on open failure and commits replacement before disposing old capture');

  // Pause replacement, then mute while the freshly created graph is not yet the
  // committed graph. Both active and pending program senders must stay silent.
  let releaseSwap,startedSwap;
  const started=new Promise(resolve=>startedSwap=resolve),gate=new Promise(resolve=>releaseSwap=resolve);
  context.replaceStudioPublishedTracks=async()=>{startedSwap();await gate;for(const gain of context.outputMuteGainsRef.current)assert.equal(gain.gain.value,0,'all outgoing graphs remain silent before sender swap');};
  const pending=run({videoDeviceId:'one',audioDeviceId:'third-mic'});await started;
  assert.equal(context.outputMuteGainsRef.current.size,2,'pending output gain is registered before replacing tracks');
  let mute;(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='changeOutputMuted')mute=n.initializer;ts.forEachChild(n,visit);})(file);
  Object.assign(context,{persistControlPatch:async()=>{},setOutputMuted(){},setRoomScreenShareOutputMuted(){},room:{}});
  const setMute=vm.runInNewContext(ts.transpileModule(`(${mute.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  await setMute(true);releaseSwap();await pending;
  assert.equal(context.outputMuteGainsRef.current.size,1,'retired capture removes its output gate');
  console.log('PASS: output mute also gates capture graphs pending sender replacement');

  await setMute(false);
  context.privateTalkActiveRef.current=true;
  await setMute(false);
  assert.ok([...context.outputMuteGainsRef.current].every(gain=>gain.gain.value===1),'private reply state never changes studio program gain');
  assert.equal(context.outputMutedRef.current,false,'program user mute preference remains untouched');

  const uncertainVideo={mediaStreamTrack:track('video'),stop(){this.mediaStreamTrack.stop();}},uncertainAudio={mediaStreamTrack:track('audio'),stop(){this.mediaStreamTrack.stop();}};
  context.returnPublishedRef.current={video:uncertainVideo,audio:uncertainAudio};context.returnPublicationRef=ref({});
  Object.assign(context,{setOnAir(){},setOnAirStatus(){},room:{localParticipant:{unpublishTrack:async()=>{events.push('unpublish-uncertain');}}}});
  context.connectedStudioRoomRef.current=context.room;
  context.replaceStudioPublishedTracks=async()=>{throw new context.StudioTrackRollbackError([Error('replacement failed'),Error('rollback failed')]);};
  await assert.rejects(run({videoDeviceId:'one',audioDeviceId:'fourth-mic'}),/восстановить/);
  assert.equal(context.onAirRef.current,false,'failed sender rollback explicitly leaves ON AIR');
  assert.equal(uncertainVideo.mediaStreamTrack.readyState,'ended');assert.equal(uncertainAudio.mediaStreamTrack.readyState,'ended');
  assert.equal(Object.keys(context.returnPublishedRef.current).length,0,'failed rollback clears uncertain publication refs');
  console.log('PASS: program gain stays independent of private replies and double-failure stops uncertain senders');
  // The native browser can leave resume() pending before any user activation.
  // That must not hold up muted OFF AIR video preparation.
  context.onAirRef.current=false;context.returnPublishedRef.current={};audioRunning=false;
  let captureTimeout;try{await Promise.race([run({videoDeviceId:'one',audioDeviceId:'auto-preview-mic'}),new Promise((_,reject)=>captureTimeout=setTimeout(()=>reject(Error('muted preview blocked on audio resume')),1000))]);}finally{clearTimeout(captureTimeout);}
  assert.equal(context.returnAudioContextRef.current.state,'suspended');assert.equal(context.previewReadyRef.current,true);
  console.log('PASS: muted automatic video preparation completes while native audio resume remains pending');
  let stopCapture,disconnectEffect;(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='stopReturnCapture')stopCapture=n.initializer;if(ts.isCallExpression(n)&&n.expression.getText(file)==='useEffect'&&n.arguments[0].getText(file).includes('const disconnected')&&n.arguments[0].getText(file).includes('stopReturnCapture'))disconnectEffect=n.arguments[0];ts.forEachChild(n,visit);})(file);
  assert.ok(stopCapture&&disconnectEffect,'real final-disconnect capture cleanup exists');
  const listeners=new Map();context.room.on=(event,handler)=>listeners.set(event,handler);context.room.off=event=>listeners.delete(event);context.RoomEvent={Disconnected:'disconnected'};context.connectedStudioRoomRef.current=context.room;context.returnActiveRef=ref(true);context.setReturnActive=()=>{};context.returnVideoRef.current={srcObject:context.returnPreviewStreamRef.current,play:()=>Promise.resolve()};
  context.stopReturnCapture=vm.runInNewContext(ts.transpileModule(`(${stopCapture.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const cleanup=vm.runInNewContext(ts.transpileModule(`(${disconnectEffect.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context)();
  let releaseCapture,opened;const opening=new Promise(resolve=>opened=resolve),permission=new Promise(resolve=>releaseCapture=resolve),late=new Stream([track('video'),track('audio')]);context.navigator.mediaDevices.getUserMedia=async()=>{opened();return permission;};
  const pendingCapture=run({videoDeviceId:'late-camera',audioDeviceId:'late-mic'});await opening;listeners.get('disconnected')();releaseCapture(late);await assert.rejects(pendingCapture,/не подключена/);
  assert.ok(late.getTracks().every(track=>track.readyState==='ended'),'late permission grant tracks are stopped after final disconnect');assert.equal(context.returnVideoRef.current.srcObject,null,'late capture never reattaches preview');assert.equal(context.returnPreviewStreamRef.current,undefined);assert.equal(context.connectedStudioRoomRef.current,null);assert.equal(context.onAirRef.current,false);assert.equal(context.returnActiveRef.current,false);cleanup();
  console.log('PASS: actual final-disconnect handler invalidates pending native capture, stops late tracks and prevents preview reattachment/publication');


})().catch(error=>{console.error(error);process.exitCode=1;});

(async()=>{
  const file=ts.createSourceFile('StudioWorkspace.tsx',fs.readFileSync(`${__dirname}/../components/StudioWorkspace.tsx`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let apply;(function visit(n){if(ts.isBinaryExpression(n)&&n.left.getText(file)==='applyQualityRef.current')apply=n.right;ts.forEachChild(n,visit);})(file);
  let release,applied=false;const waiting=new Promise(resolve=>release=resolve),ref=current=>({current});
  const context={airRequestQueueRef:ref(waiting),qualityApplyQueueRef:ref(Promise.resolve()),studioRole:'primary',onAirRef:ref(false),returnStreamRef:ref(undefined),returnPublicationRef:ref({}),setPreviewFps(){applied=true;},setReturnFps(){},setReturnBitrate(){}};
  const run=vm.runInNewContext(ts.transpileModule(`(${apply.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const pending=run(120,12000);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(applied,false,'quality changes wait behind in-flight capture/publication swaps');
  release();await pending;assert.equal(applied,true);
  console.log('PASS: quality and capture changes share one serialized transaction queue');
})().catch(error=>{console.error(error);process.exitCode=1;});
