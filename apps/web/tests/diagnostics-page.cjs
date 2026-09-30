const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../app/diagnostics/page.tsx"), "utf8");
assert.match(source, /fetch\("\/api\/health"/);
assert.match(source, /CastLink Diagnostics/);
assert.doesNotMatch(source, /LIVEKIT_API_SECRET|DATABASE_URL|CASTLINK_SESSION_SECRET|CASTLINK_DATA_ENCRYPTION_KEY/);

console.log("PASS: diagnostics page consumes sanitized health endpoint only");
