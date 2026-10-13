const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.resolve(__dirname, "../app/api/studio-route/route.ts"), "utf8");
const store = fs.readFileSync(path.resolve(__dirname, "../lib/control-plane-store.ts"), "utf8");

assert.match(api, /canJoin\(request, roomName, room\.passwordHash, studioId\)/);
assert.match(api, /currentStudioRoute\(studioId\)/);
assert.match(api, /owner \? route : \{/);
assert.match(api, /endpoint: route\.endpoint/);
assert.doesNotMatch(api, /listControlNodes/);

assert.match(store, /assigned_node_id/);
assert.match(store, /n\.endpoint/);
assert.match(store, /row\.state === "active"/);
assert.match(store, /row\.health === "healthy"/);
assert.match(store, /Date\.now\(\) - lastSeenAt <= 45_000/);
assert.match(store, /Node endpoint must use HTTPS/);

console.log("PASS: studio routing exposes only assigned healthy node and guest access is studio-scoped");
