const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

(async () => {
  const { cpuUsage, networkRates, parseNetwork } = load('../lib/server-monitor.ts');
  assert.equal(cpuUsage(null, { at: 5000, idle: 200, total: 400 }), null);
  assert.equal(cpuUsage({ at: 0, idle: 100, total: 200 }, { at: 5000, idle: 200, total: 600 }), 75);
  assert.equal(cpuUsage({ at: 0, idle: 100, total: 200 }, { at: 46000, idle: 200, total: 600 }), null, 'stale intervals are gaps');
  assert.equal(cpuUsage({ at: 0, idle: 100, total: 200 }, { at: 15000, idle: 200, total: 600 }), 75, '15 second background cadence retains a measured rate');
  assert.equal(cpuUsage({ at: 0, idle: 100, total: 200 }, { at: 5000, idle: 0, total: 100 }), null, 'counter reset is unavailable');
  const before = { at: 1000, interfaces: { eth0: { rx: 100, tx: 100 } } };
  assert.deepEqual(networkRates(before, { at: 2000, interfaces: { eth0: { rx: 125100, tx: 250100 } } }), { inMbps: 1, outMbps: 2 });
  assert.deepEqual(networkRates(null, before), { inMbps: null, outMbps: null });
  assert.deepEqual(networkRates(before, { at: 2000, interfaces: { eth0: { rx: 100, tx: 100 } } }), { inMbps: 0, outMbps: 0 });
  assert.deepEqual(networkRates(before, { at: 2000, interfaces: { eth1: { rx: 100, tx: 100 } } }), { inMbps: null, outMbps: null });
  assert.deepEqual(networkRates(before, { at: 2000, interfaces: { eth0: { rx: 0, tx: 0 } } }), { inMbps: null, outMbps: null });
  assert.deepEqual(parseNetwork('eth0 00000000\n', ' eth0: 100 0 0 0 0 0 0 0 200 0\n lo: 900 0 0 0 0 0 0 0 900 0', 1000), { at: 1000, interfaces: { eth0: { rx: 100, tx: 200 } } });

  console.log('PASS: actual counter deltas, unavailable vs zero, rate resets/gaps and 15 second background cadence');
})().catch(error => { console.error(error); process.exitCode = 1; });
