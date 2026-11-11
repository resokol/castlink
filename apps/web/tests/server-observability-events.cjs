const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
(async () => {
  const originalTimeout = global.setTimeout, originalClear = global.clearTimeout, originalError = console.error;
  const prior = new Map(['exit', 'SIGTERM', 'SIGINT', 'uncaughtExceptionMonitor'].map(name => [name, process.listeners(name)]));
  let timers = [], events = [], persisted = [], media = 'unavailable', storage = 'ok';
  global.setTimeout = fn => { const timer = { fn, unref() {} }; timers.push(timer); return timer; };
  global.clearTimeout = () => {};
  console.error = () => {};
  const { startServerObservability, stopServerObservability } = load('../lib/server-observability-worker.ts', {
    './server-monitor': { collectServerMonitorSample: async () => ({ at: Date.now(), services: { web: 'ok', livekit: media, roomStore: 'ok' } }) },
    './server-observability-store': { MONITOR_INTERVAL_MS: 15000, serverObservabilityStore: () => ({ appendSample() {}, storage: () => ({ state: storage }), appendEvents: records => persisted.push(...records), close() {} }) },
    './server-event-journal': { startServerEventJournal() {}, stopServerEventJournal() {} },
    './server-log': { serverLog: (level, event) => events.push([level, event]) },
  });
  try {
    const uncaught = process.listenerCount('uncaughtException'), rejection = process.listenerCount('unhandledRejection');
    startServerObservability(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, [['info', 'server.observability.started'], ['warn', 'server.livekit.unavailable']]);
    timers.at(-1).fn(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 2, 'steady unavailability is not logged every sample');
    media = 'ok'; storage = 'unavailable'; timers.at(-1).fn(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events.slice(-2), [['info', 'server.livekit.recovered'], ['warn', 'server.observability_storage.unavailable']]);
    storage = 'ok'; timers.at(-1).fn(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events.at(-1), ['info', 'server.observability_storage.recovered']);
    const error = new Error('sensitive message, credentials and stack must not be stored'); error.name = 'TypeError'; error.code = 'EPIPE';
    process.emit('uncaughtExceptionMonitor', error, 'uncaughtException');
    assert.equal(persisted.length, 1); assert.equal(persisted[0].event, 'server.uncaught_exception');
    assert.deepEqual(persisted[0].fields, { reason: 'TypeError', code: 'EPIPE', action: 'uncaughtException' });
    assert.doesNotMatch(JSON.stringify(persisted), /sensitive|credentials|stack/);
    process.emit('uncaughtExceptionMonitor', error, 'uncaughtException');
    assert.equal(persisted.length, 2, 'framework-handled uncaught errors remain observed after the first');
    assert.equal(process.listenerCount('uncaughtException'), uncaught); assert.equal(process.listenerCount('unhandledRejection'), rejection);
    const framework = () => {};
    process.on('unhandledRejection', framework); await new Promise(resolve => setImmediate(resolve));
    assert.equal(process.listenerCount('unhandledRejection'), rejection + 2, 'observer joins an existing framework handler');
    process.emit('unhandledRejection', error, Promise.resolve());
    process.emit('unhandledRejection', error, Promise.resolve());
    assert.equal(persisted.filter(event => event.event === 'server.unhandled_rejection').length, 2);
    process.removeListener('unhandledRejection', framework);
    assert.equal(process.listenerCount('unhandledRejection'), rejection, 'observer detaches with the last framework handler');
    stopServerObservability(); assert.deepEqual(events.at(-1), ['info', 'server.observability.stopped']);
    console.log('PASS: startup/shutdown, once-per-transition service availability and fatal observer with only name/code/origin');
  } finally {
    global.setTimeout = originalTimeout; global.clearTimeout = originalClear; console.error = originalError;
    for (const [name, listeners] of prior) for (const listener of process.listeners(name)) if (!listeners.includes(listener)) process.removeListener(name, listener);
    delete global[Symbol.for('castlink.server-observability-worker')];
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
