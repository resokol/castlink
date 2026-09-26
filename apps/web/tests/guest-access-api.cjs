const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const prefix = `test-guest-${Date.now()}`;
const privateRoom = prefix + '-private', otherRoom = prefix + '-other', openRoom = prefix + '-open';
const jars = { studio: new Map(), guest: new Map(), invited: new Map() };
async function req(route, { actor, body, method = body === undefined ? 'GET' : 'POST', origin } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (actor) headers.cookie = [...jars[actor]].map(([k, v]) => `${k}=${v}`).join('; ');
  if (origin) headers.origin = origin;
  const response = await fetch(base + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (actor) for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0], at = pair.indexOf('=');
    if (pair.slice(at + 1)) jars[actor].set(pair.slice(0, at), pair.slice(at + 1)); else jars[actor].delete(pair.slice(0, at));
  }
  return response;
}
const login = (actor, room, password) => req('/api/auth', { actor, body: { kind: 'guest', room, password } });
const token = (actor, room = privateRoom) => req(`/api/token?room=${room}&identity=guest-test&role=guest`, { actor });
const exchange = (invite, room = privateRoom, actor = 'invited') => req('/api/auth', { actor, body: { kind: 'guest', room, invite } });
(async () => {
  assert.equal((await req('/api/auth', { actor: 'studio', body: { kind: 'studio', password: 'test-studio-password' } })).status, 200);
  for (const [name, password] of [[privateRoom, 'correct-password'], [otherRoom, 'different-password'], [openRoom, '']])
    assert.equal((await req('/api/rooms', { actor: 'studio', body: { action: 'create', name, password } })).status, 200);
  assert.equal((await token()).status, 401);
  assert.equal((await token('studio')).status, 401, 'studio cookie must not bypass protected guest entry');
  assert.equal((await (await req(`/api/auth?kind=guest&room=${privateRoom}`, { actor: 'studio' })).json()).allowed, false);
  assert.equal((await login('studio', privateRoom, 'wrong-password')).status, 401);
  assert.equal((await token('studio')).status, 401);
  assert.equal((await login('guest', privateRoom, 'correct-password')).status, 200);
  assert.equal((await token('guest')).status, 200);
  assert.equal((await login('guest', privateRoom, 'wrong-password')).status, 401);
  assert.equal((await token('guest')).status, 401, 'wrong password clears old room authorization');
  assert.equal((await req('/api/invites', { body: { room: privateRoom } })).status, 401);
  assert.equal((await req('/api/invites', { actor: 'guest', body: { room: privateRoom } })).status, 401);
  assert.equal((await req('/api/invites', { actor: 'studio', origin: 'https://foreign.example', body: { room: privateRoom } })).status, 401);
  const response = await req('/api/invites', { actor: 'studio', body: { room: privateRoom } });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  const url = new URL((await response.json()).path, base), invite = url.searchParams.get('invite');
  assert.equal(url.pathname, '/room'); assert.equal(url.searchParams.get('name'), privateRoom);
  assert.equal((await exchange(invite)).status, 200, 'invite works without password');
  assert.equal((await token('invited')).status, 200);
  assert.equal((await req(`/api/token?room=${privateRoom}&identity=studio-panel-test&role=studio-panel`, { actor: 'invited' })).status, 401, 'invite grants no studio role');
  assert.equal((await req('/api/invites', { actor: 'invited', body: { room: privateRoom } })).status, 401);
  assert.equal((await exchange(invite, otherRoom)).status, 401, 'invite is room-bound');
  assert.equal((await exchange(invite + 'tampered')).status, 401);
  assert.equal((await token('invited')).status, 401, 'invalid invite clears previous authorization');
  const viewer = (await (await req(`/api/rooms?name=${privateRoom}`, { actor: 'studio' })).json()).viewAccess;
  assert.equal((await exchange(viewer)).status, 401, 'viewer link must not authorize publishing guest');
  const claims = JSON.parse(Buffer.from(invite.split('.')[0], 'base64url').toString());
  claims.exp = Date.now() - 1000;
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', process.env.TEST_SIGNING_SECRET || 'isolated-guest-test-secret-20260926').update(`studiolink-session-v1:${body}`).digest('base64url');
  assert.equal((await exchange(body + '.' + sig)).status, 401, 'expired signed invitation rejected');
  assert.equal((await exchange(invite)).status, 200);
  assert.equal((await req('/api/rooms', { actor: 'studio', body: { action: 'delete', name: privateRoom } })).status, 200);
  assert.equal((await req('/api/rooms', { actor: 'studio', body: { action: 'create', name: privateRoom, password: 'new-password' } })).status, 200);
  assert.equal((await exchange(invite)).status, 401, 'old invite rejected after password changes');
  assert.equal((await token('invited')).status, 401);
  assert.equal((await login('guest', openRoom, 'anything')).status, 401, 'unprotected room does not silently accept arbitrary passwords');
  assert.equal((await login('guest', openRoom, '')).status, 200);
  assert.equal((await token('guest', openRoom)).status, 200);
  assert.equal((await login('guest', prefix + '-missing', '')).status, 404);
  assert.equal((await req('/api/auth', { body: null })).status, 400);
  assert.equal((await req('/api/auth', { body: { kind: 'guest', room: 123, password: '' } })).status, 400);
  console.log('PASS: strict guest passwords, studio-cookie isolation, stale-cookie removal, signed invitations, tampering/expiry/room binding, open rooms');
})().catch(e => { console.error(e); process.exitCode = 1; });
