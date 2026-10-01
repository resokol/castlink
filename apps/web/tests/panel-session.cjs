const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, process: { env: { LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'test-secret' } }, require: name => name in imports ? imports[name] : name === 'node:crypto' ? require(name) : {}, console, Date });
  return module.exports;
}
let owner = true, moderator = false, admin = false, guest = false;
const claims = [];
let participants = [];
class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
class AccessToken { constructor(k, s, options) { this.options = options; } addGrant(grant) { this.grant = grant; } async toJwt() { claims.push(this); return 'test-jwt'; } }
class RoomServiceClient { async listParticipants() { return participants; } }
const { GET } = load('../app/api/token/route.ts', {
  'next/server': { NextResponse }, 'livekit-server-sdk': { AccessToken, RoomServiceClient, TrackSource: { CAMERA: 2, MICROPHONE: 1, SCREEN_SHARE: 3, SCREEN_SHARE_AUDIO: 4 } },
  '@/lib/access': { isStudio: () => owner, canJoin: () => guest, canView: () => false, readAccess: () => null, accessStudioMatches: () => true, roomVersion: () => 'v' },
  '@/lib/room-admin': { verifiedRoomAdminVersion: async () => admin ? 'admin-v' : null },
  '@/lib/moderator-access': { verifiedModeratorVersion: async () => moderator ? 'mod-v' : null, verifiedRoomModeratorSession: async () => null },
  '@/lib/room-store': { readRooms: async () => [{ name: 'qa' }] },
  '@/lib/studio-control': { validStudioClient: () => true },
  '../../../lib/studio-owner-access': { isStudioOwner: async () => owner },
  '../../../lib/server-log': {
    requestId: () => 'test-request-id',
    requestHeaders: (_id, extra = {}) => extra,
    serverLog: () => undefined,
  },
  '../../../lib/studio-scope': {
    defaultStudioId: () => 'studio-default',
    validateStudioId: value => value || 'studio-default',
    mediaRoomName: (_studioId, room) => room,
  },
});
const { resolveParticipantRole } = load('../lib/participant-role.ts');
const { setPanelCamera } = load('../components/TalkbackControls.tsx');
async function token(mode, clientId = 'qa-client-123', name = '') { return GET({ nextUrl: new URL(`https://test/api/token?room=qa&role=studio-moderator&clientId=${clientId}&panelMode=${mode}${name ? `&name=${encodeURIComponent(name)}` : ''}`), headers: new Headers() }); }
(async () => {
  for (const account of ['owner', 'admin', 'moderator']) {
    owner = account === 'owner'; admin = account === 'admin'; moderator = account === 'moderator';
    assert.equal((await token('moderator')).status, 200);
    const claim = claims.at(-1), metadata = JSON.parse(claim.options.metadata);
    assert.equal(claim.options.name, 'Модератор 1');
    assert.equal(resolveParticipantRole({ identity: claim.options.identity, metadata: claim.options.metadata }), 'moderator');
    assert.equal(metadata.accessRole, account === 'moderator' ? 'moderator' : 'admin', 'display mode never rewrites actual authorization');
    assert.equal(claim.grant.canPublish, true); assert.deepEqual(Array.from(claim.grant.canPublishSources), [1, 2, 3, 4], 'staff can publish camera and screen with audio');
    assert.equal(claim.grant.canUpdateOwnMetadata, false);
  }
  owner = true; admin = moderator = false;
  await token('admin'); assert.equal(claims.at(-1).options.name, 'Администратор 1');
  participants = [{ identity: 'existing-admin', name: 'Администратор 1' }];
  await token('admin', 'qa-client-456'); assert.equal(claims.at(-1).options.name, 'Администратор 2', 'default admin names are unique');
  participants = [{ identity: 'existing-mod', name: 'Модератор 1' }];
  owner = false; moderator = true;
  await token('moderator', 'qa-client-789'); assert.equal(claims.at(-1).options.name, 'Модератор 2', 'default moderator names are unique');
  participants = [];
  await token('admin'); assert.equal(claims.at(-1).options.name, 'Модератор 1', 'requesting admin mode cannot elevate moderator');
  await token('moderator', 'qa-client-custom', 'Режиссёр эфира'); assert.equal(claims.at(-1).options.name, 'Режиссёр эфира', 'manual staff name wins over default numbering');
  moderator = false;
  assert.equal((await token('moderator')).status, 401, 'panel mode does not grant staff access');
  const requestRole = role => GET({ nextUrl: new URL(`https://test/api/token?room=qa&role=${role}&clientId=qa-client-123`), headers: new Headers() });
  guest = true;
  assert.equal((await requestRole('guest')).status, 200);
  assert.equal(claims.at(-1).grant.canPublish, true, 'authorized guests can publish their media');
  assert.equal(claims.at(-1).grant.canPublishSources, undefined, 'guest sharing is not restricted to camera');
  assert.equal((await requestRole('studio-moderator')).status, 401, 'guest access cannot mint staff sharing tokens');
  assert.equal((await requestRole('talkback')).status, 401, 'guest access cannot mint private talkback tokens');
  assert.equal((await requestRole('output')).status, 403, 'guest access cannot mint technical output tokens');
  guest = false; owner = true;
  assert.equal((await requestRole('talkback')).status, 200);
  assert.deepEqual(Array.from(claims.at(-1).grant.canPublishSources), [1], 'private talkback remains microphone-only');
  assert.equal(claims.at(-1).grant.canSubscribe, false);
  for (const role of ['output', 'monitor']) {
    assert.equal((await requestRole(role)).status, 200);
    assert.equal(claims.at(-1).grant.canPublish, false, 'technical viewers cannot share media');
  }
  let called;
  const room = { state: 'connected', localParticipant: { isCameraEnabled: false, async setCameraEnabled(enabled, options) { called = { enabled, options }; this.isCameraEnabled = enabled; return enabled ? { isMuted: false, track: { mediaStreamTrack: { readyState: 'live' } } } : undefined; } } };
  await setPanelCamera(room, true, 'camera-id');
  assert.equal(called.options.deviceId.exact, 'camera-id'); assert.equal(room.localParticipant.isCameraEnabled, true);
  await setPanelCamera(room, false, 'camera-id'); assert.equal(room.localParticipant.isCameraEnabled, false);
  room.localParticipant.setCameraEnabled = async () => undefined;
  await assert.rejects(setPanelCamera(room, true, ''), /не опубликовалась/);
  room.localParticipant.setCameraEnabled = async () => ({ isMuted: true, track: { mediaStreamTrack: { readyState: 'live' } } });
  await assert.rejects(setPanelCamera(room, true, ''), /не опубликовалась/);
  room.localParticipant.setCameraEnabled = async () => { throw Error('Permission denied'); };
  await assert.rejects(setPanelCamera(room, true, ''), /Permission denied/);
  room.state = 'disconnected'; await assert.rejects(setPanelCamera(room, true, ''), /Нет соединения/);
  console.log('PASS: moderator presentation with existing admin session, unchanged authorization, camera grants, confirmed publication and failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
