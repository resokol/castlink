const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { STUDIO_FRAME_RATES, VIDEO_BITRATES_KBPS, MAX_GUEST_VIDEO_BITRATE, studioVideoConstraints, studioVideoPublishOptions } = require('../lib/video-quality.ts');
assert.deepEqual(STUDIO_FRAME_RATES, [25, 30, 50, 60]);
assert.equal(VIDEO_BITRATES_KBPS[0], 500); assert.equal(VIDEO_BITRATES_KBPS.at(-1), 10000);
assert.equal(new Set(VIDEO_BITRATES_KBPS).size, VIDEO_BITRATES_KBPS.length);
for (const fps of STUDIO_FRAME_RATES) {
  const capture = studioVideoConstraints('camera-test', fps);
  assert.deepEqual(capture.width, { exact: 1920 });
  assert.deepEqual(capture.height, { exact: 1080 });
  assert.deepEqual(capture.frameRate, { ideal: fps, max: fps });
  assert.deepEqual(capture.deviceId, { exact: 'camera-test' });
  for (const bitrate of VIDEO_BITRATES_KBPS) {
    const options = studioVideoPublishOptions(bitrate, fps);
    assert.equal(options.videoEncoding.maxFramerate, capture.frameRate.max, 'capture and sender must agree');
    assert.equal(options.videoEncoding.maxBitrate, bitrate * 1000, 'UI kbit/s converts to bit/s');
    assert.equal(options.degradationPreference, 'maintain-resolution');
    assert.equal(options.simulcast, true, 'keep bandwidth adaptation');
  }
}
assert.equal(MAX_GUEST_VIDEO_BITRATE, 10000 * 1000);
assert.equal(studioVideoConstraints('', 60).deviceId, undefined);
for (const invalid of [0, 499, 10001, NaN, Infinity]) assert.throws(() => studioVideoPublishOptions(invalid, 30));
assert.throws(() => studioVideoPublishOptions(4000, 24));
console.log('PASS: 25/30/50/60 FPS capture and encoding, 500–10000 kbit/s, guest ceiling, bounds');
