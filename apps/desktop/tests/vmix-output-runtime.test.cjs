'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { startVmixSlot } = require('../src/vmix-output-runtime.cjs');

test('receiver can reconnect to the same slot and the media feed survives the replacement sink', async () => {
  const sinks = [];
  const states = [];
  let refreshes = 0;
  const slot = await startVmixSlot({ mode: 'srt', link: {}, width: 4, height: 4, fps: 30, onState: state => states.push(state),
    retryMs: 10, pollMs: 10,
    createOutput: async () => {
      let disconnect;
      const sink = { frames: 0, closed: new Promise(resolve => { disconnect = resolve; }),
        stop: async () => disconnect({ code: 0 }), disconnect: () => disconnect({ code: 1 }),
        writeAudio() {}, writeVideo() { sink.frames++; return true; } };
      sinks.push(sink);
      return sink;
    }, createSource: ({ onState }) => ({ async refresh() { refreshes++; onState('source'); }, async stop() {} }),
  });
  try {
    sinks[0].disconnect();
    await new Promise(resolve => setTimeout(resolve, 170));
    assert.ok(sinks[1]?.frames > 0);
    assert.ok(refreshes > 1);
    assert.ok(states.includes('restarting'));
  } finally { await slot.stop(); }
});
