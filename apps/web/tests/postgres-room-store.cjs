const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Pool } = require("pg");
const { randomUUID } = require("node:crypto");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { PostgresRoomStoreBackend } = require("../lib/postgres-room-store.ts");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 4 });
const installationId = randomUUID();

(async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/postgres/001_rooms.sql"), "utf8");
  await pool.query(schema);

  const backend = new PostgresRoomStoreBackend(pool, installationId);
  await assert.rejects(() => backend.validate(), /room store is empty/);

  await backend.update(() => [
    { name: "room-b", studioOnly: true },
    { name: "room-a" },
  ]);
  await backend.validate();

  const first = await backend.read();
  assert.deepEqual(first.map(room => room.name), ["room-b", "room-a"], "room order must be preserved");
  assert.equal(first[0].studioOnly, true);

  await Promise.all([
    backend.update(rooms => rooms.map(room => room.name === "room-b"
      ? { ...room, transferRoomId: "server-a" }
      : room)),
    backend.update(rooms => rooms.map(room => room.name === "room-b"
      ? { ...room, outputAccessVersion: "version-b" }
      : room)),
  ]);

  const afterConcurrent = await backend.read();
  const roomB = afterConcurrent.find(room => room.name === "room-b");
  assert.equal(roomB.transferRoomId, "server-a");
  assert.equal(roomB.outputAccessVersion, "version-b");
  assert.deepEqual(afterConcurrent.map(room => room.name), ["room-b", "room-a"]);

  console.log("PASS: PostgreSQL room store validates non-empty state, preserves order and serializes concurrent mutations");
})().finally(async () => {
  await pool.query("DELETE FROM castlink_installations WHERE installation_id = $1", [installationId]).catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
