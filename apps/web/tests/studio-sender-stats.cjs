const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createStudioSenderStatsState, sampleStudioSenderStats } = require('../lib/studio-sender-stats.ts');
const counter = (id, bytes, timestamp, width = 1920, height = 1080, extra = {}) => ({ streamId: id, bytesSent: bytes, timestamp, frameWidth: width, frameHeight: height, framesPerSecond: 60, ...extra });
function source() {
  let value = [], reads = 0;
  return { track: { getSenderStats: async () => { reads++; return value; } }, set(next) { value = next; }, reads: () => reads };
}
(async () => {
  const state = createStudioSenderStatsState(), video = source(), audio = source();
  const sample = () => sampleStudioSenderStats(state, video.track, audio.track);
  video.set([counter('high', 1_000_000, 1000), counter('low', 100_000, 1000, 480, 270)]);
  audio.set(counter('audio', 1000, 500)); assert.equal(await sample(), undefined, 'first read establishes baselines without fake traffic');
  video.set([counter('high', 3_000_000, 3000), counter('low', 300_000, 3000, 480, 270)]);
  audio.set(counter('audio', 33_000, 2500));
  let result = await sample(); assert.equal(result.metrics.videoKbps, 8800, 'all current layer deltas are summed'); assert.equal(result.metrics.audioKbps, 128, 'audio uses its own timestamp');
  assert.equal(result.metrics.resolution, '1920×1080'); assert.equal(video.reads(), 2); assert.equal(audio.reads(), 2);
  assert.equal(await sample(), undefined, 'cached report is not a fresh zero');
  video.set([counter('high', 9_000_000, 2000)]); assert.equal(await sample(), undefined, 'out-of-order report cannot move baseline backwards');
  video.set([counter('high', 4_000_000, 5000)]); result = await sample(); assert.equal(result.metrics.videoKbps, 4000);
  video.set([counter('new-ssrc', 100_000_000, 7000)]); assert.equal(await sample(), undefined, 'new SSRC is baselined instead of producing a bitrate spike');
  video.set([counter('new-ssrc', 101_500_000, 9000)]); assert.equal((await sample()).metrics.videoKbps, 6000);
  video.set([counter('new-ssrc', 1000, 11000)]); assert.equal(await sample(), undefined, 'counter reset rebaselines instead of claiming zero traffic');
  video.set([counter('new-ssrc', 1_001_000, 13000)]); assert.equal((await sample()).metrics.videoKbps, 4000);
  video.set([counter('new-ssrc', 1_001_000, 15000)]); assert.equal((await sample()).metrics.videoKbps, 0, 'advanced timestamps with unchanged valid bytes are measured zero traffic');
  const replacement = source(); replacement.set([counter('new-ssrc', 999_000_000, 17000)]);
  assert.equal(await sampleStudioSenderStats(state, replacement.track, audio.track), undefined, 'replacement publication gets new baselines even when an ID is reused');
  replacement.set([counter('new-ssrc', 1_000_000_000, 19000)]); assert.equal((await sampleStudioSenderStats(state, replacement.track, audio.track)).metrics.videoKbps, 4000);
  replacement.set([{ streamId: 'bad', bytesSent: Infinity, timestamp: 21000 }]); assert.equal(await sampleStudioSenderStats(state, replacement.track, audio.track), undefined, 'invalid counters are not fresh zero');
  replacement.set([]); assert.equal(await sampleStudioSenderStats(state, replacement.track, audio.track), undefined, 'empty report is missing measurement');

  let report, rawReads = 0, sdkReads = 0;
  const rawTrack = { getSenderStats: async () => { sdkReads++; throw Error('SDK temporarily unavailable'); }, getRTCStatsReport: async () => { rawReads++; return report; } };
  const rawState = createStudioSenderStatsState();
  function raw(bytes, timestamp, frames) {
    report = new Map([
      ['v', { id: 'v', type: 'outbound-rtp', kind: 'video', bytesSent: bytes, timestamp, frameWidth: 1280, frameHeight: 720, framesEncoded: frames }],
      ['remote', { id: 'remote', type: 'outbound-rtp', kind: 'video', isRemote: true, bytesSent: 999_999_999, timestamp }],
      ['audio', { id: 'audio', type: 'outbound-rtp', kind: 'audio', bytesSent: 999_999_999, timestamp }],
      ['in', { id: 'in', type: 'inbound-rtp', kind: 'video', bytesReceived: 999_999_999, timestamp }],
    ]);
  }
  raw(1_000_000, 1_800_000_000_000, 100); assert.equal(await sampleStudioSenderStats(rawState, rawTrack, undefined), undefined);
  raw(2_000_000, 1_800_000_002_000, 220); result = await sampleStudioSenderStats(rawState, rawTrack, undefined);
  assert.equal(result.metrics.videoKbps, 4000, 'raw fallback uses the RTP clock without mixing performance.now'); assert.equal(result.metrics.fps, 60, 'missing native FPS can be measured from frames encoded'); assert.equal(result.metrics.resolution, '1280×720');
  assert.equal(rawReads, 2); assert.equal(sdkReads, 2);
  report = undefined; assert.equal(await sampleStudioSenderStats(rawState, rawTrack, undefined), undefined, 'raw report failure keeps existing measured data to age out');
  console.log('PASS: sender single reads, aggregate layer deltas, separate clocks, SSRC/publication/reset baselines, cached/invalid guards and raw fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
