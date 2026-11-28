'use strict';

const path = require('node:path');
const { realpathSync } = require('node:fs');

// Public NDI SDK C ABI only; the proprietary runtime is installed separately.
// https://docs.ndi.video/all/developing-with-ndi/sdk/frame-types
// https://docs.ndi.video/all/developing-with-ndi/sdk/ndi-send
const SYNTHESIZE_TIMECODE = 9223372036854775807n;
const runtimes = new Map();

function failure(code, cause) {
  return Object.assign(new Error(code, cause ? { cause } : undefined), { code });
}

// https://docs.ndi.video/all/developing-with-ndi/sdk/dynamic-loading-of-ndi-libraries
function runtimeCandidates(libraryPath) {
  if (libraryPath !== undefined && libraryPath !== '') {
    if (typeof libraryPath !== 'string' || !path.isAbsolute(libraryPath) || libraryPath.includes('\0')) {
      throw failure('NDI_LIBRARY_PATH');
    }
    return [libraryPath];
  }
  const filename = process.platform === 'win32' ? 'Processing.NDI.Lib.x64.dll'
    : process.platform === 'darwin' ? 'libndi.dylib' : 'libndi.so.6';
  const candidates = ['NDI_RUNTIME_DIR_V6', 'NDI_RUNTIME_DIR_V5']
    .map(key => process.env[key]).filter(value => value && path.isAbsolute(value))
    .map(directory => path.join(directory, filename));
  if (process.platform === 'win32') {
    // Use absolute installed paths; do not search the working directory for a DLL.
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    candidates.push(path.join(programFiles, 'NDI', 'NDI 6 Runtime', 'v6', filename));
    candidates.push(path.join(programFiles, 'NDI', 'NDI 6 Tools', 'Runtime', filename));
  } else {
    candidates.push(process.platform === 'darwin' ? '/usr/local/lib/libndi.dylib' : filename);
  }
  return [...new Set(candidates)];
}

function bindRuntime(koffi, library) {
  const create = koffi.struct({ p_ndi_name: 'str', p_groups: 'str', clock_video: 'bool', clock_audio: 'bool' });
  const video = koffi.struct({
    xres: 'int', yres: 'int', FourCC: 'int', frame_rate_N: 'int', frame_rate_D: 'int',
    picture_aspect_ratio: 'float', frame_format_type: 'int', timecode: 'int64_t',
    p_data: 'void *', line_stride_in_bytes: 'int', p_metadata: 'str', timestamp: 'int64_t',
  });
  const audio = koffi.struct({
    sample_rate: 'int', no_channels: 'int', no_samples: 'int', timecode: 'int64_t',
    reference_level: 'int', p_data: 'void *',
  });
  return {
    initialize: library.func('NDIlib_initialize', 'bool', []),
    destroy: library.func('NDIlib_destroy', 'void', []),
    create: library.func('NDIlib_send_create', 'void *', [koffi.pointer(create)]),
    stop: library.func('NDIlib_send_destroy', 'void', ['void *']),
    video: library.func('NDIlib_send_send_video_v2', 'void', ['void *', koffi.pointer(video)]),
    audio: library.func('NDIlib_util_send_send_audio_interleaved_16s', 'void', ['void *', koffi.pointer(audio)]),
  };
}

function acquireRuntime(libraryPath) {
  const candidates = runtimeCandidates(libraryPath);
  // Load lazily: NDI is optional and importing this module needs no native dependency.
  let koffi;
  try { koffi = require('./vmix-native-dependencies.cjs').koffi(); } catch (cause) { throw failure('NDI_BINDINGS_UNAVAILABLE', cause); }
  let lastError;
  for (const candidate of candidates) {
    let key = candidate;
    try { key = realpathSync(candidate); } catch { /* System loader may resolve a library name. */ }
    const existing = runtimes.get(key);
    if (existing) { existing.references++; return existing; }
    let library, runtime;
    try {
      library = koffi.load(candidate);
      runtime = bindRuntime(koffi, library);
    } catch (cause) {
      library?.unload();
      lastError = cause;
      continue;
    }
    let initialized;
    try { initialized = runtime.initialize(); } catch (cause) {
      library.unload();
      throw failure('NDI_INITIALIZE', cause);
    }
    if (!initialized) { library.unload(); throw failure('NDI_INITIALIZE'); }
    runtime.references = 1;
    runtime.release = () => {
      if (--runtime.references !== 0) return;
      runtimes.delete(key);
      try { runtime.destroy(); } finally { library.unload(); }
    };
    runtimes.set(key, runtime);
    return runtime;
  }
  throw failure('NDI_RUNTIME_UNAVAILABLE', lastError);
}

async function startNdiOutput({ libraryPath, name, width, height, fps } = {}) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 4096 && value % 2 === 0) ||
      !Number.isInteger(fps) || fps < 1 || fps > 120) throw failure('NDI_ENCODING');
  if (typeof name !== 'string' || !name.trim() || name.length > 253 || /[\u0000-\u001f\u007f\\/:*?"<>|]/u.test(name)) {
    throw failure('NDI_NAME');
  }
  const runtime = acquireRuntime(libraryPath);
  let sender;
  try {
    // The slot scheduler supplies timing; native clocks must not wait on the Electron thread.
    sender = runtime.create({ p_ndi_name: name, p_groups: null, clock_video: false, clock_audio: false });
    if (!sender) throw failure('NDI_SENDER_UNAVAILABLE');
  } catch (cause) {
    runtime.release();
    throw failure('NDI_SENDER_UNAVAILABLE', cause);
  }
  let stopped = false;
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  function finish(code) {
    if (stopped) return;
    stopped = true;
    try { runtime.stop(sender); } catch { code = 1; }
    try { runtime.release(); } catch { code = 1; }
    resolveClosed({ code, signal: null });
  }
  return {
    closed,
    writeVideo(frame) {
      if (stopped || !Buffer.isBuffer(frame) || frame.length !== width * height * 3 / 2) return false;
      // Synchronous sending consumes the buffer before returning; no retained JS pointers.
      try { runtime.video(sender, {
        xres: width, yres: height, FourCC: 0x30323449, frame_rate_N: fps, frame_rate_D: 1,
        picture_aspect_ratio: width / height, frame_format_type: 1, timecode: SYNTHESIZE_TIMECODE,
        p_data: frame, line_stride_in_bytes: width, p_metadata: null, timestamp: 0,
      }); } catch { finish(1); return false; }
      return true;
    },
    writeAudio(frame) {
      // Bound one packet to one second of 48 kHz stereo and require complete sample pairs.
      if (stopped || !Buffer.isBuffer(frame) || !frame.length || frame.length % 4 || frame.length > 192_000) return false;
      try { runtime.audio(sender, {
        sample_rate: 48_000, no_channels: 2, no_samples: frame.length / 4,
        timecode: SYNTHESIZE_TIMECODE, reference_level: 0, p_data: frame,
      }); } catch { finish(1); return false; }
      return true;
    },
    async stop() {
      finish(0);
      await closed;
    },
  };
}

module.exports = { startNdiOutput };
