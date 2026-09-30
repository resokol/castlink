const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const logger = fs.readFileSync(path.resolve(__dirname, "../lib/server-log.ts"), "utf8");
const auth = fs.readFileSync(path.resolve(__dirname, "../app/api/auth/route.ts"), "utf8");
const rooms = fs.readFileSync(path.resolve(__dirname, "../app/api/rooms/route.ts"), "utf8");
const token = fs.readFileSync(path.resolve(__dirname, "../app/api/token/route.ts"), "utf8");
const studios = fs.readFileSync(path.resolve(__dirname, "../app/api/studios/route.ts"), "utf8");
const studioAccess = fs.readFileSync(path.resolve(__dirname, "../app/api/studio-access/route.ts"), "utf8");
const heartbeat = fs.readFileSync(path.resolve(__dirname, "../app/v1/nodes/heartbeat/route.ts"), "utf8");
const controlStudio = fs.readFileSync(path.resolve(__dirname, "../app/v1/control/studio/route.ts"), "utf8");
const controlTransfer = fs.readFileSync(path.resolve(__dirname, "../app/v1/control/studio-transfer/route.ts"), "utf8");
const serverTransfer = fs.readFileSync(path.resolve(__dirname, "../app/api/server-transfer/route.ts"), "utf8");

assert.match(logger, /\[redacted\]/);
assert.match(logger, /secret\|token\|password\|authorization\|cookie\|cipher\|invite\|access/i);
assert.match(logger, /x-request-id/);
assert.match(auth, /auth\.allowed/);
assert.match(auth, /auth\.denied/);
assert.match(rooms, /rooms\.mutation/);
assert.match(token, /token\.issued/);
assert.match(studios, /control\.studio\.created/);
assert.match(studios, /control\.studio\.assignment_auto/);
assert.match(studios, /control\.studio\.assignment_pin/);
assert.match(studioAccess, /control\.studio_owner\.accepted/);
assert.match(studioAccess, /control\.studio_owner\.revoked/);
assert.match(heartbeat, /control\.node\.heartbeat/);
assert.match(controlStudio, /control\.studio_read\.allowed/);
assert.match(controlTransfer, /control\.studio_transfer\.committed/);
assert.match(serverTransfer, /transfer\.started/);
assert.match(serverTransfer, /transfer\.start_failed/);
assert.doesNotMatch(logger, /process\.env\.(LIVEKIT_API_SECRET|DATABASE_URL|CASTLINK_SESSION_SECRET|CASTLINK_DATA_ENCRYPTION_KEY)/);

console.log("PASS: structured logging covers auth, rooms, token issuance, control-plane, node heartbeat and failover while redacting sensitive fields");
