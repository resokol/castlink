const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createGuestNetworkStatsState, sampleGuestNetworkStats, formatPacketLoss } = require('../lib/guest-network-stats.ts');
const track = {};
function report(at, received, lost, extra = {}) {
  return new Map([
    ['video', { id: 'video', ssrc: 123, type: 'inbound-rtp', kind: 'video', timestamp: at, packetsReceived: received, packetsLost: lost, jitter: .005, ...extra }],
    ['transport', { id: 'transport', type: 'transport', selectedCandidatePairId: 'pair' }],
    ['pair', { id: 'pair', type: 'candidate-pair', currentRoundTripTime: .02 }],
  ]);
}
const state = createGuestNetworkStatsState();
const sample = (at, received, lost, extra) => sampleGuestNetworkStats(state, track, report(at, received, lost, extra), at);
let result = sample(1000, 9_997_000, 3000);
assert.equal(result.currentLoss, null, 'first sample cannot claim measured current health');
assert.deepEqual(result.totalLoss, { packets: 3000, percent: .03 });
result = sample(3000, 10_007_000, 3000);
assert.deepEqual(result.currentLoss, { packets: 0, percent: 0 });
assert.equal(result.stability, 'Хорошая', 'historical 3000 losses do not keep current network bad');
result = sample(5000, 10_016_000, 4000);
assert.deepEqual(result.currentLoss, { packets: 1000, percent: 5 });
assert.equal(result.stability, 'Плохая', 'current burst is visible as a percentage');
for (const at of [7000, 9000, 11000, 13000, 15000]) result = sample(at, 10_016_000 + (at - 5000) * 5, 4000);
assert.equal(result.stability, 'Хорошая', 'network recovers after the burst leaves the 10 second window');
assert.deepEqual(result.currentLoss, { packets: 0, percent: 0 });
assert.equal(result.totalLoss.packets, 4000, 'history survives current recovery');
assert.equal(result.rttMs, 20, 'receiver RTT comes from selected ICE pair');
assert.equal(result.jitterMs, 5);
result = sampleGuestNetworkStats(state, track, report(15000, 10_066_000, 4000), 23000);
assert.equal(result.currentLoss, null, 'cached reports age out instead of becoming measured zero loss');
assert.equal(result.stability, null);
result = sample(25000, 10_116_000, 4000);
assert.equal(result.currentLoss, null, 'long observation gap cannot be labelled as the last 10 seconds');
result = sample(27000, 10_126_000, 4000);
assert.equal(result.stability, 'Хорошая');
result = sample(29000, 10_136_000, 3990);
assert.equal(result.totalLoss.packets, 3990, 'late packet corrections lower historical loss without resetting received counters');
assert.equal(result.currentLoss.packets, 0, 'negative corrections are never rendered as negative current loss');
result = sample(31000, 100, 2);
assert.equal(result.currentLoss, null, 'counter restart establishes a new baseline');
assert.equal(result.totalLoss.packets, 3992, 'history survives counter restart');
result = sample(33000, 200, 2);
assert.equal(result.stability, 'Хорошая');
result = sample(35000, 100, 3, { ssrc: 456 });
assert.equal(result.currentLoss, null, 'new SSRC does not mix old current samples');
assert.equal(result.totalLoss.packets, 3995);
const replacement = {};
result = sampleGuestNetworkStats(state, replacement, report(37000, 100, 1), 37000);
assert.equal(result.currentLoss, null, 'replacement track cannot inherit current samples');
assert.equal(result.totalLoss.packets, 3996, 'replacement camera track preserves participant history');
result = sampleGuestNetworkStats(state, undefined, undefined, 39000);
assert.equal(result.currentLoss, null);
assert.equal(result.jitterMs, null);
assert.equal(result.stability, null, 'missing camera is unknown rather than healthy');
assert.equal(result.totalLoss.packets, 3996);
assert.equal(sampleGuestNetworkStats(createGuestNetworkStatsState(), track, new Map(), 1000).totalLoss, null);

const medium = createGuestNetworkStatsState();
sampleGuestNetworkStats(medium, track, report(1000, 0, 0), 1000);
assert.equal(sampleGuestNetworkStats(medium, track, report(3000, 99, 1), 3000).stability, 'Средняя');
const invalid = createGuestNetworkStatsState();
assert.equal(sampleGuestNetworkStats(invalid, track, report(1000, NaN, 1), 1000).stability, null);
const idle = createGuestNetworkStatsState();
sampleGuestNetworkStats(idle, track, report(1000, 0, 0), 1000);
assert.equal(sampleGuestNetworkStats(idle, track, report(3000, 0, 0), 3000).stability, null, 'no traffic has no loss denominator');

const muted = createGuestNetworkStatsState();
sampleGuestNetworkStats(muted, track, report(1000, 1000, 10), 1000);
sampleGuestNetworkStats(muted, undefined, undefined, 3000);
assert.equal(sampleGuestNetworkStats(muted, track, report(5000, 1100, 10), 5000).totalLoss.packets, 10, 'muting and resuming the same camera must not double historical losses');

const reused = createGuestNetworkStatsState();
sampleGuestNetworkStats(reused, track, report(1000, 1000, 10), 1000);
sampleGuestNetworkStats(reused, track, report(3000, 1100, 10), 3000);
result = sampleGuestNetworkStats(reused, replacement, report(5000, 1200, 10), 5000);
assert.equal(result.totalLoss.packets, 10, 'new LiveKit track wrapper reusing the same RTP counters must not recount history');
assert.ok(Math.abs(result.totalLoss.percent - 1000 / 1210) < 1e-10, 'history denominator includes 1200 received once');
assert.equal(result.currentLoss, null, 'wrapper replacement still resets current observation');
result = sampleGuestNetworkStats(reused, replacement, report(7000, 1300, 10), 7000);
assert.equal(result.stability, 'Хорошая');

assert.equal(formatPacketLoss({ percent: .03, packets: 3000 }, 'ru'), '0,03% / 3\u00a0000');
assert.equal(formatPacketLoss({ percent: 0, packets: 0 }, 'ru'), '0% / 0');
assert.equal(formatPacketLoss({ percent: .0001, packets: 1 }, 'ru'), '<0,01% / 1', 'small nonzero loss never rounds to zero');
assert.equal(formatPacketLoss({ percent: 2.5, packets: 1234 }, 'en'), '2.5% / 1,234');
assert.equal(formatPacketLoss({ percent: 2.5, packets: 1234 }, 'zh-CN'), '2.5% / 1,234');
assert.equal(formatPacketLoss(null, 'ru'), null);
console.log('PASS guest network: current/history, recovery, stale/gap, SSRC/track/reset, late corrections, unknown and percent-first localization');
