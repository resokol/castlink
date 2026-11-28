'use strict';

const path = require('node:path');

// The native API and layout are defined in the MIT-licensed official header:
// https://github.com/openmediatransport/libomt/blob/master/libomt.h
// NativeAOT libomt owns process-wide discovery threads: keep loaded libraries
// alive across slot restarts, and never call omt_shutdown for an individual slot.
const runtimes = new Map();

function invoke(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn.async(...args, (error, result) => { if (error) reject(error); else resolve(result); });
  });
}

function loadRuntime(libraryPath) {
  if (runtimes.has(libraryPath)) return runtimes.get(libraryPath);
  try {
    // Optional: importing the adapter does not load Koffi or any native SDK.
    const koffi = require('./vmix-native-dependencies.cjs').koffi();
    const frame = koffi.struct({
      Type: 'int', Timestamp: 'int64_t', Codec: 'int',
      Width: 'int', Height: 'int', Stride: 'int', Flags: 'int',
      FrameRateN: 'int', FrameRateD: 'int', AspectRatio: 'float', ColorSpace: 'int',
      SampleRate: 'int', Channels: 'int', SamplesPerChannel: 'int',
      Data: 'void *', DataLength: 'int', CompressedData: 'void *', CompressedLength: 'int',
      FrameMetadata: 'void *', FrameMetadataLength: 'int',
    });
    const library = koffi.load(libraryPath);
    const runtime = {
      library,
      create: library.func('omt_send_create', 'void *', ['str', 'int']),
      send: library.func('omt_send', 'int', ['void *', koffi.pointer(frame)]),
      destroy: library.func('omt_send_destroy', 'void', ['void *']),
    };
    runtimes.set(libraryPath, runtime);
    return runtime;
  } catch (cause) {
    throw new Error('OMT_RUNTIME_UNAVAILABLE', { cause });
  }
}

async function startOmtOutput({ libraryPath, name, width, height, fps } = {}) {
  if (typeof libraryPath !== 'string' || !path.isAbsolute(libraryPath) || libraryPath.includes('\0') ||
      typeof name !== 'string' || !name.trim() || name.includes('\0') || Buffer.byteLength(name, 'utf8') > 1023 ||
      ![width, height].every(value => Number.isInteger(value) && value >= 16 && value <= 4096 && value % 2 === 0) ||
      !Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('OMT_CONFIG');

  const runtime = loadRuntime(libraryPath);
  let sender;
  try { sender = await invoke(runtime.create, name, 0); }
  catch (cause) { throw new Error('OMT_SENDER_CREATE', { cause }); }
  if (!sender) throw new Error('OMT_SENDER_CREATE');

  const epoch = process.hrtime.bigint();
  const pending = new Set();
  const busy = new Set();
  let stopping = false, stopPromise, failed = false, resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const stamp = () => (process.hrtime.bigint() - epoch) / 100n; // 100ns units; caller already paces frames.
  const emptyFrame = () => ({
    Type: 0, Timestamp: 0, Codec: 0,
    Width: 0, Height: 0, Stride: 0, Flags: 0, FrameRateN: 0, FrameRateD: 0, AspectRatio: 0, ColorSpace: 0,
    SampleRate: 0, Channels: 0, SamplesPerChannel: 0,
    Data: null, DataLength: 0, CompressedData: null, CompressedLength: 0, FrameMetadata: null, FrameMetadataLength: 0,
  });

  function stop() {
    if (!stopPromise) {
      stopping = true;
      stopPromise = (async () => {
        await Promise.allSettled([...pending]);
        try { await invoke(runtime.destroy, sender); }
        catch { failed = true; }
        sender = null;
        resolveClosed({ code: failed ? 1 : 0, signal: null });
        return closed;
      })();
    }
    return stopPromise;
  }

  function send(kind, frame) {
    busy.add(kind);
    const operation = invoke(runtime.send, sender, frame)
      // A zero result is normal with no connected receivers; do not stop a
      // persistent caster slot just because vMix is not connected yet.
      .catch(() => { failed = true; queueMicrotask(() => { void stop(); }); })
      .finally(() => {
        frame.Data = null; // Hold native input memory until the async call completes.
        pending.delete(operation);
        busy.delete(kind);
      });
    pending.add(operation);
    return true;
  }

  return {
    closed,
    writeVideo(i420) {
      if (stopping || busy.has('video') || !Buffer.isBuffer(i420) || i420.length !== width * height * 3 / 2) return false;
      // OMT supports NV12. Copy Y and interleave U/V from tightly packed I420.
      // Own the bytes because callers reuse their capture buffers immediately.
      const ySize = width * height, uvSize = ySize / 4;
      const data = Buffer.allocUnsafe(i420.length);
      i420.copy(data, 0, 0, ySize);
      for (let i = 0; i < uvSize; i++) {
        data[ySize + i * 2] = i420[ySize + i];
        data[ySize + i * 2 + 1] = i420[ySize + uvSize + i];
      }
      return send('video', {
        ...emptyFrame(), Type: 2, Codec: 0x3231564e, Timestamp: stamp(),
        Width: width, Height: height, Stride: width, FrameRateN: fps, FrameRateD: 1,
        AspectRatio: width / height, ColorSpace: height < 720 ? 601 : 709,
        Data: data, DataLength: data.length,
      });
    },
    writeAudio(pcm) {
      if (stopping || busy.has('audio') || !Buffer.isBuffer(pcm) || !pcm.length || pcm.length % 4 !== 0 || pcm.length > 48000 * 4) return false;
      const samples = pcm.length / 4;
      const data = Buffer.allocUnsafe(samples * 2 * 4);
      for (let i = 0; i < samples; i++) {
        data.writeFloatLE(pcm.readInt16LE(i * 4) / 32768, i * 4);
        data.writeFloatLE(pcm.readInt16LE(i * 4 + 2) / 32768, (samples + i) * 4);
      }
      return send('audio', {
        ...emptyFrame(), Type: 4, Codec: 0x31415046, Timestamp: stamp(),
        SampleRate: 48000, Channels: 2, SamplesPerChannel: samples, Data: data, DataLength: data.length,
      });
    },
    stop,
  };
}

module.exports = { startOmtOutput };
