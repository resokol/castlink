const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./load-typescript.cjs');
const { ServerObservabilityStore } = load('../lib/server-observability-store.ts');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-observability-benchmark-'));
const now = Date.now(), filename = path.join(directory, 'runtime', 'server-observability.sqlite');
const store = new ServerObservabilityStore(filename, { clock: () => now });
const point = at => ({ at, cpuPercent: 37, memoryUsedBytes: 512 * 1024 ** 2, memoryTotalBytes: 2 * 1024 ** 3, diskUsedBytes: 5 * 1024 ** 3, diskTotalBytes: 20 * 1024 ** 3, diskAvailableBytes: 14 * 1024 ** 3, networkInMbps: 1, networkOutMbps: 2, processRssBytes: 100 * 1024 ** 2, processUptimeSec: 100, configuredRooms: 5, activeRooms: 2, connections: 10, casters: 7, services: { web: 'ok', livekit: 'ok', roomStore: 'ok' } });
try {
  const fillStarted = performance.now();
  for (let n = 0; n < 5760; n++) if (!store.appendSample(point(now - (5759 - n) * 15000))) throw new Error('sample_write_failed');
  for (let batch = 0; batch < 200; batch++) store.appendEvents(Array.from({ length: 100 }, (_, n) => ({ at: now - 20000 + batch * 100 + n, level: n % 10 ? 'info' : 'error', event: 'benchmark.request', service: 'castlink-web', fields: { requestId: 'benchmark-request', status: n % 10 ? 200 : 503, durationMs: n } })));
  const fillMs = performance.now() - fillStarted;
  const latency = action => { const values = []; for (let n = 0; n < 20; n++) { const start = performance.now(); action(); values.push(performance.now() - start); } return { meanMs: values.reduce((a, b) => a + b) / values.length, maxMs: Math.max(...values) }; };
  const metricsRead = latency(() => store.readMetrics(86400000));
  const eventsRead = latency(() => store.readEvents('error'));
  const write = latency(() => store.appendSample(point(now)));
  const batchWrite = latency(() => store.appendEvents(Array.from({ length: 100 }, () => ({ at: now, level: 'info', event: 'benchmark.request', service: 'castlink-web', fields: { status: 200 } }))));
  const bytesBeforeClose = fs.readdirSync(path.dirname(filename)).reduce((sum, name) => sum + fs.statSync(path.join(path.dirname(filename), name)).size, 0);
  const payloadBytes = Buffer.byteLength(JSON.stringify(store.readMetrics(86400000)));
  store.close();
  console.log(JSON.stringify({ samples: 5760, events: 20000, fillMs, metricsRead, eventsRead, write, batchWrite, bytesBeforeClose, databaseBytes: fs.statSync(filename).size, metrics24hPayloadBytes: payloadBytes, fixture: directory, note: 'synthetic benchmark data; same production SQLite store; no live server modified' }));
} finally { store.close(); if (!process.env.CASTLINK_KEEP_BENCHMARK) fs.rmSync(directory, { recursive: true, force: true }); }
