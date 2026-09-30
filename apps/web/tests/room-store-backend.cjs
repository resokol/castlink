const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const previous = {
  nodeEnv: process.env.NODE_ENV,
  dataDir: process.env.STUDIOLINK_DATA_DIR,
  roomsFile: process.env.STUDIOLINK_ROOMS_FILE,
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-room-store-"));
process.env.NODE_ENV = "development";
process.env.STUDIOLINK_DATA_DIR = root;
delete process.env.STUDIOLINK_ROOMS_FILE;

const store = require("../lib/room-store.ts");

(async () => {
  const initial = await store.readRooms();
  assert.deepEqual(initial, [{ name: "demo-room" }]);

  await store.updateRooms(rooms => [...rooms, { name: "room-b", studioOnly: true }]);
  const afterCreate = await store.readRooms();
  assert.equal(afterCreate.length, 2);
  assert.equal(afterCreate[1].name, "room-b");
  assert.equal(afterCreate[1].studioOnly, true);

  await Promise.all([
    store.updateRooms(rooms => rooms.map(room => room.name === "room-b" ? { ...room, transferRoomId: "a" } : room)),
    store.updateRooms(rooms => rooms.map(room => room.name === "room-b" ? { ...room, outputAccessVersion: "b" } : room)),
  ]);
  const afterSerial = await store.readRooms();
  const roomB = afterSerial.find(room => room.name === "room-b");
  assert.equal(roomB.transferRoomId, "a");
  assert.equal(roomB.outputAccessVersion, "b");

  const raw = JSON.parse(fs.readFileSync(path.join(root, "runtime", "studiolink-rooms.json"), "utf8"));
  assert.equal(raw.schemaVersion, 1);
  assert.ok(Array.isArray(raw.rooms));

  console.log("PASS: room-store backend preserves default room, versioned JSON and serialized mutations");
})().finally(() => {
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.dataDir === undefined) delete process.env.STUDIOLINK_DATA_DIR; else process.env.STUDIOLINK_DATA_DIR = previous.dataDir;
  if (previous.roomsFile === undefined) delete process.env.STUDIOLINK_ROOMS_FILE; else process.env.STUDIOLINK_ROOMS_FILE = previous.roomsFile;
  fs.rmSync(root, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
