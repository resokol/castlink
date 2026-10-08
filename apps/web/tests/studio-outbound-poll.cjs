const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const outbound = require('../lib/studio-outbound-stats.ts');
const { readTrackStats } = require('../lib/media-stats.ts');
const senderStats = require('../lib/studio-sender-stats.ts');
const file = require.resolve('../components/StudioWorkspace.tsx');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let refresh;
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'refresh') refresh = node.initializer.getText(source); ts.forEachChild(node, visit); }
visit(source); assert.ok(refresh, 'actual Studio refresh callback is loaded');
const code = ts.transpileModule(`const refresh = ${refresh}; module.exports = refresh;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness() {
  let videoStats = [], audioStats, videoReads = 0, audioReads = 0, failVideo = false, deferred;
  const video = { getSenderStats: async () => { videoReads++; if (failVideo) throw Error('temporary unavailable'); return deferred || videoStats; } };
  const audio = { getSenderStats: async () => { audioReads++; return audioStats; } };
  const ref = current => ({ current });
  const samples = [], history = [];
  const context = { module: { exports: {} }, readTrackStats, ...outbound, performance: { now: () => 1000 }, cancelled: false, refreshBusy: false,
    studioRoleRef: ref('primary'), onAirRef: ref(true), room: { localParticipant: { trackPublications: new Map() }, remoteParticipants: new Map() },
    returnPublicationRef: ref({ video: { track: video }, audio: { track: audio } }), returnPublishedRef: ref({ video, audio }),
    returnStreamRef: ref({ getVideoTracks: () => [{ getSettings: () => ({ width: 1920, height: 1080 }) }] }),
    Track: { Kind: { Video: 'video', Audio: 'audio' } }, ...senderStats, returnSenderStatsRef: ref(senderStats.createStudioSenderStatsState()),
    returnBitrateHistoryRef: ref(history), localOutboundRef: ref(null),
    recordReturnBitrate: value => { history.push(value); return history; }, setLocalOutboundSample: sample => samples.push(sample), setStatsDebug() {}, setGuests() {},
  };
  vm.runInNewContext(code, context);
  return { context, samples, refresh: context.module.exports, reads: () => ({ videoReads, audioReads }), set(video, audio) { videoStats = video; audioStats = audio; }, fail() { failVideo = true; }, pause() { let release; deferred = new Promise(resolve => { release = resolve; }); return () => { release(videoStats); deferred = undefined; }; } };
}
const layer = (id, width, height, bytes, timestamp, fps = 30) => ({ streamId: id, frameWidth: width, frameHeight: height, bytesSent: bytes, timestamp, framesPerSecond: fps });
(async () => {
  const h = harness();
  h.set([layer('h264-high', 1920, 1080, 10_000_000, 1000, 0), layer('h264-low', 960, 540, 1_000_000, 1000)], { streamId: 'audio', bytesSent: 1000, timestamp: 1000 });
  await h.refresh();
  h.set([layer('h264-high', 1920, 1080, 10_000_000, 3000, 0), layer('h264-low', 960, 540, 2_000_000, 3000)], { streamId: 'audio', bytesSent: 33_000, timestamp: 3000 });
  await h.refresh();
  assert.equal(h.samples.at(-1).videoKbps, 4000, 'stalled high layer must not hide the measured 4Mbps lower-layer transmission');
  assert.equal(h.samples.at(-1).resolution, '960×540', 'resolution describes the largest currently growing layer');
  assert.equal(h.samples.at(-1).audioKbps, 128);
  assert.deepEqual(h.reads(), { videoReads: 2, audioReads: 2 }, 'each sender is sampled once per collection');
  const single = harness();
  single.set([layer('h264-single', 1920, 1080, 1_000_000, 1000, 60)], undefined); await single.refresh();
  single.set([layer('h264-single', 1920, 1080, 2_500_000, 3000, 60)], undefined); await single.refresh();
  assert.equal(single.samples.at(-1).videoKbps, 6000, 'single-stream measured rate uses its actual counter, independent of desired limit');
  const before = single.samples.length; single.fail(); await single.refresh();
  assert.equal(single.samples.length, before, 'missing stats cannot manufacture a fresh zero sample');
  for (const transition of ['off-air', 'role-loss', 'reset', 'cancelled']) {
    const pending = harness();
    pending.set([layer('video', 1920, 1080, 1_000_000, 1000)], undefined); await pending.refresh();
    pending.set([layer('video', 1920, 1080, 2_000_000, 3000)], undefined);
    const release = pending.pause(), collection = pending.refresh(); await new Promise(resolve => setImmediate(resolve));
    if (transition === 'off-air') pending.context.onAirRef.current = false;
    if (transition === 'role-loss') pending.context.studioRoleRef.current = 'moderator';
    if (transition === 'reset') pending.context.returnSenderStatsRef.current = senderStats.createStudioSenderStatsState();
    if (transition === 'cancelled') pending.context.cancelled = true;
    release(); await collection;
    assert.equal(pending.samples.length, 0, `late report after ${transition} cannot update the graph`);
  }
  console.log('PASS: actual main Studio polling samples once, reports flowing H264 layers/single stream and preserves last measurement on unavailable stats');
})().catch(error => { console.error(error); process.exitCode = 1; });
