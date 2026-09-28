const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const jars = { owner: '', admin: '', newAdmin: '' };
async function req(route, { actor = 'owner', method = 'GET', body, token, origin } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (actor && jars[actor]) headers.cookie = jars[actor];
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  const response = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (actor && actor in jars) {
    const cookie = response.headers.get('set-cookie');
    if (cookie) jars[actor] = cookie.split(';')[0];
  }
  return response;
}
const post = (route, body, options = {}) => req(route, { method: 'POST', body, ...options });
const decode = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
(async () => {
  const room = `test-admin-${Date.now()}`;
  const other = `${room}-other`;
  try {
    assert.equal((await req('/api/auth?kind=studio')).status, 200);
    assert.equal((await post('/api/auth', { kind: 'studio', password: process.env.TEST_STUDIO_PASSWORD || 'test-studio-password' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'create', name: room, password: 'old-password' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'create', name: other })).status, 200);
    const primaryId = `admin-test-primary-${Date.now()}`;
    const primaryJoin = await post('/api/studio-control', { action: 'join', room, clientId: primaryId });
    assert.equal(primaryJoin.status, 200);
    const primaryState = await primaryJoin.json();

    const firstGrantResponse = await post('/api/admin-access', { action: 'create', room });
    assert.equal(firstGrantResponse.status, 200);
    const firstGrant = await firstGrantResponse.json();
    const grant = await (await post('/api/admin-access', { action: 'create', room })).json();
    assert.ok(grant.path.includes(`/admin?room=${encodeURIComponent(room)}#invite=`));
    assert.ok(grant.expiresAt <= Date.now() + 24 * 60 * 60 * 1000 && grant.expiresAt > Date.now());
    const invite = decodeURIComponent(grant.path.split('#invite=')[1]);
    const firstInvite = decodeURIComponent(firstGrant.path.split('#invite=')[1]);
    const firstAccepted = await post('/api/admin-access', { action: 'accept', room, invite: firstInvite }, { actor: 'admin' });
    assert.equal(firstAccepted.status, 200, 'reissuing a link must not revoke earlier admins');
    const accepted = await post('/api/admin-access', { action: 'accept', room, invite }, { actor: 'newAdmin' });
    assert.equal(accepted.status, 200);
    jars.owner = `${jars.owner}; ${jars.admin}`;
    const ownerPrimary = await (await req(`/api/studio-control?room=${encodeURIComponent(room)}&clientId=${primaryId}`)).json();
    assert.equal(ownerPrimary.role, 'primary', 'room-admin cookie cannot demote the owner studio session');
    assert.equal((await post('/api/studio-control', { action: 'heartbeat', room, clientId: primaryId, epoch: primaryState.epoch })).status, 200);
    assert.equal((await req(`/api/admin-access?room=${encodeURIComponent(room)}`, { actor: 'admin' })).status, 200);
    assert.deepEqual(await (await req(`/api/admin-access?room=${encodeURIComponent(other)}`, { actor: 'admin' })).json(), { allowed: false });

    const state = await (await post('/api/studio-control', { action: 'join', mode: 'admin', room, clientId: `room-admin-${Date.now()}` }, { actor: 'admin' })).json();
    assert.equal(state.role, 'moderator');
    assert.equal(state.epoch, primaryState.epoch, 'room-admin join cannot create or replace primary lease');
    assert.equal((await post('/api/studio-control', { action: 'claim', room, clientId: `room-admin-${Date.now()}` }, { actor: 'admin' })).status, 403);
    for (const action of ['heartbeat', 'release']) assert.equal((await post('/api/studio-control', { action, room, clientId: primaryId, epoch: state.epoch }, { actor: 'admin' })).status, 403);
    assert.equal((await post('/api/studio-control', { action: 'command', room, clientId: 'room-admin-client-1234', epoch: state.epoch, patch: { fps: 30, bitrate: 4000, gain: 120, onAir: true } }, { actor: 'admin' })).status, 200);
    assert.equal((await post('/api/studio-control', { action: 'command', room, clientId: 'room-admin-client-1234', epoch: state.epoch, patch: { preview: true } }, { actor: 'admin' })).status, 403);

    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-panel&clientId=${primaryId}&epoch=${state.epoch}`, { actor: 'admin' })).status, 401);
    const modResponse = await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=room-admin-token-1234&identity=studio-panel-forged`, { actor: 'admin' });
    assert.equal(modResponse.status, 200);
    const mod = await modResponse.json();
    const claims = decode(mod.token);
    assert.ok(mod.identity.startsWith('studio-moderator-') && mod.identity.endsWith('-room-admin-token-1234'));
    assert.equal(claims.video.canPublish, true);
    assert.deepEqual(claims.video.canPublishSources, ['microphone', 'camera', 'screen_share', 'screen_share_audio']);
    assert.equal(claims.video.canPublishData, false);
    assert.equal(claims.exp - claims.nbf <= 5 * 60, true, 'room-admin LiveKit token lifetime is short');
    const metadata = JSON.parse(claims.metadata);
    assert.equal(metadata.roomAdmin, true);
    assert.ok(metadata.adminAccessVersion);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(other)}&role=studio-moderator&clientId=room-admin-token-1234`, { actor: 'admin' })).status, 401);

    const roomDetails = await (await req(`/api/rooms?name=${encodeURIComponent(room)}`, { actor: 'admin' })).json();
    assert.equal(roomDetails.passwordSet, true);
    assert.equal(roomDetails.guestPassword, 'old-password');
    assert.equal('viewAccess' in roomDetails, false);
    assert.equal((await req('/api/rooms', { actor: 'admin' })).status, 401, 'no global room listing');
    assert.equal((await post('/api/rooms', { action: 'password', name: room, password: 'new-password' }, { actor: 'admin' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'mode', name: room, studioOnly: true }, { actor: 'admin' })).status, 200);
    assert.ok([401, 403].includes((await post('/api/rooms', { action: 'create', name: `${room}-forbidden` }, { actor: 'admin' })).status));
    assert.equal((await post('/api/rooms', { action: 'delete', name: room }, { actor: 'admin' })).status, 403);
    assert.equal((await post('/api/invites', { room }, { actor: 'admin' })).status, 200);
    assert.equal((await post('/api/invites', { room: other }, { actor: 'admin' })).status, 401);
    assert.equal((await req('/api/participants', { actor: 'admin', method: 'DELETE', body: { room, identity: 'studio-panel-main' } })).status, 403);
    const kickGuest = await req('/api/participants', { actor: 'admin', method: 'DELETE', body: { room, identity: 'guest-not-connected-test' } });
    assert.equal(kickGuest.status, 502, 'guest kick reached LiveKit after room-scope authorization');

    const moderatorStats = await req(`/api/stats?room=${encodeURIComponent(room)}`, { actor: 'admin', token: mod.token });
    assert.equal(moderatorStats.status, 200);
    assert.equal((await req(`/api/stats?room=${encodeURIComponent(other)}`, { actor: 'admin', token: mod.token })).status, 403);
    assert.equal((await req('/api/stats', { actor: 'admin', method: 'DELETE', token: mod.token })).status, 401);

    const revoke = await post('/api/admin-access', { action: 'revoke', room });
    assert.equal(revoke.status, 200);
    assert.equal(typeof (await revoke.json()).disconnected, 'boolean');
    assert.equal((await req(`/api/admin-access?room=${encodeURIComponent(room)}`, { actor: 'admin' })).status, 200);
    assert.equal((await (await req(`/api/admin-access?room=${encodeURIComponent(room)}`, { actor: 'admin' })).json()).allowed, false);
    assert.equal((await (await req(`/api/admin-access?room=${encodeURIComponent(room)}`, { actor: 'newAdmin' })).json()).allowed, false);
    const primaryStillThere = await (await req(`/api/studio-control?room=${encodeURIComponent(room)}&clientId=${primaryId}`)).json();
    assert.equal(primaryStillThere.role, 'primary');
    assert.equal(primaryStillThere.epoch, primaryState.epoch, 'admin revocation cannot release or replace the primary lease');
    assert.equal((await post('/api/studio-control', { action: 'join', room, clientId: 'room-admin-client-1234' }, { actor: 'admin' })).status, 401);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=room-admin-token-1234`, { actor: 'admin' })).status, 401);
    assert.equal((await post('/api/admin-access', { action: 'accept', room, invite }, { actor: 'newAdmin' })).status, 403);
  } finally {
    await post('/api/rooms', { action: 'delete', name: room }).catch(() => {});
    await post('/api/rooms', { action: 'delete', name: other }).catch(() => {});
  }
  console.log('PASS: room-admin invitation/revocation, room-scoped APIs, non-publishing token, primary lease and participant safety');
})().catch(error => { console.error(error); process.exitCode = 1; });
