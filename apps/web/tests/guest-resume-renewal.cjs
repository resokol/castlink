const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
const resume = load('../lib/guest-resume.ts');
const bearer = load('../lib/session-http-bearer.ts');
const { startRoomTelemetry } = load('../lib/rtc-telemetry.ts', { './guest-resume': resume, './session-http-bearer': bearer });
const original = { fetch: global.fetch, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, sessionStorage: global.sessionStorage, localStorage: global.localStorage };
const tab = new Map(), durable = new Map();
const store = values => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
const now = Math.floor(Date.now() / 1000);
const jwt = (identity, exp) => 'header.' + Buffer.from(JSON.stringify({ iss: 'test', sub: identity, exp, video: { room: 'tenant-one/one' }, metadata: JSON.stringify({ studioId: 'tenant-one', roomDisplayName: 'one', role: 'guest' }) })).toString('base64url') + '.signature';
const source = jwt('guest-one', now + 110), fresh = jwt('guest-one', now + 7200);
const key = resume.guestResumeKey('tenant-one', 'one');
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const makeRoom = () => Object.assign(new EventEmitter(), { state: 'connected', localParticipant: { identity: 'guest-one', name: 'Guest', trackPublications: new Map() }, remoteParticipants: new Map() });
(async () => {
 let stop;
 try {
  global.sessionStorage = store(tab); global.localStorage = store(durable);
  global.setTimeout = () => 1; global.clearTimeout = () => {};
  await resume.requestGuestSession({ studioId: 'tenant-one', room: 'one', name: 'Guest', storage: resume.guestResumeStorage(), fetcher: async () => ({ ok: true, json: async () => ({ token: source, identity: 'guest-one' }) }), claim: async () => true, personalInvite: 'bound-invite' });
  let renewals = 0;
  global.fetch = async url => { if (url.startsWith('/api/token')) renewals++; return { ok: true, json: async () => ({ token: fresh }) }; };
  const room = makeRoom(); stop = startRoomTelemetry(room, 'one', source); await settle();
  assert.equal(JSON.parse(tab.get(key)).token, fresh, 'successful telemetry renewal updates the existing tab resume credential');
  assert.equal(JSON.parse(durable.get(key)).token, fresh, 'successful telemetry renewal updates matching durable recovery');
  assert.equal(JSON.parse(tab.get(key)).entryInvite, 'bound-invite');
  stop(); stop = undefined; await settle();
  stop = startRoomTelemetry(room, 'one', source); await settle();
  assert.equal(renewals, 1, 'same Room retry uses its accepted fresh token instead of the old initial token');
  stop(); stop = undefined; await settle();
  const oldNow = Date.now; Date.now = () => (now + 120) * 1000;
  try {
   let sent;
   const resumed = await resume.requestGuestSession({ studioId: 'tenant-one', room: 'one', name: 'Guest', storage: resume.guestResumeStorage(), claim: async () => true, fetcher: async (url, options) => {
    sent = options.headers.authorization;
    const token = sent?.replace('Bearer ', '');
    if (token && JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).exp * 1000 <= Date.now()) return { ok: false, status: 401 };
    return { ok: true, json: async () => token ? ({ token, identity: 'guest-one' }) : ({ token: jwt('guest-new', now + 8000), identity: 'guest-new' }) };
   } });
   assert.equal(sent, `Bearer ${fresh}`, 'reload after original credential expiry resumes with the renewed token');
   assert.equal(resumed.identity, 'guest-one', 'expired initial token does not force a new guest identity');
  } finally { Date.now = oldNow; }
  // Another tab has replaced the durable recovery with its own credential.
  const other = JSON.stringify({ identity: 'guest-other', token: jwt('guest-other', now + 8000), entryInvite: 'other' });
  tab.set(key, JSON.stringify({ identity: 'guest-one', token: source, entryInvite: 'bound-invite', tabOnly: true })); durable.set(key, other);
  stop = startRoomTelemetry(makeRoom(), 'one', source); await settle(); stop(); stop = undefined;
  assert.equal(JSON.parse(tab.get(key)).token, fresh); assert.equal(JSON.parse(tab.get(key)).tabOnly, true);
  assert.equal(durable.get(key), other, 'renewing a tab-only identity never overwrites another durable caster');
  // Credentials removed while a renewal was in flight must stay removed.
  tab.set(key, JSON.stringify({ identity: 'guest-one', token: source })); durable.set(key, other);
  let complete; global.fetch = async url => url.startsWith('/api/token') ? new Promise(resolve => complete = resolve) : { ok: true };
  stop = startRoomTelemetry(makeRoom(), 'one', source); await settle(); tab.delete(key);
  complete({ ok: true, json: async () => ({ token: fresh }) }); await settle(); stop(); stop = undefined;
  assert.equal(tab.has(key), false, 'late renewal never recreates a cleared credential'); assert.equal(durable.get(key), other);
  // Invalid cross-identity server responses are rejected before persistence.
  tab.set(key, JSON.stringify({ identity: 'guest-one', token: source }));
  global.fetch = async () => ({ ok: true, json: async () => ({ token: jwt('guest-other', now + 8000) }) });
  stop = startRoomTelemetry(makeRoom(), 'one', source); await settle(); stop(); stop = undefined;
  assert.equal(JSON.parse(tab.get(key)).token, source);
  // A fresh source token on the same Room must not inherit its previous lifecycle's cache.
  const replacement = jwt('guest-one', now + 1000); let posted;
  global.fetch = async (url, options) => { assert.equal(url, '/api/stats'); posted = options.headers.authorization; return { ok: true }; };
  stop = startRoomTelemetry(room, 'one', replacement); await settle();
  assert.equal(posted, `Bearer ${replacement}`); stop(); stop = undefined;
  // Storage failures never interrupt successful RTC collection or HTTP renewal.
  global.sessionStorage = { getItem() { throw Error('storage blocked'); } }; global.localStorage = global.sessionStorage;
  global.fetch = async (url, options) => url.startsWith('/api/token') ? { ok: true, json: async () => ({ token: fresh }) } : (posted = options.headers.authorization, { ok: true });
  stop = startRoomTelemetry(makeRoom(), 'one', source); await settle();
  assert.equal(posted, `Bearer ${fresh}`); stop(); stop = undefined;
  console.log('PASS long-call guest resume renewal, same-Room retry, invitation/tab isolation and cleared/invalid credential guards');
 } finally { stop?.(); Object.assign(global, original); }
})().catch(error => { console.error(error); process.exitCode = 1; });
