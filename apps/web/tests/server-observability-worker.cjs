const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
(async () => {
  const realTimeout = global.setTimeout, realClear = global.clearTimeout;
  let scheduled = [], collections = 0, persisted = 0, resolve, active = 0, maxActive = 0;
  global.setTimeout = (fn, ms) => { const timer = { fn, ms, cancelled: false, unref() {} }; scheduled.push(timer); return timer; };
  global.clearTimeout = timer => { if (timer) timer.cancelled = true; };
  const store = { appendSample() { persisted++; }, close() {}, addDroppedEvents() {}, appendEvents() { return true; }, storage() { return { state: 'ok' }; } };
  const worker = load('../lib/server-observability-worker.ts', {
    './server-monitor': { collectServerMonitorSample: async () => { collections++; active++; maxActive = Math.max(maxActive, active); await new Promise(r => resolve = r); active--; return { at: Date.now(), services: { web: 'ok', livekit: 'ok', roomStore: 'ok' } }; } },
    './server-observability-store': { serverObservabilityStore: () => store, MONITOR_INTERVAL_MS: 15000 },
    './server-event-journal': { startServerEventJournal() {}, stopServerEventJournal() {} },
    './server-log': { serverLog() {} },
  });
  try {
    process.env.NEXT_PHASE = 'phase-production-build'; worker.startServerObservability(); assert.equal(collections, 0, 'build does not collect');
    delete process.env.NEXT_PHASE;
    worker.startServerObservability(); worker.startServerObservability();
    assert.equal(collections, 1, 'one immediate collection independent of HTTP readers');
    assert.equal(scheduled.length, 0, 'no next collection scheduled while current one runs');
    resolve(); await new Promise(r => setImmediate(r));
    assert.equal(persisted, 1); assert.equal(scheduled[0].ms, 15000);
    scheduled[0].fn(); assert.equal(collections, 2);
    worker.stopServerObservability(); resolve(); await new Promise(r => setImmediate(r));
    assert.equal(maxActive, 1); assert.equal(scheduled.length, 1, 'completion cannot resurrect stopped sampler');
    assert.equal(persisted, 1, 'shutdown does not write a late collection');
    worker.startServerObservability(); assert.equal(collections, 2, 'shutdown cannot restart through duplicate registration');
    console.log('PASS: production startup guard, automatic sampling, singleton/no-overlap and shutdown without resurrection');
  } finally { global.setTimeout = realTimeout; global.clearTimeout = realClear; delete global[Symbol.for('castlink.server-observability-worker')]; }
})().catch(error => { console.error(error); process.exitCode = 1; });
