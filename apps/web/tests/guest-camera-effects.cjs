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
    const processor = { options, processedTrack: { stop() {}, getConstraints() { throw Error('processed output constraints touched'); } },
      async init() {}, async restart() {}, destroyed: 0, async destroy() { this.destroyed++; } };
    created.push(processor);
    return processor;
  },
};
const originalLoad = Module._load;
Module._load = function (id, ...args) { return id === '@livekit/track-processors' ? processors : originalLoad.call(this, id, ...args); };
global.Image = class { async decode() { if (this.src === 'broken') throw Error('bad image'); } };
const { RoomEvent, LocalVideoTrack } = require('livekit-client');
const { watchGuestCameraEffects } = require('../lib/guest-camera-effects.ts');
const { guestCameraSource } = require('../lib/guest-camera-source.ts');
const { enqueueGuestCameraTask } = require('../lib/guest-video-codec.ts');
const flush = room => enqueueGuestCameraTask(room, async () => {});
const startupCapture = { height: { ideal: 1080 }, frameRate: { ideal: 30 } };
const staffCapture = { height: { ideal: 720 }, frameRate: { ideal: 25 }, resizeMode: { ideal: 'none' } };
function makeSource() {
  let constraints = structuredClone(startupCapture);
  return {
    readyState: 'live', calls: [],
    getConstraints: () => structuredClone(constraints),
    async applyConstraints(value) {
      this.calls.push(structuredClone(value));
      constraints = structuredClone(value);
      if (this.afterApply) await this.afterApply(value);
    },
  };
}
function makeTrack() {
  return {
    isMuted: false, calls: [], processor: undefined,
    _mediaStreamTrack: makeSource(), _constraints: startupCapture,
    log: { debug() {} }, emit() {}, async setMediaStreamTrack() {},
    get mediaStreamTrack() { return this.processor?.processedTrack ?? this._mediaStreamTrack; },
    getProcessor() { return this.processor; },
    async setProcessor(processor, preview) {
      this.calls.push(['set', preview]);
      if (gate) await gate;
      if (failInit) { failInit = false; throw Error('init failed'); }
      await processor.init({ track: this._mediaStreamTrack });
      if (this.processor) await LocalVideoTrack.prototype.internalStopProcessor.call(this);
      this.processor = processor;
      if (this.afterSet) await this.afterSet();
    },
    async stopProcessor() {
      this.calls.push(['stop']);
      await LocalVideoTrack.prototype.internalStopProcessor.call(this);
      if (this.afterStop) await this.afterStop();
    },
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
  const source = room.pub.track._mediaStreamTrack;
  await first.init({ track: source });
  assert.equal(guestCameraSource(room.pub.track), source);
  const replacement = makeSource();
  room.pub.track._mediaStreamTrack = replacement;
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

  // Exercise the installed SDK teardown: it reapplies startup constraints on
  // replacement and stop, even when staff changed the physical source directly.
  const capture = makeRoom(), captureWatch = watchGuestCameraEffects(capture, e => errors.push(e));
  const captureTrack = capture.pub.track, raw = captureTrack.mediaStreamTrack;
  await captureWatch.setEffect({ mode: 'blur' });
  await raw.applyConstraints(staffCapture);
  await captureWatch.setEffect({ mode: 'image', url: 'blob:test' });
  assert.deepEqual(raw.getConstraints(), staffCapture, 'replacement preserves staff physical capture constraints after SDK reset');
  await captureWatch.setEffect({ mode: 'none' });
  assert.deepEqual(raw.getConstraints(), staffCapture, 'effect off preserves staff physical capture constraints after SDK reset');
  await captureWatch.setEffect({ mode: 'blur' });
  captureTrack.afterSet = () => { captureTrack.afterSet = undefined; throw Error('sender swap failed'); };
  await assert.rejects(captureWatch.setEffect({ mode: 'image', url: 'blob:test' }), /Не удалось/);
  assert.equal(captureTrack.processor.options.mode, 'background-blur', 'failed replacement rolls back previous effect');
  assert.deepEqual(raw.getConstraints(), staffCapture, 'replacement error and rollback preserve staff physical capture constraints');
  raw.afterApply = value => {
    if (value.height?.ideal === 1080) { raw.afterApply = undefined; throw Error('SDK constraint reset failed'); }
  };
  await assert.rejects(captureWatch.setEffect({ mode: 'image', url: 'blob:test' }), /Не удалось/);
  assert.equal(captureTrack.processor.options.mode, 'background-blur', 'SDK teardown failure rolls back previous effect');
  assert.deepEqual(raw.getConstraints(), staffCapture, 'SDK teardown failure and rollback preserve staff physical capture constraints');
  captureTrack.afterStop = () => { captureTrack.afterStop = undefined; throw Error('sender restore failed'); };
  await assert.rejects(captureWatch.setEffect({ mode: 'none' }), /Не удалось/);
  assert.deepEqual(raw.getConstraints(), staffCapture, 'teardown error preserves staff physical capture constraints');
  await captureWatch.setEffect({ mode: 'blur' });
  captureWatch.stop(); await flush(capture);
  assert.deepEqual(raw.getConstraints(), staffCapture, 'watcher stop preserves staff physical capture constraints');

  for (const change of ['sid', 'source', 'foreign', 'ended']) {
    const moved = makeRoom(), movedWatch = watchGuestCameraEffects(moved, e => errors.push(e));
    const movedTrack = moved.pub.track, originalSource = movedTrack.mediaStreamTrack;
    await movedWatch.setEffect({ mode: 'blur' });
    await originalSource.applyConstraints(staffCapture);
    const newSource = makeSource();
    const foreignProcessor = { async destroy() { throw Error('foreign owner touched'); } };
    movedTrack.afterStop = () => {
      if (change === 'sid') moved.localParticipant.sid = 'new-session';
      if (change === 'source') movedTrack._mediaStreamTrack = newSource;
      if (change === 'foreign') movedTrack.processor = foreignProcessor;
      if (change === 'ended') originalSource.readyState = 'ended';
    };
    await movedWatch.setEffect({ mode: 'none' });
    assert.equal(originalSource.calls.length, 2, `${change}: obsolete capture is not restored after ownership changes`);
    assert.equal(newSource.calls.length, 0, `${change}: new physical source is untouched`);
    if (change === 'foreign') assert.equal(movedTrack.processor, foreignProcessor);
    movedWatch.stop(); await flush(moved);
  }
  console.log('PASS: guest camera effects lifecycle, preview/sender, off, unsupported, errors, ownership, cancellation and queue');
})().catch(error => { console.error(error); process.exitCode = 1; });
