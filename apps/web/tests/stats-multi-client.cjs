const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-stats-clients-'));
Object.assign(process.env, { CASTLINK_STORAGE_BACKEND: 'json', STUDIOLINK_DATA_DIR: dir,
  STUDIOLINK_ROOMS_FILE: path.join(dir, 'rooms.json'), STUDIOLINK_STATS_DIR: path.join(dir, 'stats'),
  CASTLINK_SESSION_SECRET: 'isolated-stats-session-secret', LIVEKIT_API_KEY: 'isolated-stats-key', LIVEKIT_API_SECRET: 'isolated-stats-secret' });
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) { return resolve.call(this, id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : id, ...args); };
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { NextRequest, NextResponse } = require('next/server');
process.env.ROOM_CREATION_PASSWORD = 'isolated-creation-password';
const origin = 'https://stats.example.test';
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];
function request(route, cookie = '', body, headers = {}) {
  return new NextRequest(origin + route, { method: body ? 'POST' : 'GET', headers: { host: 'stats.example.test', origin, cookie, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
(async () => {
  const entry = require('../app/api/room-studio-access/route.ts');
  const api = require('../app/api/stats/route.ts');
  const store = require('../lib/room-store.ts');
  const { saveSample } = require('../lib/telemetry-store.ts');
  const { hashPassword, setAccessCookie, canJoin } = require('../lib/access.ts');
  const moderator = require('../lib/moderator-access.ts');
  const create = await entry.POST(request('/api/room-studio-access', '', { action: 'create', name: 'Poker', studioPassword: 'studio-fixture-password', password: 'guest-fixture-password', creationPassword: process.env.ROOM_CREATION_PASSWORD }));
  assert.equal(create.status, 200); const firstPc = cookieOf(create);
  const login = await entry.POST(request('/api/room-studio-access', '', { action: 'login', name: 'Poker', studioPassword: 'studio-fixture-password' }));
  assert.equal(login.status, 200); const secondPc = cookieOf(login);
  await entry.POST(request('/api/room-studio-access', '', { action: 'create', name: 'Other', studioPassword: 'other-fixture-password', creationPassword: process.env.ROOM_CREATION_PASSWORD }));
  const sample = { at: Date.now(), room: 'Poker', identity: 'guest-fixture', name: 'Guest', session: 'fixture-audio-session', role: 'guest', state: 'connected', quality: 'good', reconnects: 0, uptimeSec: 20,
    streams: [{ id: 'audio-in', kind: 'audio', direction: 'in', participant: 'guest-fixture', source: 'microphone', bitrateKbps: 64, lossPct: 1, jitterMs: 10, rttMs: 50 }] };
  await saveSample(sample);
  const url = '/api/stats?studioId=studio-default&room=Poker&minutes=15';
  // No browser has joined LiveKit or acquired the publishing primary lease.
  for (const cookie of [firstPc, secondPc]) {
    const response = await api.GET(request(url, cookie));
    assert.equal(response.status, 200, 'studio login on either PC reads history without a media token or primary lease');
    const history = await response.json();
    assert.equal(history.connections[0].session, sample.session);
    const details = await api.GET(request(url + '&diagnostics=audio', cookie));
    assert.equal(details.status, 200); assert.equal((await details.json()).samples[0].session, sample.session);
  }
  assert.equal((await api.GET(request(url, secondPc, undefined, { authorization: 'Bearer expired-media-token' }))).status, 200, 'expired media connection does not revoke a valid studio login');
  assert.equal((await api.GET(request(url))).status, 403, 'anonymous reader denied');
  assert.equal((await api.GET(request(url.replace('Poker', 'Other'), secondPc))).status, 403, 'creator cookie is room scoped');
  assert.equal((await api.GET(request(url.replace('studio-default', 'studio-foreign'), secondPc))).status, 403, 'creator cookie is tenant scoped');
  const record = (await store.readRooms()).find(room => room.name === 'Poker');
  const guestResponse = NextResponse.json({});
  setAccessCookie(guestResponse, request('/'), 'guest', 'Poker', record.passwordHash);
  const guestCookie = cookieOf(guestResponse);
  assert.equal(canJoin(request('/', guestCookie), 'Poker', record.passwordHash), true);
  assert.equal((await api.GET(request(url, guestCookie))).status, 403, 'valid guest login cannot read history');
  const invite = await moderator.createRoomModeratorInvite('Poker');
  const accepted = await moderator.acceptRoomModeratorInvite('Poker', invite.id, invite.expiresAt, 'studio-default', record.creatorAccessId);
  const modResponse = NextResponse.json({});
  moderator.setRoomModeratorCookie(modResponse, request('/'), 'Poker', accepted.id, accepted.expiresAt);
  const modCookie = cookieOf(modResponse);
  assert.ok(await moderator.verifiedRoomModeratorSession(request('/', modCookie), 'Poker'));
  assert.equal((await api.GET(request(url, modCookie))).status, 403, 'valid restricted moderator stays restricted');
  await store.updateRooms(rooms => rooms.map(room => room.name === 'Poker' ? { ...room, studioPasswordHash: hashPassword('rotated-password') } : room));
  assert.equal((await api.GET(request(url, firstPc))).status, 403, 'password change revokes the first PC');
  assert.equal((await api.GET(request(url, secondPc))).status, 403, 'password change revokes every prior studio session');
  console.log('PASS: two actual studio logins read the same history without media or primary lease; audio detail, expired media token, anonymous/guest/moderator/room/tenant isolation and password revocation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
