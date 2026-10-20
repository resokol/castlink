const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { NextRequest } = require('next/server');
let actor = 'owner', allowedRoom = 'room-a', sameOrigin = true, disconnected = false;
const calls = [], updates = [];
const record = { name: 'room-a', creatorAccessId: 'resolution-room' };
let participant;
const authorized = role => async (_request, room, studioId) => actor === role && room === allowedRoom && studioId === 'studio-one';
const api = load('../app/api/participants/route.ts', {
  '../../../lib/talkback-session': {},
  '../../../lib/node-admission': {},
  '../../../lib/rate-limit': { consumeRateLimit: () => ({ ok: true }) },
  '@/lib/access': { sameOrigin: () => sameOrigin },
  '../../../lib/room-studio-access': { canHostNamedRoom: authorized('owner') },
  '@/lib/room-admin': { isRoomAdmin: authorized('admin') },
  '@/lib/moderator-access': { isModerator: authorized('moderator') },
  '@/lib/room-store': { readRooms: async () => [record, { name: 'room-b' }] },
  'livekit-server-sdk': { RoomServiceClient: class {
    async getParticipant(room, identity) { calls.push({ room, identity }); if (disconnected) throw Error('offline'); return participant; }
    async updateParticipant(room, identity, patch) { updates.push({ room, identity, patch }); }
  } },
});
const preserved = { role: 'guest', studioId: 'studio-one', videoMaxBitrateKbps: 2500, videoRotation: 90, studioImageTransform: { zoom: 1.5 }, transferSessionId: 'session-one' };
const reset = () => { participant = { sid: 'PA-current', metadata: JSON.stringify(preserved), tracks: [{ sid: 'camera', source: 2 }, { sid: 'screen', source: 3 }] }; disconnected = false; };
const request = overrides => new NextRequest('https://castlink.test/api/participants', { method: 'POST', headers: { origin: 'https://castlink.test', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'video-resolution', room: 'room-a', studioId: 'studio-one', identity: 'guest-one', participantSid: 'PA-current', height: 720, ...overrides }) });
(async () => {
  for (const role of ['owner', 'admin', 'moderator']) {
    actor = role; reset();
    for (const height of [720, 1080]) {
      const response = await api.POST(request({ height }));
      assert.equal(response.status, 200, role + ' can request camera resolution in its own room');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: true, requested: true, participantSid: 'PA-current', height });
      assert.deepEqual(updates.at(-1), { room: load('../lib/studio-scope.ts').mediaRoomName('studio-one', 'room-a'), identity: 'guest-one', patch: { metadata: JSON.stringify({ ...preserved, videoHeight: height }) } });
    }
  }
  const before = updates.length;
  for (const role of ['owner', 'admin', 'moderator']) {
    actor = role; allowedRoom = 'room-b';
    assert.equal((await api.POST(request())).status, 403, role + ' cannot control another room');
  }
  allowedRoom = 'room-a'; actor = 'guest';
  assert.equal((await api.POST(request())).status, 403, 'caster cannot choose resolution');
  actor = 'owner';
  for (const height of [null, 0, 480, 721, 1080.5, '720', {}, true]) assert.equal((await api.POST(request({ height }))).status, 400, 'height must be numeric 720 or 1080');
  for (const participantSid of [undefined, null, '', 'bad sid', 1, 'x'.repeat(101)]) assert.equal((await api.POST(request({ participantSid }))).status, 400, 'current participant SID is required');
  for (const identity of ['studio-panel-main', 'studio-moderator-one', 'talkback-one', 'output-one']) assert.equal((await api.POST(request({ identity }))).status, 403, 'only caster camera targets are allowed');
  assert.equal((await api.POST(request({ participantSid: 'PA-stale' }))).status, 409, 'old SID cannot mutate replacement caster');
  disconnected = true;
  assert.equal((await api.POST(request())).status, 409, 'disconnected caster cannot be controlled');
  reset();
  for (const metadata of ['broken', 'null', '[]', '{}', JSON.stringify({ ...preserved, role: 'studio-moderator' }), JSON.stringify({ ...preserved, studioId: 'studio-other' }), JSON.stringify({ ...preserved, studioId: undefined })]) {
    participant.metadata = metadata;
    assert.equal((await api.POST(request())).status, 403, 'verified guest metadata must match studio');
  }
  sameOrigin = false;
  assert.equal((await api.POST(request())).status, 403);
  assert.equal(updates.length, before, 'rejected requests cannot update metadata or tracks');
  console.log('PASS resolution API: owner/admin/moderator same-room controls, strict input, guest/staff/scope/SID rejection and metadata preservation');
})().catch(error => { console.error(error); process.exitCode = 1; });
