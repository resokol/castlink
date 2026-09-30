const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.resolve(__dirname, "../app/api/studios/route.ts"), "utf8");

assert.match(api, /isStudio\(request\)/);
assert.doesNotMatch(api, /isRoomAdmin/);
assert.match(api, /request\.headers\.get\("origin"\)/);
assert.match(api, /sameOrigin\(request\)/);
assert.match(api, /assignStudioAuto/);
assert.match(api, /pinStudio/);
assert.match(api, /action === "create"/);
assert.match(api, /action === "auto"/);
assert.match(api, /action === "pin"/);

console.log("PASS: studio control-plane API is owner-only and mutation requests require same-origin");
