const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../app/api/health/route.ts"), "utf8");

assert.match(source, /status: ok \? "ok" : "degraded"/);
assert.match(source, /LIVEKIT_SERVER_URL/);
assert.match(source, /CASTLINK_TURN_HEALTH_HOST/);
assert.match(source, /storageBackend/);
assert.doesNotMatch(source, /LIVEKIT_API_SECRET|CASTLINK_SESSION_SECRET|CASTLINK_DATA_ENCRYPTION_KEY/);

console.log("PASS: health endpoint exposes component status without embedding application secrets");
