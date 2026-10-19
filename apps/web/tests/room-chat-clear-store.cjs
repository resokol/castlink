const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { load } = require('./load-typescript.cjs');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'castlink-chat-clear-'));
  process.env.STUDIOLINK_DATA_DIR = root;
  const scope = { studioId: 'studio-one', roomAssociation: 'room-one' }, now = 1800000000000;
  const message = text => ({ id: randomUUID(), message: text, identity: 'guest-one', name: 'Caster' });
  const filename = s => path.join(root, 'runtime', 'room-chat', createHash('sha256').update(JSON.stringify([s.studioId, s.roomAssociation])).digest('hex') + '.json');
  try {
    const chat = load('../lib/room-chat-store.ts');
    assert.equal(typeof chat.clearRoomChat, 'function', 'store supports a durable room-wide clear');
    assert.deepEqual(await chat.readRoomChatSnapshot(scope, now), { messages: [], generation: 0 });
    const old = message('before clear');
    await chat.appendRoomChat(scope, old, now);
    const isolated = { ...scope, roomAssociation: 'another-room' };
    await chat.appendRoomChat(isolated, message('keep another room'), now);
    assert.deepEqual(await chat.clearRoomChat(scope, now + 1), { messages: [], generation: 1 });
    assert.equal((await chat.readRoomChatSnapshot(isolated, now + 1)).messages.length, 1);
    const reloaded = load('../lib/room-chat-store.ts');
    assert.deepEqual(await reloaded.readRoomChatSnapshot(scope, now + 2), { messages: [], generation: 1 }, 'clear survives module restart');
    for (const generation of [undefined, 0]) {
      await assert.rejects(reloaded.appendRoomChatSnapshot(scope, old, generation, now + 3), error => error.generation === 1, 'old in-flight/retried posts cannot restore history');
    }
    const fresh = await reloaded.appendRoomChatSnapshot(scope, message('after clear'), 1, now + 4);
    assert.equal(fresh.generation, 1);
    assert.equal(fresh.message.message, 'after clear');
    await reloaded.readRoomChatSnapshot(scope, now + 86400000 + 3600001);
    assert.deepEqual(await reloaded.readRoomChatSnapshot(scope, now + 86400000 + 3600002), { messages: [], generation: 1 }, 'retention cleanup keeps the clear generation');
    assert.equal(JSON.parse(await fs.readFile(filename(scope), 'utf8')).generation, 1);
    const queuedScope = { ...scope, roomAssociation: 'serialized' };
    await chat.appendRoomChatSnapshot(queuedScope, message('before queued clear'), 0, now);
    let releaseClear;
    const clearGate = new Promise(resolve => { releaseClear = resolve; });
    const cleared = reloaded.clearRoomChat(queuedScope, now, () => clearGate);
    const after = chat.appendRoomChatSnapshot(queuedScope, message('stale queued post'), 0, now);
    const rejectedAfter = assert.rejects(after, error => error.generation === 1);
    releaseClear();
    assert.equal((await cleared).generation, 1);
    await rejectedAfter;
    assert.deepEqual(await chat.readRoomChatSnapshot(queuedScope, now), { messages: [], generation: 1 }, 'append and clear serialize across module instances');
    await assert.rejects(chat.clearRoomChat(queuedScope, now, async () => { throw Error('revoked'); }), /revoked/);
    assert.equal((await chat.readRoomChatSnapshot(queuedScope, now)).generation, 1, 'failed authorization guard does not mutate');
    assert.equal((await chat.clearRoomChat(queuedScope, now)).generation, 2, 'successive clears advance generation');
    const legacyScope = { ...scope, roomAssociation: 'legacy' };
    await chat.appendRoomChat(legacyScope, message('legacy history'), now);
    const legacy = JSON.parse(await fs.readFile(filename(legacyScope), 'utf8'));
    legacy.schemaVersion = 1; delete legacy.generation;
    await fs.writeFile(filename(legacyScope), JSON.stringify(legacy));
    assert.equal((await chat.readRoomChatSnapshot(legacyScope, now)).generation, 0, 'schema1 history remains readable');
    assert.equal((await chat.clearRoomChat(legacyScope, now)).generation, 1);
    assert.equal(JSON.parse(await fs.readFile(filename(legacyScope), 'utf8')).schemaVersion, 2);
    console.log('PASS room chat clear: durable atomic generation, stale-post rejection, scope isolation, queued authorization, retention, schema1 compatibility');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
