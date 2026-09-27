const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let slots = [], cursor = 0, effects = [], rooms = [], intervals = new Map(), viewers = 2;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
  useState(value) { const i = cursor++; slots[i] ||= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
  useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
};
function media() { return { readyState: 'live', stopped: 0, getConstraints: () => ({}), addEventListener() {}, removeEventListener() {}, clone: () => media(), stop() { this.stopped++; this.readyState = 'ended'; } }; }
class LocalVideoTrack { constructor(track) { this.mediaStreamTrack = track; this.simulcastCodecs = new Map(); } }
class LocalAudioTrack { constructor(track) { this.mediaStreamTrack = track; } }
class Room {
  constructor() {
    rooms.push(this); this.published = []; this.unpublished = []; this.disconnected = false;
    this.localParticipant = {
      publishTrack: async (track, options) => {
        this.published.push({ track, options }); track.publishOptions = options;
        if (track instanceof LocalVideoTrack) {
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
      AbortSignal, DOMException, setInterval(fn) { const id = intervals.size + 1; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); },
      fetch: async () => ({ ok: true, json: async () => ({ viewerCount: viewers, room: 'isolated-watch', token: 'qa-token' }) }),
    }, { filename: file });
  return module.exports;
}
const quality = load(require.resolve('../lib/video-quality.ts'), { 'livekit-client': livekit });
const { useStudioStreamRelay } = load(require.resolve('../lib/studio-stream-relay.ts'), { react, 'livekit-client': livekit, './livekit-url': { getLiveKitUrl: () => 'ws://qa' }, './video-quality': quality });
function render(props) { cursor = 0; effects = []; useStudioStreamRelay(props); for (const commit of effects) commit(); }
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
(async () => {
  const sourceVideo = media(), sourceAudio = media();
  const props = { roomName: 'qa', clientId: 'qa-client', epoch: 1, enabled: true, videoTrack: sourceVideo, audioTrack: sourceAudio, fps: 60, bitrateKbps: 12000 };
  render(props); await flush();
  assert.equal(rooms.length, 1); const relay = rooms[0]; assert.equal(relay.published.length, 2);
  const publication = relay.published.find(item => item.track instanceof LocalVideoTrack);
  assert.equal(publication.options.simulcast, false, 'watch uses one full-quality encoding');
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 12_000_000);
  render({ ...props, fps: 30, bitrateKbps: 6000 }); await flush();
  assert.equal(rooms.length, 1, 'live quality changes must not create another room connection');
  assert.equal(relay.unpublished.length, 0, 'live quality changes must not unpublish media');
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 6_000_000);
  assert.equal(publication.track.sender.getParameters().encodings[0].maxFramerate, 30);
  publication.track.sender.parameters.encodings[0].maxBitrate = 12_000_000;
  await [...intervals.values()][0](); await flush();
  assert.equal(publication.track.sender.getParameters().encodings[0].maxBitrate, 6_000_000, 'SDK changes are reconciled with the shared limit');
  viewers = 0; await [...intervals.values()][0](); await flush();
  assert.equal(relay.disconnected, true); assert.equal(relay.unpublished.length, 2);
  assert.equal(sourceVideo.readyState, 'live'); assert.equal(sourceAudio.readyState, 'live');
  for (const slot of slots) slot?.cleanup?.(); await flush();
  console.log('PASS: watch relay 12000→6000 live cap/FPS, no reconnect/unpublish on quality change, reconciliation, viewer-zero cleanup preserves main sources');
})().catch(error => { console.error(error); process.exitCode = 1; });
