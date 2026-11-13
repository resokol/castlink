const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const { RoomEvent, Track } = require('livekit-client');
const { load } = require('./load-typescript.cjs');
const { bindStudioRoomLifecycle } = load('../lib/studio-room-lifecycle.ts');
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
    module: { exports: {} }, room, RoomEvent, Track, bindStudioRoomLifecycle, readGuestReceiveBitrate,
    Date: class extends Date { static now() { return clock; } },
    studioId: 'studio', roomName: 'room', transferSnapshot: undefined,
    acquireStudioClientId: async () => ({ clientId: 'client', release() {} }),
    fetch: async url => ({ ok: true, json: async () => url === '/api/studio-control' ? { role: 'moderator' } : { token: 'token' } }),
    readControlResponse: response => response.json(), getLiveKitUrl: () => 'ws://fixture', startRoomTelemetry: () => () => {},
    createStudioSenderStatsState: () => ({}),
    readTrackStats: track => track.getRTCStatsReport(), freshGuestCameraOutboundBitrate: sample => sample?.bitrateKbps ?? null,
    GUEST_CAMERA_OUTBOUND_TOPIC: 'camera-outbound', parseGuestClientInfo: () => undefined,
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
  return { room, participant, microphone, context, frames, intervals,
    guests: () => guests, renders: () => guestRenders,
    stats: value => { report = value; },
    time: value => { clock = value; },
    tickFrames() { const pending = Array.from(frames.values()); frames.clear(); pending.forEach(callback => callback(100)); },
    stop: () => context.module.exports(),
  };
}

(async () => {
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

  const video = (bytesReceived, timestamp) => new Map([['v', { id: 'v', type: 'inbound-rtp', kind: 'video', frameWidth: 1280, frameHeight: 720, bytesReceived, timestamp, packetsLost: 0, jitter: 0.002 }]]);
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
  console.log('PASS: audio frames and unchanged polls preserve Studio guest state; mute/name/stats/departure update cards; PCM meters retain local updates');
})().catch(error => { console.error(error); process.exitCode = 1; });
