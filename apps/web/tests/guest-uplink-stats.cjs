const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let api = {};
try { api = load('../lib/guest-uplink-stats.ts'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(typeof api.sampleGuestUplinkStats, 'function', 'caster uplink loss sampler must be available');
const { createGuestUplinkStatsState, sampleGuestUplinkStats } = api;
const state = createGuestUplinkStatsState(), track = {};
const report = (at, sent, lost, extra = {}, kind = 'video') => new Map([
  ['out', { id: 'out', type: 'outbound-rtp', kind, ssrc: 7, remoteId: 'rr', packetsSent: sent, timestamp: at }],
  ['rr', { id: 'rr', type: 'remote-inbound-rtp', kind, ssrc: 7, localId: 'out', packetsLost: lost, timestamp: at, reportsReceived: at / 1000, jitter: .004, roundTripTime: .04, ...extra }],
]);
const sample = (at, sent, lost, extra) => sampleGuestUplinkStats(state, track, report(at, sent, lost, extra), at, 'video');
assert.equal(sample(1000, 1000, 0).currentLoss, null, 'first feedback is only a baseline');
let result = sample(3000, 1100, 10);
assert.deepEqual(result.currentLoss, { packets: 10, percent: 10 }, 'uplink divides by sent packets, which already include loss');
assert.equal(result.stability, 'Плохая');
assert.equal(result.rttMs, 40);
assert.equal(result.jitterMs, 4);
for (const at of [5000, 7000, 9000, 11000, 13000]) result = sample(at, 1100 + (at - 3000) / 20, 10);
assert.equal(result.stability, 'Хорошая', 'current recovery retains session losses separately');
assert.equal(result.totalLoss.packets, 10);
const freshAt = state.freshAt;
result = sample(15000, 1800, 10, { reportsReceived: 13 });
assert.equal(state.freshAt, freshAt, 'new outbound/local stats timestamp without new RR cannot refresh feedback');
result = sample(27000, 2000, 10, { reportsReceived: 13 });
assert.equal(result.stability, null, 'cached RTCP expires even while packetsSent grows');
result = sample(29000, 2100, 10);
assert.equal(result.currentLoss, null, 'feedback after a long gap needs a new current baseline');
result = sample(31000, 2200, 8);
assert.equal(result.totalLoss.packets, 8, 'late corrections lower historical losses');
assert.equal(result.currentLoss.packets, 0);
result = sampleGuestUplinkStats(state, track, report(33000, 100, 1, {}, 'audio'), 33000, 'audio');
assert.equal(result.currentLoss, null, 'audio/source switch resets current observation');
assert.equal(result.totalLoss.packets, 9);
result = sampleGuestUplinkStats(state, track, report(35000, 200, 1, {}, 'audio'), 35000, 'audio');
assert.equal(result.stability, 'Хорошая', 'audio-only sender feedback is supported');
for (const extra of [{ localId: 'wrong' }, { ssrc: 8 }, { kind: 'video' }, { packetsLost: undefined }]) {
  const invalid = createGuestUplinkStatsState();
  assert.equal(sampleGuestUplinkStats(invalid, track, report(1000, 100, 1, extra, 'audio'), 1000, 'audio').currentLoss, null);
  assert.equal(invalid.freshAt, undefined, 'mismatched or missing feedback cannot become a healthy zero');
}
const noRR = new Map([['out', { id: 'out', type: 'outbound-rtp', kind: 'video', packetsSent: 500, timestamp: 31000 }]]);
assert.equal(sampleGuestUplinkStats(state, track, noRR, 31000, 'video').stability, null, 'sender-only report is unknown');
// Real Chromium shape: no reportsReceived, remote timestamp fixed until an RR arrives.
const chrome = createGuestUplinkStatsState();
const chromeSample = (at, feedbackAt, sent, lost, measurements = 1) => sampleGuestUplinkStats(chrome, track,
  report(at, sent, lost, { timestamp: feedbackAt, reportsReceived: undefined, roundTripTimeMeasurements: measurements }, 'audio'), at, 'audio');
chromeSample(1000, 1000, 1000, 0);
assert.equal(chromeSample(3000, 1000, 1100, 0).currentLoss, null, 'cached RR with growing sender remains baseline-only');
assert.equal(chromeSample(9000, 9000, 1400, 40, 1).currentLoss.percent, 10, 'new RR reports loss even when RTT measurements did not advance');
assert.equal(chromeSample(17000, 17000, 1800, 40, 2).currentLoss.percent, 5, 'eight-second audio feedback gap remains measurable');
assert.equal(chromeSample(31000, 17000, 2500, 40, 2).currentLoss, null, 'feedback eventually expires despite continuing sender traffic');

const layers = createGuestUplinkStatsState();
const layerSample = (at, sent, lost, extra) => {
  const value = report(at, sent, lost);
  value.set('inactive', { id: 'inactive', ssrc: 99, type: 'outbound-rtp', kind: 'video', timestamp: at, packetsSent: 0, ...extra });
  return sampleGuestUplinkStats(layers, track, value, at, 'video');
};
layerSample(1000, 1000, 0);
assert.equal(layerSample(3000, 1100, 10, { active: false, packetsSent: 900 }).currentLoss.percent, 10, 'inactive previously-used simulcast layer does not erase active feedback');
assert.equal(layerSample(5000, 1200, 10).stability, 'Плохая', 'never-sent no-RR simulcast layer does not force an endless baseline');
assert.equal(layerSample(7000, 1300, 10, { active: true, packetsSent: 100 }).stability, null, 'advancing active layer without receiver feedback makes the kind unknown');
console.log('PASS uplink: RTCP association, sender denominator, RR freshness, recovery, corrections, history, audio and missing feedback');
