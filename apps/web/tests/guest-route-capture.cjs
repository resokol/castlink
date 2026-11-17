const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {EventEmitter}=require('node:events'),{RoomEvent}=require('livekit-client');
const video=require('../lib/guest-video-codec.ts');
const route=require('../lib/guest-route-capture.ts');
const {rememberGuestCameraSource}=require('../lib/guest-camera-source.ts');
const choices={height:1080,micGain:100,listenGain:100,videoDeviceId:'camera',cameraResolution:'auto',cameraFrameRate:'auto'};
const metadata=JSON.stringify({role:'guest',studioId:'studio'});
const token=metadata=>'header.'+Buffer.from(JSON.stringify({sub:'guest-one',video:{room:'room'},metadata})).toString('base64url')+'.signature';
function fixture(width,height,frameRate){
 const room=new EventEmitter();room.state='connected';room.name='room';
 const native={getSettings:()=>({deviceId:'camera',width,height,frameRate}),getConstraints:()=>({}),async applyConstraints(value){this.applied=value;}};
 const track={mediaStreamTrack:native,getSourceTrackSettings:()=>native.getSettings()};
 room.localParticipant={identity:'guest-one',sid:'old',metadata,isCameraEnabled:true,getTrackPublication:()=>({track})};
 return {room,native,track};
}
const settings=f=>({sourceToken:'source',bearer:token(metadata),studioId:'studio',roomName:'room',choices:()=>choices,isCurrent:()=>true});
const renew=f=>{global.fetch=async()=>({ok:true,json:async()=>({token:token(f.room.localParticipant.metadata),identity:'guest-one'})});return route.prepareGuestRouteChange(f.room,settings(f)).then(prepared=>{prepared.commit();return prepared.token;});};
(async()=>{
 for(const [width,height,fps] of [[1920,1080,25],[1280,960,29.97]]){
  const f=fixture(width,height,fps);await renew(f);f.room.localParticipant.sid='new';
  await video.applyGuestCameraHeight(f.room,()=>true,choices);
  assert.deepEqual([f.native.applied.width.ideal,f.native.applied.height.ideal,f.native.applied.frameRate.ideal],[width,height,fps],'route reconnect retains native geometry and FPS');
  await video.applyGuestCameraHeight(f.room,()=>true,choices);
  assert.equal(f.native.applied.width.ideal,width,'watcher cannot undo preserved capture');
  assert.ok(route.guestRouteCaptureConstraints(f.room,choices));
  f.room.localParticipant.metadata=JSON.stringify({role:'guest',studioId:'studio',videoHeight:720});
  await video.applyGuestCameraHeight(f.room,()=>true,choices);
  assert.equal(f.native.applied.width,undefined,'new staff preset invalidates old geometry');
  assert.equal(f.native.applied.height.ideal,720);
 }
 const effect=fixture(1920,1080,50);rememberGuestCameraSource(effect.track,effect.native);
 effect.track.mediaStreamTrack={getSettings:()=>({width:640,height:480,frameRate:30})};
 await renew(effect);assert.equal(route.guestRouteCaptureConstraints(effect.room,choices).width.ideal,1920,'snapshot uses physical source behind effects');
 for(const changed of [{videoDeviceId:'new-camera'},{cameraResolution:'720p'},{cameraFrameRate:'60'}]){
  const f=fixture(1920,1080,25);await renew(f);
  assert.equal(route.guestRouteCaptureConstraints(f.room,{...choices,...changed}),undefined);
  assert.equal(route.guestRouteCaptureConstraints(f.room,choices),undefined,'invalidated snapshot never returns');
 }
 const removed=fixture(1920,1080,25);removed.room.localParticipant.metadata=JSON.stringify({role:'guest',studioId:'studio',cameraCapture:{mode:'custom',resolution:'1920x1080',frameRate:'25'}});
 await renew(removed);removed.room.localParticipant.metadata=metadata;removed.room.emit(RoomEvent.ParticipantMetadataChanged,'',removed.room.localParticipant);
 assert.equal(route.guestRouteCaptureConstraints(removed.room,choices),undefined,'removing staff capture invalidates snapshot');
 const failed=fixture(1920,1080,25);
 global.fetch=async()=>({ok:false});await assert.rejects(route.prepareGuestRouteChange(failed.room,settings(failed)));
 assert.equal(failed.room.localParticipant.sid,'old');assert.equal(failed.room.state,'connected');assert.equal(route.guestRouteCaptureConstraints(failed.room,choices),undefined);
 global.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};await assert.rejects(route.prepareGuestRouteChange(failed.room,settings(failed)),/timeout/);
 global.fetch=async()=>({ok:true,json:async()=>{failed.room.localParticipant.metadata=JSON.stringify({role:'guest',studioId:'studio',videoHeight:720});return {token:token(metadata),identity:'guest-one'};}});
 await assert.rejects(route.prepareGuestRouteChange(failed.room,settings(failed)),/Настройки камеры/);
 assert.equal(route.guestRouteCaptureConstraints(failed.room,choices),undefined,'newer staff intent cannot be overwritten by renewal snapshot');

 const fallback=fixture(1920,1080,25);await renew(fallback);
 fallback.native.getSettings=()=>({deviceId:'fallback-camera',width:640,height:480,frameRate:30});
 await video.applyGuestCameraHeight(fallback.room,()=>true,choices);
 assert.equal(fallback.native.applied.deviceId,undefined,'automatic fallback never reapplies exact unplugged device');
 assert.equal(fallback.native.applied.width,undefined,'automatic fallback chooses its own native dimensions');
 const stable=fixture(1920,1080,25);await renew(stable);
 const prior=route.guestRouteCaptureConstraints(stable.room,choices);
 global.fetch=async()=>({ok:true,json:async()=>({token:token(metadata),identity:'guest-one'})});
 const rejected = await route.prepareGuestRouteChange(stable.room,settings(stable));
 assert.throws(()=>rejected.commit(()=>false),/Сессия обновилась/);
 assert.equal(route.guestRouteCaptureConstraints(stable.room,choices),prior,'rejected token acceptance preserves previous valid snapshot');
 route.bindGuestRouteCaptureSource(stable.room,'different-session');
 assert.equal(route.guestRouteCaptureConstraints(stable.room,choices),undefined,'snapshot cannot cross a source session');
 const ordered=fixture(1920,1080,25);
 ordered.room.localParticipant.metadata=JSON.stringify({role:'guest',studioId:'studio',cameraCapture:{mode:'custom',resolution:'1920x1080',frameRate:'25'}});
 global.fetch=async()=>({ok:true,json:async()=>({token:token(JSON.stringify({studioId:'studio',role:'guest',cameraCapture:{frameRate:'25',resolution:'1920x1080',mode:'custom'}})),identity:'guest-one'})});
 const prepared=await route.prepareGuestRouteChange(ordered.room,settings(ordered));prepared.commit();
 assert.ok(route.guestRouteCaptureConstraints(ordered.room,choices),'equivalent metadata field order does not cancel route');
 console.log('guest-route-capture: passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
