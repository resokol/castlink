const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 1 });

(async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/control-plane/001_multitenant.sql"), "utf8");
  await pool.query(schema);

  await pool.query("DELETE FROM castlink_control.organization_members");
  await pool.query("DELETE FROM castlink_control.rooms");
  await pool.query("DELETE FROM castlink_control.studios");
  await pool.query("DELETE FROM castlink_control.nodes");
  await pool.query("DELETE FROM castlink_control.organizations");
  await pool.query("DELETE FROM castlink_control.accounts");

  await pool.query("INSERT INTO castlink_control.accounts(account_id, email) VALUES ('acct-001','a@example.invalid')");
  await pool.query("INSERT INTO castlink_control.organizations(organization_id,name) VALUES ('org-alpha','Alpha'),('org-beta1','Beta')");
  await pool.query("INSERT INTO castlink_control.organization_members(organization_id,account_id,role) VALUES ('org-alpha','acct-001','owner')");
  await pool.query("INSERT INTO castlink_control.nodes(node_id,name,region,node_type,health,last_seen_at) VALUES ('node-vps-01','VPS','frankfurt','cloud','healthy',now())");
  await pool.query("INSERT INTO castlink_control.studios(studio_id,organization_id,name,assigned_node_id) VALUES ('studio-a1','org-alpha','Main','node-vps-01'),('studio-b1','org-beta1','Main','node-vps-01')");
  await pool.query("INSERT INTO castlink_control.rooms(room_id,studio_id,name) VALUES ('room-a1','studio-a1','caster'),('room-b1','studio-b1','caster')");

  const sameName = await pool.query("SELECT studio_id,name FROM castlink_control.rooms WHERE name='caster' ORDER BY studio_id");
  assert.deepEqual(sameName.rows, [
    { studio_id: "studio-a1", name: "caster" },
    { studio_id: "studio-b1", name: "caster" },
  ]);

  await assert.rejects(
    pool.query("INSERT INTO castlink_control.rooms(room_id,studio_id,name) VALUES ('room-a2','studio-a1','caster')"),
    /duplicate key|unique/i,
  );

  const legacy = await pool.query("SELECT to_regclass('public.castlink_rooms') AS legacy, to_regclass('castlink_control.rooms') AS control");
  assert.ok(legacy.rows[0].legacy, "node-local room table must coexist");
  assert.equal(legacy.rows[0].control, "castlink_control.rooms");

  console.log("PASS: control-plane schema isolates same-name rooms by studio and coexists with node-local storage");
})().finally(async () => {
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
