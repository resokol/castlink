const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
let reads = [];
const access = load('../lib/super-admin-access.ts', {
  './platform-credentials': { readPlatformSession: async token => token === 'platform-session' ? {} : null },
  './control-plane-store': {},
});
const { GET } = load('../app/api/super-admin/events/route.ts', {
  'next/server': { NextResponse }, '@/lib/super-admin-access': access,
  '@/lib/server-observability-store': { serverObservabilityStore: () => ({ readEvents: (level, cursor) => { reads.push([level, cursor]); return { events: [], storage: { state: 'ok', droppedEvents: 0, samplerRunning: true } }; } }) },
});
const request = (query = '', cookies = {}) => ({ nextUrl: new URL(`http://localhost/api/super-admin/events${query}`), cookies: { get: key => cookies[key] ? { value: cookies[key] } : undefined } });
(async () => {
  for (const cookies of [{}, { 'castlink-guest': 'guest' }, { 'castlink-room-admin': 'admin' }, { 'castlink-studio-owner': 'owner' }, { 'castlink-super-admin-v2': 'forged' }]) assert.equal((await GET(request('?level=invalid', cookies))).status, 403);
  assert.equal(reads.length, 0);
  const authorized = { 'castlink-super-admin-v2': 'platform-session' };
  for (const query of ['?level=', '?level=debug', '?cursor=0', '?cursor=-1', '?cursor=9007199254740992', '?cursor=abc', '?path=/etc/passwd', '?level=info&level=error', '?cursor=1&cursor=2']) assert.equal((await GET(request(query, authorized))).status, 400, query);
  assert.equal(reads.length, 0, 'bad queries do not open storage');
  const response = await GET(request('?level=error&cursor=42', authorized));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(reads, [['error', 42]]);
  console.log('PASS: event journal uses dedicated platform session only, validates filter/cursor and denies path parameters before DB access');
})().catch(error => { console.error(error); process.exitCode = 1; });
