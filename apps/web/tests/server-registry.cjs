const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.resolve(__dirname, "../app/api/servers/route.ts"), "utf8");
const page = fs.readFileSync(path.resolve(__dirname, "../app/servers/page.tsx"), "utf8");
const client = fs.readFileSync(path.resolve(__dirname, "../lib/server-registry-client.ts"), "utf8");

assert.match(api, /isSuperAdmin\(request\)/);
assert.doesNotMatch(api, /isRoomAdmin/);
assert.match(api, /request\.headers\.get\("origin"\)/);
assert.match(api, /sameOrigin\(request\)/);
assert.match(client, /Authorization: `Bearer \$\{lease\}`/);
assert.doesNotMatch(page, /CASTLINK_SERVER_LEASE|Authorization/);
assert.match(page, /PlatformAccessGate/);
assert.match(page, /TEMPORARY PRIVATE NODE/);
assert.match(page, /action: "temporary"/);
assert.match(page, /action: "deactivate"/);

console.log("PASS: server registry is Super-Admin-only and keeps signed lease server-side");
