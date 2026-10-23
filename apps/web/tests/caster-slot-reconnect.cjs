const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { NextRequest } = require('next/server');
const { load } = require('./load-typescript.cjs');
(async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'castlink-slot-reconnect-'));
 Object.assign(process.env, { STUDIOLINK_DATA_DIR: root, CASTLINK_STORAGE_BACKEND: 'json', CASTLINK_SESSION_SECRET: 'slot-reconnect-test', CASTLINK_HOSTED_ACCESS: '0', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'slot-reconnect-secret-at-least-32-characters' });
 try {
  await fs.mkdir(path.join(root, 'runtime'), { recursive: true });
  await fs.writeFile(path.join(root, 'runtime/studiolink-rooms.json'), JSON.stringify({ schemaVersion: 1, rooms: [{ name: 'A', slotAssociationId: 'room-a' }, { name: 'Private', passwordHash: 'protected', slotAssociationId: 'private-room' }] }));
  const participants = new Map(), sdk = require('livekit-server-sdk');
  const media = { async getParticipant(room, identity) { const live = participants.get(`${room}:${identity}`); if (!live) throw Object.assign(Error('missing'), { status: 404 }); return live; }, async removeParticipant() { throw Error('slot reconnect must not stop media'); } };
  const overrides = { 'livekit-server-sdk': { ...sdk, RoomServiceClient: class { getParticipant(...args) { return media.getParticipant(...args); } } } };
  const tokenApi = load('../app/api/token/route.ts', overrides), outputApi = load('../app/api/caster-slot-output/route.ts', overrides);
  const slots = load('../lib/caster-slot-store.ts'), access = load('../lib/caster-slot-access.ts'), service = load('../lib/caster-slot-service.ts'), admissions = load('../lib/guest-admission-store.ts');
  const { requestGuestSession, acceptGuestInvite, guestResumeStorage } = load('../lib/guest-resume.ts');
  const saved = new Map();
  const backed = values => ({ getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  globalThis.localStorage = backed(saved); globalThis.sessionStorage = backed(new Map());
  let storage = guestResumeStorage();
  const fetcher = (url, init) => tokenApi.GET(new NextRequest('https://local.example' + url, init));
  const liveSession = (room, session, sid) => participants.set(`${room}:${session.identity}`, { identity: session.identity, sid, metadata: JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url')).metadata });
  for (const room of ['A', 'Private']) {
   const scope = { studioId: 'studio-default', roomAssociation: room === 'A' ? 'room-a' : 'private-room' }, actor = { studioId: scope.studioId, kind: 'studio', authorize: async () => true };
   const slot = await slots.createCasterSlot(scope, { name: 'Caster' });
   const invite = room === 'Private' ? await access.personalCasterInviteKey(await slots.readPersonalCasterInvite(scope.studioId, slot.inviteId)) : undefined;
   if (!invite) acceptGuestInvite(storage, scope.studioId, room, 'accepted-room-invite');
   const first = await requestGuestSession({ studioId: scope.studioId, room, name: 'Alice', storage, fetcher, personalInvite: invite });
   liveSession(room, first, 'SID-first');
   const admission = await service.adoptConnectedCaster(actor, scope, first.identity, 'SID-first', media);
   const assigned = await service.assignCasterToSlot(actor, scope, slot.id, admission.id, slot.revision, false, media);
   const outputKey = await access.createSlotOutputAccess(scope, slot.id, 'camera');
   const snapshot = async () => {
    const response = await outputApi.GET(new NextRequest(`https://local.example/api/caster-slot-output?slot=${slot.id}&source=camera`, { headers: { 'x-castlink-slot-access': outputKey } }));
    assert.equal(response.status, 200); return (await response.json()).snapshot;
   };
   participants.delete(`${room}:${first.identity}`);
   assert.equal((await snapshot()).phase, 'disconnected');
   // Closing the original tab destroys its session storage; a reopened tab recovers only the signed durable credential.
   globalThis.sessionStorage = backed(new Map()); storage = guestResumeStorage();
   if (!invite) acceptGuestInvite(storage, scope.studioId, room, 'accepted-room-invite');
   const rejoined = await requestGuestSession({ studioId: scope.studioId, room, name: 'Alice', storage, fetcher, personalInvite: invite });
   assert.equal(rejoined.identity, first.identity, `${room}: refresh/reentry retains identity`);
   liveSession(room, rejoined, 'SID-rejoined');
   const restored = await snapshot();
   assert.equal(restored.phase, 'assigned'); assert.equal(restored.target.participantSid, 'SID-rejoined');
   assert.equal(restored.target.sessionId, admission.id); assert.equal(restored.target.generation, admission.generation);
   assert.deepEqual((await slots.readCasterSlot(scope.studioId, slot.id)).outputVersions, assigned.outputVersions);
   let resolveLive, started;
   const lookupStarted = new Promise(resolve => { started = resolve; });
   const stale = service.confirmCasterSlot(scope, slot.id, { ...media, getParticipant: () => { started(); return new Promise(resolve => { resolveLive = resolve; }); } });
   await lookupStarted;
   const beforeRelease = await slots.readCasterSlot(scope.studioId, slot.id);
   await service.releaseCasterSlot(actor, scope, slot.id, beforeRelease.revision, media);
   resolveLive({ ...participants.get(`${room}:${first.identity}`), sid: 'SID-late' });
   assert.equal((await stale).assignment, null, 'stale callbacks cannot restore released mappings');
  }
  const scope = { studioId: 'studio-default', roomAssociation: 'room-a' }, version = load('../lib/slot-room-scope.ts').slotRoomVersion({ name: 'A' });
  const started = await admissions.startGuestAdmission(scope, { clientId: 'legacy-tab', name: 'Alice', roomVersion: version });
  const firstGeneration = await admissions.changeGuestAdmission(scope, started.session.id, 'waiting', 'admitted');
  const slot = await slots.createCasterSlot(scope, { name: 'Legacy' });
  await slots.mutateCasterSlot(scope, slot.id, slot.revision, item => ({ ...item, phase: 'assigned', assignment: { sessionId: firstGeneration.id, identity: firstGeneration.identity, generation: firstGeneration.generation, participantSid: 'SID-old' } }));
  await admissions.changeGuestAdmission(scope, firstGeneration.id, 'admitted', 'waiting');
  const nextGeneration = await admissions.changeGuestAdmission(scope, firstGeneration.id, 'waiting', 'admitted');
  participants.set(`A:${nextGeneration.identity}`, { identity: nextGeneration.identity, sid: 'SID-next-generation', metadata: JSON.stringify({ role: 'guest', studioId: scope.studioId, admissionId: nextGeneration.id, admissionGeneration: nextGeneration.generation }) });
  assert.equal(await service.confirmCasterSlot(scope, slot.id, media), null, 'saved assignment cannot follow a different admitted generation');
  assert.equal((await slots.readCasterSlot(scope.studioId, slot.id)).assignment.participantSid, 'SID-old');
  console.log('PASS ordinary/private invitation reentry restores slot output, stable URLs, stale callback and generation isolation');
 } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
