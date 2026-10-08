const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let slots = [], cursor = 0, effects = [], rooms = [], intervals = new Map(), viewers = 2, result;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
  useState(value) { const i = cursor++; slots[i] ||= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
  useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
};
function media() { return { readyState: 'live', stopped: 0, getConstraints: () => ({}), addEventListener() {}, removeEventListener() {}, clone: () => media(), stop() { this.stopped++; this.readyState = 'ended'; } }; }
class LocalVideoTrack { constructor(track) { this.mediaStreamTrack = track; this.simulcastCodecs = new Map(); this.counter = { streamId: 'watch-video', timestamp: 1000, bytesSent: 1000, frameWidth: 1920, frameHeight: 1080, framesPerSecond: 60 }; } async getSenderStats() { return this.pendingStats ? this.pendingStats : [this.counter]; } }
class LocalAudioTrack { constructor(track) { this.mediaStreamTrack = track; this.counter = { streamId: 'watch-audio', timestamp: 1000, bytesSent: 1000 }; } async getSenderStats() { return this.counter; } }
class Room {
  constructor() {
    rooms.push(this); this.published = []; this.unpublished = []; this.disconnected = false;
    this.localParticipant = {
      publishTrack: async (track, options) => {
        this.published.push({ track, options }); track.publishOptions = options;
        if (track instanceof LocalVideoTrack) {
          track.codec = options.videoCodec;
          track.sender = { parameters: { encodings: [{ maxBitrate: options.videoEncoding.maxBitrate, maxFramerate: options.videoEncoding.maxFramerate }] },
            getParameters() { return structuredClone(this.parameters); }, async setParameters(parameters) { this.parameters = parameters; } };
        }
      },
      unpublishTrack: async track => { this.unpublished.push(track); },
    };
  }
  on() { return this; } off() { return this; }
  async connect() {} async disconnect() { this.disconnected = true; }
}
const livekit = { Room, LocalVideoTrack, LocalAudioTrack, Track: { Source: { Camera: 'camera', Microphone: 'microphone' } }, AudioPresets: { musicHighQualityStereo: {} } };
function load(file, imports) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, require(name) { if (name in imports) return imports[name]; throw Error('Unexpected import: ' + name); },
      AbortSignal, DOMException, RTCRtpSender: { getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }] }) }, setTimeout, clearTimeout, setInterval(fn, ms) { const id = intervals.size + 1; intervals.set(id, { fn, ms }); return id; }, clearInterval(id) { intervals.delete(id); },
      fetch: async () => ({ ok: true, json: async () => ({ viewerCount: viewers, room: 'isolated-watch', token: 'qa-token' }) }),
    }, { filename: file });
  return module.exports;
}
const quality = load(require.resolve('../lib/video-quality.ts'), { 'livekit-client': livekit });
const mediaStats = load(require.resolve('../lib/media-stats.ts'), {});
const senderStats = load(require.resolve('../lib/studio-sender-stats.ts'), { './media-stats': mediaStats });
const outboundStats = load(require.resolve('../lib/studio-outbound-stats.ts'), {});
const { useStudioStreamRelay } = load(require.resolve('../lib/studio-stream-relay.ts'), { react, 'livekit-client': livekit, './livekit-url': { getLiveKitUrl: () => 'ws://qa' }, './video-quality': quality, './studio-sender-stats': senderStats, './studio-outbound-stats': outboundStats });
function render(props) { cursor = 0; effects = []; result = useStudioStreamRelay(props); for (const commit of effects) commit(); }
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
(async () => {
  const sourceVideo = media(), sourceAudio = media();
  const props = { roomName: 'qa', clientId: 'qa-client', epoch: 1, enabled: true, videoTrack: sourceVideo, audioTrack: sourceAudio, fps: 60, bitrateKbps: 20000, videoCodec: 'h264' };
  render(props); await flush();
  assert.equal(rooms.length, 1); const relay = rooms[0]; assert.equal(relay.published.length, 2);
  render(props); assert.equal(result.active, true, 'watch publication reports its own active state');
  const publication = relay.published.find(item => item.track instanceof LocalVideoTrack);
  assert.equal(publication.options.simulcast, false, 'watch uses one full-quality encoding');
  assert.equal(publication.options.videoCodec, 'h264', 'watch uses the studio-selected codec');
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 20_000_000);
  render({ ...props, bitrateKbps: 25000 }); await flush();
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 25_000_000);
  render({ ...props, fps: 30, bitrateKbps: 6000 }); await flush();
  assert.equal(rooms.length, 1, 'live quality changes must not create another room connection');
  assert.equal(relay.unpublished.length, 0, 'live quality changes must not unpublish media');
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 6_000_000);
  assert.equal(publication.track.sender.getParameters().encodings[0].maxFramerate, 30);
  publication.track.sender.parameters.encodings[0].maxBitrate = 12_000_000;
  await [...intervals.values()].find(timer => timer.ms === 5000).fn(); await flush();
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 6_000_000, 'SDK changes are reconciled with the shared limit');
  const sampleTick = () => [...intervals.values()].find(timer => timer.ms === 2000).fn();
  await sampleTick(); await flush();
  publication.track.counter = { ...publication.track.counter, timestamp: 3000, bytesSent: 1_651_000 };
  const audioPublication = relay.published.find(item => item.track instanceof LocalAudioTrack);
  audioPublication.track.counter = { ...audioPublication.track.counter, timestamp: 3000, bytesSent: 33_000 };
  await sampleTick(); await flush(); render({ ...props, fps: 30, bitrateKbps: 6000 });
  assert.equal(result.outbound.videoKbps, 6600, 'graph uses measured watch traffic, not its configured 6000 cap');
  assert.equal(result.outbound.audioKbps, 128); assert.equal(result.outbound.videoHistory.join(','), '6600');
  assert.equal(rooms.length, 1, 'stats polling must not reconnect or republish');
  const measuredAt = result.outbound.measuredAt;
  await sampleTick(); await flush(); render({ ...props, fps: 30, bitrateKbps: 6000 });
  assert.equal(result.outbound.measuredAt, measuredAt, 'cached counters do not create a fresh zero');
  let lateStats;
  publication.track.pendingStats = new Promise(resolve => { lateStats = resolve; });
  void sampleTick(); await flush();
  viewers = 0; await [...intervals.values()].find(timer => timer.ms === 5000).fn(); await flush();
  render({ ...props, fps: 30, bitrateKbps: 6000 });
  assert.equal(result.outbound, null); assert.equal(result.active, false);
  lateStats([{ ...publication.track.counter, timestamp: 5000, bytesSent: 3_301_000 }]); await flush();
  render({ ...props, fps: 30, bitrateKbps: 6000 });
  assert.equal(result.outbound, null, 'late sender response cannot revive a stopped relay');
  assert.equal(relay.disconnected, true); assert.equal(relay.unpublished.length, 2);
  assert.equal(sourceVideo.readyState, 'live'); assert.equal(sourceAudio.readyState, 'live');
  // Replacing the owning source retires the previous sampler, including an in-flight response.
  viewers = 2; render({ ...props, fps: 30, bitrateKbps: 6000 });
  await [...intervals.values()].find(timer => timer.ms === 5000).fn(); await flush();
  const second = rooms[1], secondVideo = second.published.find(item => item.track instanceof LocalVideoTrack).track;
  let retiredStats; secondVideo.pendingStats = new Promise(resolve => { retiredStats = resolve; });
  void sampleTick(); await flush();
  const replacement = { ...props, videoTrack: media(), audioTrack: media() };
  render(replacement); await flush();
  assert.equal(second.disconnected, true); assert.equal(rooms.length, 3);
  retiredStats([{ ...secondVideo.counter, timestamp: 3000, bytesSent: 9_000_000 }]); await flush();
  render(replacement); assert.equal(result.outbound, null, 'old source response cannot populate new source history');
  const third = rooms[2], thirdVideo = third.published.find(item => item.track instanceof LocalVideoTrack).track;
  thirdVideo.counter = { ...thirdVideo.counter, timestamp: 3000, bytesSent: 501_000 };
  await sampleTick(); await flush(); render(replacement);
  assert.equal(result.outbound.videoKbps, 2000); assert.equal(result.outbound.videoHistory.join(','), '2000');
  // Unexpected collection errors also leave the measured sample unchanged and never reject the timer.
  const originalGet = thirdVideo.getSenderStats;
  Object.defineProperty(thirdVideo, 'getSenderStats', { configurable: true, get() { throw Error('stats getter unavailable'); } });
  await sampleTick(); await flush(); render(replacement);
  assert.equal(result.outbound.videoKbps, 2000);
  Object.defineProperty(thirdVideo, 'getSenderStats', { configurable: true, value: originalGet });
  let disposedStats; thirdVideo.pendingStats = new Promise(resolve => { disposedStats = resolve; });
  void sampleTick(); await flush();
  for (const slot of slots) slot?.cleanup?.(); await flush();
  disposedStats([{ ...thirdVideo.counter, timestamp: 5000, bytesSent: 9_000_000 }]); await flush();
  assert.equal(intervals.size, 0, 'dispose removes both timers');
  assert.equal(sourceVideo.readyState, 'live'); assert.equal(sourceAudio.readyState, 'live');
  console.log('PASS: measured watch video/audio, cached and late-response guards; H264 watch relay 20000→25000→6000 live cap/FPS, single stream, no reconnect/unpublish on quality change, reconciliation, viewer-zero cleanup preserves main sources');
})().catch(error => { console.error(error); process.exitCode = 1; });
