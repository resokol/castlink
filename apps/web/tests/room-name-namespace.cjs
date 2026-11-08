const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-room-namespace-"));
process.env.STUDIOLINK_DATA_DIR = root;
process.env.CASTLINK_STORAGE_BACKEND = "json";
process.env.CASTLINK_HOSTED_ACCESS = "0";
process.env.CASTLINK_SESSION_SECRET = "local-namespace-fixture-secret";

const access = require("../lib/access.ts");
const store = require("../lib/room-store.ts");
const { mediaRoomName } = require("../lib/studio-scope.ts");
const actor = request => request.cookies.get("actor")?.value;
const load = Module._load;
let liveKitCalls = 0;
Module._load = function(id, parent, main) {
  if (id === "@/lib/access") return access;
  if (id === "@/lib/room-store") return store;
  if (id === "@/lib/room-admin") return { isRoomAdmin: async () => false };
  if (id === "@/lib/moderator-access") return { isModerator: async request => actor(request) === "moderator", verifiedRoomModeratorSession: async () => null };
  if (id === "@/lib/studio-control") return { readStudioState: async () => ({ desired: {}, actual: null }) };
  if (id.endsWith("/studio-owner-access")) return { isStudioOwner: async request => actor(request) === "owner" };
  if (id.endsWith("/room-studio-access")) return {
    canHostRoom: async request => ["owner", "creator"].includes(actor(request)),
    verifiedRoomStudioSession: request => actor(request) === "creator" ? { id: "fixture-creator" } : null,
    requireRoomCreatorUnchanged() {},
  };
  if (id === "livekit-server-sdk") return { RoomServiceClient: class {
    async listRooms() { liveKitCalls++; return []; }
    async listParticipants() { liveKitCalls++; return []; }
  } };
  if (id.endsWith("/rate-limit")) return { consumeRateLimit: () => ({ ok: true }), rateLimitHeaders: () => ({}) };
  return load.call(this, id, parent, main);
};
const { NextRequest } = require("next/server");
const route = require("../app/api/rooms/route.ts");
function request(principal, body) {
  return new NextRequest("https://fixture.invalid/api/rooms", {
    method: "POST", headers: { host: "fixture.invalid", origin: "https://fixture.invalid", cookie: `actor=${principal}` }, body: JSON.stringify(body),
  });
}

(async () => {
  try {
    await store.updateRooms(() => [{ name: "source" }]);
    const collision = mediaRoomName("studio-victim", "private");
    assert.equal(mediaRoomName("studio-default", collision), collision, "reserved names alias another tenant's literal LiveKit namespace");
    const forbidden = [collision, "S-tenant-private", "castlink-view-private", "CastLink-View-private", "bad\u0000name", "bad\nname"];
    for (const principal of ["owner", "moderator"]) {
      for (const name of forbidden) {
        const before = await store.readRooms();
        assert.equal((await route.POST(request(principal, { action: "create", name }))).status, 400, `${principal} cannot create reserved/control-character names`);
        assert.equal((await route.POST(request(principal, { action: "rename", name: "source", newName: name }))).status, 400, `${principal} cannot rename into reserved/control-character names`);
        assert.deepEqual(await store.readRooms(), before, "invalid names must not mutate stored rooms");
      }
    }
    for (const newName of forbidden) assert.equal((await route.POST(request("creator", { action: "rename", name: "source", newName }))).status, 400);
    assert.equal(liveKitCalls, 0, "reject invalid names before contacting LiveKit");

    for (const [principal, name] of [["owner", "  Прямой эфир 01: камера_2.  "], ["moderator", "Room — North (A)"]]) {
      assert.equal((await route.POST(request(principal, { action: "create", name }))).status, 200);
      assert.ok((await store.readRooms()).some(room => room.name === name.trim()));
      assert.equal((await route.POST(request(principal, { action: "rename", name: name.trim(), newName: `${name.trim()} next` }))).status, 200);
    }
    const legacyName = "s-existing-legacy";
    await store.updateRooms(rooms => [...rooms, { name: legacyName }]);
    const legacyRead = await route.GET(new NextRequest(`https://fixture.invalid/api/rooms?name=${legacyName}`, { headers: { cookie: "actor=owner" } }));
    assert.equal((await legacyRead.json()).exists, true);
    assert.equal((await route.POST(request("owner", { action: "mode", name: legacyName, studioOnly: true }))).status, 200);
    assert.equal((await route.POST(request("owner", { action: "password", name: legacyName, password: "" }))).status, 200);
    assert.ok((await store.readRooms()).some(room => room.name === legacyName && room.studioOnly));
    assert.equal(mediaRoomName("studio-default", legacyName), legacyName, "existing room routing is unchanged");
    console.log("PASS: room creation and rename reserve internal media namespaces for every actor while preserving legitimate names and existing rooms");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
