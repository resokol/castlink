const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const jars = { owner: '', moderator: '', admin: '', stale: '', scoped: '', scoped2: '', scopedAdmin: '' };
async function req(route, { actor = 'owner', method = 'GET', body, token, origin, cookie } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie !== undefined) headers.cookie = cookie;
  else if (actor && jars[actor]) headers.cookie = jars[actor];
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  const response = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (actor && actor in jars) { const setCookie = response.headers.get('set-cookie'); if (setCookie) jars[actor] = setCookie.split(';')[0]; }
  return response;
}
const post = (route, body, options = {}) => req(route, { method: 'POST', body, ...options });
(async () => {
  const room = `test-moderator-${Date.now()}`, other = `${room}-other`, created = `${room}-created`;
  try {
    assert.equal((await req('/api/auth?kind=studio')).status, 200);
    assert.equal((await post('/api/auth', { kind: 'studio', password: process.env.TEST_STUDIO_PASSWORD || 'test-studio-password' })).status, 200);
    for (const name of [room, other]) assert.equal((await post('/api/rooms', { action: 'create', name })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'password', name: room, password: 'old-password' })).status, 200);

    const grantResponse = await post('/api/moderator-access', { action: 'create', room });
    assert.equal(grantResponse.status, 200);
    const grant = await grantResponse.json();
    assert.ok(grant.path.includes(`/moderator?room=${encodeURIComponent(room)}#invite=`));
    assert.ok(grant.expiresAt > Date.now() && grant.expiresAt <= Date.now() + 24 * 60 * 60 * 1000);
    const invite = decodeURIComponent(grant.path.split('#invite=')[1]);
    assert.equal((await post('/api/moderator-access', { action: 'accept', invite }, { actor: 'moderator' })).status, 200);
    assert.deepEqual(await (await req('/api/moderator-access', { actor: 'moderator' })).json(), { allowed: true, scope: 'server', role: 'moderator', canInvite: false });
    assert.equal((await post('/api/moderator-access', { action: 'create', room }, { actor: 'moderator' })).status, 403);

    const list = await req('/api/rooms', { actor: 'moderator' });
    assert.equal(list.status, 200); assert.ok((await list.json()).rooms.includes(other));
    assert.equal((await post('/api/rooms', { action: 'create', name: created, password: 'guest-secret' }, { actor: 'moderator' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'mode', name: created, studioOnly: true }, { actor: 'moderator' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'password', name: created, password: 'new-guest-secret' }, { actor: 'moderator' })).status, 200);
    const details = await (await req(`/api/rooms?name=${encodeURIComponent(created)}`, { actor: 'moderator' })).json();
    assert.equal(details.passwordSet, true); assert.equal(details.guestPassword, 'new-guest-secret', 'global moderators can view the current password');
    assert.equal((await post('/api/rooms', { action: 'delete', name: created }, { actor: 'moderator' })).status, 403);
    assert.equal((await post('/api/admin-access', { action: 'create', room: created }, { actor: 'moderator' })).status, 403);
    assert.equal((await post('/api/server-transfer', { action: 'start', room: created, targetId: 'test' }, { actor: 'moderator', origin: base })).status, 401);

    const primaryClientId = `primary-${Date.now()}`;
    const primary = await (await post('/api/studio-control', { action: 'join', room, clientId: primaryClientId })).json();
    const view = await (await post('/api/studio-control', { action: 'join', mode: 'admin', room, clientId: `mod-${Date.now()}` }, { actor: 'moderator' })).json();
    assert.equal(view.role, 'moderator');
    assert.equal(view.epoch, primary.epoch);
    const moderatorSnapshot = await (await req(`/api/studio-control?room=${encodeURIComponent(room)}&clientId=${encodeURIComponent(primaryClientId)}`, { actor: 'moderator' })).json();
    assert.equal(moderatorSnapshot.role, 'moderator', 'moderator never appears as the primary in studio snapshots');
    for (const action of ['claim', 'heartbeat', 'release', 'command']) {
      assert.equal((await post('/api/studio-control', { action, room, clientId: 'moderator-client-1234', epoch: view.epoch, patch: { onAir: true } }, { actor: 'moderator' })).status, 403, `moderator cannot ${action}`);
    }
    assert.equal((await req('/api/stats', { actor: 'moderator', method: 'DELETE' })).status, 401);
    assert.equal((await req('/api/participants', { actor: 'moderator', method: 'DELETE', body: { room, identity: 'studio-panel-main' } })).status, 403);
    assert.equal((await post('/api/participants', { action: 'mute', room, identity: 'studio-panel-main' }, { actor: 'moderator' })).status, 403);
    assert.equal((await post('/api/participants', { action: 'unmute', room, identity: 'guest-sample' }, { actor: 'moderator' })).status, 400);
    assert.equal((await post('/api/move-guest', { room, identity: 'studio-panel-main', targetRoom: other }, { actor: 'moderator' })).status, 403);
    assert.equal((await post('/api/move-guest', { room, identity: 'guest-sample', targetRoom: other }, { actor: 'moderator' })).status, 200);
    assert.equal((await post('/api/invites', { room: other }, { actor: 'moderator' })).status, 200, 'moderator may copy guest invitations across rooms');

    const tokenResponse = await req(`/api/token?room=${encodeURIComponent(other)}&role=studio-moderator&clientId=moderator-token-1234`, { actor: 'moderator' });
    assert.equal(tokenResponse.status, 200, 'server moderator may join any existing room');
    const token = await tokenResponse.json();
    const claims = JSON.parse(Buffer.from(token.token.split('.')[1], 'base64url').toString());
    const moderatorMetadata = JSON.parse(claims.metadata);
    assert.equal(claims.video.canPublish, true); assert.deepEqual(claims.video.canPublishSources, ['microphone', 'camera']); assert.equal(claims.video.canPublishData, false);
    assert.equal(moderatorMetadata.accessRole, 'moderator'); assert.ok(moderatorMetadata.moderatorAccessVersion);
    assert.equal(moderatorMetadata.roomAdmin, undefined);
    assert.ok(claims.exp - claims.nbf <= 5 * 60, 'moderator LiveKit token has a short lifetime');
    const talkbackData = await (await req(`/api/token?room=${encodeURIComponent(other)}&role=talkback&clientId=moderator-talkback-1234`, { actor: 'moderator' })).json();
    const talkbackClaims = JSON.parse(Buffer.from(talkbackData.token.split('.')[1], 'base64url').toString());
    assert.ok(talkbackData.identity.startsWith('talkback-') && talkbackData.identity.endsWith('-moderator-talkback-1234'));
    assert.equal(talkbackClaims.video.canSubscribe, false); assert.equal(talkbackClaims.video.canPublish, true);
    assert.deepEqual(talkbackClaims.video.canPublishSources, ['microphone']); assert.equal(talkbackClaims.video.canPublishData, false);
    const guestToken = await (await req(`/api/token?room=${encodeURIComponent(other)}&role=guest&identity=guest-secondary-1234`, { actor: 'moderator' })).json();
    const guestMetadata = JSON.parse(JSON.parse(Buffer.from(guestToken.token.split('.')[1], 'base64url').toString()).metadata);
    assert.equal(guestMetadata.role, 'guest'); assert.equal(guestMetadata.accessRole, undefined);
    assert.equal(guestMetadata.moderatorAccessVersion, undefined, 'moderator cookie does not mark unrelated guest tokens as moderator');
    assert.equal((await req(`/api/stats?room=${encodeURIComponent(other)}`, { actor: 'moderator', token: token.token })).status, 403, 'global moderators cannot view statistics');
    assert.equal((await req(`/api/stats?room=${encodeURIComponent(other)}`, { actor: 'moderator', method: 'DELETE', token: token.token })).status, 401);

    const adminGrant = await (await post('/api/admin-access', { action: 'create', room })).json();
    const adminInvite = decodeURIComponent(adminGrant.path.split('#invite=')[1]);
    assert.equal((await post('/api/admin-access', { action: 'accept', room, invite: adminInvite }, { actor: 'admin' })).status, 200);
    const adminTokenResponse = await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=room-admin-token-1234`, { actor: 'admin' });
    assert.equal(adminTokenResponse.status, 200);
    const adminClaims = JSON.parse(Buffer.from((await adminTokenResponse.json()).token.split('.')[1], 'base64url').toString());
    const adminMetadata = JSON.parse(adminClaims.metadata);
    assert.equal(adminMetadata.accessRole, 'admin'); assert.equal(adminMetadata.roomAdmin, true);
    assert.equal(adminMetadata.moderatorAccessVersion, undefined, 'room admin token does not inherit global moderator access');
    assert.equal((await req(`/api/token?room=${encodeURIComponent(other)}&role=studio-moderator&clientId=room-admin-token-1234`, { actor: 'admin' })).status, 401);
    assert.equal((await post('/api/move-guest', { room, identity: 'guest-sample', targetRoom: other }, { actor: 'admin' })).status, 401, 'room-admin retains its prior lack of room-transfer permission');

    const scopedAdminGrant = await (await post('/api/admin-access', { action: 'create', room })).json();
    const scopedAdminInvite = decodeURIComponent(scopedAdminGrant.path.split('#invite=')[1]);
    assert.equal((await post('/api/admin-access', { action: 'accept', room, invite: scopedAdminInvite }, { actor: 'scopedAdmin' })).status, 200);
    const canInvite = await (await req(`/api/moderator-access?room=${encodeURIComponent(room)}`, { actor: 'scopedAdmin' })).json();
    assert.equal(canInvite.scope, 'room'); assert.equal(canInvite.canInvite, true);
    const scopedGrant = await (await post('/api/moderator-access', { action: 'create', room }, { actor: 'scopedAdmin' })).json();
    assert.equal(scopedGrant.scope, 'room'); assert.equal(typeof scopedGrant.inviteId, 'string');
    const scopedInvite = decodeURIComponent(scopedGrant.path.split('#invite=')[1]);
    assert.equal((await post('/api/moderator-access', { action: 'accept', room, invite: scopedInvite }, { actor: 'scoped' })).status, 200);
    assert.equal((await post('/api/moderator-access', { action: 'accept', room, invite: scopedInvite }, { actor: 'scoped2' })).status, 200);
    const scopedRole = await (await req(`/api/moderator-access?room=${encodeURIComponent(room)}`, { actor: 'scoped' })).json();
    assert.equal(scopedRole.role, 'room-moderator'); assert.equal(scopedRole.canInvite, false);
    assert.deepEqual((await (await req('/api/moderator-access', { actor: 'scoped' })).json()).rooms, [room], 'room moderator receives only their room list');
    assert.deepEqual((await (await req('/api/rooms', { actor: 'scoped' })).json()).rooms, [room], 'room moderator cannot enumerate unrelated rooms');
    const scopedDetails = await (await req(`/api/rooms?name=${encodeURIComponent(room)}`, { actor: 'scoped' })).json();
    assert.equal(scopedDetails.guestPassword, 'old-password', 'room moderator can view its room password');
    const otherDetails = await (await req(`/api/rooms?name=${encodeURIComponent(other)}`, { actor: 'scoped' })).json();
    assert.equal('guestPassword' in otherDetails, false);
    assert.ok([401, 403].includes((await post('/api/rooms', { action: 'create', name: created }, { actor: 'scoped' })).status));
    assert.equal((await post('/api/rooms', { action: 'mode', name: room, studioOnly: true }, { actor: 'scoped' })).status, 200);
    assert.equal((await post('/api/rooms', { action: 'password', name: other, password: 'bad' }, { actor: 'scoped' })).status, 401);
    assert.equal((await post('/api/invites', { room }, { actor: 'scoped' })).status, 200);
    assert.equal((await post('/api/invites', { room: other }, { actor: 'scoped' })).status, 401);
    assert.equal((await post('/api/move-guest', { room, identity: 'guest-sample', targetRoom: other }, { actor: 'scoped' })).status, 401);
    const scopedTokenData = await (await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-1234`, { actor: 'scoped' })).json();
    const scopedClaims = JSON.parse(Buffer.from(scopedTokenData.token.split('.')[1], 'base64url').toString());
    const scopedMetadata = JSON.parse(scopedClaims.metadata);
    assert.equal(scopedMetadata.accessRole, 'room-moderator'); assert.equal(scopedMetadata.roomModeratorRoom, room);
    const sameIdAdminToken = await (await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-1234`, { actor: 'scopedAdmin' })).json();
    assert.notEqual(sameIdAdminToken.identity, scopedTokenData.identity, 'same client ID cannot collide across admin/moderator scopes');
    assert.equal(scopedClaims.video.canPublish, true); assert.deepEqual(scopedClaims.video.canPublishSources, ['microphone', 'camera']); assert.equal(scopedClaims.video.canPublishData, false);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(other)}&role=studio-moderator&clientId=scoped-token-1234`, { actor: 'scoped' })).status, 401);
    const scopedState = await (await post('/api/studio-control', { action: 'join', room, clientId: 'scoped-readonly-1234' }, { actor: 'scoped' })).json();
    assert.equal('actual' in scopedState, false, 'moderator actual telemetry is redacted');
    assert.equal((await req(`/api/stats?room=${encodeURIComponent(room)}`, { actor: 'scoped', token: scopedTokenData.token })).status, 403);
    assert.equal((await post('/api/moderator-access', { action: 'create', room: other }, { actor: 'scoped' })).status, 403, 'scoped moderators cannot issue access');
    const scopedId1 = scopedMetadata.roomModeratorSessionId;
    const scopedToken2Data = await (await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-5678`, { actor: 'scoped2' })).json();
    const scopedId2 = JSON.parse(JSON.parse(Buffer.from(scopedToken2Data.token.split('.')[1], 'base64url').toString()).metadata).roomModeratorSessionId;
    assert.notEqual(scopedId1, scopedId2, 'each accepted moderator has a distinct revocation ID');
    assert.equal((await post('/api/moderator-access', { action: 'revoke-session', room, id: scopedId1 }, { actor: 'scopedAdmin' })).status, 200);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-1234`, { actor: 'scoped' })).status, 401);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-5678`, { actor: 'scoped2' })).status, 200, 'individual revocation preserves sibling scoped moderator sessions');
    assert.equal((await post('/api/moderator-access', { action: 'revoke-room', room }, { actor: 'scopedAdmin' })).status, 200);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=scoped-token-5678`, { actor: 'scoped2' })).status, 401);
    assert.equal((await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=room-admin-token-1234`, { actor: 'admin' })).status, 200, 'room moderator revocation leaves room admin access intact');

    const combinedCookie = `${jars.owner}; ${jars.moderator}`;
    const effective = await (await req('/api/moderator-access', { cookie: combinedCookie })).json();
    assert.deepEqual(effective, { allowed: true, owner: true, role: 'owner', canInvite: true, scope: 'server' }, 'owner cookie takes precedence over moderator cookie');
    const ownerModToken = await (await req(`/api/token?room=${encodeURIComponent(room)}&role=studio-moderator&clientId=owner-token-1234`, { cookie: combinedCookie })).json();
    const ownerClaims = JSON.parse(Buffer.from(ownerModToken.token.split('.')[1], 'base64url').toString());
    const ownerMetadata = JSON.parse(ownerClaims.metadata);
    assert.equal(ownerMetadata.accessRole, 'admin');
    assert.equal(ownerMetadata.moderatorAccessVersion, undefined, 'owner login takes precedence over a moderator cookie');
    assert.equal((await post('/api/moderator-access', { action: 'revoke' })).status, 200);
    assert.equal((await (await req('/api/moderator-access', { actor: 'moderator' })).json()).allowed, false, 'rotating the version revokes moderator sessions');
    assert.equal((await post('/api/moderator-access', { action: 'accept', invite }, { actor: 'stale' })).status, 403, 'revocation invalidates unused moderator links too');
    assert.equal((await (await req(`/api/admin-access?room=${encodeURIComponent(room)}`, { actor: 'admin' })).json()).allowed, true, 'moderator revocation leaves room-admin sessions intact');
  } finally {
    for (const name of [room, other, created]) await post('/api/rooms', { action: 'delete', name }).catch(() => {});
  }
  console.log('PASS: server moderator invitation, room management allowlist, guest-only controls, read-only studio access, and owner/admin boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
