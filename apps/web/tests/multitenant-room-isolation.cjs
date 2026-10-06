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
const { mediaRoomName } = require("../lib/studio-scope.ts");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 2 });
const installationId = randomUUID();
const studioA = "studio-alpha";
const studioB = "studio-bravo";

(async () => {
  const m1 = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/postgres/001_rooms.sql"), "utf8");
  const m2 = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/postgres/002_studio_scope.sql"), "utf8");
  await pool.query(m1);
  await pool.query(m2);
  await pool.query(fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/postgres/003_diagnostic_room_revision.sql"), "utf8"));

  const backend = new PostgresRoomStoreBackend(pool, installationId);
  await backend.update(studioA, () => [{ name: "caster", studioOnly: true }]);
  await backend.update(studioB, () => [{ name: "caster", outputAccessVersion: "b" }]);

  const a = await backend.read(studioA);
  const b = await backend.read(studioB);

  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].name, "caster");
  assert.equal(b[0].name, "caster");
  assert.equal(a[0].studioOnly, true);
  assert.equal(b[0].outputAccessVersion, "b");

  const rows = await pool.query(
    "SELECT studio_id,name FROM castlink_rooms WHERE installation_id=$1 AND name='caster' ORDER BY studio_id",
    [installationId],
  );
  assert.deepEqual(rows.rows.map(row => [row.studio_id, row.name]), [
    [studioA, "caster"],
    [studioB, "caster"],
  ]);

  const mediaA = mediaRoomName(studioA, "caster");
  const mediaB = mediaRoomName(studioB, "caster");
  assert.notEqual(mediaA, mediaB);
  assert.ok(mediaA.endsWith("-caster"));
  assert.ok(mediaB.endsWith("-caster"));
  assert.equal(mediaRoomName("studio-default", "caster"), "caster", "legacy default studio must remain compatible");

  console.log("PASS: identical room names remain isolated by studio in PostgreSQL and LiveKit namespace");
})().finally(async () => {
  await pool.query("DELETE FROM castlink_installations WHERE installation_id=$1", [installationId]).catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
