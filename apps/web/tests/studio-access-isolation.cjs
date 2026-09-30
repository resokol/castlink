const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

process.env.CASTLINK_SESSION_SECRET = "tenant-test-session-secret-123456789";
process.env.LIVEKIT_API_SECRET = "legacy-livekit-secret";
process.env.STUDIOLINK_DEFAULT_STUDIO_ID = "studio-default";

const access = require("../lib/access.ts");
const { mediaRoomName } = require("../lib/studio-scope.ts");

function requestWithCookie(name, value) {
  return {
    cookies: { get: key => key === name ? { value } : undefined },
    headers: new Headers(),
    nextUrl: new URL("https://castlink.test/room"),
  };
}

const studioA = "studio-alpha";
const studioB = "studio-bravo";
const room = "caster";
const hash = access.hashPassword("same-password");

const tokenA = access.signAccess({
  kind: "guest",
  studio: studioA,
  room,
  version: access.roomVersion(hash),
});

const scopedCookieA = "studiolink-room-" + access.roomVersion(studioA + "\0" + room).slice(0, 20);
const reqA = requestWithCookie(scopedCookieA, tokenA);
assert.equal(access.canJoin(reqA, room, hash, studioA), true);
assert.equal(access.canJoin(reqA, room, hash, studioB), false);

const inviteA = access.signAccess({ kind: "invite", studio: studioA, room, version: "invite-v1" });
assert.ok(access.validGuestInvite(inviteA, room, "invite-v1", studioA));
assert.equal(access.validGuestInvite(inviteA, room, "invite-v1", studioB), false);

const viewerA = access.signAccess({ kind: "viewer", studio: studioA, room, version: "viewer-v1" });
const claims = access.readAccess(viewerA);
assert.equal(access.accessStudioMatches(claims, studioA), true);
assert.equal(access.accessStudioMatches(claims, studioB), false);

assert.notEqual(mediaRoomName(studioA, room), mediaRoomName(studioB, room));
assert.equal(mediaRoomName("studio-default", room), room);

console.log("PASS: guest cookies, invites, viewer grants and media rooms are isolated by studioId");
