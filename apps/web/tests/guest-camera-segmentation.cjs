const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const processors = require('@livekit/track-processors');
assert.equal(require('@livekit/track-processors/package.json').version, '0.8.2', 'review mask reuse against the pinned transformer when upgrading');
const originalPerformance = global.performance, originalVideoFrame = global.VideoFrame;
let now = 0, current;
global.performance = { now: () => now };
global.VideoFrame = class {
  constructor(source, options = {}) { this.timestamp = options.timestamp ?? source.timestamp; this.codedWidth = this.displayWidth = 640; this.codedHeight = this.displayHeight = 360; this.closed = false; }
  close() { this.closed = true; }
};
const room = { state: 'connected', on() {}, off() {} };
const source = { readyState: 'live', getConstraints: () => ({}) };
room.localParticipant = { sid: 'SID', isCameraEnabled: true, getTrackPublication: () => ({ track: current }) };
function makeProcessor() {
  const transformer = new processors.BackgroundTransformer({ blurRadius: 10 });
  const stats = { inferences: 0, composites: 0, maskUpdates: 0, closedMasks: 0, outputs: [] };
  transformer.isFirstFrame = false;
  const processor = {
    transformer, stats, processedTrack: {},
    async init() {
      transformer.canvas = {};
      transformer.gl = { renderFrame() { stats.composites++; now += 2; }, updateMask() { stats.maskUpdates++; } };
      transformer.imageSegmenter = { segmentForVideo(frame, timestamp, callback) {
        stats.inferences++; now += 80;
        callback({ categoryMask: { getAsWebGLTexture: () => ({}) }, close() { stats.closedMasks++; } });
      } };
    }, async restart(options) { await this.init(options); }, async destroy() {},
  };
  return processor;
}
const { watchGuestCameraEffects } = load('../lib/guest-camera-effects.ts', {
  '@livekit/track-processors': { ...processors, supportsBackgroundProcessors: () => true, BackgroundProcessor: makeProcessor },
  './guest-video-codec': { enqueueGuestCameraTask: (_room, task) => Promise.resolve().then(task) },
  './guest-camera-source': { guestCameraSource: () => source, rememberGuestCameraSource() {}, forgetGuestCameraSource() {} },
});
function makeTrack() {
  return { isMuted: false, mediaStreamTrack: source, getProcessor() { return this.processor; },
    async setProcessor(processor) { await processor.init({ track: source }); this.processor = processor; },
    async stopProcessor() { this.processor = undefined; },
  };
}
async function run(processor) {
  now = 0;
  const frames = [];
  for (let i = 0; i < 120; i++) {
    now = Math.max(now, i * 1000 / 30);
    const frame = new VideoFrame({}, { timestamp: 1 + i * 1e6 / 30 }); frames.push(frame);
    await processor.transformer.transform(frame, { enqueue(output) { processor.stats.outputs.push(output.timestamp); output.close(); } });
  }
  assert(frames.every(frame => frame.closed), 'every input frame is released');
  assert.equal(processor.stats.composites, 120, 'all source frames reach the real upstream compositor');
  assert.deepEqual(processor.stats.outputs, frames.map(frame => frame.timestamp), 'output preserves each frame and its source timestamp');
  assert.equal(processor.stats.inferences, processor.stats.maskUpdates, 'only fresh masks replace the retained WebGL mask');
  assert.equal(processor.stats.inferences, processor.stats.closedMasks, 'all inference results release GPU masks');
  return { ...processor.stats, elapsedMs: now };
}
(async () => {
  try {
    const baseline = makeProcessor(); await baseline.init();
    const before = await run(baseline);
    current = makeTrack();
    const watcher = watchGuestCameraEffects(room, error => { throw Error(error); });
    await watcher.setEffect({ mode: 'blur' });
    const after = await run(current.processor);
    assert(after.inferences < before.inferences / 2, 'expensive inference must yield time to received video and UI');
    assert(after.elapsedMs < before.elapsedMs / 2, 'bounded inference avoids accumulating simulated source delay');
    assert(after.inferences > 1, 'the contour keeps refreshing');
    const firstSegmenter = current.processor.transformer.imageSegmenter;
    await current.processor.restart({ track: source });
    assert.notEqual(current.processor.transformer.imageSegmenter, firstSegmenter);
    const restarted = current.processor;
    restarted.stats.inferences = restarted.stats.composites = restarted.stats.maskUpdates = restarted.stats.closedMasks = 0; restarted.stats.outputs = [];
    const again = await run(restarted);
    assert(again.inferences < before.inferences / 2, 'camera restart installs pacing on the replacement segmenter');
    watcher.stop();
    console.log(`PASS pinned0.8.2 real transformer:120/120 composites, simulated80ms inference before=${before.inferences}/${before.elapsedMs.toFixed(0)}ms after=${after.inferences}/${after.elapsedMs.toFixed(0)}ms; mask reuse, timestamps, close and restart`);
  } finally { global.performance = originalPerformance; global.VideoFrame = originalVideoFrame; }
})().catch(error => { console.error(error); process.exitCode = 1; });
