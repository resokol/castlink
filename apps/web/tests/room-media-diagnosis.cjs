const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { createRoomMediaDiagnosis } = load('../lib/room-media-diagnosis.ts');

function sample(at, identity, streams, extra = {}) {
  return { at, identity, room: 'room', session: identity + '-session', state: 'connected', streams, ...extra };
}
function video(direction, fields = {}, details = {}) {
  return { id: 'rtp-' + direction, participant: 'guest', source: 'camera', direction, kind: 'video',
    bitrateKbps: 1200, fps: 25, lossPct: 0, bytes: 1000, freezes: null,
    video: { trackSid: 'TRACK', ...details }, ...fields };
}
function audio(fields) {
  return { id: 'audio-in', participant: 'guest', source: 'microphone', direction: 'in', kind: 'audio',
    bitrateKbps: 64, bytes: 100, lossPct: 0, ...fields };
}
function diagnose(rows) {
  const report = createRoomMediaDiagnosis();
  rows.forEach(row => report.add(row));
  return report.finish();
}
function only(rows, code) {
  const { findings } = diagnose(rows);
  assert.deepEqual(findings.map(f => f.code), [code]);
  return findings[0];
}

const initial = sample(1000, 'guest', [video('out', {}, { framesEncoded: 30, totalEncodeTime: 1 })]);
const cpu = sample(3000, 'guest', [
  video('out', { qualityLimitation: 'cpu' }, { framesEncoded: 80, totalEncodeTime: 3 }),
  video('out', { id: 'inactive-rid', qualityLimitation: 'bandwidth', bitrateKbps: 0, fps: 0 }),
]);
const cpuFinding = only([initial, cpu, sample(3200, 'watcher', [video('in')])], 'sender-cpu');
assert.equal(cpuFinding.side, 'sender');
assert.equal(cpuFinding.confidence, 'observed');
assert.equal(cpuFinding.source, 'guest');
assert.equal(cpuFinding.evidence.encodeMsPerFrame, 40);
assert.equal(cpuFinding.evidence.outboundKbps, 1200);
const bandwidth = only([sample(1000, 'guest', [
  video('out', { qualityLimitation: 'bandwidth' }, { availableOutgoingBitrate: 2e6 }),
  video('out', { id: 'second-rid', bitrateKbps: 300 }),
])], 'sender-bandwidth');
assert.equal(bandwidth.evidence.outboundKbps, 1500);
assert.equal(bandwidth.evidence.availableOutgoingKbps, 2000);
assert.equal(only([sample(1000, 'guest', [video('out', { lossPct: 4 })])], 'sender-loss').evidence.lossPct, 4);

// Server timestamps straddle a comparison-bucket boundary, and the control
// arrives after the incident. Client wall clocks can be arbitrarily far apart.
const bad = sample(4999, 'watcher-a', [video('in', { lossPct: 8 })], { clientAt: 100 });
const good = sample(5050, 'watcher-b', [video('in')], { clientAt: 10000000 });
only([bad, good], 'unlocalized');
const isolated = only([bad, good, { ...bad, at: 6999 }, { ...good, at: 7050 }], 'receiver-path');
assert.equal(isolated.receiver, 'watcher-a');
assert.equal(isolated.evidence.healthyReceivers, 1);
assert.equal(isolated.confidence, 'likely');
assert.equal(only([bad], 'unlocalized').confidence, 'unknown');
only([bad, { ...good, at: bad.at + 2501 }], 'unlocalized');
only([bad, { ...good, room: 'different' }], 'unlocalized');
only([bad, { ...good, identity: bad.identity }], 'unlocalized');
only([bad, sample(5000, 'watcher-b', [video('in', {}, { trackSid: 'other-camera' })])], 'unlocalized');
only([bad, sample(5000, 'watcher-b', [video('in', { lossPct: null })])], 'unlocalized');
only([bad, sample(5000, 'watcher-b', [video('in', {}, { publicationMuted: true })])], 'unlocalized');
only([bad, sample(5000, 'watcher-b', [video('in', { fps: 0, bitrateKbps: 0 })])], 'unlocalized');

// Loss during a receiver reconnect while an independent receiver keeps the same stream.
const reconnecting = { ...bad, state: 'signalReconnecting' };
const reconnectFinding = only([reconnecting, good], 'receiver-path');
assert.equal(reconnectFinding.evidence.receiverReconnecting, 1);
only([reconnecting], 'unlocalized');
const { connectionVerdicts } = load('../lib/connection-verdicts.ts');
const conclusions = rows => connectionVerdicts(diagnose(rows), true);
assert.deepEqual(conclusions([reconnecting, good]), [{location:'after', findingIndex:0}]);
assert.deepEqual(conclusions([bad]), [{location:'unknown', findingIndex:0}]);
assert.deepEqual(conclusions([cpu]), [{location:'before', findingIndex:0}]);
assert.deepEqual(conclusions([good]), [{location:'clear', reason:'no-symptoms'}]);
assert.deepEqual(conclusions([]), [{location:'unknown', reason:'insufficient-data'}]);
assert.deepEqual(conclusions([{ ...good, state:'reconnecting' }]), conclusions([]));
assert.deepEqual(connectionVerdicts(diagnose([good]), false), conclusions([]));
assert.deepEqual(connectionVerdicts({ findings:[isolated, cpuFinding, reconnectFinding], coverage:{} }, true, 5000),
  [{location:'inside', reason:'livekit-api-check-failed', at:5000}, {location:'after', findingIndex:0}, {location:'before', findingIndex:1}]);
const senderRR = { kind: 'remote-inbound-rtp', fresh: true, ageMs: 300, fractionLost: 0 };
const sender = sample(5000, 'guest', [video('out', { peerReport: senderRR })]);
const sfuReport = (packetsSent, bytesSent) => ({ kind: 'remote-outbound-rtp', fresh: true, ageMs: 150, packetsSent, bytesSent });
const subscriber = (at, sent, lossPct) => sample(at, 'watcher-a', [video('in', { lossPct, peerReport: sfuReport(sent, sent * 100) })]);
const firstLegRows = [subscriber(2900, 100, 0), subscriber(4900, 300, 8), sender,
  subscriber(6900, 500, 9), { ...sender, at: 7010 }];
const recentFirstLeg = only(firstLegRows, 'receiver-path');
assert.equal(recentFirstLeg.evidence.sfuEgressPacketsDelta, 200);
assert.equal(recentFirstLeg.evidence.sfuEgressBytesDelta, 20000);
only([bad, sender, { ...bad, at: 7000 }, { ...sender, at: 7010 }], 'unlocalized');
assert.equal(recentFirstLeg.evidence.senderLossPct, 0);
assert.equal(recentFirstLeg.evidence.healthyReceivers, 0);
for (const report of [undefined, { ...senderRR, fresh: false }, { ...senderRR, ageMs: 6000 },
    { ...senderRR, fractionLost: undefined }, { ...senderRR, kind: 'remote-outbound-rtp' }]) {
  const publisher = sample(5000, 'guest', [video('out', { peerReport: report })]);
  only([subscriber(2900, 100, 0), subscriber(4900, 300, 8), publisher,
    subscriber(6900, 500, 8), { ...publisher, at: 7010 }], 'unlocalized');
}
const native = only([sample(1000, 'guest', [video('out', { lossPct: 1, peerReport: { ...senderRR, fractionLost: 0.125 } })])], 'sender-loss');
assert.equal(native.evidence.lossPct, 12.5);
const highLayer = sample(4999, 'a', [video('in', { width: 1280, height: 720, lossPct: 12 })]);
const lowLayer = sample(5000, 'b', [video('in', { width: 320, height: 180 })]);
only([highLayer, lowLayer, { ...highLayer, at: 7000 }, { ...lowLayer, at: 7020 }], 'unlocalized');
const shared = only([bad, sample(5100, 'watcher-b', [video('in', { lossPct: 12 })])], 'shared-path');
assert.equal(shared.receiver, null);
assert.deepEqual(new Set(shared.receivers), new Set(['watcher-a', 'watcher-b']));
assert.equal(shared.evidence.affectedReceivers, 2);
assert.equal(shared.evidence.lossPct, 12);
const unknownMixed = diagnose([bad, good, sample(5075, 'watcher-c', [video('in', { lossPct: 12 })])]);
assert.ok(unknownMixed.findings.every(f => f.code === 'unlocalized'));

const concealed = intervalMs => audio({ audio: { concealedPct: 13, receivedSamplesDelta: 96000, intervalMs } });
const audioControl = sample(4700, 'monitor', [audio({ audio: { concealedPct: 0, receivedSamplesDelta: 96000, intervalMs: 2000 } })]);
const audioFinding = only([audioControl, sample(4900, 'output', [concealed(2000)]),
  { ...audioControl, at: 6700 }, sample(6900, 'output', [concealed(2000)])], 'unlocalized');
assert.equal(audioFinding.evidence.concealedPct, 13);
assert.equal(audioFinding.kind, 'audio');
only([sample(5000, 'output', [concealed(2000)]), sample(5010, 'monitor', [audio({})])], 'unlocalized');
assert.equal(diagnose([sample(5000, 'output', [concealed(30000)])]).findings.length, 0);
assert.equal(diagnose([sample(5000, 'output', [audio({ lossPct: 20, audioTrack: { mediaTrackEnabled: false } })])]).findings.length, 0);

const receiver = 'monitor';
function frames(at, decoded, received, dropped, freeze, opt = {}) {
  return sample(at, receiver, [video('in', {}, { framesDecoded: decoded, framesReceived: received,
    framesDropped: dropped, freezeCount: freeze, ...opt })]);
}
const first = frames(1000, 20, 20, 0, 7);
assert.equal(diagnose([first]).findings.length, 0, 'initial cumulative freezes are historical');
const stall = frames(3000, 20, 70, 50, 8);
only([first, stall], 'unlocalized');
const decode = only([first, { ...first, identity: 'other', session: 'other-session' }, stall,
  { ...frames(3000, 70, 70, 0, 7), identity: 'other', session: 'other-session' }], 'receiver-decode');
assert.equal(decode.evidence.droppedPct, 100);
assert.equal(decode.evidence.freezes, 1);
assert.equal(decode.evidence.receivedFrames, 50);
assert.equal(decode.evidence.decodedFrames, 0);
const slow = only([frames(1000, 20, 20, 0, 7, { totalDecodeTime: 1 }),
  frames(3000, 40, 100, 60, 8, { totalDecodeTime: 2.5 })], 'receiver-decode');
assert.equal(slow.evidence.decodeMsPerFrame, 75);
for (const next of [
  frames(3000, 0, 70, 50, 8),
  frames(3000, 20, 70, 50, 8, { trackSid: 'replacement' }),
  frames(11000, 20, 70, 50, 8),
  { ...frames(3000, 20, 70, 50, 8), session: 'next' },
  { ...frames(3000, 20, 70, 50, 8), reconnects: 1 },
  frames(3000, 20, 70, 50, 8, { publicationMuted: true }),
]) assert.equal(diagnose([first, next]).findings.length, 0);
assert.equal(diagnose([first, frames(2000, 20, 20, 0, 7, { mediaTrackReadyState: 'ended' }),
  frames(3000, 20, 70, 50, 8)]).findings.length, 0);
assert.equal(diagnose([frames(1000, 20, 20, 0, 7, { statsAt: 5000 }),
  frames(3000, 20, 70, 50, 8, { statsAt: 3000 })]).findings.length, 0);
const legacy = at => sample(at, receiver, [video('in', { video: undefined, freezes: at === 1000 ? 99 : 100 })]);
assert.equal(only([legacy(1000), legacy(3000)], 'unlocalized').evidence.freezes, 1);
assert.equal(diagnose([bad, sample(5000, 'guest', [video('out', {}, { publicationMuted: true })])]).findings.length, 0);

const episodes = diagnose([1000, 3000, 5100, 30000].map(at => sample(at, 'guest', [video('out', { lossPct: 5 })])));
assert.equal(episodes.findings.length, 2);
assert.equal(episodes.findings[1].intervals, 3);
assert.equal(episodes.coverage.samples, 4);
assert.equal(episodes.coverage.participants, 1);
assert.equal(episodes.coverage.inbound, 0);
assert.equal(episodes.coverage.outbound, 4);
assert.equal(episodes.coverage.detailedVideo, 4);

const bounded = diagnose(Array.from({ length: 120 }, (_, n) => sample(n * 10000, 'guest', [video('out', { lossPct: 5 })])));
assert.equal(bounded.findings.length, 48);
assert.equal(bounded.coverage.limited, true);
assert.equal(bounded.findings[0].lastAt, 1190000);
assert.equal(diagnose([{ ...good, videoDiagnosticsLimited: true }]).coverage.limited, true);
assert.equal(diagnose([{ ...good, at: 60000 }, bad]).coverage.limited, true);
assert.deepEqual(diagnose([]).findings, []);

const layerReport = (direction, width, height, bitrateKbps, more = {}) =>
  video(direction, { width, height, bitrateKbps, codec: 'video/H264', ...more });
function layerWindow(at, { track = 'TRACK', control = true, small = false, legacy = false, requestedQuality = 'high', requestedShortSide } = {}) {
  const pub = layerReport('out', 1920, 1080, 3475);
  const sub = layerReport('in', 640, 360, 120, { video: { trackSid: track, requestedQuality, requestedShortSide },
    peerReport: { kind: 'remote-outbound-rtp', fresh: true, ageMs: 100, egressKbps: 126, egressIntervalMs: 1800 } });
  const reference = small ? layerReport('in', 640, 360, 380) : layerReport('in', 1920, 1080, 3474);
  if (legacy) for (const stream of [pub, sub, reference]) delete stream.video;
  return [
    sample(at, 'guest', [pub, { ...pub, id: 'out-lower', width: 640, height: 360, bitrateKbps: 60 }], { role: 'guest' }),
    sample(at + 200, 'studio', [sub], { role: 'studio' }),
    ...(control ? [sample(at + 400, 'output', [reference], { role: 'output' })] : []),
  ];
}
const layerDrop = only([...layerWindow(4100), ...layerWindow(6100)], 'receiver-layer');
assert.equal(layerDrop.receiver, 'studio');
assert.equal(layerDrop.confidence, 'observed');
assert.equal(layerDrop.videoLayers.trackSid, 'TRACK');
assert.equal(layerDrop.videoLayers.publisher.kbps, 3475, 'compare a layer, not the sum of simulcast encodings');
assert.equal(layerDrop.videoLayers.receiver.height, 360);
assert.equal(layerDrop.videoLayers.receiver.requestedQuality, 'high');
assert.equal(layerDrop.videoLayers.receiver.sfuEgressKbps, 126);
assert.equal(layerDrop.videoLayers.control.height, 1080);
assert.equal(layerDrop.videoLayers.control.identity, 'output');
for (const size of [undefined, 0, 360, 1080]) {
  const findings = diagnose([4100, 6100].flatMap(at => layerWindow(at, { requestedQuality: 'adaptive', requestedShortSide: size }))).findings;
  assert.equal(findings.some(f => f.code === 'receiver-layer'), size === 1080);
}
const lossOnBoth = [4100, 6100].flatMap(at => layerWindow(at).map(row => row.role === 'guest' ? row : {
  ...row, streams: row.streams.map(v => ({ ...v, lossPct: row.role === 'output' ? 8 : 12.6 })),
}));
const comparisonWithLoss = diagnose(lossOnBoth).findings.find(f => f.code === 'receiver-layer');
assert.equal(comparisonWithLoss.evidence.lossPct, 12.6);
assert.equal(comparisonWithLoss.evidence.controlReceiverLossPct, 8, 'a control with the high layer can still be losing packets');
const archivedLayers = [4100, 6100, 8100].flatMap((at, i) => layerWindow(at).map(row => {
  if (row.role !== 'studio') return row;
  const [stream] = row.streams;
  return { ...row, streams: [{ ...stream, bytes: 20000 + 25000 * i, video: { ...stream.video, statsAt: at },
    peerReport: { kind: 'remote-outbound-rtp', fresh: i > 0, ageMs: 150, bytesSent: 50000 + 25000 * i } }] };
}));
const historicalEgress = only(archivedLayers, 'receiver-layer').videoLayers.receiver;
assert.equal(historicalEgress.sfuEgressKbps, 100);
assert.equal(historicalEgress.sfuEgressIntervalMs, 2000);
assert.equal(historicalEgress.sfuEgressClock, 'rtcp-receipt');
assert.equal(only([...layerWindow(4100, { legacy: true }), ...layerWindow(6100, { legacy: true })], 'receiver-layer').confidence, 'likely');
for (const options of [{ track: 'DIFFERENT' }, { control: false }, { small: true }, { requestedQuality: 'low' }]) {
  assert.equal(diagnose([...layerWindow(4100, options), ...layerWindow(6100, options)]).findings.length, 0);
}
assert.equal(diagnose(layerWindow(4100)).findings.length, 0, 'one sample may be a layer transition');
const sameResolution = [4100, 6100].flatMap(at => layerWindow(at).map(row => row.role === 'studio'
  ? { ...row, streams: row.streams.map(v => ({ ...v, width: 1920, height: 1080 })) } : row));
assert.equal(diagnose(sameResolution).findings.length, 0, 'bitrate alone does not identify the spatial layer');
console.log('PASS room media diagnosis, limits, endpoint attribution, capture-clock isolation, resets and legacy records');
