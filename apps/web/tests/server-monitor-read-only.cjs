const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
(async () => {
  let reads = 0;
  const { readServerMonitor } = load('../lib/server-monitor.ts', {
    'livekit-server-sdk': { RoomServiceClient: class { constructor() { throw new Error('HTTP reader attempted collection'); } } },
    './room-store': { readNodeRoomInventory: async () => { throw new Error('HTTP reader attempted inventory'); } },
    './server-observability-store': { serverObservabilityStore: () => ({ readMetrics: windowMs => { reads++; return { history: [], latest: null, windowMs, storage: { state: 'unavailable', droppedEvents: 0, samplerRunning: false } }; } }), MONITOR_INTERVAL_MS: 15000, OBSERVABILITY_RETENTION_MS: 86400000 },
  });
  const view = await readServerMonitor(21600000);
  assert.equal(reads, 1); assert.equal(view.latest, null); assert.equal(view.history.length, 0);
  assert.equal(view.intervalMs, 15000); assert.equal(view.retentionMs, 86400000); assert.equal(view.windowMs, 21600000);
  assert.equal(view.storage.state, 'unavailable'); assert.equal(view.storage.samplerRunning, false);
  console.log('PASS: HTTP metrics reads retained SQLite data only, never starts collection, and exposes unavailable/not-running state');
})().catch(error => { console.error(error); process.exitCode = 1; });
