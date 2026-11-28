'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSlotFrames } = require('../src/vmix-slot-frames.cjs');

test('unassigning one output clears its old picture and audio while its sink stays active', () => {
  const delivered = [];
  const other = [];
  const a = createSlotFrames({ width: 4, height: 4, fps: 30, sink: {
    writeVideo: frame => delivered.push([...frame]), writeAudio: frame => delivered.push([...frame]),
  } });
  const b = createSlotFrames({ width: 4, height: 4, fps: 30, sink: {
    writeVideo: frame => other.push(frame[0]), writeAudio() {},
  } });
  a.video({ width: 4, height: 4, data: Buffer.alloc(24, 75) });
  a.audio(Buffer.alloc(6400, 7));
  b.video({ width: 4, height: 4, data: Buffer.alloc(24, 100) });
  a.write();
  b.write();
  assert.equal(delivered[0][0], 75);
  assert.equal(delivered[1][0], 7);
  a.clear();
  a.write();
  b.write();
  assert.deepEqual(delivered[2], [...Array(16).fill(16), ...Array(8).fill(128)]);
  assert.equal(delivered[3].every(value => value === 0), true);
  assert.deepEqual(other, [100, 100]);
  a.video({ width: 4, height: 4, data: Buffer.alloc(24, 95) });
  a.write();
  assert.equal(delivered[4][0], 95);
});

test('a different video size is fitted into the existing canvas and does not change the media format', () => {
  const delivered = [];
  const slot = createSlotFrames({ width: 8, height: 4, fps: 30, sink: {
    writeVideo: frame => delivered.push(Buffer.from(frame)), writeAudio() {},
  } });
  slot.video({ width: 2, height: 2, data: Buffer.from([50, 80, 90, 110, 120, 130]) });
  slot.write();
  assert.deepEqual([...delivered[0].subarray(0, 8)], [16, 16, 50, 50, 80, 80, 16, 16]);
  assert.equal(delivered[0].length, 48);
});

test('odd I420 screen dimensions replace the previous image and accept a quarter turn', () => {
  const delivered = [];
  const slot = createSlotFrames({ width: 4, height: 4, fps: 30, sink: {
    writeVideo: frame => delivered.push(Buffer.from(frame)), writeAudio() {},
  } });
  slot.video({ width: 4, height: 4, data: Buffer.alloc(24, 47) });
  slot.write();
  const odd = Buffer.alloc(43, 128);
  for (let row = 0; row < 5; row++) odd.fill(200 - row, row * 5, row * 5 + 5);
  slot.video({ width: 5, height: 5, data: odd }, 90);
  slot.write();
  assert.equal(delivered[0][0], 47);
  assert.deepEqual([...delivered[1].subarray(0, 4)], [196, 197, 198, 199]);
});
