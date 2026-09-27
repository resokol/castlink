const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { createStudioOutboundSample, selectStudioOutboundView } = require('../lib/studio-outbound-stats.ts');
const now = 1_800_000_000_000;
const history = Array.from({ length: 65 }, (_, index) => index * 200);
const mainMeasurement = createStudioOutboundSample({ resolution: '1920×1080', videoKbps: 4200, audioKbps: 128, fps: 59.8 }, history, now);
assert.equal(mainMeasurement.videoHistory.length, 60, 'publisher sends at most sixty history samples');
assert.deepEqual(mainMeasurement.videoHistory, history.slice(-60));

const primaryView = selectStudioOutboundView('primary', mainMeasurement, null, true, now + 1000);
assert.equal(primaryView.status, 'live');
assert.equal(primaryView.sample.videoKbps, 4200);
const moderatorLocalPoll = createStudioOutboundSample({ resolution: '320×180', videoKbps: 0, audioKbps: 0, fps: 0 }, [0], now);
const moderatorView = selectStudioOutboundView('moderator', moderatorLocalPoll, { outbound: mainMeasurement }, true, now + 1000);
assert.deepEqual(moderatorView.sample, mainMeasurement, 'moderator displays primary snapshot, ignoring its own empty local poll');

assert.equal(selectStudioOutboundView('moderator', null, { outbound: mainMeasurement }, false, now).status, 'offline', 'offline primary values are never shown as live');
assert.equal(selectStudioOutboundView('moderator', null, null, true, now).status, 'waiting', 'missing first sample reports waiting');
assert.equal(selectStudioOutboundView('moderator', null, { outbound: { ...mainMeasurement, measuredAt: now - 10_001 } }, true, now).status, 'stale', 'samples older than ten seconds are discarded');
assert.equal(selectStudioOutboundView('moderator', null, { outbound: { ...mainMeasurement, videoKbps: Infinity } }, true, now).status, 'stale', 'malformed non-finite metrics are discarded');
assert.equal(selectStudioOutboundView('moderator', null, { outbound: { ...mainMeasurement, videoHistory: Array(61).fill(1) } }, true, now).status, 'stale', 'oversized history is rejected');
assert.equal(selectStudioOutboundView('moderator', null, { outbound: mainMeasurement }, true, now + 12_000).status, 'stale', 'old samples age out as wall time passes');
assert.equal(selectStudioOutboundView('primary', null, { outbound: mainMeasurement }, true, now).status, 'waiting', 'role reset clears local primary snapshot');
assert.equal(selectStudioOutboundView('connecting', mainMeasurement, { outbound: mainMeasurement }, true, now).status, 'waiting', 'role transition resets the graph');

console.log('PASS: primary outbound snapshot, moderator mirror, bounded history, stale/offline/reset guards');
