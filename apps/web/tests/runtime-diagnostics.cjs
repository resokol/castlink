const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const original = Module._extensions['.ts'];
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
try {
  const file = '../lib/runtime-diagnostics.ts';
  assert.ok(fs.existsSync(require('node:path').join(__dirname, file)), 'runtime sanitizer must exist');
  const { sanitizeRuntimeDiagnostic } = require(file);
  const raw = { visibility: 'visible', browser: 'chrome', environment: 'browser', loopLagMs: 0, maxLoopLagMs: 450,
    longTasks: 0, longTaskMaxMs: null, heapUsedBytes: 1024, heapLimitBytes: 2048, errors: 1, rejections: 0,
    events: [{ at: 123, kind: 'started' }], message: 'secret', url: 'https://secret/token', userAgent: 'secret' };
  const sanitized = sanitizeRuntimeDiagnostic(raw);
  assert.deepEqual(sanitized, { visibility: 'visible', browser: 'chrome', environment: 'browser', loopLagMs: 0, maxLoopLagMs: 450,
    longTasks: 0, longTaskMaxMs: null, heapUsedBytes: 1024, heapLimitBytes: 2048, errors: 1, rejections: 0,
    events: [{ at: 123, kind: 'started' }] }, 'only operational schema fields survive');
  for (const value of [null, [], 'secret', {}, { ...raw, visibility: 'secret' }, { ...raw, browser: 'raw user agent' }, { ...raw, environment: 'server' }]) {
    assert.equal(sanitizeRuntimeDiagnostic(value), undefined, 'malformed diagnostics are omitted');
  }
  const invalid = sanitizeRuntimeDiagnostic({ ...raw, loopLagMs: '100', maxLoopLagMs: Infinity, longTasks: -1,
    longTaskMaxMs: NaN, heapUsedBytes: '1024', heapLimitBytes: -1, errors: '1', rejections: -1,
    events: [{ at: 1, kind: 'error', message: 'secret' }, { at: '2', kind: 'online' }, { at: 3, kind: 'secret' }, null] });
  for (const key of ['loopLagMs','maxLoopLagMs','longTasks','longTaskMaxMs','heapUsedBytes','heapLimitBytes']) assert.equal(invalid[key], null, key);
  assert.equal(invalid.errors, 0); assert.equal(invalid.rejections, 0);
  assert.deepEqual(invalid.events, [{ at: 1, kind: 'error' }]);
  const bounded = sanitizeRuntimeDiagnostic({ ...raw, loopLagMs: 1e100, maxLoopLagMs: 1e100, longTasks: 1e100,
    longTaskMaxMs: 1e100, heapUsedBytes: 1e100, heapLimitBytes: 1e100, errors: 1e100, rejections: 1e100,
    events: Array.from({ length: 25 }, (_, at) => ({ at, kind: 'loop-stall', token: 'secret' })) });
  assert.equal(bounded.events.length, 20); assert.equal(bounded.events[0].at, 5);
  const sparseEvents = sanitizeRuntimeDiagnostic({ ...raw, events: [...raw.events, ...Array(150).fill({ kind: 'secret' })] });
  assert.deepEqual(sparseEvents.events, raw.events, 'recent valid events survive malformed trailing entries');
  for (const key of ['loopLagMs','maxLoopLagMs','longTasks','longTaskMaxMs','heapUsedBytes','heapLimitBytes','errors','rejections']) {
    assert.ok(Number.isFinite(bounded[key]) && bounded[key] < 1e100, `${key} is bounded`);
  }
  assert.equal(JSON.stringify(bounded).includes('secret'), false);
  console.log('PASS: runtime diagnostics allowlist, malformed objects, unsupported metrics, bounded counters, and recent operational events');
} finally { if (original) Module._extensions['.ts'] = original; else delete Module._extensions['.ts']; }
