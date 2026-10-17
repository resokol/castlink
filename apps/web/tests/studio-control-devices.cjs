const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-device-control-'));
process.env.STUDIOLINK_STUDIO_CONTROL_FILE = path.join(dir, 'control.json');
const control = require('../lib/studio-control.ts');

(async () => {
  try {
    const room = 'device-test-room';
    const { state } = await control.joinStudio(room, 'studio-device-client');
    const epoch = state.epoch;
    const devices = [
      { deviceId: 'camera-one', label: 'Camera', kind: 'videoinput' },
      { deviceId: 'microphone-one', label: 'Microphone', kind: 'audioinput' },
      { deviceId: 'output-one', label: 'Speakers', kind: 'audiooutput' },
    ];
    await control.heartbeatStudio(room, 'studio-device-client', epoch, { devices, onAir: false, airBusy: false });
    assert.ok(await control.updateStudioDesired(room, epoch, { videoDeviceId: 'camera-one' }));
    let current = await control.readStudioState(room);
    assert.equal(current.desired.videoDeviceId, 'camera-one');
    assert.equal(current.desired.deviceRevision, 1);
    assert.equal(await control.updateStudioDesired(room, epoch, { audioDeviceId: 'output-one' }), null, 'reject a device ID of the wrong kind');
    assert.equal(await control.updateStudioDesired(room, epoch, { outputDeviceId: 'missing' }), null, 'reject a device missing from the latest heartbeat');
    assert.equal(await control.updateStudioDesired(room, epoch, { audioDeviceId: null }), null, 'reject null input IDs');

    await control.updateStudioDesired(room, epoch, { onAir: true });
    await control.heartbeatStudio(room, 'studio-device-client', epoch, { devices, onAir: true, airBusy: false });
    assert.ok(await control.updateStudioDesired(room, epoch, { audioDeviceId: 'microphone-one' }), 'allow microphone replacement during stable live broadcast');
    assert.ok(await control.updateStudioDesired(room, epoch, { videoDeviceId: 'camera-one' }), 'allow camera replacement during stable live broadcast');
    assert.equal((await control.readStudioState(room)).desired.onAir, true, 'device replacement preserves broadcast intent');
    assert.equal(await control.updateStudioDesired(room, epoch, { audioDeviceId: 'camera-one' }), null, 'live replacement still validates latest device kind');

    await control.heartbeatStudio(room, 'studio-device-client', epoch, { devices, onAir: false, airBusy: true });
    assert.equal(await control.updateStudioDesired(room, epoch, { audioDeviceId: 'microphone-one' }), null, 'reject input changes during on-air transition');
    assert.equal(await control.updateStudioDesired(room, epoch, { onAir: true, audioDeviceId: 'microphone-one' }), null, 'reject mixed on-air and input command');
    assert.ok(await control.updateStudioDesired(room, epoch, { outputDeviceId: 'output-one' }), 'allow output changes during transition');

    await control.heartbeatStudio(room, 'studio-device-client', epoch, { devices, onAir: false, airBusy: false });
    current = JSON.parse(fs.readFileSync(process.env.STUDIOLINK_STUDIO_CONTROL_FILE, 'utf8'));
    current.rooms[room].leaseUntil = Date.now() - 1;
    fs.writeFileSync(process.env.STUDIOLINK_STUDIO_CONTROL_FILE, JSON.stringify(current));
    assert.equal(await control.updateStudioDesired(room, epoch, { videoDeviceId: 'camera-one' }), null, 'reject changes while the primary lease is offline');

    const claimed = await control.claimStudio(room, 'studio-device-client');
    assert.ok(claimed.epoch > epoch);
    assert.equal(claimed.desired.videoDeviceId, null);
    assert.equal(claimed.desired.audioDeviceId, null);
    assert.equal(claimed.desired.outputDeviceId, null);
    assert.equal(claimed.desired.deviceRevision, 0);
    assert.deepEqual(await control.updateStudioDesired(room, epoch, { videoDeviceId: 'camera-one' }), { stale: true }, 'reject stale epoch device command');
    console.log('PASS: studio device command validation, input-transition lock, offline lease, and epoch reset');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
