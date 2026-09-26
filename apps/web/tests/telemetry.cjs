const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

// Load the actual TypeScript modules without adding a test-runner dependency.
const original = Module._extensions['.ts'];
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studiolink-stats-test-'));
process.env.STUDIOLINK_STATS_DIR = directory;
const { saveSample, readHistory } = require('../lib/telemetry-store.ts');
const { rateDelta } = require('../lib/rtc-telemetry.ts');
const { csv, historyCsv, connectionsCsv } = require('../lib/stats-csv.ts');

(async () => {
  const prev = { at: 1000, bytes: 1000, packets: 90, lost: 10 };
  assert.deepEqual(rateDelta(undefined, prev), { bitrateKbps: null, lossPct: null });
  assert.deepEqual(rateDelta(prev, { at: 2000, bytes: 126000, packets: 180, lost: 20 }), { bitrateKbps: 1000, lossPct: 10 });
  assert.equal(rateDelta(prev, { ...prev, at: 2000, bytes: 0 }).bitrateKbps, null);
  assert.equal(rateDelta(prev, { ...prev, at: 2000, packets: 0 }).lossPct, null);
  const at = Math.floor(Date.now() / 10000) * 10000 - 20000;
  const sample = (session, bitrate, offset = 0) => ({ at: at + offset, room: 'test-room', identity: session, session,
    name: session, role: 'guest', state: 'connected', quality: 'excellent', reconnects: 0, uptimeSec: 10,
    streams: [{ id: 'video', direction: 'in', kind: 'video', bitrateKbps: bitrate, lossPct: 1, jitterMs: 2, rttMs: 30 }] });
  await saveSample(sample('guest-a', 100));
  await saveSample(sample('guest-a', 300, 1000));
  await saveSample(sample('guest-b', 500));
  let history = await readHistory('test-room', 15);
  assert.equal(history.connections.length, 2);
  assert.equal(history.series.find(p => p.at === at).inbound, 700, 'sum of session averages, not sum of all samples');
  assert.equal(history.series.find(p => p.at === at).connections, 2);
  assert.equal(history.series.find(p => p.at === at - 10000).inbound, null, 'gaps must stay unknown');
  assert.equal((await readHistory('test-room', 15, 'guest-a')).series.find(p => p.at === at).inbound, 200);
  assert.equal((await readHistory('other-room', 15)).connections.length, 0);
  await saveSample({ ...sample('guest-a', 0, 2000), state: 'disconnected', streams: [] });
  history = await readHistory('test-room', 1440);
  assert.equal(history.connections.find(c => c.session === 'guest-a').latest.state, 'disconnected');
  assert.ok(history.series.length <= 362);
  assert.ok(historyCsv(history).startsWith('\ufeff"Время UTC";'));
  assert.ok(connectionsCsv(history).includes('guest-a'));
  assert.ok(csv([['=SUM(A1)', 'quote";line\nnext', null, 0]]).includes('"\'=SUM(A1)"'));
  assert.ok(csv([['quote";line\nnext']]).includes('"quote"";line\nnext"'));
  console.log('PASS: CSV BOM, headings, connection export, formula neutralization, quoted cells');
  console.log('PASS: bitrate/loss deltas, counter resets, history aggregation, gaps, room isolation, session filter, disconnection, 24-hour range');
})().finally(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  if (original) Module._extensions['.ts'] = original; else delete Module._extensions['.ts'];
}).catch(error => { console.error(error); process.exitCode = 1; });
