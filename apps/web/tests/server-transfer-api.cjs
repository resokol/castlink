const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studiolink-transfer-api-'));
process.env.STUDIOLINK_TRANSFER_STATE_FILE = path.join(dir, 'transfer.json');
process.env.STUDIOLINK_STUDIO_CONTROL_FILE = path.join(dir, 'studio-control.json');
process.env.STUDIOLINK_TRANSFER_SECRET = 'local-test-transfer-secret-with-more-than-32-characters';
process.env.STUDIOLINK_TRANSFER_SERVER_ID = 'local';
process.env.STUDIOLINK_TRANSFER_SERVER_LABEL = 'Local';
process.env.STUDIOLINK_TRANSFER_ORIGIN = 'https://local.example';
process.env.STUDIOLINK_TRANSFER_PEER_ORIGIN = 'https://vps.example';
process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example', lanOrigin: 'https://192.168.53.68', lanPublicIps: ['79.120.36.254'] }]);
process.env.STUDIOLINK_STUDIO_PASSWORD_HASH = 'local-studio-hash';
process.env.LIVEKIT_API_KEY = 'test-key';
process.env.LIVEKIT_API_SECRET = 'test-secret';

let rooms = [];
let sourceParticipants = [];
let listParticipantsFailure = false;
let verifiedClaims = { sub: 'guest-x', video: { room: 'room-a' }, name: 'Guest X' };
const accessTokens = [];
const cookieWrites = [];
let ownerExpiresAt = Date.now() + 8 * 3600_000;
let receivedOwnerExpiry;
class MockRequest {
  constructor(url, { method = 'GET', headers = {}, body } = {}) {
    this.nextUrl = new URL(url); this.headers = new Headers(headers); this.method = method; this._body = body || '';
  }
  async text() { return this._body; }
}
class MockResponse {
  constructor(body = null, init = {}) { this.body = body; this.status = init.status || 200; this.headers = new Headers(init.headers); this.cookies = { set: (...args) => cookieWrites.push(args) }; }
  static json(body, init = {}) { const r = new MockResponse(body, init); r.json = async () => body; return r; }
}
const actualLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === 'next/server') return { NextRequest: MockRequest, NextResponse: MockResponse };
  if (name === 'livekit-server-sdk') return {
    RoomServiceClient: class { async listRooms() { return []; } async listParticipants() { if (listParticipantsFailure) throw new Error('snapshot unavailable'); return sourceParticipants; } },
    TokenVerifier: class { async verify() { return verifiedClaims; } },
    AccessToken: class {
      constructor(_key, _secret, options) { this.options = options; this.grant = null; accessTokens.push(this); }
      addGrant(grant) { this.grant = grant; }
      async toJwt() { return `test-token-${accessTokens.length}`; }
    },
  };
  if (name === '@/lib/access') return {
    isStudio: request => request.headers.get('x-studio') === 'yes',
    canJoin: () => true,
    canView: () => true,
    readAccess: () => null,
    roomVersion: () => 'test-room-version',
    sameOrigin: request => !request.headers.get('origin') || new URL(request.headers.get('origin')).host === request.headers.get('host'),
    setAccessCookie: (response, _request, kind, room, version) => { response.cookies.set(kind === 'studio' ? 'studiolink-studio' : `studiolink-room-${room}`, `signed:${version}`); },
  };
  if (name === '../../../lib/studio-owner-access') return {
    isStudioOwner: async request => request?.headers?.get?.('x-studio') === 'yes',
    studioOwnerSessionExpiresAt: async () => ownerExpiresAt,
    setStudioOwnerCookie: async (response, _request, studioId, expiresAt) => { receivedOwnerExpiry = expiresAt; response.cookies.set(`castlink-studio-owner-${studioId}`, 'signed-owner'); },
  };
  if (name === '@/lib/room-admin') return { verifiedRoomAdminVersion: async () => null };
  if (name === '@/lib/moderator-access') return { verifiedModeratorVersion: async () => null, verifiedRoomModeratorSession: async () => null };
  if (name === '@/lib/room-store') return {
    readRooms: async () => rooms,
    updateRooms: async change => { rooms = change(rooms); return rooms; },
  };
  if (name === '@/lib/studio-control') return require('../lib/studio-control.ts');
  if (name === '@/lib/server-transfer') return require('../lib/server-transfer.ts');
  return actualLoad.call(this, name, ...rest);
};
const route = require('../app/api/server-transfer/route.ts');
const tokenRoute = require('../app/api/token/route.ts');
Module._load = actualLoad;
const transfer = require('../lib/server-transfer.ts');
const studioControl = require('../lib/studio-control.ts');
const req = (body, { url = 'https://local.example/api/server-transfer', headers = {} } = {}) => new MockRequest(url, { method: 'POST', headers: { host: 'local.example', origin: 'https://local.example', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const guestTransfer = async (claims, forwardedFor) => {
  verifiedClaims = claims;
  const response = await route.GET(new MockRequest('https://local.example/api/server-transfer?room=room-a', { headers: { authorization: 'Bearer guest-jwt', ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) } }));
  return response.json();
};

(async () => {
  let response = await route.POST(req({ action: 'start', room: 'room-a', targetId: 'vps' }));
  assert.equal(response.status, 401, 'start requires studio authorization');

  response = await route.POST(req({ action: 'bridge', sourceOrigin: 'https://vps.example' }, { url: 'https://local.example/api/server-transfer?action=bridge' }));
  assert.equal(response.status, 401, 'bridge rejects unsigned requests');

  rooms = [{ name: 'room-a', transferRoomId: 'different-room-id-123456', passwordHash: 'a'.repeat(32) + ':' + 'b'.repeat(64) }];
  const transferId = '0123456789abcdef0123456789abcdef';
  const incoming = { action: 'prepare', sourceOrigin: 'https://vps.example', transferId, roomRecord: { name: 'room-a', transferRoomId: 'another-room-id-12345678' } };
  const raw = JSON.stringify(incoming), timestamp = String(Date.now()), nonce = 'abcdef0123456789abcdef0123456789';
  response = await route.POST(req(incoming, { url: 'https://local.example/api/server-transfer?action=bridge', headers: {
    'x-studiolink-transfer-time': timestamp, 'x-studiolink-transfer-nonce': nonce, 'x-studiolink-transfer-signature': transfer.signBridge(timestamp, nonce, raw),
  } }));
  assert.equal(response.status, 409, 'prepare refuses to replace a differently owned room');
  assert.equal(rooms[0].transferRoomId, 'different-room-id-123456');

  rooms = [{ name: 'room-a', transferRoomId: 'another-room-id-12345678', passwordHash: 'a'.repeat(32) + ':' + 'b'.repeat(64), adminAccessVersion: 'old-admin', guestInviteVersion: 'old-guest', viewerAccessVersion: 'old-viewer', outputAccessVersion: 'old-output' }];
  const oldStudio = await studioControl.joinStudio('room-a', 'old-studio-client-1234');
  await studioControl.heartbeatStudio('room-a', 'old-studio-client-1234', oldStudio.state.epoch, { camera: 'old-camera' });
  await studioControl.updateStudioDesired('room-a', oldStudio.state.epoch, { onAir: true, preview: true, fps: 25 });
  const beforeTransfer = await studioControl.readStudioState('room-a');
  assert.equal(beforeTransfer.desired.onAir, true);
  const acceptedPrepare = { ownerExpiresAt, action: 'prepare', sourceOrigin: 'https://vps.example', transferId: 'abcdef0123456789abcdef0123456789', roomRecord: { name: 'room-a', transferRoomId: 'another-room-id-12345678' } };
  const acceptedRaw = JSON.stringify(acceptedPrepare), acceptedTime = String(Date.now()), acceptedNonce = 'fedcba9876543210fedcba9876543210';
  response = await route.POST(req(acceptedPrepare, { url: 'https://local.example/api/server-transfer?action=bridge', headers: {
    'x-studiolink-transfer-time': acceptedTime, 'x-studiolink-transfer-nonce': acceptedNonce, 'x-studiolink-transfer-signature': transfer.signBridge(acceptedTime, acceptedNonce, acceptedRaw),
  } }));
  assert.equal(response.status, 200, 'trusted prepare installs a matching room');
  const preparedTicket = (await response.json()).ticket;
  const savedTicket = await transfer.updateTransferState(state => state.tickets[transfer.ticketHash(preparedTicket)]);
  assert.equal(savedTicket.ownerExpiresAt, ownerExpiresAt);
  assert.ok(savedTicket.exp <= Date.now() + 5 * 60_000, 'redeem deadline stays five minutes');
  assert.ok(savedTicket.ownerExpiresAt > savedTicket.exp, 'owner authorization is not truncated to ticket TTL');
  const acceptedOwner = await route.POST(req({ action: 'accept', ticket: preparedTicket }));
  assert.equal(acceptedOwner.status, 200);
  assert.equal(receivedOwnerExpiry, ownerExpiresAt, 'target login preserves verified source expiration');
  assert.equal((await route.POST(req({ action: 'accept', ticket: preparedTicket }))).status, 401, 'ticket remains single-use');
  assert.equal(rooms[0].transferRoomId, acceptedPrepare.roomRecord.transferRoomId);
  assert.match(rooms[0].guestInviteVersion, /^[0-9a-f-]{36}$/i);
  assert.match(rooms[0].viewerAccessVersion, /^[0-9a-f-]{36}$/i);
  assert.match(rooms[0].outputAccessVersion, /^[0-9a-f-]{36}$/i);
  assert.notEqual(rooms[0].guestInviteVersion, 'old-guest', 'server transfer rotates guest links on the target');
  assert.notEqual(rooms[0].viewerAccessVersion, 'old-viewer', 'server transfer rotates Studio Viewer links on the target');
  assert.notEqual(rooms[0].outputAccessVersion, 'old-output', 'server transfer rotates clean-output links on the target');
  assert.equal(rooms[0].adminAccessVersion, undefined, 'target room-admin sessions are not carried through a transfer');
  const afterTransfer = await studioControl.readStudioState('room-a');
  assert.ok(afterTransfer.epoch > beforeTransfer.epoch, 'prepare fences the old primary epoch');
  assert.equal(afterTransfer.primaryClientId, null, 'incoming studio can become primary');
  assert.equal(afterTransfer.leaseUntil, 0);
  assert.equal(afterTransfer.desired.onAir, false);
  assert.equal(afterTransfer.desired.preview, false);
  assert.equal(afterTransfer.desired.fps, 25, 'quality settings survive transfer');
  assert.equal(afterTransfer.actual, null, 'old camera status is cleared');

  const guestTokenResponse1 = await tokenRoute.GET(new MockRequest('https://local.example/api/token?room=room-a&identity=guest-old-transfer&role=guest'));
  const guestTokenResponse2 = await tokenRoute.GET(new MockRequest('https://local.example/api/token?room=room-a&identity=guest-old-transfer&role=guest&transferSessionId=caller-controlled'));
  assert.equal(guestTokenResponse1.status, 200);
  assert.equal(guestTokenResponse2.status, 200);
  const firstGuestIdentity = accessTokens.at(-2).options.identity;
  const secondGuestIdentity = accessTokens.at(-1).options.identity;
  assert.match(firstGuestIdentity, /^guest-[0-9a-f-]{36}$/i, 'guest identity is issued by the server');
  assert.notEqual(firstGuestIdentity, secondGuestIdentity, 'same-name guest sessions receive distinct identities');
  const oldSessionId = JSON.parse(accessTokens.at(-2).options.metadata).transferSessionId;
  const anotherSessionId = JSON.parse(accessTokens.at(-1).options.metadata).transferSessionId;
  assert.match(oldSessionId, /^[0-9a-f-]{36}$/i);
  assert.notEqual(oldSessionId, anotherSessionId, 'same-identity guest tokens receive different session IDs');
  assert.notEqual(anotherSessionId, 'caller-controlled', 'guest cannot choose transfer session ID');

  const initialRooms = rooms;
  rooms = [...rooms, { name: 'empty-room' }, { name: 'snapshot-failure-room' }];
  sourceParticipants = [
    { identity: firstGuestIdentity, metadata: accessTokens.at(-2).options.metadata },
    { identity: 'guest-legacy', metadata: JSON.stringify({ role: 'guest' }) },
    { identity: 'guest-legacy-no-metadata' },
    { identity: 'guest-spoofed-role', metadata: JSON.stringify({ role: 'output' }) },
    { identity: 'studio-panel-main', metadata: JSON.stringify({ role: 'studio-panel' }) },
  ];
  let prepareCalls = 0;
  const bridgeUrls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (options?.body === undefined) return { ok: true, json: async () => ({ enabled: true, liveKitReady: true, id: 'vps' }) };
    const payload = JSON.parse(options.body);
    assert.ok(['prepare', 'ticket'].includes(payload.action));
    bridgeUrls.push(url);
    if (payload.action === 'prepare') { prepareCalls++; assert.equal(payload.ownerExpiresAt, ownerExpiresAt, 'source forwards verified login expiry'); }
    return { ok: true, json: async () => ({ ticket: 'a'.repeat(48) }) };
  };
  try {
    const targetsResponse = await route.GET(new MockRequest('https://local.example/api/server-transfer', { headers: { 'x-studio': 'yes' } }));
    const targetsBody = await targetsResponse.json();
    assert.equal(targetsBody.targets[0].origin, 'https://vps.example');
    assert.equal(JSON.stringify(targetsBody).includes('192.168.53.68'), false, 'LAN endpoint stays server-side');
    assert.equal(JSON.stringify(targetsBody).includes('lanPublicIps'), false, 'client IP allowlist stays server-side');

    response = await route.POST(req({ action: 'start', room: 'room-a', targetId: 'vps' }, { headers: { 'x-studio': 'yes' } }));
    assert.equal(response.status, 200, 'source captures connected guests before preparing the target');
    const startResponse = await response.json();
    assert.equal(startResponse.targetUrl, 'https://vps.example', 'legacy targetUrl remains canonical');
    assert.equal(startResponse.clientTargetUrl, 'https://vps.example', 'unknown clients receive canonical target URL');
    assert.ok(bridgeUrls.every(url => url === 'https://vps.example/api/server-transfer?action=bridge'), 'backend bridge always uses the canonical public target');
    const active = await transfer.updateTransferState(state => state.active['room-a']);
    assert.deepEqual(active.eligibleSessions, [
      { identity: firstGuestIdentity, transferSessionId: oldSessionId },
      { identity: 'guest-legacy' },
      { identity: 'guest-legacy-no-metadata' },
    ]);

    const eligibleClaims = { sub: firstGuestIdentity, video: { room: 'room-a' }, metadata: accessTokens.at(-2).options.metadata };
    let result = await guestTransfer(eligibleClaims, '79.120.36.254');
    assert.equal(result.role, 'guest', 'connected original session receives its transfer ticket');
    assert.equal(result.targetUrl, 'https://vps.example');
    assert.equal(result.clientTargetUrl, 'https://192.168.53.68', 'eligible LAN client receives its configured LAN endpoint');
    result = await guestTransfer(eligibleClaims, '198.51.100.1, 203.0.113.10');
    assert.equal(result.clientTargetUrl, 'https://vps.example', 'external rightmost address uses canonical public endpoint');
    result = await guestTransfer(eligibleClaims, 'spoofed-invalid, 203.0.113.10');
    assert.equal(result.clientTargetUrl, 'https://vps.example', 'spoofed left prefix does not cause LAN routing');
    result = await guestTransfer(eligibleClaims, '::ffff:79.120.36.254');
    assert.equal(result.clientTargetUrl, 'https://192.168.53.68', 'mapped IPv4 LAN client selects configured endpoint');
    result = await guestTransfer({ ...eligibleClaims, sub: 'guest-different' });
    assert.deepEqual(result, {}, 'a different identity cannot reuse a captured session ID');
    result = await guestTransfer({ ...eligibleClaims, metadata: JSON.stringify({ role: 'guest', transferSessionId: anotherSessionId }) });
    assert.deepEqual(result, {}, 'a fresh session with the same identity cannot inherit an active transfer');

    const legacyNbf = Math.floor(active.startedAt / 1000) - 1;
    result = await guestTransfer({ sub: 'guest-legacy', video: { room: 'room-a' }, metadata: JSON.stringify({ role: 'guest' }), nbf: legacyNbf });
    assert.equal(result.role, 'guest', 'connected legacy token remains transferable');
    result = await guestTransfer({ sub: 'guest-legacy', video: { room: 'room-a' }, metadata: JSON.stringify({ role: 'guest' }), nbf: Math.floor(active.startedAt / 1000) + 1 });
    assert.deepEqual(result, {}, 'fresh legacy identity token after cutoff is rejected');
    result = await guestTransfer({ sub: 'guest-legacy', video: { room: 'room-a' }, metadata: JSON.stringify({ role: 'guest', transferSessionId: anotherSessionId }), nbf: legacyNbf });
    assert.deepEqual(result, {}, 'a fresh identified session cannot inherit a captured legacy identity');
    result = await guestTransfer({ sub: 'guest-legacy', video: { room: 'room-a' }, metadata: JSON.stringify({ role: 'guest' }) });
    assert.deepEqual(result, {}, 'legacy token without a verifiable issue time is rejected');
    result = await guestTransfer({ sub: 'guest-not-connected', video: { room: 'room-a' }, metadata: JSON.stringify({ role: 'guest' }), nbf: legacyNbf });
    assert.deepEqual(result, {}, 'not-yet-connected guest is excluded from the snapshot');
    result = await guestTransfer({ ...eligibleClaims, metadata: JSON.stringify({ role: 'guest', transferSessionId: 'malformed' }) });
    assert.deepEqual(result, {}, 'malformed session metadata is rejected without a legacy fallback');

    await transfer.updateTransferState(state => { state.active['old-active'] = { id: 'old', roomId: 'room', targetUrl: 'https://vps.example', targetId: 'vps', exp: Date.now() + 60_000 }; });
    verifiedClaims = { sub: firstGuestIdentity, video: { room: 'old-active' }, metadata: eligibleClaims.metadata };
    result = await (await route.GET(new MockRequest('https://local.example/api/server-transfer?room=old-active', { headers: { authorization: 'Bearer guest-jwt' } }))).json();
    assert.deepEqual(result, {}, 'active records without eligibility data never use room-wide fallback');

    const originalTargets = process.env.STUDIOLINK_TRANSFER_TARGETS_JSON;
    process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://changed-vps.example', lanOrigin: 'https://192.168.53.68', lanPublicIps: ['79.120.36.254'] }]);
    result = await guestTransfer(eligibleClaims);
    assert.deepEqual(result, {}, 'a stale active transfer cannot resolve to a changed target origin');
    process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = originalTargets;

    listParticipantsFailure = true;
    response = await route.POST(req({ action: 'start', room: 'snapshot-failure-room', targetId: 'vps' }, { headers: { 'x-studio': 'yes' } }));
    assert.equal(response.status, 503, 'snapshot failure aborts start before target preparation');
    assert.equal(prepareCalls, 1, 'failed snapshot does not prepare target');
    assert.equal(rooms.find(item => item.name === 'snapshot-failure-room').transferRoomId, undefined);
    listParticipantsFailure = false;

    sourceParticipants = [];
    response = await route.POST(req({ action: 'start', room: 'empty-room', targetId: 'vps' }, { headers: { 'x-studio': 'yes', 'x-forwarded-for': '79.120.36.254' } }));
    assert.equal(response.status, 200, 'a room with no guests can still hand off the studio');
    const emptyStart = await response.json();
    assert.equal(emptyStart.targetUrl, 'https://vps.example');
    assert.equal(emptyStart.clientTargetUrl, 'https://192.168.53.68', 'studio start also returns the per-client LAN endpoint');
    assert.deepEqual((await transfer.updateTransferState(state => state.active['empty-room'])).eligibleSessions, []);
    assert.equal(prepareCalls, 2);
  } finally {
    global.fetch = originalFetch;
    rooms = initialRooms;
  }

  rooms = [{ name: 'room-a', passwordHash: 'a'.repeat(32) + ':' + 'b'.repeat(64) }];
  const issued = transfer.newTicket('guest', 'studio-default', 'room-a', 'guest-x', 'Guest X');
  await transfer.updateTransferState(state => { state.tickets[issued.hash] = issued.ticket; });
  response = await route.POST(req({ action: 'accept', ticket: issued.token }, { headers: { origin: 'https://evil.example' } }));
  assert.equal(response.status, 403, 'accept rejects cross-origin requests without consuming the ticket');
  response = await route.POST(req({ action: 'accept', ticket: issued.token }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, 'guest');
  assert.equal(cookieWrites.at(-1)[0], 'studiolink-room-room-a', 'guest ticket installs only a room-scoped guest cookie');
  assert.notEqual(cookieWrites.at(-1)[0], 'studiolink-studio');
  response = await route.POST(req({ action: 'accept', ticket: issued.token }));
  assert.equal(response.status, 401, 'accepted tickets cannot be replayed');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: studio authorization, token-scoped guest migration, legacy cutoff, snapshot failure, empty-room studio handoff, signed bridge, collision protection, and one-use ticket exchange');
})().catch(error => { console.error(error); process.exitCode = 1; });
