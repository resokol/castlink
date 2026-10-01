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
