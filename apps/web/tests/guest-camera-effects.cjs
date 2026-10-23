const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assets = path.join(__dirname, '../public/camera-effects');
const provenance = JSON.parse(fs.readFileSync(path.join(assets, 'provenance.json'), 'utf8'));
for (const asset of [...provenance.assets, provenance.model]) {
  const bytes = fs.readFileSync(path.join(assets, asset.path));
  assert.equal(bytes.length, asset.bytes, `${asset.path} required and complete`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.path} integrity`);
}
assert.equal(fs.readFileSync(path.join(assets, provenance.model.path)).subarray(4, 8).toString(), 'TFL3');
for (const required of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  assert(provenance.assets.some(asset => asset.path === `wasm/${required}`), `${required} must be included`);
}
assert(fs.readFileSync(path.join(assets, 'LICENSE'), 'utf8').includes('Apache License'));
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, f);
let supported = true, created = [], gate, failInit = false;
const processors = {
  supportsBackgroundProcessors: () => supported,
  BackgroundProcessor(options) {
    const processor = { options, async init() {}, async restart() {}, destroyed: 0, async destroy() { this.destroyed++; } };
    created.push(processor);
    return processor;
  },
};
const originalLoad = Module._load;
Module._load = function (id, ...args) { return id === '@livekit/track-processors' ? processors : originalLoad.call(this, id, ...args); };
global.Image = class { async decode() { if (this.src === 'broken') throw Error('bad image'); } };
const { RoomEvent } = require('livekit-client');
const { watchGuestCameraEffects } = require('../lib/guest-camera-effects.ts');
const { guestCameraSource } = require('../lib/guest-camera-source.ts');
const { enqueueGuestCameraTask } = require('../lib/guest-video-codec.ts');
const flush = room => enqueueGuestCameraTask(room, async () => {});
function makeTrack() {
  return {
    isMuted: false, calls: [], processor: undefined,
    getProcessor() { return this.processor; },
    async setProcessor(processor, preview) {
      this.calls.push(['set', preview]);
      if (gate) await gate;
      if (failInit) { failInit = false; throw Error('init failed'); }
      if (this.processor) await this.processor.destroy();
      this.processor = processor;
    },
    async stopProcessor() { this.calls.push(['stop']); await this.processor.destroy(); this.processor = undefined; },
  };
}
function makeRoom(off = false) {
  const room = { state: 'connected', listeners: new Map(), pub: off ? undefined : { source: 'camera', track: makeTrack() },
    on(e, fn) { const set = this.listeners.get(e) || new Set(); set.add(fn); this.listeners.set(e, set); return this; },
    off(e, fn) { this.listeners.get(e)?.delete(fn); return this; },
    emit(e, ...args) { for (const fn of this.listeners.get(e) || []) fn(...args); },
  };
  room.localParticipant = { sid: 'local', get isCameraEnabled() { return !!room.pub && !room.pub.track.isMuted; },
    getTrackPublication(source) { assert.equal(source, 'camera'); return room.pub; },
  };
  return room;
}
(async () => {
  const room = makeRoom(), errors = [], watch = watchGuestCameraEffects(room, e => errors.push(e));
  await watch.setEffect({ mode: 'blur' });
  const first = room.pub.track.processor;
  assert.equal(first.options.mode, 'background-blur');
  const source = { raw: true };
  await first.init({ track: source });
  assert.equal(guestCameraSource(room.pub.track), source);
  const replacement = { newRaw: true };
  await first.restart({ track: replacement });
  assert.equal(guestCameraSource(room.pub.track), replacement, 'restart updates raw camera source');
  assert.equal(first.options.assetPaths.modelAssetPath, '/camera-effects/selfie_segmenter.tflite');
  assert.equal(first.options.assetPaths.tasksVisionFileSet, '/camera-effects/wasm');
  assert.deepEqual(room.pub.track.calls, [['set', true]], 'sender and preview use SDK processor');
  room.emit(RoomEvent.TrackUnmuted, room.pub, room.localParticipant);
  room.emit(RoomEvent.Reconnected);
  await flush(room);
  assert.equal(room.pub.track.processor, first, 'same selection is idempotent');
  room.emit(RoomEvent.TrackUnmuted, { source: 'screen_share' }, room.localParticipant);
  room.emit(RoomEvent.TrackMuted, { source: 'camera' }, {});
  await flush(room);
  assert.equal(room.pub.track.processor, first);
  await watch.setEffect({ mode: 'image', url: 'blob:test' });
  assert.equal(first.destroyed, 1);
  const image = room.pub.track.processor;
  assert.equal(image.options.imagePath, 'blob:test');
  failInit = true;
  await assert.rejects(watch.setEffect({ mode: 'blur' }), /Не удалось/);
  assert.equal(room.pub.track.processor, image, 'SDK init failure preserves previous effect');
  assert.equal(created.at(-1).destroyed, 1, 'failed initialization releases its resources');
  await assert.rejects(watch.setEffect({ mode: 'image', url: 'broken' }), /Не удалось/);
  assert.equal(room.pub.track.processor, image);
  room.pub.track.isMuted = true;
  room.emit(RoomEvent.TrackMuted, room.pub, room.localParticipant);
  await flush(room);
  assert.equal(room.pub.track.processor, undefined, 'muted camera releases processor without capture changes');
  room.pub.track.isMuted = false;
  room.emit(RoomEvent.TrackUnmuted, room.pub, room.localParticipant);
  await flush(room);
  assert.equal(room.pub.track.processor.options.imagePath, 'blob:test', 'failed request did not change selection');
  const old = room.pub.track;
  room.pub = { source: 'camera', track: makeTrack() };
  room.emit(RoomEvent.LocalTrackPublished, room.pub, room.localParticipant);
  await flush(room);
  assert.equal(old.processor, undefined);
  assert.equal(room.pub.track.processor.options.imagePath, 'blob:test');
  await watch.setEffect({ mode: 'none' });
  assert.equal(room.pub.track.processor, undefined);
  assert.equal(guestCameraSource(room.pub.track), room.pub.track.mediaStreamTrack, 'source released with processor');
  const foreign = { async destroy() { throw Error('foreign processor touched'); } };
  room.pub.track.processor = foreign;
  await assert.rejects(watch.setEffect({ mode: 'blur' }), /другой обработчик/);
  watch.stop(); await flush(room);
  assert.equal(room.pub.track.processor, foreign);
  assert.equal([...room.listeners.values()].reduce((n, s) => n + s.size, 0), 0);
  assert.deepEqual(errors, []);

  const off = makeRoom(true), offWatch = watchGuestCameraEffects(off, e => errors.push(e));
  const count = created.length;
  await offWatch.setEffect({ mode: 'blur' });
  assert.equal(off.pub, undefined); assert.equal(created.length, count);
  off.pub = { source: 'camera', track: makeTrack() };
  off.emit(RoomEvent.LocalTrackPublished, off.pub, off.localParticipant);
  await flush(off);
  assert.equal(off.pub.track.processor.options.mode, 'background-blur');
  supported = false;
  await assert.rejects(offWatch.setEffect({ mode: 'image', url: 'blob:test' }), /не поддерживает/);
  supported = true;
  offWatch.stop(); await flush(off);

  const cancelled = makeRoom(), cancelledWatch = watchGuestCameraEffects(cancelled, e => errors.push(e));
  let unblock;
  gate = new Promise(resolve => { unblock = resolve; });
  const pending = cancelledWatch.setEffect({ mode: 'blur' });
  await new Promise(resolve => setImmediate(resolve));
  cancelledWatch.stop(); unblock(); gate = undefined;
  await pending; await flush(cancelled);
  assert.equal(cancelled.pub.track.processor, undefined, 'late initialization is cleaned up after stop');
  assert.deepEqual(errors, [], 'no callback after stop');

  const stale = makeRoom(), staleWatch = watchGuestCameraEffects(stale, e => errors.push(e));
  let unlock; const blocker = enqueueGuestCameraTask(stale, () => new Promise(resolve => { unlock = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  const a = staleWatch.setEffect({ mode: 'blur' }), b = staleWatch.setEffect({ mode: 'none' });
  unlock(); await Promise.all([blocker, a, b]);
  assert.equal(stale.pub.track.calls.length, 0, 'superseded queue task never initializes');
  staleWatch.stop(); await flush(stale);
  console.log('PASS: guest camera effects lifecycle, preview/sender, off, unsupported, errors, ownership, cancellation and queue');
})().catch(error => { console.error(error); process.exitCode = 1; });
