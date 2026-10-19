const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { NextRequest } = require('next/server');
const { load } = require('./load-typescript.cjs');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'castlink-chat-clear-api-'));
  process.env.STUDIOLINK_DATA_DIR = root;
  process.env.LIVEKIT_API_KEY = 'test'; process.env.LIVEKIT_API_SECRET = 'test-secret';
  let role = '', revokeInQueue = false, recreateInQueue = false, association = 'assoc-one';
  const currentScope = () => ({ studioId: 'studio-default', roomAssociation: association });
  const staffAllowed = (wanted, room, studio) => role === wanted && room === 'Test' && studio === 'studio-default';
  const chat = load('../lib/room-chat-store.ts');
  const api = load('../app/api/room-chat/route.ts', {
    '@/lib/room-store': { readRooms: async () => [{ name: 'Test', slotAssociationId: association }] },
    '@/lib/room-studio-access': { canHostNamedRoom: async (req, room, studio) => staffAllowed('studio', room, studio) },
    '@/lib/room-admin': { isRoomAdmin: async (req, room, studio) => staffAllowed('admin', room, studio) },
    '@/lib/moderator-access': { isModerator: async (req, room, studio) => staffAllowed('moderator', room, studio) },
    '@/lib/room-chat-store': { ...chat, clearRoomChat: async (...args) => {
      if (revokeInQueue) role = '';
      if (recreateInQueue) association = 'assoc-new';
      return chat.clearRoomChat(...args);
    } },
    '@/lib/guest-admission-store': { managedGuestIdentity: async () => null },
    'livekit-server-sdk': {
      TokenVerifier: class { async verify() { return { sub: 'guest-one', video: { room: 'Test', canPublishData: true }, metadata: JSON.stringify({ role: 'guest', studioId: 'studio-default', roomDisplayName: 'Test', roomChatAssociation: association }) }; } },
      RoomServiceClient: class { async getParticipant() { return { identity: 'guest-one', sid: 'PA_live', name: 'Caster', permission: { canPublishData: true }, metadata: JSON.stringify({ role: 'guest', studioId: 'studio-default', roomChatAssociation: association }) }; } },
    },
  });
  const request = (method, body, studio = 'studio-default', origin = 'http://localhost') => new NextRequest('http://localhost/api/room-chat?room=Test&studioId=' + studio, {
    method, headers: { origin, host: 'localhost', authorization: 'Bearer guest', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal(typeof api.DELETE, 'function', 'API supports a room-wide clear');
    await chat.appendRoomChat(currentScope(), { id: randomUUID(), message: 'before', identity: 'guest-one', name: 'Caster' });
    assert.equal((await api.DELETE(request('DELETE'))).status, 403, 'guest token does not grant clear');
    for (const allowed of ['studio', 'admin', 'moderator']) {
      role = allowed;
      const response = await api.DELETE(request('DELETE'));
      assert.equal(response.status, 200, allowed + ' may clear');
      const snapshot = await response.json();
      assert.deepEqual(snapshot.messages, []); assert.ok(snapshot.generation > 0);
    }
    const current = await chat.readRoomChatSnapshot(currentScope());
    assert.equal((await api.DELETE(request('DELETE', null, 'studio-other'))).status, 403, 'staff cannot clear another studio');
    assert.equal((await api.DELETE(request('DELETE', null, 'studio-default', 'http://other'))).status, 403);
    role = 'studio'; revokeInQueue = true;
    assert.equal((await api.DELETE(request('DELETE'))).status, 403, 'revoked queued operation is denied');
    revokeInQueue = false;
    assert.equal((await chat.readRoomChatSnapshot(currentScope())).generation, current.generation);
    role = 'studio'; recreateInQueue = true;
    assert.equal((await api.DELETE(request('DELETE'))).status, 409, 'queued request cannot clear a recreated room');
    recreateInQueue = false; association = 'assoc-one'; role = '';
    const id = randomUUID();
    for (const generation of [undefined, 0]) {
      const stale = await api.POST(request('POST', { id, message: 'stale', ...(generation === undefined ? {} : { generation }) }));
      assert.equal(stale.status, 409);
      assert.equal((await stale.json()).generation, current.generation);
    }
    const posted = await api.POST(request('POST', { id, message: 'new message', generation: current.generation }));
    assert.equal(posted.status, 200);
    assert.equal((await posted.json()).generation, current.generation);
    const history = await (await api.GET(request('GET'))).json();
    assert.equal(history.generation, current.generation);
    assert.deepEqual(history.messages.map(message => message.message), ['new message']);
    assert.equal((await api.POST(request('POST', { id: randomUUID(), message: 'bad generation', generation: -1 }))).status, 400);
    console.log('PASS room chat clear API: studio/admin/moderator, guest/revoked/cross-studio/cross-origin denial, recreated room guard, snapshot and stale sends');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
