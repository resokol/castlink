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
console.log('PASS room media diagnosis, limits, endpoint attribution, capture-clock isolation, resets and legacy records');
