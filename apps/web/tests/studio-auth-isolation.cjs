const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const previous = {
  session: process.env.CASTLINK_SESSION_SECRET,
  livekit: process.env.LIVEKIT_API_SECRET,
};
process.env.CASTLINK_SESSION_SECRET = "test-session-secret-for-studio-isolation";
process.env.LIVEKIT_API_SECRET = "legacy-secret";

const access = require("../lib/access.ts");

try {
  const invite = access.signAccess({
    kind: "invite",
    studio: "studio-alpha",
    room: "caster",
    version: "v1",
  });

  assert.ok(access.validGuestInvite(invite, "caster", "v1", "studio-alpha"));
  assert.equal(access.validGuestInvite(invite, "caster", "v1", "studio-bravo"), null);
  assert.equal(access.accessStudioMatches(access.readAccess(invite), "studio-alpha"), true);
  assert.equal(access.accessStudioMatches(access.readAccess(invite), "studio-bravo"), false);

  const moderator = fs.readFileSync(path.resolve(__dirname, "../lib/moderator-access.ts"), "utf8");
  const moderatorApi = fs.readFileSync(path.resolve(__dirname, "../app/api/moderator-access/route.ts"), "utf8");
  const tokenApi = fs.readFileSync(path.resolve(__dirname, "../app/api/token/route.ts"), "utf8");
  const roomsApi = fs.readFileSync(path.resolve(__dirname, "../app/api/rooms/route.ts"), "utf8");
  const invitesApi = fs.readFileSync(path.resolve(__dirname, "../app/api/invites/route.ts"), "utf8");

  assert.match(moderator, /scopedKey\(studioId: string, room: string\)/);
  assert.match(moderator, /studio: scope/);
  assert.match(moderator, /accessStudioMatches\(claims, scope\)/);
  assert.doesNotMatch(moderatorApi, /Модераторы для этой студии пока не включены/);
  assert.match(moderatorApi, /mediaRoomName\(studioId, room\)/);
  assert.match(tokenApi, /verifiedRoomModeratorSession\(request, room, studioId\)/);
  assert.match(tokenApi, /verifiedModeratorVersion\(request, undefined, studioId\)/);
  assert.doesNotMatch(tokenApi, /studioId === defaultStudioId\(\)\s*\?\s*await verified/);
  assert.match(roomsApi, /isModerator\(request, undefined, studioId\)/);
  assert.match(invitesApi, /isModerator\(request, room\.name, studioId\)/);

  console.log("PASS: guest/moderator access is scoped by studio and cross-studio reuse is rejected");
} finally {
  if (previous.session === undefined) delete process.env.CASTLINK_SESSION_SECRET; else process.env.CASTLINK_SESSION_SECRET = previous.session;
  if (previous.livekit === undefined) delete process.env.LIVEKIT_API_SECRET; else process.env.LIVEKIT_API_SECRET = previous.livekit;
}
