const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const { RoomEvent, Track } = require('livekit-client');
const { load } = require('./load-typescript.cjs');
const { bindStudioRoomLifecycle } = load('../lib/studio-room-lifecycle.ts');
const { createGuestNetworkStatsState, sampleGuestNetworkStats } = load('../lib/guest-network-stats.ts');
const { GUEST_CAMERA_OUTBOUND_TOPIC, freshGuestUplink, parseGuestCameraOutbound } = load('../lib/guest-camera-outbound.ts');
const { readGuestReceiveBitrate } = load('../lib/guest-receive-bitrate.ts');

// Run the actual connection effect, including its event/interval/RAF wiring.
// Count guest state identity changes: React uses Object.is to bail out here.
const source = ts.createSourceFile('StudioWorkspace.tsx', fs.readFileSync(require.resolve('../components/StudioWorkspace.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let connectionEffect;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('const unbindRoomLifecycle =')) connectionEffect = node.arguments[0];
  ts.forEachChild(node, visit);
})(source);
assert.ok(connectionEffect, 'actual Studio connection lifecycle is tested');
const code = ts.transpileModule(`module.exports = (${connectionEffect.getText(source)})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
const ref = current => ({ current });

function harness() {
  const room = new EventEmitter();
  Object.assign(room, { state: 'connected', localParticipant: { trackPublications: new Map() }, remoteParticipants: new Map(), connect: async () => {}, disconnect() {} });
  const microphone = { isMuted: false, track: { mediaStreamTrack: { readyState: 'live' }, getRTCStatsReport: async () => undefined } };
  let report = new Map();
  const camera = { isMuted: false, track: { getRTCStatsReport: async () => report } };
  const participant = { identity: 'guest-alice', sid: 'PA_alice', name: 'Alice', audioLevel: 0,
    getTrackPublication: source => source === Track.Source.Camera ? camera : source === Track.Source.Microphone ? microphone : undefined };
  room.remoteParticipants.set(participant.identity, participant);
  let guests = [], guestRenders = 0, nextFrame = 0;
  const frames = new Map(), intervals = new Map();
  let clock = 1000;
  const context = {
    module: { exports: {} }, room, RoomEvent, Track, bindStudioRoomLifecycle, readGuestReceiveBitrate, createGuestNetworkStatsState, sampleGuestNetworkStats, freshGuestUplink, parseGuestCameraOutbound,
    Date: class extends Date { static now() { return clock; } },
    studioId: 'studio', roomName: 'room', transferSnapshot: undefined,
    acquireStudioClientId: async () => ({ clientId: 'client', release() {} }),
    fetch: async url => ({ ok: true, json: async () => url === '/api/studio-control' ? { role: 'moderator' } : { token: 'token' } }),
    readControlResponse: response => response.json(), getLiveKitUrl: () => 'ws://fixture', startRoomTelemetry: () => () => {},
    createStudioSenderStatsState: () => ({}),
    readTrackStats: track => track.getRTCStatsReport(), freshGuestCameraOutboundBitrate: sample => sample?.bitrateKbps ?? null,
    GUEST_CAMERA_OUTBOUND_TOPIC, parseGuestClientInfo: () => undefined,
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval: callback => { const id = intervals.size + 1; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    setGuests: update => { const next = typeof update === 'function' ? update(guests) : update; if (!Object.is(next, guests)) { guestRenders++; guests = next; } },
    guestCameraOutboundRef: ref({}), clientInfoRef: ref({}), guestMeterTargetsRef: ref({}), guestMeterDisplayRef: ref({}),
    studioRoleRef: ref('moderator'), onAirRef: ref(false), previewReadyRef: ref(false), returnPublishedRef: ref({}), returnPublicationRef: ref({}),
    refreshRef: ref(undefined), connectedStudioRoomRef: ref(null), controlRevisionRef: ref(0), appliedRevisionRef: ref(0), deviceRevisionRef: ref(0), studioPrimaryOnlineRef: ref(false),
  };
  for (const name of ['setSessionToken', 'setOnAir', 'setReturnActive', 'setPreviewReady', 'setOnAirStatus', 'setStudioClientId', 'setStudioRole', 'setStudioEpoch', 'setRemoteDesired', 'setStudioPrimaryOnline', 'setCanClaimStudio', 'setStatus']) context[name] = () => {};
  vm.runInNewContext(code, context);
  return { room, participant, microphone, camera, context, frames, intervals,
    guests: () => guests, renders: () => guestRenders,
    stats: value => { report = value; },
    time: value => { clock = value; },
    tickFrames() { const pending = Array.from(frames.values()); frames.clear(); pending.forEach(callback => callback(100)); },
    stop: () => context.module.exports(),
  };
}

if (require.main === module) (async () => {
  const h = harness();
  await flush();
  assert.equal(h.guests()[0].name, 'Alice');
  let before = h.renders();
  h.participant.audioLevel = 0.75;
  h.room.emit(RoomEvent.ActiveSpeakersChanged, [h.participant]);
  for (let i = 0; i < 60; i++) h.tickFrames();
  assert.equal(h.renders(), before, '60 audio animation frames must not rerender the Studio guest list');

  h.time(3000);
  await h.context.refreshRef.current();
  await h.context.refreshRef.current();
  assert.equal(h.renders(), before, 'identical participant/stat polls, including audioLevel changes, preserve guest state identity');
  h.room.emit(RoomEvent.ParticipantDisconnected, { identity: 'studio-moderator' });
  await flush();
  assert.equal(h.renders(), before, 'staff departure does not replace an unchanged guest roster');
  h.room.emit(RoomEvent.Reconnecting);
  h.room.emit(RoomEvent.Reconnected);
  assert.equal(h.renders(), before, 'resetting already-empty outbound measurements preserves guest state');

  h.microphone.isMuted = true;
  h.room.emit(RoomEvent.TrackMuted, h.microphone, h.participant);
  await flush();
  assert.equal(h.guests()[0].microphone, false, 'mute events still update the guest card');
  assert.equal(h.renders(), before + 1);
  const replacementTrack = { mediaStreamTrack: { readyState: 'live' } };
  h.microphone.track = replacementTrack;
  await h.context.refreshRef.current();
  assert.equal(h.guests()[0].microphoneTrack, replacementTrack, 'replacement microphone reaches the local meter even when card statistics match');
  h.participant.sid = 'PA_reconnected';
  before = h.renders();
  await h.context.refreshRef.current();
  assert.equal(h.renders(), before + 1, 'a participant incarnation change refreshes actions even with identical card statistics');
  h.participant.name = 'Alice renamed';
  h.room.emit(RoomEvent.ParticipantConnected, h.participant);
  await flush();
  assert.equal(h.guests()[0].name, 'Alice renamed');

  h.stats(new Map([['video', { type: 'inbound-rtp', kind: 'video', frameWidth: 1280, frameHeight: 720, bytesReceived: 1000, timestamp: 1000 }]]));
  await h.context.refreshRef.current();
  assert.equal(h.guests()[0].resolution, '1280×720', 'changed statistics still reach the card');
  before = h.renders();
  await h.context.refreshRef.current();
  assert.equal(h.renders(), before, 'cached statistics do not replace unchanged rows');

  const video = (bytesReceived, timestamp) => new Map([['v', { id: 'v', type: 'inbound-rtp', kind: 'video', frameWidth: 1280, frameHeight: 720, bytesReceived, timestamp, packetsReceived: bytesReceived / 1000, packetsLost: 0, jitter: 0.002 }]]);
  h.stats(video(1_000_000, 1000)); await h.context.refreshRef.current();
  h.time(5000); h.stats(video(2_000_000, 3000)); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].receiveVideoKbps, 4000);
  assert.equal(h.guests()[0].networkMeasured, true);
  const freshness = h.guests()[0].statsSampledAtRef;
  before = h.renders();
  h.time(7000); h.stats(video(3_000_000, 5000)); await h.context.refreshRef.current();
  assert.equal(h.renders(), before, 'equal fresh bitrate samples do not rerender the Studio roster');
  assert.equal(h.guests()[0].statsSampledAtRef, freshness, 'freshness owner remains stable');
  assert.equal(freshness.current, 7000, 'local expiry sees the fresh sample without a parent update');

  // Real sampler must distinguish historical totals from current observations.
  const lossyVideo = (at, received, lost) => new Map([['v', { id: 'v', ssrc: 1, type: 'inbound-rtp', kind: 'video', timestamp: at, bytesReceived: received * 1000, packetsReceived: received, packetsLost: lost, jitter: .002 }]]);
  h.participant.sid = 'PA_loss_history';
  h.time(9000); h.stats(lossyVideo(9000, 9_997_000, 3000)); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].networkMeasured, false, 'first sample is baseline, not current health');
  assert.equal(h.guests()[0].totalLoss.packets, 3000);
  h.time(11000); h.stats(lossyVideo(11000, 10_007_000, 3000)); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].stability, 'Хорошая', 'old loss cannot poison current status');
  assert.equal(h.guests()[0].currentLoss.packets, 0);
  const oldTotalPercent = h.guests()[0].totalLoss.percent;
  h.time(13000); h.stats(lossyVideo(13000, 10_017_000, 3000)); await h.context.refreshRef.current();
  assert.ok(h.guests()[0].totalLoss.percent < oldTotalPercent, 'denominator-only changes reach the UI');
  await h.context.refreshRef.current(); // The first cached report clears the old bitrate.
  before = h.renders();
  await h.context.refreshRef.current();
  assert.equal(h.renders(), before, 'equal current/history objects preserve optimized guest row identity');
  h.time(15000); h.stats(lossyVideo(15000, 10_026_000, 4000)); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].stability, 'Средняя', '1000 losses / 30000 recent packets is medium');
  for (const at of [17000, 19000, 21000, 23000, 25000]) {
    h.time(at); h.stats(lossyVideo(at, 10_026_000 + (at - 15000) * 5, 4000)); await h.context.refreshRef.current();
  }
  assert.equal(h.guests()[0].stability, 'Хорошая', 'current status recovers after ten seconds');
  assert.equal(h.guests()[0].totalLoss.packets, 4000, 'history stays visible after recovery');
  h.camera.track = { getRTCStatsReport: async () => lossyVideo(27000, 10_086_000, 4000) };
  h.time(27000); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].currentLoss, null, 'wrapper replacement resets current samples');
  assert.equal(h.guests()[0].totalLoss.packets, 4000, 'wrapper replacement preserves history without recounting RTP counters');
  h.participant.sid = 'PA_new_session';
  h.camera.track = { getRTCStatsReport: async () => lossyVideo(29000, 100, 1) };
  h.time(29000); await h.context.refreshRef.current();
  assert.equal(h.guests()[0].totalLoss.packets, 1, 'participant SID changes reset historical loss');

  h.context.guestCameraOutboundRef.current[h.participant.identity] = { sid: h.participant.sid, bitrateKbps: 1234 };
  await h.context.refreshRef.current();
  assert.equal(h.guests()[0].roomSendBitrateKbps, 1234);
  before = h.renders();
  h.room.emit(RoomEvent.Reconnecting);
  assert.equal(h.guests()[0].roomSendBitrateKbps, null, 'reconnection still clears real outbound measurements');
  assert.equal(h.renders(), before + 1);

  h.room.remoteParticipants.delete(h.participant.identity);
  h.room.emit(RoomEvent.ParticipantDisconnected, h.participant);
  await flush();
  assert.equal(h.guests().length, 0, 'departure removes the participant');
  before = h.renders();
  await h.context.refreshRef.current();
  assert.equal(h.renders(), before, 'empty roster polls do not update state');
  h.stop();
  assert.equal(h.room.eventNames().length, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.intervals.size, 0);

  // Noise/echo switching can republish a microphone while its old stats are pending.
  // Exercise the real Studio sampler with both a replacement and a reused SDK track.
  for (const reuseTrack of [false, true]) {
    const audio = harness();
    await flush();
    const audioReport = (bytesReceived, timestamp) => new Map([['a', { id: 'a', type: 'inbound-rtp', kind: 'audio', bytesReceived, timestamp }]]);
    let currentAudio = audioReport(1000, 1000);
    const oldTrack = audio.microphone.track;
    oldTrack.getRTCStatsReport = async () => currentAudio;
    await audio.context.refreshRef.current();
    currentAudio = audioReport(33000, 3000);
    await audio.context.refreshRef.current();
    assert.equal(audio.guests()[0].receiveAudioKbps, 128);

    let finishOldReport;
    oldTrack.getRTCStatsReport = () => new Promise(resolve => { finishOldReport = resolve; });
    const pendingRefresh = audio.context.refreshRef.current();
    await flush();
    assert.equal(typeof finishOldReport, 'function', 'old microphone report is genuinely pending');
    const currentTrack = reuseTrack ? oldTrack : { mediaStreamTrack: { readyState: 'live' } };
    currentAudio = audioReport(500000, 5000);
    currentTrack.getRTCStatsReport = async () => currentAudio;
    const nextPublication = { isMuted: false, track: currentTrack };
    const getPublication = audio.participant.getTrackPublication;
    audio.participant.getTrackPublication = source => source === Track.Source.Microphone ? nextPublication : getPublication(source);
    finishOldReport(audioReport(9000000000, 5000));
    await pendingRefresh;
    assert.equal(audio.guests()[0].receiveAudioKbps, null, 'superseded publication report cannot leak into the new microphone bitrate');
    await audio.context.refreshRef.current();
    assert.equal(audio.guests()[0].receiveAudioKbps, null, 'republished microphone establishes a fresh baseline');
    assert.equal(audio.guests()[0].microphoneTrack, currentTrack, 'meter owns the current microphone after processing switch');
    currentAudio = audioReport(532000, 7000);
    await audio.context.refreshRef.current();
    assert.equal(audio.guests()[0].receiveAudioKbps, 128, 'normal audio bitrate recovers without a spike after processing switch');
    assert.equal(audio.guests()[0].stability, 'Хорошая', 'audio processing does not change the video network grade');
    audio.stop();
  }

  // Camera-off casters use their existing microphone report, preserving camera priority.
  const voice = harness();
  await flush();
  let reads = { video: 0, audio: 0 };
  let voiceAt = 3000, videoReceived = 1000, videoLost = 10, audioReceived = 1000, audioLost = 2;
  let missingVideoReport = false;
  const receiverReport = (kind, received, lost) => new Map([
    ['same', { id: 'same', ssrc: 1, type: 'inbound-rtp', kind, timestamp: voiceAt, bytesReceived: received * 1000, packetsReceived: received, packetsLost: lost, jitter: .002 }],
    ['pair', { id: 'pair', type: 'candidate-pair', nominated: true, state: 'succeeded', currentRoundTripTime: .025 }],
  ]);
  voice.camera.track.getRTCStatsReport = async () => { reads.video++; return missingVideoReport ? undefined : receiverReport('video', videoReceived, videoLost); };
  const readAudio = async () => { reads.audio++; return receiverReport('audio', audioReceived, audioLost); };
  voice.microphone.track.getRTCStatsReport = readAudio;
  const refreshVoice = async at => {
    voiceAt = at; voice.time(at);
    const beforeReads = { ...reads };
    await voice.context.refreshRef.current();
    assert.equal(reads.video - beforeReads.video, voice.camera.track ? 1 : 0, 'camera stats reads are not multiplied');
    assert.equal(reads.audio - beforeReads.audio, voice.microphone.isMuted ? 0 : 1, 'audio fallback reuses exactly one existing microphone report');
  };
  await refreshVoice(3000);
  voice.camera.isMuted = true;
  await refreshVoice(5000);
  assert.equal(voice.guests()[0].currentLoss, null, 'camera off switches to audio with a fresh baseline');
  assert.equal(voice.guests()[0].totalLoss.packets, 12, 'video history survives switching to microphone');
  audioReceived += 100;
  await refreshVoice(7000);
  assert.equal(voice.guests()[0].networkMeasured, true, 'audio-only caster has measured network quality');
  assert.equal(voice.guests()[0].stability, 'Хорошая');
  assert.equal(voice.guests()[0].jitterMs, 2);
  assert.equal(voice.guests()[0].rttMs, 25);
  audioReceived += 90; audioLost += 10;
  await refreshVoice(9000);
  assert.equal(voice.guests()[0].stability, 'Плохая', 'audio packet-loss burst affects current network status');
  for (const at of [11000, 13000, 15000, 17000, 19000]) { audioReceived += 100; await refreshVoice(at); }
  assert.equal(voice.guests()[0].stability, 'Хорошая', 'audio network status recovers after ten seconds');
  const voiceHistory = voice.guests()[0].totalLoss.packets;
  voice.camera.isMuted = false;
  await refreshVoice(21000);
  assert.equal(voice.guests()[0].currentLoss, null, 'camera on switches back to video baseline');
  assert.equal(voice.guests()[0].totalLoss.packets, voiceHistory, 'returning to known video counters does not recount losses');
  videoReceived += 100;
  await refreshVoice(23000);
  assert.equal(voice.guests()[0].stability, 'Хорошая');
  videoReceived += 80; videoLost += 20; audioReceived += 100;
  await refreshVoice(25000);
  assert.equal(voice.guests()[0].stability, 'Плохая', 'healthy microphone cannot hide failing active camera');
  missingVideoReport = true; audioReceived += 100;
  await refreshVoice(27000);
  assert.equal(voice.guests()[0].networkMeasured, false, 'unavailable stats from active camera do not select healthy audio');
  voice.camera.track = undefined;
  await refreshVoice(29000);
  assert.equal(voice.guests()[0].currentLoss, null, 'unsubscribed camera permits microphone fallback');
  audioReceived += 100;
  await refreshVoice(31000);
  assert.equal(voice.guests()[0].networkMeasured, true);
  const audioFreshness = voice.guests()[0].networkSampledAtRef.current;
  voice.time(39000); await voice.context.refreshRef.current(); // Report timestamp is still31000.
  assert.equal(voice.guests()[0].networkMeasured, false, 'cached audio expires after six seconds');
  assert.equal(voice.guests()[0].networkSampledAtRef.current, audioFreshness, 'cached audio does not extend network freshness');
  voice.microphone.track = { getRTCStatsReport: readAudio };
  audioReceived += 100;
  await refreshVoice(41000);
  assert.equal(voice.guests()[0].currentLoss, null, 'replacement microphone resets current samples');
  const beforeMuted = voice.guests()[0].totalLoss.packets;
  voice.microphone.isMuted = true;
  await refreshVoice(43000);
  assert.equal(voice.guests()[0].networkMeasured, false, 'both muted sources are unknown');
  assert.equal(voice.guests()[0].totalLoss.packets, beforeMuted, 'muting preserves session history');
  voice.microphone.isMuted = false;
  voice.participant.sid = 'PA_audio_rejoined'; audioReceived = 100; audioLost = 1;
  await refreshVoice(45000);
  assert.equal(voice.guests()[0].totalLoss.packets, 1, 'audio-only participant SID change resets session history');
  audioReceived += 100;
  await refreshVoice(47000);
  assert.equal(voice.guests()[0].networkMeasured, true);
  voice.stop();

  for (const change of ['microphone-publication', 'camera-enabled']) {
    const race = harness();
    await flush();
    race.camera.isMuted = true;
    let reportAt = 1000, received = 100;
    const reportAudio = () => new Map([['a', { id: 'a', type: 'inbound-rtp', kind: 'audio', timestamp: reportAt, packetsReceived: received, packetsLost: 1 }]]);
    race.microphone.track.getRTCStatsReport = async () => reportAudio();
    await race.context.refreshRef.current();
    reportAt = 3000; received = 200; race.time(3000);
    await race.context.refreshRef.current();
    assert.equal(race.guests()[0].networkMeasured, true);
    let finishMicrophone;
    race.microphone.track.getRTCStatsReport = () => new Promise(resolve => { finishMicrophone = resolve; });
    race.time(5000);
    const oldAudioReport = race.context.refreshRef.current();
    await flush();
    if (change === 'camera-enabled') race.camera.isMuted = false;
    else {
      const getPublication = race.participant.getTrackPublication;
      const nextMic = { isMuted: false, track: { getRTCStatsReport: async () => reportAudio() } };
      race.participant.getTrackPublication = source => source === Track.Source.Microphone ? nextMic : getPublication(source);
    }
    finishMicrophone(new Map([['a', { id: 'a', type: 'inbound-rtp', kind: 'audio', timestamp: 5000, packetsReceived: 1000, packetsLost: 900 }]]));
    await oldAudioReport;
    assert.equal(race.guests()[0].networkMeasured, false, `${change}: superseded audio sample is unknown`);
    assert.equal(race.guests()[0].totalLoss.packets, 1, `${change}: rejected audio report cannot contaminate history`);
    race.stop();
  }

  const rejoined = harness();
  await flush();
  let finishCamera;
  rejoined.camera.track.getRTCStatsReport = () => new Promise(resolve => { finishCamera = resolve; });
  const oldCameraSample = rejoined.context.refreshRef.current();
  await flush();
  rejoined.participant.sid = 'PA_rejoin_during_report';
  finishCamera(new Map([['v', { id: 'v', type: 'inbound-rtp', kind: 'video', timestamp: 1000, packetsReceived: 1000, packetsLost: 3000 }]]));
  await oldCameraSample;
  assert.notEqual(rejoined.guests()[0].participantSid, rejoined.participant.sid, 'old in-flight report cannot be attached to a new participant session');
  rejoined.camera.track.getRTCStatsReport = async () => new Map([['v', { id: 'v', type: 'inbound-rtp', kind: 'video', timestamp: 3000, packetsReceived: 100, packetsLost: 1 }]]);
  await rejoined.context.refreshRef.current();
  assert.equal(rejoined.guests()[0].totalLoss.packets, 1, 'new participant session uses only its own counters');
  rejoined.stop();

  // GuestAudioMeter owns PCM observations and state independently of the Studio.
  let state = [], cursor = 0, effect, observer;
  const { GuestAudioMeter } = load('../components/GuestAudioMeter.tsx', {
    react: { ...require('react'), useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; }, useEffect(callback) { effect = callback; } },
    '@/lib/audio-meter': { METER_FLOOR_DB: -90, observePcmTrack(track, onLevel, muted) { observer = { track, onLevel, muted }; return () => {}; } },
  });
  const track = { mediaStreamTrack: { readyState: 'live' }, isMuted: false };
  const renderMeter = () => { cursor = 0; return GuestAudioMeter({ track }); };
  renderMeter(); effect();
  observer.onLevel(-12.3);
  assert.equal(renderMeter().props.db, -12.3, 'PCM levels still update the local meter output');
  assert.equal(observer.track, track.mediaStreamTrack);
  track.isMuted = true;
  assert.equal(observer.muted(), true, 'local meter observes mute changes without a new Studio render');
  console.log('PASS: audio frames and unchanged polls preserve Studio guest state; mute/name/stats/departure update cards; PCM meters retain local updates; audio-only fallback, source switching, camera priority, freshness, session/race guards and RTC read counts verified');
})().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { harness };
