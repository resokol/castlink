const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const ts = require("typescript");

Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-room-access-"));
const file = path.join(dir, "rooms.json");
const previous = process.env.STUDIOLINK_ROOMS_FILE;
process.env.STUDIOLINK_ROOMS_FILE = file;
fs.writeFileSync(file, JSON.stringify([{ name: "legacy-open" }, { name: "legacy-protected", passwordHash: "salt:hash" }]));

const { ensureRoomAccessVersions, readRooms } = require("../lib/room-store.ts");
const legacy = value => crypto.createHash("sha256").update(value || "").digest("hex");

(async () => {
  const open = await ensureRoomAccessVersions("legacy-open");
  assert.equal(open.guestInviteVersion, legacy(""));
  assert.equal(open.viewerAccessVersion, legacy(""));
  assert.equal(open.outputAccessVersion, legacy(""));

  const protectedRoom = await ensureRoomAccessVersions("legacy-protected");
  assert.equal(protectedRoom.guestInviteVersion, legacy("salt:hash"));
  assert.equal(protectedRoom.viewerAccessVersion, legacy("salt:hash"));
  assert.equal(protectedRoom.outputAccessVersion, legacy("salt:hash"));

  const reread = await readRooms();
  assert.equal(reread.find(room => room.name === "legacy-open").guestInviteVersion, legacy(""));
  console.log("PASS: legacy access versions bootstrap compatibly and persist");
})().finally(() => {
  if (previous === undefined) delete process.env.STUDIOLINK_ROOMS_FILE;
  else process.env.STUDIOLINK_ROOMS_FILE = previous;
  fs.rmSync(dir, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
