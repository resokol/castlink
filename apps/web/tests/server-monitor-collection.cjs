const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

(async () => {
  const savedNow = Date.now, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  let at = 100000, online = true;
  Date.now = () => at;
  process.env.LIVEKIT_API_KEY = 'test-key'; process.env.LIVEKIT_API_SECRET = 'secret-not-for-output';
  try {
    class RoomServiceClient {
      async listRooms() { if (!online) throw new Error('private failure text'); return [{ name: 'private-room' }]; }
      async listParticipants() { return [{ identity: 'guest-secret' }, { identity: 'studio-panel-main' }, { identity: 'monitor-private' }]; }
    }
    const { collectServerMonitorSample } = load('../lib/server-monitor.ts', {
      'livekit-server-sdk': { RoomServiceClient },
      './room-store': { readNodeRoomInventory: async () => { if (!online) throw new Error('private store error'); return [{ name: 'private-room' }, { name: 'idle-room' }]; } },
      './persistent-storage': { productionDataDir: () => '/test-data' },
      'node:fs/promises': {
        access: async () => {},
        statfs: async () => ({ blocks: 100, bsize: 1024, bfree: 40, bavail: 30 }),
        readFile: async file => file === '/proc/meminfo' ? 'MemTotal: 1000 kB\nMemAvailable: 400 kB\n' : file === '/proc/net/route' ? 'eth0 00000000' : 'eth0: 100 0 0 0 0 0 0 0 200 0',
      },
    });
    const sample = await collectServerMonitorSample();
    assert.equal(sample.cpuPercent, null); assert.equal(sample.networkInMbps, null);
    assert.equal(sample.configuredRooms, 2); assert.equal(sample.activeRooms, 1);
    assert.equal(sample.casters, 1); assert.equal(sample.connections, 3);
    assert.equal(sample.diskUsedBytes, 61440); assert.equal(sample.diskAvailableBytes, 30720);
    if (process.platform === 'linux') assert.equal(sample.memoryUsedBytes, 614400);
    assert.deepEqual(sample.services, { web: 'ok', livekit: 'ok', roomStore: 'ok' });
    assert.doesNotMatch(JSON.stringify(sample), /private-room|guest-secret|secret-not-for-output|idle-room/);
    online = false; at += 15000;
    const failed = await collectServerMonitorSample();
    assert.equal(failed.configuredRooms, null); assert.equal(failed.connections, null); assert.equal(failed.casters, null);
    assert.deepEqual(failed.services, { web: 'ok', livekit: 'unavailable', roomStore: 'unavailable' });
    assert.doesNotMatch(JSON.stringify(failed), /private failure|private store/);
    console.log('PASS: measured room/caster counts, real disk and memory calculations, private data exclusion and unavailable service states');
  } finally {
    Date.now = savedNow;
    if (key === undefined) delete process.env.LIVEKIT_API_KEY; else process.env.LIVEKIT_API_KEY = key;
    if (secret === undefined) delete process.env.LIVEKIT_API_SECRET; else process.env.LIVEKIT_API_SECRET = secret;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
