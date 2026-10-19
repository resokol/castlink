const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-room-creation-'));
Object.assign(process.env, { CASTLINK_STORAGE_BACKEND: 'json', STUDIOLINK_DATA_DIR: dir, STUDIOLINK_ROOMS_FILE: path.join(dir, 'rooms.json'), CASTLINK_DEPLOYMENT_MODEL: 'self-hosted', CASTLINK_HOSTED_ACCESS: '0', CASTLINK_SESSION_SECRET: 'isolated-room-creation-session', LIVEKIT_API_SECRET: 'isolated-room-creation-media' });
delete process.env.ROOM_CREATION_PASSWORD;
delete process.env.ROOM_CREATION_PASSWORD_SHA256;
delete process.env.STUDIOLINK_STUDIO_PASSWORD_HASH;
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) { return resolve.call(this, id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : id, ...args); };
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { NextRequest, NextResponse } = require('next/server');
const request = (body, { cookie = '', origin = 'https://example.test', route = 'room-studio-access', ip = '127.0.0.1' } = {}) => new NextRequest('https://example.test/api/' + route, { method: 'POST', headers: { host: 'example.test', origin, cookie, 'x-real-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const payload = (name = 'mine', creationPassword) => ({ action: 'create', name, studioPassword: 'room-studio-password', password: 'guest-password', ...(creationPassword === undefined ? {} : { creationPassword }) });

(async () => {
  const api = require('../app/api/room-studio-access/route.ts');
  const roomsApi = require('../app/api/rooms/route.ts');
  const store = require('../lib/room-store.ts');
  const limits = require('../lib/rate-limit.ts');
  const access = require('../lib/access.ts');
  const baseline = JSON.stringify(await store.readRooms());
  assert.equal((await api.POST(request(payload()))).status, 503, 'public creation fails closed when creation password is unset');
  for (const invalidConfiguration of ['', '   ', 'x'.repeat(257)]) {
    process.env.ROOM_CREATION_PASSWORD = invalidConfiguration;
    assert.equal((await api.POST(request(payload('unconfigured', invalidConfiguration)))).status, 503, 'invalid server configuration cannot reopen public creation');
  }
  process.env.ROOM_CREATION_PASSWORD = 'creation-only-secret';
  for (const value of [undefined, '', 'wrong', 'room-studio-password', 'guest-password', 42, {}, 'x'.repeat(257)]) {
    assert.equal((await api.POST(request(payload('denied', value)))).status, 403, 'only the separate creation credential grants creation');
  }
  assert.equal(JSON.stringify(await store.readRooms()), baseline, 'failed creation never mutates the real room store');
  assert.equal((await api.POST(request(payload('csrf', 'creation-only-secret'), { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await api.POST(request(payload('missing-origin', 'creation-only-secret'), { origin: '' }))).status, 403);
  const created = await api.POST(request(payload('mine', 'creation-only-secret')));
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { allowed: true, name: 'mine', studioId: 'studio-default' });
  const cookie = created.headers.get('set-cookie').split(';')[0];
  const record = (await store.readRooms()).find(room => room.name === 'mine');
  assert.ok(access.checkPassword('room-studio-password', record.studioPasswordHash));
  assert.ok(!JSON.stringify(record).includes('creation-only-secret'), 'creation credential is not persisted in room data');
  assert.ok(!created.headers.get('set-cookie').includes('creation-only-secret'), 'creation credential never becomes a cookie');
  limits.resetRateLimitsForTests();
  for (const invalidHash of ['malformed', ' '.repeat(64), 'z'.repeat(64)]) {
    process.env.ROOM_CREATION_PASSWORD_SHA256 = invalidHash;
    assert.equal((await api.POST(request(payload('invalid-hash', 'creation-only-secret')))).status, 503, 'malformed preferred hash never falls back to a plaintext credential');
  }
  process.env.ROOM_CREATION_PASSWORD_SHA256 = require('node:crypto').createHash('sha256').update('Пароль $ # " \\').digest('hex');
  assert.equal((await api.POST(request(payload('hash-denied', 'creation-only-secret')))).status, 403, 'configured hash takes precedence over the plaintext legacy option');
  assert.equal((await api.POST(request(payload('hash-created', 'Пароль $ # " \\')))).status, 200, 'hash config supports UTF-8 passwords and Compose punctuation without storing plaintext');
  delete process.env.ROOM_CREATION_PASSWORD_SHA256;
  delete process.env.ROOM_CREATION_PASSWORD;
  assert.equal((await api.POST(request({ action: 'login', name: 'mine', studioPassword: 'room-studio-password' }))).status, 200, 'existing studio login does not depend on the creation credential');
  assert.equal((await api.POST(request({ action: 'login', name: 'mine', studioPassword: 'guest-password' }))).status, 401);
  const guestResponse = NextResponse.json({});
  access.setAccessCookie(guestResponse, request({}), 'guest', 'mine', record.passwordHash);
  const guestCookie = guestResponse.headers.get('set-cookie').split(';')[0];
  assert.equal(access.canJoin(new NextRequest('https://example.test', { headers: { cookie: guestCookie } }), 'mine', record.passwordHash), true, 'caster join is independent of the creation credential');
  for (const auth of ['', cookie, guestCookie]) {
    assert.equal((await roomsApi.POST(request({ action: 'create', name: 'bypass', creationPassword: 'creation-only-secret' }, { cookie: auth, route: 'rooms' }))).status, 401, 'legacy rooms API does not accept guest, room-owner, or creation-password authority');
  }
  process.env.STUDIOLINK_STUDIO_PASSWORD_HASH = access.hashPassword('legacy-staff-password');
  const staffResponse = NextResponse.json({});
  access.setAccessCookie(staffResponse, request({}), 'studio', '', process.env.STUDIOLINK_STUDIO_PASSWORD_HASH);
  const staffCookie = staffResponse.headers.get('set-cookie').split(';')[0];
  assert.equal((await roomsApi.POST(request({ action: 'create', name: 'staff-created' }, { cookie: staffCookie, route: 'rooms' }))).status, 200, 'already authorized staff retain their existing server-side creation rights');
  process.env.ROOM_CREATION_PASSWORD = 'creation-only-secret';
  limits.resetRateLimitsForTests();
  for (let i = 0; i < 20; i++) assert.equal((await api.POST(request(payload('limited', 'wrong')))).status, 403);
  const limited = await api.POST(request(payload('limited', 'creation-only-secret')));
  assert.equal(limited.status, 429, 'bad creation credentials consume the existing rate limit');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.ok(!(await store.readRooms()).some(room => room.name === 'limited'));
  console.log('PASS room creation: separate server secret, fail closed, real store, unchanged login/join, CSRF/rate limit, alternate API guest denial and existing staff authorization');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
