const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const savedDefaults = new Map();
const inviteKeys = new Map();
let records = [{ name: "room-a", guestInviteVersion: "guest-v1" }];
const invalidatedDiagnosticRooms = [];
class NextResponse extends Response {
  static json(value, init = {}) {
    const response = new NextResponse(JSON.stringify(value), init);
    response.cookies = { delete() {}, set() {} };
    return response;
  }
}
const access = {
  isStudio: () => true,
  readAccess: value => JSON.parse(value),
  guestEntryFromAccess: () => ({}),
  sameOrigin: () => true,
  roomVersion: value => "legacy-" + String(value || ""),
  signAccess: data => JSON.stringify({ ...data, exp: Date.now() + 60_000 }),
  validGuestInvite: (value, room, version) => {
    try {
      const claims = JSON.parse(value);
      return claims.kind === "invite" && claims.room === room && claims.version === version && claims.exp > Date.now();
    } catch { return false; }
  },
  canJoin: () => false,
  checkPassword: () => false,
  clearGuestAccess: () => {},
  setAccessCookie: () => {},
};
const roomStore = {
  invalidateDiagnosticReceipts: async (studioId, room) => {
    assert.equal(typeof studioId, "string");
    assert.ok(studioId);
    invalidatedDiagnosticRooms.push(room);
  },
  readRooms: async () => records,
  updateRooms: async change => (records = change(records)),
  ensureRoomAccessVersions: async name => records.find(item => item.name === name),
};
const mocks = {
  "next/server": { NextResponse },
  "../../../lib/guest-invite-key": { createGuestInviteKey: async signed => {const key=require("node:crypto").randomBytes(24).toString("base64url");inviteKeys.set(key,signed);return key;}, resolveGuestInviteKey: async value => inviteKeys.get(value) || value },
  "../../../lib/guest-entry-store": { readGuestEntrySettings: async (_studio, room) => savedDefaults.get(room.creatorAccessId || room.transferRoomId) || ({noGuestAudio:false,startMuted:false,audioOnly:false}), saveGuestEntrySettings: async (_studio, room, settings) => { assert.ok(room.creatorAccessId || room.transferRoomId); savedDefaults.set(room.creatorAccessId || room.transferRoomId, settings); } },
  "@/lib/access": access,
  "@/lib/room-admin": { isRoomAdmin: async () => false },
  "@/lib/moderator-access": { isModerator: async () => false },
  "@/lib/room-store": roomStore,
  "../../../lib/studio-owner-access": { isStudioOwner: async () => true },
  "./studio-owner-access": { isStudioOwner: async () => true },
};
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  return Object.hasOwn(mocks, name) ? mocks[name] : originalLoad.call(this, name, parent, main);
};
const invites = require("../app/api/invites/route.ts");
const auth = require("../app/api/auth/route.ts");
Module._load = originalLoad;

const request = body => ({
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: { get: () => null },
  cookies: { get: () => undefined },
  nextUrl: new URL("https://castlink.test/api"),
});

(async () => {
  const defaults = {audioOnly:true,noGuestAudio:true,startMuted:true};
  const saved = await invites.POST(request({action:"settings",room:"room-a",entrySettings:defaults}));
  assert.equal(saved.status,200);const immutableRoomId = records[0].transferRoomId;assert.ok(immutableRoomId,"legacy save initializes immutable ID under room lock");
  const created = await invites.POST(request({ action: "create", room: "room-a", entrySettings: {audioOnly:true,noGuestAudio:true,startMuted:true} }));
  assert.equal(created.status, 200);
  assert.deepEqual(invalidatedDiagnosticRooms, ["room-a"], "ordinary invite creation must invalidate diagnostic receipts for that room");
  const path = (await created.json()).path;
  const url = new URL(path, "https://castlink.test");
  assert.equal(url.searchParams.get("invite"), null, "invite secret must not be in query");
  const invite = new URLSearchParams(url.hash.slice(1)).get("invite");
  assert.match(invite,/^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(JSON.parse(inviteKeys.get(invite)).entrySettings,{audioOnly:true,noGuestAudio:true,startMuted:true});
  assert.equal(JSON.parse(inviteKeys.get(invite)).version, "guest-v1");

  const accepted = await auth.POST(request({ kind: "guest", room: "room-a", invite }));
  assert.equal(accepted.status, 200);

  const revoked = await invites.POST(request({ action: "revoke", room: "room-a" }));
  assert.equal(revoked.status, 200);
  assert.notEqual(records[0].guestInviteVersion, "guest-v1");
  assert.equal(records[0].transferRoomId,immutableRoomId);
  assert.deepEqual((await (await invites.POST(request({action:"read-settings",room:"room-a"}))).json()).entrySettings,defaults,"revocation preserves defaults");
  records[0]={...records[0],passwordHash:"rotated",guestInviteVersion:"rotated-password"};
  assert.deepEqual((await (await invites.POST(request({action:"read-settings",room:"room-a"}))).json()).entrySettings,defaults,"password rotation preserves defaults");

  const rejected = await auth.POST(request({ kind: "guest", room: "room-a", invite }));
  assert.equal(rejected.status, 401, "revoked guest link must stop authorizing immediately");

  console.log("PASS: guest invite fragment, independent version and explicit revocation");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
