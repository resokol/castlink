const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studios/page.tsx"), "utf8");

assert.match(page, /PlatformAccessGate/);
assert.match(page, /fetch\("\/api\/studios"/);
assert.match(page, /action: "create"/);
assert.match(page, /action: "auto"/);
assert.match(page, /action: "pin"/);
assert.match(page, /activeStudios/);
assert.match(page, /activeParticipants/);
assert.match(page, /activeVideoTracks/);
assert.doesNotMatch(page, /DATABASE_URL|CASTLINK_NODE_SECRET|LIVEKIT_API_SECRET/);

console.log("PASS: multi-studio placement UI is platform-gated and consumes sanitized control-plane API only");
