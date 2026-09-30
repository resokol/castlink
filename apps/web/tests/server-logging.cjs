const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const logger = fs.readFileSync(path.resolve(__dirname, "../lib/server-log.ts"), "utf8");
const auth = fs.readFileSync(path.resolve(__dirname, "../app/api/auth/route.ts"), "utf8");
const rooms = fs.readFileSync(path.resolve(__dirname, "../app/api/rooms/route.ts"), "utf8");
const token = fs.readFileSync(path.resolve(__dirname, "../app/api/token/route.ts"), "utf8");

assert.match(logger, /\[redacted\]/);
assert.match(logger, /secret\|token\|password\|authorization\|cookie\|cipher\|invite\|access/i);
assert.match(logger, /x-request-id/);
assert.match(auth, /auth\.allowed/);
assert.match(auth, /auth\.denied/);
assert.match(rooms, /rooms\.mutation/);
assert.match(token, /token\.issued/);
assert.doesNotMatch(logger, /process\.env\.(LIVEKIT_API_SECRET|DATABASE_URL|CASTLINK_SESSION_SECRET|CASTLINK_DATA_ENCRYPTION_KEY)/);

console.log("PASS: structured logging uses correlation IDs and redacts sensitive field names");
