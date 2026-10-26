const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const helper = require('../lib/video-quality.ts');

assert.deepEqual(helper.VIDEO_BITRATES_KBPS, [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.equal(helper.DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, 10000);
assert.equal(helper.DEFAULT_STUDIO_VIDEO_CODEC, 'h264');
assert.equal(helper.DEFAULT_GUEST_VIDEO_BITRATE_KBPS, 4000);
for (const metadata of [undefined, '{}', 'broken', 'null', '[]', '{"videoHeight":"720"}', '{"videoHeight":480}', '{"videoHeight":null}']) assert.equal(helper.guestCameraHeight(metadata), 1080);
for (const height of [720, 1080]) assert.equal(helper.guestCameraHeight(JSON.stringify({ videoHeight: height })), height);
assert.equal(helper.isValidStudioVideoBitrateKbps(12000), true);
assert.equal(helper.isValidStudioVideoBitrateKbps(25001), false);
assert.deepEqual(helper.videoBitrateOptions(750), [500, 750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.deepEqual(helper.videoBitrateOptions(1500), [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]);
assert.deepEqual(helper.videoBitrateOptions(12000), helper.VIDEO_BITRATES_KBPS);

assert.deepEqual(helper.studioVideoBitrateOptions().slice(-3), [16000,20000,25000]);
assert.equal(helper.studioVideoPublishOptions(25000,60,'h264',false).videoCodec,'h264');
assert.equal(helper.studioVideoPublishOptions(25000,60,'h264',false).simulcast,false);
assert.equal(helper.studioVideoPublishOptions(12000,60).videoCodec,'h264');
assert.equal(helper.studioVideoPublishOptions(12000,60).simulcast,true);
assert.equal(helper.studioVideoPublishOptions(12000,60).scalabilityMode,undefined);
assert.equal(helper.isStudioVideoCodec('av1'), true);
assert.equal(helper.isStudioVideoCodec('h265'), true);
const hevc = helper.studioVideoPublishOptions(10000, 50, 'h265', false);
assert.equal(hevc.videoCodec, 'h265');
assert.equal(hevc.backupCodec, false, 'explicit H265 never silently publishes another codec');
assert.equal(hevc.scalabilityMode, undefined);
assert.equal(hevc.simulcast, false);
for (const layered of [false, true]) {
  const av1 = helper.studioVideoPublishOptions(25000, 60, 'av1', layered);
  assert.equal(av1.videoCodec, 'av1');
  assert.equal(av1.simulcast, false, 'AV1 uses one SVC encoder, not independent simulcast encoders');
  assert.equal(av1.scalabilityMode, layered ? 'L3T3_KEY' : 'L1T3');
  assert.equal(av1.backupCodec, false, 'explicit AV1 must not publish a hidden VP8 fallback');
  assert.equal(av1.videoEncoding.maxBitrate, 25000000);
}
assert.throws(()=>helper.studioVideoPublishOptions(25000,60,'bogus',false), /кодек/);
assert.equal(helper.isValidGuestVideoBitrateKbps(16000),false);
for (const metadata of [undefined, '{}', 'invalid', '{"videoMaxBitrateKbps":16000}']) assert.equal(helper.guestVideoBitrate(metadata),4000);
for (const bitrate of [500, 1500, 2500, 12000]) assert.equal(helper.guestVideoBitrate(JSON.stringify({videoMaxBitrateKbps:bitrate})),bitrate,'stored guest limits remain unchanged');
assert.equal(helper.defaultGuestVideoCodec(),'vp8','unknown capabilities retain the compatible legacy fallback');
global.RTCRtpSender={getCapabilities:()=>({codecs:[{mimeType:'video/VP8'}]})};
assert.equal(helper.defaultGuestVideoCodec(),'vp8');
assert.doesNotThrow(()=>helper.assertStudioVideoCodecSupported('vp8'));
assert.throws(()=>helper.assertStudioVideoCodecSupported('h264'),/H264/);
global.RTCRtpSender.getCapabilities=()=>({codecs:[{mimeType:'video/H264'}]});
assert.equal(helper.defaultGuestVideoCodec(),'h264');
assert.doesNotThrow(()=>helper.assertStudioVideoCodecSupported('h264'));
assert.throws(()=>helper.assertPublishedStudioVideoCodec({codec:'vp8'},'h264'),/H264/);
assert.doesNotThrow(()=>helper.assertPublishedStudioVideoCodec({codec:'h264'},'h264'));
assert.throws(()=>helper.assertStudioVideoCodecSupported('av1'),/AV1/);
global.RTCRtpSender.getCapabilities=()=>({codecs:[{mimeType:'video/H265'}]});
assert.deepEqual(helper.supportedStudioVideoCodecs(),['h265']);
assert.deepEqual(helper.reportedStudioVideoCodecs({supportedVideoCodecs:['h264']}),['h264'],'local H265 support cannot enable it for a remote H264-only sender');
for(const actual of [undefined,null,{}, {supportedVideoCodecs:'h265'}]) assert.deepEqual(helper.reportedStudioVideoCodecs(actual),[]);
assert.deepEqual(helper.reportedStudioVideoCodecs({supportedVideoCodecs:['h265','bogus']}),['h265']);
assert.doesNotThrow(()=>helper.assertStudioVideoCodecSupported('h265'));
assert.doesNotThrow(()=>helper.assertPublishedStudioVideoCodec({codec:'h265'},'h265'));
assert.throws(()=>helper.assertPublishedStudioVideoCodec({codec:'h264'},'h265'),/H265/);
global.RTCRtpSender.getCapabilities=()=>({codecs:[{mimeType:'video/AV1'}]});
assert.throws(()=>helper.assertStudioVideoCodecSupported('h265'),/H265/);
assert.equal(helper.defaultGuestVideoCodec(),'av1');
global.RTCRtpSender.getCapabilities=()=>({codecs:['VP8','H264','AV1'].map(codec=>({mimeType:`video/${codec}`}))});
assert.equal(helper.defaultGuestVideoCodec(),'h264','H264 is preferred regardless of capability order');
assert.doesNotThrow(()=>helper.assertStudioVideoCodecSupported('av1'));
assert.throws(()=>helper.assertPublishedStudioVideoCodec({codec:'vp8'},'av1'),/AV1/);
assert.doesNotThrow(()=>helper.assertPublishedStudioVideoCodec({codec:'av1'},'av1'));

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
// LiveKit's legacy SVC shape stores the inclusive total on the first encoding.
const legacySvc = [
  { rid: 'f', maxBitrate: 12_000_000, scalabilityMode: 'L3T3_KEY' },
  { rid: 'h', maxBitrate: 4_000_000 },
  { rid: 'q', maxBitrate: 12_000_000 / 9 },
];
const cappedSvc = helper.capStudioVideoEncodings(legacySvc, 25000, 60);
assert.equal(cappedSvc[0].maxBitrate, 25_000_000, 'inclusive SVC ceiling must not shrink by summing nested layers');
assert.equal(cappedSvc[1].maxBitrate, Math.floor(25_000_000 / 3));
assert.equal(cappedSvc[2].maxBitrate, Math.floor(25_000_000 / 9));
assert.equal(helper.studioVideoEncodingsMatch(cappedSvc, 25000, 60), true);
assert.equal(helper.studioVideoEncodingsMatch(cappedSvc, 20000, 60), false);
assert.equal(helper.studioVideoEncodingsMatch(cappedSvc.map((e, i) => i === 1 ? { ...e, maxFramerate: 30 } : e), 25000, 60), false);
const svcBack = helper.capStudioVideoEncodings(cappedSvc, 20000, 50);
assert.equal(svcBack[0].maxBitrate, 20_000_000);
assert.equal(helper.studioVideoEncodingsMatch(svcBack, 20000, 50), true);
const ridSvc = helper.capStudioVideoEncodings([
  { rid: 'q', maxBitrate: 1_000_000, scalabilityMode: 'L1T3', scaleResolutionDownBy: 4 },
  { rid: 'h', maxBitrate: 3_000_000, scalabilityMode: 'L1T3', scaleResolutionDownBy: 2 },
  { rid: 'f', maxBitrate: 8_000_000, scalabilityMode: 'L1T3', scaleResolutionDownBy: 1 },
], 25000, 60);
assert.equal(ridSvc.reduce((sum, e) => sum + e.maxBitrate, 0), 25_000_000, 'RID SVC-capable simulcast remains independent aggregate streams');
assert.equal(helper.studioVideoEncodingsMatch(ridSvc, 25000, 60), true);
assert.throws(() => helper.capStudioVideoEncodings([{ maxBitrate: 1 }], 100, 30), /Некорректный битрейт/);
assert.equal(helper.studioVideoPublishOptions(12000, 60).videoEncoding.maxBitrate, 12_000_000);
assert.throws(() => helper.studioVideoPublishOptions(25001, 60), /Некорректный битрейт/);
const maxEncodings = helper.capStudioVideoEncodings([{ rid: 'f', maxBitrate: 1_000_000 }, { rid: 'h', maxBitrate: 500_000 }], 12000, 60);
assert.equal(maxEncodings.reduce((sum, encoding) => sum + encoding.maxBitrate, 0), 12_000_000);
assert.throws(() => helper.capStudioVideoEncodings([{ maxBitrate: 1 }], 25001, 60), /Некорректный битрейт/);

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
