const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { guestAudioProfile, guestAudioProcessingOptions, guestAudioCaptureOptions, guestAudioPublishOptions, enqueueGuestMicrophoneTask, switchGuestMicrophoneProfile } = require('../lib/guest-audio.ts');
const { guestCaptureConstraints } = require('../lib/guest-media.ts');
const speech = { audioDeviceId:'chosen-mic', audioProfile:'speech', height:720, micGain:100, listenGain:100 };
const raw = { ...speech, audioProfile:'raw' };
const processing = enabled => ({ autoGainControl:enabled, echoCancellation:enabled, noiseSuppression:enabled, voiceIsolation:enabled });
assert.equal(guestAudioProfile(undefined), 'speech');
assert.equal(guestAudioProfile('invalid-saved-mode'), 'speech');
assert.equal(guestAudioProfile('raw'), 'raw');
assert.deepEqual(guestAudioCaptureOptions(speech), { ...processing(true), deviceId:{exact:'chosen-mic'} });
assert.deepEqual(guestAudioCaptureOptions(raw), { ...processing(false), deviceId:{exact:'chosen-mic'} });
assert.deepEqual(guestAudioProcessingOptions({}), processing(true), 'old saved choices preserve speech defaults');
assert.deepEqual(guestCaptureConstraints(raw).audio, guestAudioCaptureOptions(raw), 'preview and live request identical constraints');
assert.deepEqual(guestAudioPublishOptions(speech), { dtx:true, red:true, forceStereo:false, audioPreset:{maxBitrate:48000} });
assert.deepEqual(guestAudioPublishOptions(raw, {channelCount:1}), { dtx:false, red:true, forceStereo:false, audioPreset:{maxBitrate:96000} });
assert.deepEqual(guestAudioPublishOptions(raw, {channelCount:2}), { dtx:false, red:true, forceStereo:true, audioPreset:{maxBitrate:128000} });
assert.equal(guestAudioPublishOptions(raw).forceStereo, undefined, 'unknown channel count follows captured input, never forces stereo');
assert.ok(Object.hasOwn(guestAudioPublishOptions(raw), 'forceStereo'), 'own undefined overrides SDK forced-mono default so native stereo survives');

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const settle = () => new Promise(resolve => setImmediate(resolve));
function makeRoom({ muted = false, channels = 1, absent = false } = {}) {
  const room = {state:'connected', calls:[], track:undefined, pub:undefined};
  let enabled = !muted;
  const track = {
    isMuted:muted,
    stopped:0,
    constraints:guestAudioCaptureOptions(speech),
    mediaStreamTrack:{ getSettings:()=>({deviceId:'actual-current-mic', channelCount:channels}), get enabled(){return enabled;} },
    async applyConstraints(options) {
      room.calls.push(['constraints', options]);
      if (room.waitConstraints) { const pending=room.waitConstraints; room.waitConstraints=undefined; await pending; }
      if (room.failConstraints) { room.failConstraints--; throw new Error('constraints failed'); }
      this.constraints={...this.constraints,...options};
    },
    async mute() { this.isMuted=true; enabled=false; },
    stop() { this.stopped++; },
  };
  room.track=track;
  if (!absent) room.pub={track, options:{source:'microphone', stopMicTrackOnMute:false, dtx:true, red:true}};
  room.localParticipant = {
    getTrackPublication(source) { assert.equal(source, 'microphone', 'profile switch must never inspect camera/screen'); return room.pub; },
    async unpublishTrack(target, stop) {
      assert.equal(target, track); assert.equal(stop,false,'same capture must survive republish');
      room.calls.push(['unpublish',target]); room.pub=undefined;
      if (room.failUnpublish) { room.failUnpublish--; throw new Error('unpublish listener failed'); }
      if (room.onUnpublish) room.onUnpublish();
      if (room.waitUnpublish) await room.waitUnpublish;
    },
    async publishTrack(target, options) {
      assert.equal(target,track,'reuse the exact SDK local microphone track');
      room.calls.push(['publish',options,target.isMuted]);
      if (room.failPublish) { room.failPublish--; throw new Error('publish failed'); }
      if (room.waitPublish) { const pending=room.waitPublish; room.waitPublish=undefined; await pending; }
      room.pub={track:target,options};
      if (room.onPublish) room.onPublish();
      return room.pub;
    },
  };
  return room;
}

(async()=>{
  const live = makeRoom();
  assert.equal(await switchGuestMicrophoneProfile(live, speech, raw), true);
  assert.equal(live.pub.track, live.track);
  assert.deepEqual(live.track.constraints, {...processing(false),deviceId:{exact:'chosen-mic'}}, 'processing changes without replacing selected device constraints');
  assert.equal(live.track.mediaStreamTrack.getSettings().deviceId,'actual-current-mic');
  assert.equal(live.pub.options.dtx,false,'profile changes encoder signaling, not just browser constraints');
  assert.equal(live.pub.options.red,true); assert.equal(live.pub.options.source,'microphone');
  assert.equal(live.pub.options.stopMicTrackOnMute,false); assert.equal(live.track.stopped,0);

  const muted = makeRoom({muted:true});
  assert.equal(await switchGuestMicrophoneProfile(muted,speech,raw),true);
  assert.equal(muted.track.isMuted,true); assert.equal(muted.track.mediaStreamTrack.enabled,false);
  assert.equal(muted.calls.find(c=>c[0]==='publish')[2],true,'publication is born muted');
  const noMic = makeRoom({absent:true});
  assert.equal(await switchGuestMicrophoneProfile(noMic,speech,raw),true);
  assert.equal(noMic.calls.length,0,'choosing mode while mic disabled never captures/unmutes');

  const failedCapture=makeRoom(); failedCapture.failConstraints=1;
  await assert.rejects(switchGuestMicrophoneProfile(failedCapture,speech,raw),/constraints failed/);
  assert.equal(failedCapture.pub.track,failedCapture.track);
  assert.deepEqual(failedCapture.track.constraints,guestAudioCaptureOptions(speech));
  assert.equal(failedCapture.calls.filter(c=>c[0]==='unpublish').length,0,'capture rejection preserves the existing publication');
  const failedPublish=makeRoom({muted:true}); failedPublish.failPublish=1;
  await assert.rejects(switchGuestMicrophoneProfile(failedPublish,speech,raw),/publish failed/);
  assert.equal(failedPublish.pub.options.dtx,true,'failed new publication restores previous encoding');
  assert.equal(failedPublish.pub.track,failedPublish.track); assert.equal(failedPublish.track.isMuted,true);
  assert.deepEqual(failedPublish.track.constraints,guestAudioCaptureOptions(speech));
  const failedRestore=makeRoom(); failedRestore.failPublish=2;
  await assert.rejects(switchGuestMicrophoneProfile(failedRestore,speech,raw),/восстановить прежний звук/);
  assert.equal(failedRestore.track.stopped,1,'failed rollback does not leak detached capture');
  const failedUnpublish=makeRoom(); failedUnpublish.failUnpublish=1;
  await assert.rejects(switchGuestMicrophoneProfile(failedUnpublish,speech,raw),/unpublish listener failed/);
  assert.equal(failedUnpublish.pub.track,failedUnpublish.track,'late unpublish failure restores a removed microphone publication');
  assert.equal(failedUnpublish.pub.options.dtx,true);

  let current=false;
  const alreadyStale=makeRoom();
  assert.equal(await switchGuestMicrophoneProfile(alreadyStale,speech,raw,{isCurrent:()=>current}),false);
  assert.equal(alreadyStale.calls.length,0);
  current=true; const staleCapture=makeRoom(), captureGate=deferred(); staleCapture.waitConstraints=captureGate.promise;
  const pending=switchGuestMicrophoneProfile(staleCapture,speech,raw,{isCurrent:()=>current});
  await settle(); current=false; captureGate.resolve();
  assert.equal(await pending,false); assert.equal(staleCapture.pub.options.dtx,true);
  assert.deepEqual(staleCapture.track.constraints,guestAudioCaptureOptions(speech));
  const leftDuringGap=makeRoom(); leftDuringGap.onUnpublish=()=>{leftDuringGap.state='disconnected';};
  assert.equal(await switchGuestMicrophoneProfile(leftDuringGap,speech,raw),false);
  assert.equal(leftDuringGap.calls.filter(c=>c[0]==='publish').length,0);
  assert.equal(leftDuringGap.track.stopped,1,'disconnect owns no detached track, so helper stops it');
  const latePublication=makeRoom(), publishGate=deferred(); latePublication.waitPublish=publishGate.promise;
  const lateResult=switchGuestMicrophoneProfile(latePublication,speech,raw);
  await settle(); latePublication.state='disconnected'; publishGate.resolve();
  assert.equal(await lateResult,false);
  assert.equal(latePublication.track.stopped,1,'a publication completing after disconnect cannot keep capturing');
  const reconnectingCapture=makeRoom(), reconnectCaptureGate=deferred();reconnectingCapture.waitConstraints=reconnectCaptureGate.promise;
  const reconnectingResult=switchGuestMicrophoneProfile(reconnectingCapture,speech,raw);
  await settle();reconnectingCapture.state='reconnecting';reconnectCaptureGate.resolve();
  assert.equal(await reconnectingResult,false);
  assert.equal(reconnectingCapture.track.stopped,0,'SDK-owned published capture survives a temporary reconnect');
  assert.deepEqual(reconnectingCapture.track.constraints,guestAudioCaptureOptions(speech));
  current=true; const stalePublication=makeRoom(); stalePublication.onPublish=()=>{current=false;};
  assert.equal(await switchGuestMicrophoneProfile(stalePublication,speech,raw,{isCurrent:()=>current}),false);
  assert.equal(stalePublication.pub.options.dtx,true,'stale completed publication is rolled back');

  const concurrent=makeRoom(), gate=deferred(); concurrent.waitUnpublish=gate.promise;
  const changing=switchGuestMicrophoneProfile(concurrent,speech,raw);
  await settle();
  let commandRan=false;
  const command=enqueueGuestMicrophoneTask(concurrent,async()=>{commandRan=true; assert.ok(concurrent.pub,'mute/device command waits until microphone republished'); await concurrent.track.mute();});
  await settle(); assert.equal(commandRan,false); gate.resolve();
  await changing; await command; assert.equal(concurrent.track.isMuted,true);
  const failedQueue=makeRoom(); failedQueue.failPublish=1;
  const failure=switchGuestMicrophoneProfile(failedQueue,speech,raw); const handled=assert.rejects(failure,/publish failed/);
  const nextTask=enqueueGuestMicrophoneTask(failedQueue,async()=>guestAudioProcessingOptions(speech));
  await handled; assert.deepEqual(await nextTask,processing(true),'a rejected mutation must not block later microphone commands');
  console.log('PASS: guest speech/raw capture and encoder options, device/mute preservation, rollback, stale cleanup, and serialized microphone mutations');
})().catch(error=>{console.error(error);process.exitCode=1;});
