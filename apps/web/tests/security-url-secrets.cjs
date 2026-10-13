const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const invites = read("app/api/invites/route.ts");
const studio = read("components/StudioWorkspace.tsx");
const output = read("app/output/[identity]/page.tsx");
const token = read("app/api/token/route.ts");
const telemetry = read("lib/rtc-telemetry.ts");

assert.match(invites, /#invite=/, "new guest invites must use URL fragments");
assert.doesNotMatch(invites, /[?&]invite=/, "guest invite secrets must not be generated in query strings");
assert.match(studio, /#access=/, "new clean-output links must use URL fragments");
assert.doesNotMatch(studio, /&access=/, "clean-output access secrets must not be generated in query strings");
assert.match(output, /x-castlink-view-access/, "output access must be exchanged through a request header");
assert.match(output, /sessionStorage\.setItem/, "output fragment access must survive a local browser-input reload without staying in the URL");
assert.doesNotMatch(output, /&access=/, "output token request must not send access in query");
assert.match(token, /x-castlink-view-access/, "token endpoint must accept the protected viewer access header");
assert.doesNotMatch(telemetry, /[?&]access=/, "token renewal must not reintroduce access secrets into query strings");

console.log("PASS: guest/output secrets are generated in fragments and exchanged outside URL query");
