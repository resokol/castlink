const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const access = fs.readFileSync(path.resolve(__dirname, "../lib/studio-owner-access.ts"), "utf8");
const api = fs.readFileSync(path.resolve(__dirname, "../app/api/studio-access/route.ts"), "utf8");
const gate = fs.readFileSync(path.resolve(__dirname, "../components/StudioOwnerGate.tsx"), "utf8");
const studios = fs.readFileSync(path.resolve(__dirname, "../app/studios/page.tsx"), "utf8");

assert.match(access, /cookieName = \(studioId: string\) =>/);
assert.match(access, /kind: "studio-owner-invite", studio: scope/);
assert.match(access, /kind: "studio-owner", studio: scope/);
assert.match(access, /accessStudioMatches\(claims, scope\)/);
assert.match(access, /rotateStudioOwnerAccessVersion/);

assert.match(api, /action === "create-invite"/);
assert.match(api, /resolveStudioRoute\(studioId\)/);
assert.match(api, /new URL\("\/studio", targetOrigin\)/);
assert.match(api, /target\.hash =/);
assert.match(api, /action === "revoke"/);
assert.match(api, /isSuperAdmin\(request\)/);

assert.match(gate, /params\.get\("studioId"\)/);
assert.match(gate, /fragment\.get\("owner"\)/);
assert.match(gate, /\/api\/studio-access/);
assert.match(gate, /action: "accept"/);
assert.match(gate, /handledStudio\.current === studioId/);
assert.match(gate, /setAllowed\(false\)/);

assert.match(studios, /issueOwnerLink/);
assert.match(studios, /openStudio/);
assert.match(studios, /window\.location\.assign\(await issueOwnerLink\(studioId\)\)/);
assert.match(studios, /createOwnerLink/);
assert.match(studios, /revokeOwnerAccess/);
assert.match(studios, /Owner-link/);

console.log("PASS: per-studio owner access is scoped, revocable and owner-link targets assigned node");

// A standalone Next server can retain its internal URL behind the HTTPS proxy.
// Owner links must use the already checked browser Origin when no node route exists.
const { load } = require('./load-typescript.cjs');
const { sameOrigin } = load('../lib/access.ts');
let assigned = { ok: false, reason: 'unassigned' }, authorized = true, issued = 0;
const route = load('../app/api/studio-access/route.ts', {
  '../../../lib/super-admin-access': { isSuperAdmin: async () => authorized },
  '../../../lib/access': { sameOrigin },
  '../../../lib/studio-owner-access': { newStudioOwnerInvite: async () => { issued++; return { invite: 'qa.owner.invite', expiresAt: 123456789 }; } },
  '../../../lib/control-plane-store': { resolveStudioRoute: async () => { if (assigned instanceof Error) throw assigned; return assigned; } },
  '../../../lib/server-log': { requestId: () => 'qa', requestHeaders: (_, extra) => extra, serverLog() {} },
});
function request(origin = 'https://castlink.example') {
  return { headers: new Headers({ origin, host: 'castlink.example' }), nextUrl: new URL('http://127.0.0.1:3000/api/studio-access'), text: async () => JSON.stringify({ action: 'create-invite', studioId: 'studio-default' }) };
}
(async () => {
  for (const state of [{ ok: false, reason: 'unassigned' }, { ok: false, reason: 'assigned_node_unavailable' }, new Error('store unavailable')]) {
    assigned = state;
    const response = await route.POST(request());
    assert.equal(response.status, 200);
    const target = new URL((await response.json()).path);
    assert.equal(target.origin, 'https://castlink.example', 'fallback owner link retains public HTTPS identity behind proxy');
    assert.equal(target.pathname, '/studio');
    assert.equal(target.searchParams.get('studioId'), 'studio-default');
    assert.equal(new URLSearchParams(target.hash.slice(1)).get('owner'), 'qa.owner.invite');
  }
  assigned = { ok: true, endpoint: 'https://assigned.example' };
  const remote = await route.POST(request());
  assert.equal(new URL((await remote.json()).path).origin, 'https://assigned.example', 'healthy assigned node remains authoritative');
  const before = issued;
  assert.equal((await route.POST(request('https://attacker.example'))).status, 403);
  assert.equal(issued, before, 'mismatched Origin never issues an invite');
  authorized = false;
  assert.equal((await route.POST(request())).status, 403);
  assert.equal(issued, before, 'ordinary callers cannot issue an invite');
  console.log('PASS: owner-link fallback uses checked public Origin; assigned-node routing and authorization preserved');
})().catch(error => { console.error(error); process.exitCode = 1; });
