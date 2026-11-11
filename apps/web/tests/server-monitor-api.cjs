const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let samples = 0, windows = [];
class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
const access = load('../lib/super-admin-access.ts', {
  './platform-credentials': { readPlatformSession: async token => token === 'valid-session' ? { principalId: 'platform-owner' } : null },
  './control-plane-store': {},
});
const api = load('../app/api/super-admin/metrics/route.ts', {
  'next/server': { NextResponse },
  '@/lib/server-monitor': { readServerMonitor: async window => { samples++; windows.push(window); return { history: [{ at: 1, connections: 3 }] }; } },
  '@/lib/super-admin-access': access,
});
const request = cookies => ({ cookies: { get: key => cookies[key] ? { value: cookies[key] } : undefined }, nextUrl: new URL('http://localhost/api/super-admin/metrics') });
(async () => {
  for (const cookies of [{}, { 'castlink-guest': 'guest' }, { 'castlink-room-admin': 'admin' }, { 'castlink-studio-owner': 'owner' }, { 'castlink-super-admin-v2': 'forged' }]) {
    const response = await api.GET(request(cookies));
    assert.equal(response.status, 403); assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal(samples, 0, 'unauthorized users never trigger global sampling');
  const response = await api.GET(request({ 'castlink-super-admin-v2': 'valid-session' }));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).history[0].connections, 3);
  assert.equal(samples, 1);
  assert.deepEqual(windows, [3600000]);
  for (const query of ['?range=', '?range=7d', '?range=1h&range=24h', '?path=/etc/passwd']) {
    const bad = request({ 'castlink-super-admin-v2': 'valid-session' }); bad.nextUrl.search = query;
    assert.equal((await api.GET(bad)).status, 400, query);
  }
  assert.equal(samples, 1, 'invalid range/path never reads storage');
  const full = request({ 'castlink-super-admin-v2': 'valid-session' }); full.nextUrl.search = '?range=24h';
  assert.equal((await api.GET(full)).status, 200); assert.equal(windows.at(-1), 86400000);
  console.log('PASS: server metrics deny guests, room admins and studio owners; platform session only, no-store');
})().catch(error => { console.error(error); process.exitCode = 1; });
