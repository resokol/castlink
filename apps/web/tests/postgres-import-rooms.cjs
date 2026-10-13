const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-pg-import-"));
const runtime = path.join(root, "runtime");
fs.mkdirSync(runtime, { recursive: true });
const installationId = randomUUID();
fs.writeFileSync(path.join(root, "installation.json"), JSON.stringify({
  schemaVersion: 1,
  installationId,
  createdAt: new Date().toISOString(),
}));
const roomsFile = path.join(runtime, "studiolink-rooms.json");
const rooms = [
  { name: "z-room", studioOnly: true, guestInviteVersion: "guest-z" },
  { name: "a-room", outputAccessVersion: "out-a" },
];
fs.writeFileSync(roomsFile, JSON.stringify({ schemaVersion: 1, rooms }));

const env = {
  ...process.env,
  DATABASE_URL: connectionString,
  STUDIOLINK_DATA_DIR: root,
  STUDIOLINK_INSTALLATION_ID: installationId,
  STUDIOLINK_DEFAULT_STUDIO_ID: "studio-default",
};

function run(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: path.resolve(__dirname, "../../.."),
    env,
    encoding: "utf8",
  });
}

const pool = new Pool({ connectionString, max: 1 });

(async () => {
  const migrate = run("scripts/postgres-migrate.mjs");
  assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

  const first = run("scripts/postgres-import-rooms.mjs");
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /imported: 2 rooms/);

  const stored = await pool.query(
    "SELECT studio_id, name FROM castlink_rooms WHERE installation_id = $1 ORDER BY studio_id, sort_order, name",
    [installationId],
  );
  assert.deepEqual(stored.rows, [
    { studio_id: "studio-default", name: "z-room" },
    { studio_id: "studio-default", name: "a-room" },
  ]);

  const second = run("scripts/postgres-import-rooms.mjs");
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /no-op:/);

  fs.writeFileSync(roomsFile, JSON.stringify({
    schemaVersion: 1,
    rooms: [...rooms, { name: "new-room" }],
  }));
  const refused = run("scripts/postgres-import-rooms.mjs");
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr + refused.stdout, /already contains different rooms/);

  const replaced = run("scripts/postgres-import-rooms.mjs", ["--replace"]);
  assert.equal(replaced.status, 0, replaced.stderr || replaced.stdout);

  const afterReplace = await pool.query(
    "SELECT studio_id, name FROM castlink_rooms WHERE installation_id = $1 ORDER BY studio_id, sort_order, name",
    [installationId],
  );
  assert.deepEqual(afterReplace.rows, [
    { studio_id: "studio-default", name: "z-room" },
    { studio_id: "studio-default", name: "a-room" },
    { studio_id: "studio-default", name: "new-room" },
  ]);

  console.log("PASS: PostgreSQL migration/import is ordered, idempotent and refuses implicit overwrite");
})().finally(async () => {
  await pool.query("DELETE FROM castlink_installations WHERE installation_id = $1", [installationId]).catch(() => undefined);
  await pool.end();
  fs.rmSync(root, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
