const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { consumeRateLimit, rateLimitHeaders, requestSource, resetRateLimitsForTests } = require("../lib/rate-limit.ts");

const request = (ip = "203.0.113.10") => ({ headers: new Headers({ "x-forwarded-for": ip }) });

resetRateLimitsForTests();
const first = consumeRateLimit(request(), { scope: "test", limit: 2, windowMs: 60_000 });
const second = consumeRateLimit(request(), { scope: "test", limit: 2, windowMs: 60_000 });
const denied = consumeRateLimit(request(), { scope: "test", limit: 2, windowMs: 60_000 });
assert.equal(first.ok, true);
assert.equal(second.ok, true);
assert.equal(denied.ok, false);
assert.equal(denied.remaining, 0);
assert.ok(denied.retryAfterSec >= 1);
assert.equal(rateLimitHeaders(denied)["Retry-After"], String(denied.retryAfterSec));

assert.equal(consumeRateLimit(request("203.0.113.11"), { scope: "test", limit: 2, windowMs: 60_000 }).ok, true, "different source gets a separate bucket");
assert.equal(consumeRateLimit(request(), { scope: "other-scope", limit: 1, windowMs: 60_000, subject: "room-a" }).ok, true);
assert.equal(consumeRateLimit(request(), { scope: "other-scope", limit: 1, windowMs: 60_000, subject: "room-b" }).ok, true, "subjects may be scoped below the independent source ceiling");
assert.equal(requestSource({ headers: new Headers({ "x-forwarded-for": "198.51.100.1, 127.0.0.1" }) }), "127.0.0.1");

const sources = {
  auth: fs.readFileSync(path.resolve(__dirname, "../app/api/auth/route.ts"), "utf8"),
  token: fs.readFileSync(path.resolve(__dirname, "../app/api/token/route.ts"), "utf8"),
  rooms: fs.readFileSync(path.resolve(__dirname, "../app/api/rooms/route.ts"), "utf8"),
  studio: fs.readFileSync(path.resolve(__dirname, "../app/api/studio-control/route.ts"), "utf8"),
  participants: fs.readFileSync(path.resolve(__dirname, "../app/api/participants/route.ts"), "utf8"),
  superAdmin: fs.readFileSync(path.resolve(__dirname, "../app/api/super-admin/route.ts"), "utf8"),
  superAdminAccess: fs.readFileSync(path.resolve(__dirname, "../app/api/super-admin-access/route.ts"), "utf8"),
};
for (const [name, source] of Object.entries(sources)) assert.match(source, /consumeRateLimit/, `${name} must use control-plane anti-abuse limiting`);
assert.match(sources.token, /token-issue-source/, "token issue has an IP/source ceiling independent of studio/role");
assert.match(sources.rooms, /rooms-mutation-source/, "room mutations have an IP/source ceiling independent of studio");
assert.match(sources.studio, /studio-control-source/);
assert.match(sources.studio, /studio-heartbeat-source/);
assert.match(sources.participants, /participant-control-source/);

const limiter = fs.readFileSync(path.resolve(__dirname, "../lib/rate-limit.ts"), "utf8");
assert.ok(!/\b(?:livekit|turn|rtp|webrtc)\b/i.test(limiter), "control-plane limiter must not enter the media path");
assert.match(limiter, /control\.rate_limited/, "rejected control requests are audit logged");

console.log("PASS: bounded control-plane anti-abuse limits source/subject floods without touching media path");
