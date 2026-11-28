'use strict';

const { createSlotFrames } = require('./vmix-slot-frames.cjs');
const { createSlotSource } = require('./vmix-slot-source.cjs');

async function openOutput(options) {
  switch (options.mode) {
    case 'srt': return require('./vmix-srt-output.cjs').startSrtOutput(options);
    case 'ndi': return require('./vmix-ndi-output.cjs').startNdiOutput(options);
    case 'omt': return require('./vmix-omt-output.cjs').startOmtOutput(options);
    default: throw new Error('VMIX_PROTOCOL');
  }
}

async function startVmixSlot(options) {
  const { link, width, height, fps, onState, retryMs = 1000, pollMs = 1000,
    createOutput = openOutput, createSource = createSlotSource } = options;
  let current, restarting, retryTimer, pollTimer, closed = false, sourceState = 'waiting';
  const frames = createSlotFrames({ width, height, fps, sink: {
    writeVideo: frame => current?.writeVideo(frame), writeAudio: samples => current?.writeAudio(samples),
  } });
  function retryOutput() {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      restarting = attachOutput().catch(() => retryOutput());
    }, retryMs);
  }
  async function attachOutput() {
    const output = await createOutput(options);
    if (closed) { await output.stop(); return; }
    current = output;
    onState(sourceState);
    void output.closed.then(() => {
      if (current !== output) return;
      current = undefined;
      if (!closed) { onState('restarting'); retryOutput(); }
    });
  }
  await attachOutput();
  let source;
  try {
    const sdk = options.sdk || (!options.createSource && require('./vmix-native-dependencies.cjs').livekit());
    source = createSource({ sdk, link, frames, fetcher: options.fetcher, onAssignment: options.onAssignment, onState(state) {
      sourceState = state;
      if (current) onState(state);
    } });
  } catch (error) {
    closed = true;
    await current?.stop();
    clearTimeout(retryTimer);
    throw error;
  }
  const framePeriod = 1000 / fps;
  let frameTimer, deadline = performance.now() + framePeriod;
  function scheduleFrame() {
    frameTimer = setTimeout(() => {
      frames.write();
      const now = performance.now();
      deadline += framePeriod;
      if (deadline <= now) deadline += Math.ceil((now - deadline + 0.01) / framePeriod) * framePeriod;
      if (!closed) scheduleFrame();
    }, Math.ceil(deadline - performance.now()));
  }
  scheduleFrame();
  async function poll() {
    await source.refresh();
    if (!closed) pollTimer = setTimeout(poll, pollMs);
  }
  void poll();

  return {
    async stop() {
      if (closed) return;
      closed = true;
      clearTimeout(frameTimer);
      clearTimeout(pollTimer);
      clearTimeout(retryTimer);
      await Promise.all([current?.stop(), source.stop(), restarting]);
    },
  };
}

module.exports = { startVmixSlot };
