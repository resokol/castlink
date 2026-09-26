const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const room = `test-stats-${Date.now()}`;
const jars = { studio: '', guest: '' };
async function req(route, { actor, method = 'GET', body, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (actor && jars[actor]) headers.cookie = jars[actor];
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(base + route, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const cookie = response.headers.get('set-cookie');
  if (actor && cookie) jars[actor] = cookie.split(';')[0];
  return response;
}
async function token(identity, role, actor, target = room, access = '') {
  const response = await req(`/api/token?room=${target}&identity=${identity}&role=${role}&access=${encodeURIComponent(access)}`, { actor });
  assert.equal(response.status, 200); return (await response.json()).token;
}
(async () => {
  assert.equal((await req('/api/auth?kind=studio')).status, 200);
  assert.equal((await (await req('/api/auth?kind=studio')).json()).allowed, false);
  assert.equal((await req('/api/token?room=demo-room&identity=studio-panel-test&role=studio-panel')).status, 401);
  assert.equal((await req('/api/token?room=demo-room&identity=studio-panel-test&role=guest')).status, 403);
  for (const route of ['/api/rooms', '/api/move-guest']) assert.equal((await req(route, { method: 'POST', body: {} })).status, 401);
  for (const route of ['/api/participants', '/api/stats']) assert.equal((await req(route, { method: 'DELETE', body: {} })).status, 401);
  assert.equal((await req('/api/auth', { actor: 'studio', method: 'POST', body: { kind: 'studio', password: 'wrong-password' } })).status, 401);
  assert.equal((await req('/api/auth', { actor: 'studio', method: 'POST', body: { kind: 'studio', password: process.env.TEST_STUDIO_PASSWORD || 'test-studio-password' } })).status, 200);
  assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { action: 'create', name: room } })).status, 200);
  const protectedRoom = room + '-private';
  assert.equal((await req('/api/rooms', { actor: 'studio', method: 'POST', body: { action: 'create', name: protectedRoom, password: 'test-room-password' } })).status, 200);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=guest-test&role=guest`)).status, 401);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=output-test&role=output`)).status, 401);
  assert.equal((await req('/api/auth', { actor: 'guest', method: 'POST', body: { kind: 'guest', room: protectedRoom, password: 'test-room-password' } })).status, 200);
  await token('guest-private-test', 'guest', 'guest', protectedRoom);
  const roomData = await (await req(`/api/rooms?name=${protectedRoom}`, { actor: 'studio' })).json();
  const viewer = await token('output-test', 'output', undefined, protectedRoom, roomData.viewAccess);
  const claims = JSON.parse(Buffer.from(viewer.split('.')[1], 'base64url').toString());
  assert.equal(claims.video.canPublish, false);
  assert.equal((await req(`/api/token?room=${protectedRoom}&identity=guest-bypass&role=guest&access=${roomData.viewAccess}`)).status, 401);
  assert.equal((await req('/api/participants', { actor: 'studio', method: 'DELETE', body: {} })).status, 400);
  const guest = await token('guest-api-test', 'guest');
  const studio = await token('studio-panel-api-test', 'studio-panel', 'studio');
  assert.equal((await req('/api/stats')).status, 401);
  assert.equal((await req('/api/stats', { token: guest })).status, 401);
  assert.equal((await req('/api/stats', { actor: 'studio', token: guest })).status, 403);
  assert.equal((await req('/api/stats?room=other', { actor: 'studio', token: studio })).status, 403);
  assert.equal((await req('/api/stats?minutes=5', { actor: 'studio', token: studio })).status, 400);
  const sample = { room, identity: 'guest-api-test', session: 'test-session-12345', name: 'API test', state: 'connected', streams: [
    { id: 'test-video', participant: 'guest-api-test', direction: 'out', kind: 'video', bitrateKbps: 1250, rttMs: 25, lossPct: 0 }
  ] };
  assert.equal((await req('/api/stats', { method: 'POST', token: guest, body: { ...sample, room: 'other' } })).status, 400);
  assert.equal((await req('/api/stats', { method: 'POST', token: guest, body: sample })).status, 204);
  for (const minutes of [15, 60, 360, 720, 1440]) {
    const response = await req(`/api/stats?minutes=${minutes}`, { actor: 'studio', token: studio });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.connections.length, 1); assert.ok(data.series.some(p => p.outbound === 1250));
  }
  assert.equal((await req('/api/stats', { actor: 'studio', method: 'DELETE', token: studio })).status, 200);
  assert.equal((await (await req('/api/stats', { actor: 'studio', token: studio })).json()).connections.length, 1, 'active stays');
  await req('/api/stats', { method: 'POST', token: guest, body: { ...sample, state: 'disconnected', streams: [] } });
  await req('/api/stats', { actor: 'studio', method: 'DELETE', token: studio });
  const cleared = await (await req('/api/stats', { actor: 'studio', token: studio })).json();
  assert.equal(cleared.connections.length, 0); assert.ok(cleared.series.some(p => p.outbound === 1250), 'graphs preserved');
  assert.equal((await req('/api/guest-command?room=test&identity=guest-test')).status, 401);
  for (const route of ['/studio', '/room', '/monitor', '/output/guest-api-test']) assert.equal((await req(route)).status, 200);
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
})().catch(error => { console.error(error.message); process.exitCode = 1; });
