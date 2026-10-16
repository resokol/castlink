const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), Module = require('node:module'), {EventEmitter} = require('node:events');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, file);
const {guestCameraCaptureTrack}=require('../lib/guest-video-codec.ts');
const {createGuestCameraTransforms} = require('../lib/guest-camera-transform.ts'), {DEFAULT_CAMERA_TRANSFORM: base} = require('../lib/camera-transform.ts'), {RoomEvent} = require('livekit-client');
global.HTMLCanvasElement = class {captureStream() {}};
let sets=0, stops=0, publication;
const makeTrack=()=>({processor:undefined, getProcessor(){return this.processor;}, async setProcessor(processor){this.processor=processor;sets++;},async stopProcessor(){this.processor=undefined;stops++;}});
const room=new EventEmitter(); room.state='connected';room.localParticipant={isCameraEnabled:true,getTrackPublication(source){assert.equal(source,'camera','only camera is accessed; microphone is untouched');return publication;}};
const errors=[];const controller=createGuestCameraTransforms(room,error=>errors.push(error));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const raw={applyConstraints:async()=>{}},canvas={applyConstraints:async()=>{throw Error('must not constrain canvas');}};
 assert.equal(guestCameraCaptureTrack({getProcessor:()=>({name:'castlink-camera-transform',sourceTrack:raw}),mediaStreamTrack:canvas}),raw,'native camera constraints bypass generated canvas');
 publication={track:makeTrack()};room.emit(RoomEvent.LocalTrackPublished);await settle();assert.equal(sets,0,'identity bypass must not allocate processor');
 const transform={...base,zoom:2};assert.equal(await controller.apply(transform,()=>true),'applied');assert.equal(sets,1);assert.equal(controller.state().cameraTransform.zoom,2);
 const activeProcessor=publication.track.getProcessor();let suspended=0;const originalSuspend=activeProcessor.suspend.bind(activeProcessor);activeProcessor.suspend=()=>{suspended++;originalSuspend();};
 room.localParticipant.isCameraEnabled=false;room.emit(RoomEvent.TrackMuted);assert.equal(suspended,1,'camera mute synchronously suspends processor');assert.equal(controller.state().cameraTransform.zoom,2,'off camera retains selected transform');room.localParticipant.isCameraEnabled=true;
 // A codec/device republish which creates a replacement camera inherits the approved settings.
 publication={track:makeTrack()};room.emit(RoomEvent.LocalTrackPublished);await settle();assert.equal(sets,2);assert.equal(controller.state().cameraTransform.zoom,2);
 await controller.apply(base,()=>true);assert.equal(stops,1);assert.equal(publication.track.getProcessor(),undefined,'reset restores raw camera encoder track');
 room.localParticipant.isCameraEnabled=false;publication=undefined;assert.equal(await controller.apply(transform,()=>true),'saved');assert.equal(sets,2,'saving while off must not start capture');
 publication={track:makeTrack()};room.localParticipant.isCameraEnabled=true;room.emit(RoomEvent.TrackUnmuted);await settle();assert.equal(sets,3);
 await assert.rejects(controller.apply({...base,zoom:3},()=>false));assert.equal(controller.state().cameraTransform.zoom,2,'expired request cannot mutate transform');
 controller.stop();await settle();assert.equal(room.listenerCount(RoomEvent.LocalTrackPublished),0);assert.equal(publication.track.getProcessor(),undefined);assert.deepEqual(errors,[]);
 console.log('GUEST_CAMERA_TRANSFORM_PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
