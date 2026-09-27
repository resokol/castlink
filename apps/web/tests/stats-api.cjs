const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const room = `test-stats-${Date.now()}`;
const moderatorJar = 'moderator';
const jars = { studio: '', guest: '', [moderatorJar]: '' };
async function req(route, { actor, method = 'GET', body, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (actor && jars[actor]) headers.cookie = jars[actor];
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(base + route, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const cookie = response.headers.get('set-cookie');
  if (actor && cookie) jars[actor] = cookie.split(';')[0];
  return response;
}
async function token(identity, role, actor, target = room, access = '', targetIdentity = '') {
  const response = await req(`/api/token?room=${target}&identity=${identity}&targetIdentity=${targetIdentity}&role=${role}&access=${encodeURIComponent(access)}`, { actor });
  assert.equal(response.status, 200); return (await response.json()).token;
}
const decode = value => JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
(async () => {
  assert.equal((await req('/api/auth?kind=studio')).status, 200);
  assert.equal((await (await req('/api/auth?kind=studio')).json()).allowed, false);
  assert.equal((await req('/api/token?room=demo-room&identity=studio-panel-test&role=studio-panel')).status, 401);
  assert.equal((await req('/api/rooms', { method: 'POST', body: { action: 'mode', name: 'demo-room', studioOnly: true } })).status, 401);
  assert.equal((await req('/api/move-guest', { method: 'POST', body: { room: 'demo-room', identity: 'guest-test', targetRoom: 'other-room' } })).status, 401);
  for (const route of ['/api/participants', '/api/stats']) assert.equal((await req(route, { method: 'DELETE', body: {} })).status, 401);
  assert.equal((await req('/api/auth', { actor: 'studio', method: 'POST', body: { kind: 'studio', password: 'wrong-password' } })).status, 401);
  assert.equal((await req('/api/auth', { actor: 'studio', method: 'POST', body: { kind: 'studio', password: process.env.TEST_STUDIO_PASSWORD || 'test-studio-password' } })).status, 200);
  assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { action: 'create', name: room } })).status, 200);
  assert.equal((await req(`/api/token?room=${room}&identity=studio-panel-test&role=guest`)).status, 403);
  const protectedRoom = room + '-private';
  assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { action: 'create', name: protectedRoom, password: 'test-room-password' } })).status, 200);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=guest-test&role=guest`)).status, 401);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=output-test&role=output`)).status, 403);
  assert.equal((await req('/api/auth', { actor: 'guest', method: 'POST', body: { kind: 'guest', room: protectedRoom, password: 'test-room-password' } })).status, 200);
  const firstPrivateGuest = await req(`/api/token?room=${protectedRoom}&identity=guest-visible-victim&name=Same%20Name&role=guest`, { actor: 'guest' });
  const secondPrivateGuest = await req(`/api/token?room=${protectedRoom}&identity=guest-visible-victim&name=Same%20Name&role=guest`, { actor: 'guest' });
  assert.equal(firstPrivateGuest.status, 200); assert.equal(secondPrivateGuest.status, 200);
  const firstPrivate = await firstPrivateGuest.json(), secondPrivate = await secondPrivateGuest.json();
  assert.notEqual(firstPrivate.identity, 'guest-visible-victim', 'requested guest identity cannot be impersonated');
  assert.notEqual(firstPrivate.identity, secondPrivate.identity, 'same-name guest sessions receive unique identities');
  const firstPrivateClaims = decode(firstPrivate.token);
  assert.equal(firstPrivateClaims.sub, firstPrivate.identity);
  assert.equal(firstPrivateClaims.video.canUpdateOwnMetadata, false);
  const refreshPrivate = await req(`/api/token?room=${protectedRoom}&identity=${firstPrivate.identity}&role=guest`, { actor: 'guest', token: firstPrivate.token });
  assert.equal(refreshPrivate.status, 200);
  const refreshedPrivate = await refreshPrivate.json();
  assert.equal(refreshedPrivate.identity, firstPrivate.identity, 'valid bearer renewal keeps its server-issued identity');
  assert.equal(decode(refreshedPrivate.token).metadata, firstPrivateClaims.metadata, 'refresh preserves the transfer session binding');
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=guest-attacker-selected&role=guest`, { actor: 'guest', token: firstPrivate.token })).status, 403,
    'a bearer cannot be renewed to another participant identity');
  assert.equal((await req(`/api/token?room=${room}&identity=${firstPrivate.identity}&role=guest`, { actor: 'guest', token: firstPrivate.token })).status, 403,
    'a guest bearer cannot be renewed into another room');
  const roomData = await (await req(`/api/rooms?name=${protectedRoom}`, { actor: 'studio' })).json();
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=output-victim&role=output`, { actor: 'guest' })).status, 403,
    'password-only guest cannot mint an output subscriber token');
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=monitor-victim&role=monitor`, { actor: 'guest' })).status, 403,
    'password-only guest cannot mint a monitor subscriber token');
  const viewer = await token('output-victim', 'output', undefined, protectedRoom, roomData.viewAccess, 'guest-private-source');
  const viewerClaims = decode(viewer);
  assert.notEqual(viewerClaims.sub, 'output-victim', 'output identity is server-issued');
  assert.equal(JSON.parse(viewerClaims.metadata).outputTarget, 'guest-private-source');
  assert.equal(viewerClaims.video.canPublish, false);
  assert.equal(viewerClaims.video.canUpdateOwnMetadata, false);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=guest-bypass&role=guest&access=${roomData.viewAccess}`)).status, 401);
  assert.equal((await req('/api/participants', { actor: 'studio', method: 'DELETE', body: {} })).status, 400);
  const guestLogin = await req('/api/auth', { actor: 'guest', method: 'POST', body: { kind: 'guest', room: protectedRoom, password: 'test-room-password' } });
  assert.equal(guestLogin.status, 200);
  const guest = await token('guest-api-test', 'guest', 'guest', protectedRoom);
  const guestIdentity = JSON.parse(Buffer.from(guest.split('.')[1], 'base64url').toString()).sub;
  const guestSettings = await (await req(`/api/rooms?name=${protectedRoom}`, { actor: 'guest' })).json();
  assert.equal(guestSettings.exists, true);
  assert.equal(guestSettings.passwordRequired, false, 'authenticated guest can see only its entry status');
  assert.equal('guestPassword' in guestSettings, false, 'guest cookie cannot reveal the room password');
  assert.equal((await req(`/api/rooms?name=${room}`, { actor: 'guest' })).status, 200);
  for (const body of [
    { action: 'mode', name: protectedRoom, studioOnly: true },
    { action: 'password', name: protectedRoom, password: 'attacker-password' },
    { action: 'delete', name: protectedRoom },
  ]) assert.equal((await req('/api/rooms', { actor: 'guest', method: 'POST', body })).status, 401, 'guest cannot change room settings');
  assert.equal((await req('/api/rooms', { actor: 'guest', method: 'POST', body: { action: 'mode', name: room, studioOnly: true } })).status, 401,
    'guest cannot change even an unprotected room');
  assert.equal((await req(`/api/studio-control?room=${protectedRoom}&clientId=guest-control-test`, { actor: 'guest' })).status, 401);
  assert.equal((await req('/api/studio-control', { actor: 'guest', method: 'POST', body: { action: 'join', room: protectedRoom, clientId: 'guest-control-test' } })).status, 401);
  assert.equal((await req('/api/participants', { actor: 'guest', method: 'POST', body: { action: 'media', room: protectedRoom, identity: guestIdentity, kind: 'audio', enabled: false } })).status, 401);
  assert.equal((await req('/api/participants', { actor: 'guest', method: 'DELETE', body: { room: protectedRoom, identity: guestIdentity } })).status, 401);
  assert.equal((await req('/api/admin-access', { actor: 'guest', method: 'POST', body: { action: 'create', room: protectedRoom } })).status, 403);
  assert.equal((await req('/api/moderator-access', { actor: 'guest', method: 'POST', body: { action: 'create', room: protectedRoom } })).status, 403);
  assert.equal((await req('/api/move-guest', { actor: 'guest', method: 'POST', body: { room: protectedRoom, identity: guestIdentity, targetRoom: room } })).status, 401);
  assert.equal((await req(`/api/stats?room=${protectedRoom}`, { actor: 'guest', token: guest })).status, 403,
    'valid guest cookie plus valid guest LiveKit bearer still cannot read statistics');
  assert.equal((await req(`/api/stats?room=${protectedRoom}`, { actor: 'guest', token: guest, method: 'DELETE' })).status, 401);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=studio-panel-main&role=guest`, { actor: 'guest' })).status, 403,
    'guest cookie cannot spoof staff identity through guest-token role');
  const studioClientId = `stats-client-${Date.now()}`;
  const studioJoin = await req('/api/studio-control', { actor: 'studio', method: 'POST', body: { action: 'join', room, clientId: studioClientId } });
  assert.equal(studioJoin.status, 200);
  const studioEpoch = (await studioJoin.json()).epoch;
  const studio = (await (await req(`/api/token?room=${room}&role=studio-panel&clientId=${studioClientId}&epoch=${studioEpoch}`, { actor: 'studio' })).json()).token;
  const moderatorInviteResponse = await req('/api/moderator-access', { actor: 'studio', method: 'POST', body: { action: 'create', room } });
  assert.equal(moderatorInviteResponse.status, 200);
  const moderatorInvite = decodeURIComponent((await moderatorInviteResponse.json()).path.split('#invite=')[1]);
  assert.equal((await req('/api/moderator-access', { actor: 'moderator', method: 'POST', body: { action: 'accept', invite: moderatorInvite } })).status, 200);
  const moderatorClientId = `stats-moderator-${Date.now()}`;
  const moderatorTokenResponse = await req(`/api/token?room=${room}&role=studio-moderator&clientId=${moderatorClientId}`, { actor: 'moderator' });
  assert.equal(moderatorTokenResponse.status, 200);
  const moderator = (await moderatorTokenResponse.json()).token;
  const moderatorMetadata = JSON.parse(JSON.parse(Buffer.from(moderator.split('.')[1], 'base64url').toString()).metadata);
  assert.equal(moderatorMetadata.accessRole, 'moderator', 'limited moderator fixture has a verified moderator cookie');
  assert.equal((await req('/api/stats')).status, 401);
  assert.equal((await req('/api/stats', { token: studio })).status, 403, 'studio JWT still requires the studio cookie');
  assert.equal((await req('/api/stats', { token: guest })).status, 403);
  assert.equal((await req('/api/stats', { actor: 'studio', token: guest })).status, 403);
  assert.equal((await req(`/api/stats?room=${room}`, { token: moderator })).status, 403, 'moderator JWT cannot view statistics');
  const moderatorHistoryResponse = await req(`/api/stats?room=${room}`, { actor: 'studio', token: moderator });
  assert.equal(moderatorHistoryResponse.status, 403, 'moderator cannot read statistics even with owner cookie');
  assert.equal((await req('/api/stats?room=other', { actor: 'studio', token: moderator })).status, 403, 'moderator cannot read another room');
  assert.equal((await req('/api/stats', { actor: 'studio', method: 'DELETE', token: moderator })).status, 403, 'moderator cannot clear statistics');
  const additionalAdminClientId = `additional-admin-${Date.now()}`;
  const additionalAdminResponse = await req(`/api/token?room=${room}&role=studio-moderator&clientId=${additionalAdminClientId}`, { actor: 'studio' });
  assert.equal(additionalAdminResponse.status, 200);
  const additionalAdminToken = (await additionalAdminResponse.json()).token;
  const additionalAdminMetadata = JSON.parse(JSON.parse(Buffer.from(additionalAdminToken.split('.')[1], 'base64url').toString()).metadata);
  assert.equal(additionalAdminMetadata.accessRole, 'admin');
  assert.equal((await req(`/api/stats?room=${room}`, { actor: 'studio', token: additionalAdminToken })).status, 200,
    'an owner-created additional admin panel retains statistics access');
  assert.equal((await req(`/api/stats?room=${room}`, { actor: 'studio', token: studio })).status, 200, 'primary studio retains statistics access');
  assert.equal((await req('/api/stats?room=other', { actor: 'studio', token: studio })).status, 403);
  assert.equal((await req('/api/stats?minutes=5', { actor: 'studio', token: studio })).status, 400);
  const telemetryGuest = await token(guestIdentity, 'guest', undefined, room);
  const telemetryIdentity = JSON.parse(Buffer.from(telemetryGuest.split('.')[1], 'base64url').toString()).sub;
  const sample = { room, identity: telemetryIdentity, session: 'test-session-12345', name: 'API test', state: 'connected', streams: [
    { id: 'test-video', participant: telemetryIdentity, direction: 'out', kind: 'video', bitrateKbps: 1250, rttMs: 25, lossPct: 0 }
  ] };
  assert.equal((await req('/api/stats', { method: 'POST', token: telemetryGuest, body: { ...sample, room: 'other' } })).status, 400);
  assert.equal((await req('/api/stats', { method: 'POST', token: telemetryGuest, body: sample })).status, 204);
  for (const minutes of [15, 60, 360, 720, 1440]) {
    const response = await req(`/api/stats?minutes=${minutes}`, { actor: 'studio', token: studio });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.connections.length, 1); assert.ok(data.series.some(p => p.outbound === 1250));
  }
  assert.equal((await req('/api/stats', { actor: 'studio', method: 'DELETE', token: studio })).status, 200);
  assert.equal((await (await req('/api/stats', { actor: 'studio', token: studio })).json()).connections.length, 1, 'active stays');
  await req('/api/stats', { method: 'POST', token: telemetryGuest, body: { ...sample, state: 'disconnected', streams: [] } });
  await req('/api/stats', { actor: 'studio', method: 'DELETE', token: studio });
  const cleared = await (await req('/api/stats', { actor: 'studio', token: studio })).json();
  assert.equal(cleared.connections.length, 0); assert.ok(cleared.series.some(p => p.outbound === 1250), 'graphs preserved');
  assert.equal((await req('/api/guest-command?room=test&identity=guest-test')).status, 401);
  for (const route of ['/studio', '/room', '/monitor', `/output/${guestIdentity}`]) assert.equal((await req(route)).status, 200);
  const publicRooms = JSON.stringify(await (await req(`/api/rooms?name=${protectedRoom}`)).json());
  assert.ok(!publicRooms.includes('passwordHash') && !publicRooms.includes('viewAccess'));
  const mode = { action: 'mode', name: room, studioOnly: true };
  assert.equal((await req('/api/rooms', { method: 'POST', body: mode })).status, 401);
  assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { ...mode, studioOnly: 'yes' } })).status, 400);
  for (const studioOnly of [true, false]) {
    assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { ...mode, studioOnly } })).status, 200);
    assert.equal((await (await req(`/api/rooms?name=${room}`)).json()).studioOnly, studioOnly);
    assert.equal((await (await req(`/api/rooms?name=${protectedRoom}`)).json()).studioOnly, false, 'other room unaffected');
  }
  const logout = await req('/api/auth', { actor: 'studio', method: 'DELETE' }); assert.equal(logout.status, 200);
  assert.equal((await req('/api/rooms', { actor: 'studio' })).status, 401);
  console.log('PASS: studio login/logout, guest passwords, role bypass protection, viewer links, kick authorization, stats ingestion/periods/reset, preserved graphs, protected commands, pages');
})().catch(error => { console.error(error); process.exitCode = 1; });
