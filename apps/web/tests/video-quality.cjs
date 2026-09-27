const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const helper = require('../lib/video-quality.ts');

assert.deepEqual(helper.VIDEO_BITRATES_KBPS, [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.equal(helper.DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, 12000);
assert.equal(helper.isValidStudioVideoBitrateKbps(12000), true);
assert.equal(helper.isValidStudioVideoBitrateKbps(13000), false);
assert.deepEqual(helper.videoBitrateOptions(750), [500, 750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.deepEqual(helper.videoBitrateOptions(1500), [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.deepEqual(helper.videoBitrateOptions(12000), helper.VIDEO_BITRATES_KBPS);

const balanced = helper.capStudioVideoEncodings([
  { rid: 'f', maxBitrate: 1_800_000 },
  { rid: 'q', maxBitrate: 300_000 },
  { rid: 'h', maxBitrate: 900_000 },
], 1200, 50);
assert.equal(balanced.reduce((sum, encoding) => sum + encoding.maxBitrate, 0), 1_200_000);
assert.deepEqual(balanced.map(encoding => encoding.maxFramerate), [50, 50, 50]);
assert.equal(balanced.map(encoding => encoding.maxBitrate).join(','), '720000,120000,360000');
assert.equal(helper.studioVideoEncodingsMatch(balanced, 1200, 50), true);
assert.equal(helper.studioVideoEncodingsMatch(balanced, 1000, 50), false);
assert.throws(() => helper.capStudioVideoEncodings([{ maxBitrate: 1 }], 100, 30), /Некорректный битрейт/);
assert.equal(helper.studioVideoPublishOptions(12000, 60).videoEncoding.maxBitrate, 12_000_000);
assert.throws(() => helper.studioVideoPublishOptions(13000, 60), /Некорректный битрейт/);
const maxEncodings = helper.capStudioVideoEncodings([{ rid: 'f', maxBitrate: 1_000_000 }, { rid: 'h', maxBitrate: 500_000 }], 12000, 60);
assert.equal(maxEncodings.reduce((sum, encoding) => sum + encoding.maxBitrate, 0), 12_000_000);
assert.throws(() => helper.capStudioVideoEncodings([{ maxBitrate: 1 }], 13000, 60), /Некорректный битрейт/);

(async () => {
  let parameters = { encodings: [{ rid: 'q', maxBitrate: 200_000 }, { rid: 'f', maxBitrate: 800_000 }] };
  let attempts = 0;
  const sender = {
    getParameters: () => structuredClone(parameters),
    setParameters: async next => {
      attempts++;
      if (attempts === 1) throw new DOMException('transceiver changed', 'InvalidModificationError');
      parameters = next;
    },
  };
  await helper.applyStudioSenderQuality(sender, 500, 25);
  assert.equal(attempts, 2, 'retries with fresh sender parameters after a LiveKit race');
  assert.equal(helper.studioVideoEncodingsMatch(parameters.encodings, 500, 25), true);
  console.log('studio video quality caps and sender retries passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
