const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { AccessToken, TokenVerifier } = require('livekit-server-sdk');
process.env.LIVEKIT_API_KEY='test-key';process.env.LIVEKIT_API_SECRET='test-secret-test-secret-test-secret';
let staffBearer='';
const ts = require('typescript');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);

let roomAdmin = false;
const calls = [], dataCalls = [], removed = [], revoked = [], updates = [], participants = new Map([
  ['guest-a', { tracks: [
    { sid: 'mic-a', source: 1 }, { sid: 'mic-b', source: 1 },
    { sid: 'camera-a', source: 2 }, { sid: 'screen-audio-a', source: 4 },
  ] }],
  ['guest-no-mic', { tracks: [{ sid: 'camera-only', source: 2 }, { sid: 'screen-audio-only', source: 4 }] }],
  ['studio-moderator-scoped', { metadata: JSON.stringify({ roomModeratorRoom: 'room-a', roomModeratorSessionId: 'session-a' }), tracks: [] }],
  ['studio-moderator-global', { metadata: JSON.stringify({ accessRole: 'moderator', moderatorAccessVersion: 'global-v', clientId: 'client-a' }), tracks: [] }],
  ['studio-moderator-admin', { metadata: JSON.stringify({ roomAdmin: true, accessRole: 'admin' }), tracks: [] }],
  ['studio-moderator-self', { metadata: JSON.stringify({ role: 'studio-moderator', studioId: 'studio-default', accessRole: 'moderator', moderatorAccessVersion: 'global-v', clientId: 'self-client' }), tracks: [] }],
]);
class RoomServiceClient {
  async getParticipant(room, identity) { return participants.get(identity) || { tracks: [] }; }
  async mutePublishedTrack(room, identity, sid, muted) { calls.push({ room, identity, sid, muted }); }
  async sendData(room, data, kind, options) { dataCalls.push({ room, text: Buffer.from(data).toString(), kind, options }); }
  async removeParticipant(room, identity) { removed.push(identity); }
  async updateParticipant(room, identity, patch) { updates.push({ room, identity, patch }); }
  async listParticipants() { return [...[...participants.entries()].map(([identity, value]) => ({ identity, ...value })), { identity: 'talkback-sibling', metadata: JSON.stringify({ roomModeratorRoom: 'room-a', roomModeratorSessionId: 'session-a', talkbackForClientId: 'client-a', accessRole: 'moderator', moderatorAccessVersion: 'global-v' }) }]; }
}
class NextResponse extends Response {
  static json(value, init = {}) { return new NextResponse(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json', ...init.headers } }); }
}
const mocks = {
  'livekit-server-sdk': { TokenVerifier, RoomServiceClient, TrackSource: { MICROPHONE: 1, CAMERA: 2 }, DataPacket_Kind: { RELIABLE: 0 } },
  'next/server': { NextRequest: class {}, NextResponse },
  '@/lib/access': { isStudio: () => false, sameOrigin: () => true },
  '@/lib/room-admin': { isRoomAdmin: async () => roomAdmin },
  '@/lib/moderator-access': { isModerator: async () => true, revokeRoomModeratorSession: async (room, id) => revoked.push([room, id]) },
  '@/lib/room-store': { readRooms: async () => [{ name: 'room-a' }] },
  '../../../lib/studio-owner-access': { isStudioOwner: async () => false },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) { return Object.hasOwn(mocks, request) ? mocks[request] : originalLoad.call(this, request, parent, isMain); };
const route = require('../app/api/participants/route.ts');
const request = data => ({ headers: { get: name => name === 'origin' ? 'https://studio.test' : name === 'authorization' && staffBearer ? 'Bearer '+staffBearer : null }, json: async () => data });

(async () => {
  let response = await route.POST(request({ action: 'mute', room: 'room-a', identity: 'guest-a' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(call => [call.sid, call.muted]), [['mic-a', true], ['mic-b', true]], 'only microphone tracks are muted and never unmuted by the API');
  response = await route.POST(request({ action: 'mute', room: 'room-a', identity: 'guest-no-mic' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, muted: false, tracks: 0 });
  assert.equal(calls.length, 2, 'camera and screen audio remain untouched');
  response = await route.POST(request({ action: 'mute', room: 'room-a', identity: 'studio-panel-main' }));
  assert.equal(response.status, 403, 'staff identities cannot be muted as guests');
  response = await route.POST(request({ action: 'media', room: 'room-a', identity: 'guest-a', kind: 'video', enabled: false }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.slice(2).map(call => [call.sid, call.muted]), [['camera-a', true]], 'video-off mutes camera tracks only');
  response = await route.POST(request({ action: 'media', room: 'room-a', identity: 'guest-a', kind: 'audio', enabled: false }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.slice(3).map(call => [call.sid, call.muted]), [['mic-a', true], ['mic-b', true]], 'audio-off mutes every microphone track');
  response = await route.POST(request({ action: 'media', room: 'room-a', identity: 'guest-a', kind: 'audio', enabled: true }));
  assert.equal(response.status, 200); assert.equal((await response.json()).requested, true, 'audio-on is a request for the guest client');
  assert.equal(calls.length, 5, 'audio-on does not server-unmute');
  assert.equal(dataCalls.length, 1);
  assert.deepEqual(JSON.parse(dataCalls[0].text), { kind: 'audio', enabled: true });
  assert.deepEqual(dataCalls[0].options, { destinationIdentities: ['guest-a'], topic: 'castlink-media-control' });
  response = await route.POST(request({ action: 'media', room: 'room-a', identity: 'studio-panel-main', kind: 'audio', enabled: false }));
  assert.equal(response.status, 403, 'media control cannot target staff');
  response = await route.POST(request({ action: 'unmute', room: 'room-a', identity: 'guest-a' }));
  assert.equal(response.status, 400, 'there is no unmute API');
  const rename={action:'rename-self',room:'room-a',identity:'studio-moderator-self',clientId:'self-client',name:'Новый модератор'};
  assert.equal((await route.POST(request(rename))).status,403,'public clientId alone is not proof');
  const jwt = new AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:rename.identity,metadata:participants.get(rename.identity).metadata,ttl:'5m'});
  jwt.addGrant({roomJoin:true,room:'room-a'});staffBearer=await jwt.toJwt();
  assert.equal((await route.POST(request({...rename,identity:'studio-moderator-admin'}))).status,403,'moderator JWT cannot rename an administrator');
  const invalid=staffBearer;staffBearer=invalid+'bad';assert.equal((await route.POST(request(rename))).status,403,'tampered proof rejected');staffBearer=invalid;
  response = await route.POST(request({ action: 'rename-self', room: 'room-a', identity: 'studio-moderator-self', clientId: 'self-client', name: 'Новый модератор' }));
  assert.equal(response.status, 200); assert.equal((await response.json()).name, 'Новый модератор');
  assert.deepEqual(updates.at(-1), { room: 'room-a', identity: 'studio-moderator-self', patch: { name: 'Новый модератор' } }, 'self rename changes only display name');
  const updateCount = updates.length;
  response = await route.POST(request({ action: 'rename-self', room: 'room-a', identity: 'studio-moderator-self', clientId: 'other-client', name: 'Чужое имя' }));
  assert.equal(response.status, 403, 'staff cannot rename another client'); assert.equal(updates.length, updateCount);
  assert.equal((await route.DELETE(request({ room: 'room-a', identity: 'studio-panel-main' }))).status, 403, 'main studio cannot be removed');
  roomAdmin = true;
  assert.equal((await route.DELETE(request({ room: 'room-a', identity: 'studio-moderator-admin' }))).status, 403, 'room admin identity cannot be removed');
  removed.length = 0;
  response = await route.DELETE(request({ room: 'room-a', identity: 'studio-moderator-scoped' }));
  assert.equal(response.status, 200); assert.deepEqual(revoked, [['room-a', 'session-a']]);
  assert.deepEqual(removed.sort(), ['studio-moderator-scoped', 'talkback-sibling']);
  removed.length = 0;
  response = await route.DELETE(request({ room: 'room-a', identity: 'studio-moderator-global' }));
  assert.equal(response.status, 200); assert.deepEqual(removed.sort(), ['studio-moderator-global', 'talkback-sibling']);
  const preserved = { role:'guest', studioId:'studio-default', videoRotation:90 };
  participants.set('guest-a',{ ...participants.get('guest-a'),metadata:JSON.stringify(preserved) });
  response=await route.POST(request({action:'video-bitrate',room:'room-a',identity:'guest-a',bitrateKbps:2500}));
  assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(updates.at(-1).patch.metadata),{...preserved,videoMaxBitrateKbps:2500},'camera budget preserves unrelated metadata');
  const budgetUpdates=updates.length;
  for(const bitrateKbps of [0,499,12001,2500.5,'2500']) assert.equal((await route.POST(request({action:'video-bitrate',room:'room-a',identity:'guest-a',bitrateKbps}))).status,400);
  assert.equal((await route.POST(request({action:'video-bitrate',room:'room-a',identity:'studio-panel-main',bitrateKbps:2500}))).status,403);
  participants.set('guest-a',{...participants.get('guest-a'),metadata:JSON.stringify({...preserved,studioId:'studio-other'})});
  assert.equal((await route.POST(request({action:'video-bitrate',room:'room-a',identity:'guest-a',bitrateKbps:2500}))).status,403);
  assert.equal(updates.length,budgetUpdates,'invalid or cross-studio camera caps must not mutate a participant');
  console.log('PASS: guest media controls, scoped session revocation, linked talkback kick, and admin/main safety');
})().catch(error => { console.error(error); process.exitCode = 1; });
