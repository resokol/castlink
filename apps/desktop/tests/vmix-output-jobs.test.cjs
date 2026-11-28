'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVmixSlotJobs } = require('../src/vmix-output-jobs.cjs');

const origin = 'https://node2.example.test';
const descriptors = [1, 2, 3].map(id => ({ id: `slot-${id}`, name: `Кастер ${id}`,
  cameraPath: `/output/slot/slot-${id}#access=fixture-camera-${id}`,
  screenPath: `/output/slot/slot-${id}?source=screen#access=fixture-screen-${id}` }));

test('one stable sender is created for each of the selected slots and source types', () => {
  const config = { mode: 'srt', srt: { mode: 'listener', address: '127.0.0.1', latencyMs: 200 },
    slots: [{ id: 'slot-1', source: 'camera', port: 9001 }, { id: 'slot-3', source: 'screen', port: 9003 }] };
  const built = buildVmixSlotJobs({ config, descriptors, origin, paths: { srt: 'ffmpeg.exe' } });
  assert.deepEqual(built.map(job => job.id), ['slot-1', 'slot-3']);
  assert.match(built[0].name, /^CastLink-[a-f0-9]{16}$/);
  assert.notEqual(built[0].name, built[1].name);
  const renamed = buildVmixSlotJobs({ config, descriptors: descriptors.map(slot => ({ ...slot, name: 'new/name' })), origin, paths: { srt: 'ffmpeg.exe' } });
  assert.deepEqual(renamed.map(job => job.name), built.map(job => job.name));
  assert.equal(built[1].link, `${origin}${descriptors[2].screenPath}`);
  assert.equal(built[0].executable, 'ffmpeg.exe');
  assert.equal(built[0].config.slots[1].port, 9003);
});

test('jobs cannot use URLs supplied outside the trusted CastLink server or a third source type', () => {
  const config = { mode: 'ndi', slots: [{ id: 'slot-1', source: 'camera' }] };
  assert.throws(() => buildVmixSlotJobs({ config, descriptors: [{ ...descriptors[0], cameraPath: `https://outside.test${descriptors[0].cameraPath}` }], origin, paths: {} }), /VMIX_SLOT_LINK/);
  assert.throws(() => buildVmixSlotJobs({ config: { ...config, slots: [{ id: 'slot-1', source: 'microphone' }] }, descriptors, origin, paths: {} }), /VMIX_SLOT/);
});
