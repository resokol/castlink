const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 1 });
const installationId = randomUUID();

(async () => {
  for (const file of ["001_rooms.sql", "002_studio_scope.sql"]) {
    await pool.query(fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/postgres", file), "utf8"));
  }
  await pool.query(fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/control-plane/001_multitenant.sql"), "utf8"));

  await pool.query("INSERT INTO castlink_installations(installation_id) VALUES($1) ON CONFLICT DO NOTHING", [installationId]);
  await pool.query(
    `INSERT INTO castlink_rooms(installation_id,studio_id,name,studio_only,sort_order)
     VALUES($1,'studio-default','caster',false,0),($1,'studio-default','analyst',true,1)`,
    [installationId],
  );

  const result = spawnSync(process.execPath, ["scripts/control-plane-seed-default.mjs"], {
    cwd: path.resolve(__dirname, "../../.."),
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      CASTLINK_CONTROL_PLANE_DATABASE_URL: connectionString,
      STUDIOLINK_INSTALLATION_ID: installationId,
      STUDIOLINK_DEFAULT_STUDIO_ID: "studio-default",
      CASTLINK_DEFAULT_ORGANIZATION_ID: "org-default",
      CASTLINK_DEFAULT_STUDIO_ID: "studio-default",
      CASTLINK_DEFAULT_ACCOUNT_ID: "account-owner",
      CASTLINK_NODE_ID: "node-vps-01",
      CASTLINK_NODE_NAME: "VPS",
      CASTLINK_NODE_REGION: "frankfurt",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.ok, true);
  assert.equal(output.importedRooms, 2);

  const studios = await pool.query("SELECT organization_id,assigned_node_id FROM castlink_control.studios WHERE studio_id='studio-default'");
  assert.deepEqual(studios.rows, [{ organization_id: "org-default", assigned_node_id: "node-vps-01" }]);

  const rooms = await pool.query("SELECT name,settings FROM castlink_control.rooms WHERE studio_id='studio-default' ORDER BY name");
  assert.deepEqual(rooms.rows.map(row => ({ name: row.name, studioOnly: row.settings.studioOnly })), [
    { name: "analyst", studioOnly: true },
    { name: "caster", studioOnly: false },
  ]);

  const second = spawnSync(process.execPath, ["scripts/control-plane-seed-default.mjs"], {
    cwd: path.resolve(__dirname, "../../.."),
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      CASTLINK_CONTROL_PLANE_DATABASE_URL: connectionString,
      STUDIOLINK_INSTALLATION_ID: installationId,
      CASTLINK_NODE_ID: "node-vps-01",
    },
    encoding: "utf8",
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);

  console.log("PASS: existing single-studio node migrates idempotently into default multi-tenant control-plane scope");
})().finally(async () => {
  await pool.query("DELETE FROM castlink_installations WHERE installation_id=$1", [installationId]).catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
