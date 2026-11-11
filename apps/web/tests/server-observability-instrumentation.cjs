const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
(async () => {
  const runtime = process.env.NEXT_RUNTIME;
  const calls = [];
  let fail = false;
  const { register } = load('../instrumentation.ts', {
    './lib/persistent-storage': { validatePersistentStorage: async () => { calls.push('validate-storage'); if (fail) throw new Error('storage unavailable'); } },
    './lib/room-store': { validateRoomStore: async () => calls.push('validate-rooms') },
    './lib/reserve-heartbeat-worker': { startReserveHeartbeatWorker: () => calls.push('reserve') },
    './lib/server-observability-worker': { startServerObservability: () => calls.push('observability') },
  });
  try {
    process.env.NEXT_RUNTIME = 'edge'; await register(); assert.deepEqual(calls, []);
    process.env.NEXT_RUNTIME = 'nodejs'; await register();
    assert.deepEqual(calls, ['validate-storage', 'validate-rooms', 'reserve', 'observability']);
    calls.length = 0; fail = true; await assert.rejects(register());
    assert.deepEqual(calls, ['validate-storage'], 'invalid persistent storage cannot start the sampler');
    console.log('PASS: real instrumentation registration wires the independent Node sampler after validation and excludes edge');
  } finally { if (runtime === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = runtime; }
})().catch(error => { console.error(error); process.exitCode = 1; });
