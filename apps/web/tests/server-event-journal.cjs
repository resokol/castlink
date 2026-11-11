const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const savedTimeout = global.setTimeout, savedClear = global.clearTimeout;
let scheduled = [], batches = [], dropped = 0, persistedDropped = 0;
global.setTimeout = (fn, ms) => { const timer = { fn, ms, unref() {} }; scheduled.push(timer); return timer; };
global.clearTimeout = () => {};
try {
  const store = { appendEvents(events) { batches.push(events); persistedDropped = dropped; return true; }, addDroppedEvents(n) { dropped += n; } };
  const journal = load('../lib/server-event-journal.ts', { './server-observability-store': { serverObservabilityStore: () => store } });
  journal.enqueueServerEvent('error', 'before.start', {});
  assert.equal(scheduled.length, 0, 'build/import logs do not start a journal');
  journal.startServerEventJournal();
  journal.enqueueServerEvent('error', 'request.failed', { requestId: 'safe-request', status: 503, reason: 'https://server/path?token=private', token: 'secret', room: 'private room', identity: 'private identity', body: { password: 'secret' }, durationMs: 12 });
  assert.equal(scheduled.length, 1); assert.equal(scheduled[0].ms, 1000);
  scheduled.shift().fn();
  assert.deepEqual(batches[0][0].fields, { requestId: 'safe-request', status: 503, reason: '[redacted]', durationMs: 12 });
  assert.doesNotMatch(JSON.stringify(batches), /private|secret|password/);
  const { safeServerEvent } = load('../lib/server-event-sanitize.ts');
  for (const token of ['csa2.' + 'A'.repeat(43), 'csa1.' + 'A'.repeat(43), 'slot_id.' + 'A'.repeat(43), 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvbmUifQ.' + 'A'.repeat(43), 'v1.iv.tag.ciphertext', 'sk-proj-private-key', 'sk_test_private', 'sk_live_private', 'ghp_' + 'A'.repeat(36), 'Bearer opaque-secret', '0123456789abcdef0123456789abcdef:' + 'a'.repeat(64), 'a'.repeat(64), 'APIfakekey123456789']) {
    for (const field of ['reason', 'code', 'action', 'requestId']) assert.equal(safeServerEvent('error', 'event.failed', { [field]: token }).fields[field], '[redacted]', `${field}: known credential pattern must never be retained`);
  }
  for (let n = 0; n < 10000; n++) journal.enqueueServerEvent('info', 'event.test', { requestId: 'x'.repeat(128), code: 'x'.repeat(128), reason: 'x'.repeat(128), action: 'x'.repeat(128) });
  assert.ok(dropped > 0, 'event storm drops records rather than growing an unbounded queue');
  const queued = global[Symbol.for('castlink.server-event-journal')];
  assert.ok(queued.bytes <= 256 * 1024);
  journal.flushServerEventJournal(); assert.equal(batches.at(-1).length, 100, 'transactions are at most100 records');
  journal.stopServerEventJournal();
  assert.equal(persistedDropped, dropped, 'shutdown counts excess records before its last durable batch');
  assert.equal(queued.queue.length, 0); assert.equal(queued.bytes, 0);
  const batchCount = batches.length;
  journal.startServerEventJournal(); journal.enqueueServerEvent('error', 'after.stop', {}); journal.flushServerEventJournal();
  assert.equal(batches.length, batchCount, 'shutdown cannot resurrect the journal');
  console.log('PASS: structured-event minimization, URL/credential/name exclusion,256KiB queue,100-record batches, shutdown and explicit drops');
} finally { global.setTimeout = savedTimeout; global.clearTimeout = savedClear; delete global[Symbol.for('castlink.server-event-journal')]; }
