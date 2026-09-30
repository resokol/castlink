const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const repoRoot = path.resolve(__dirname, "../../..");
const pool = new Pool({ connectionString, max: 1 });

function run(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/control-plane-register-node.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CASTLINK_CONTROL_PLANE_DATABASE_URL: connectionString,
      CASTLINK_REGISTER_NODE_ID: "node-route-test",
      CASTLINK_REGISTER_NODE_NAME: "Route Test",
      CASTLINK_REGISTER_NODE_REGION: "frankfurt",
      CASTLINK_REGISTER_NODE_TYPE: "cloud",
      CASTLINK_REGISTER_NODE_ENDPOINT: "https://route-a.example",
      CASTLINK_REGISTER_MAX_STUDIOS: "4",
      CASTLINK_REGISTER_MAX_PARTICIPANTS: "24",
      CASTLINK_REGISTER_MAX_VIDEO_TRACKS: "32",
      ...overrides,
    },
  });
}

(async () => {
  const schema = fs.readFileSync(path.join(repoRoot, "infrastructure/control-plane/001_multitenant.sql"), "utf8");
  await pool.query(schema);
  await pool.query("DELETE FROM castlink_control.studios WHERE assigned_node_id='node-route-test'");
  await pool.query("DELETE FROM castlink_control.nodes WHERE node_id='node-route-test'");

  const first = run();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const created = await pool.query(
    "SELECT node_id,endpoint,max_active_studios,max_participants,max_video_tracks FROM castlink_control.nodes WHERE node_id='node-route-test'",
  );
  assert.equal(created.rowCount, 1);
  assert.equal(created.rows[0].endpoint, "https://route-a.example");
  assert.equal(created.rows[0].max_active_studios, 4);

  const second = run({
    CASTLINK_REGISTER_NODE_ENDPOINT: "https://route-b.example",
    CASTLINK_REGISTER_MAX_STUDIOS: "6",
    CASTLINK_REGISTER_MAX_PARTICIPANTS: "30",
    CASTLINK_REGISTER_MAX_VIDEO_TRACKS: "40",
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);

  const updated = await pool.query(
    "SELECT endpoint,max_active_studios,max_participants,max_video_tracks FROM castlink_control.nodes WHERE node_id='node-route-test'",
  );
  assert.equal(updated.rowCount, 1);
  assert.equal(updated.rows[0].endpoint, "https://route-b.example");
  assert.equal(updated.rows[0].max_active_studios, 6);
  assert.equal(updated.rows[0].max_participants, 30);
  assert.equal(updated.rows[0].max_video_tracks, 40);

  console.log("PASS: control-plane node registration is idempotent and updates routing/capacity");
})().finally(async () => {
  await pool.query("DELETE FROM castlink_control.nodes WHERE node_id='node-route-test'").catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
