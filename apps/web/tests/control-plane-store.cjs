const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Pool } = require("pg");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL = connectionString;
process.env.CASTLINK_DEFAULT_ORGANIZATION_ID = "org-default";

const store = require("../lib/control-plane-store.ts");
const pool = new Pool({ connectionString, max: 1 });

(async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/control-plane/001_multitenant.sql"), "utf8");
  await pool.query(schema);

  await pool.query("DELETE FROM castlink_control.rooms");
  await pool.query("DELETE FROM castlink_control.studios");
  await pool.query("DELETE FROM castlink_control.organization_members");
  await pool.query("DELETE FROM castlink_control.nodes");
  await pool.query("DELETE FROM castlink_control.organizations");
  await pool.query("DELETE FROM castlink_control.accounts");

  await pool.query("INSERT INTO castlink_control.organizations(organization_id,name) VALUES('org-default','Default')");
  await pool.query(
    `INSERT INTO castlink_control.nodes(
       node_id,name,region,node_type,endpoint,state,health,last_seen_at,
       max_active_studios,max_participants,max_video_tracks,
       active_studios,active_participants,active_video_tracks,cpu_load,memory_load
     ) VALUES
       ('node-vps-01','VPS','frankfurt','cloud','https://vps.example','active','healthy',now(),4,24,32,3,16,20,0.55,0.50),
       ('node-home-01','Home','home','cloud','https://home.example','active','healthy',now(),3,18,24,0,2,2,0.15,0.20)`,
  );

  const studio = await store.createStudio("Tournament");
  assert.equal(studio.organizationId, "org-default");
  assert.match(studio.studioId, /^studio-/);

  const auto = await store.assignStudioAuto(studio.studioId);
  assert.equal(auto.ok, true);
  assert.equal(auto.node.nodeId, "node-home-01");

  let stored = await store.listStudios();
  assert.equal(stored[0].assignedNodeId, "node-home-01");
  assert.equal(stored[0].assignmentMode, "auto");

  const pinned = await store.pinStudio(studio.studioId, "node-vps-01");
  assert.equal(pinned.ok, true);

  stored = await store.listStudios();
  assert.equal(stored[0].assignedNodeId, "node-vps-01");
  assert.equal(stored[0].assignmentMode, "pinned");

  const route = await store.resolveStudioRoute(studio.studioId);
  assert.equal(route.ok, true);
  assert.equal(route.nodeId, "node-vps-01");
  assert.equal(route.endpoint, "https://vps.example");

  await pool.query("UPDATE castlink_control.nodes SET last_seen_at=now()-interval '2 minutes' WHERE node_id='node-vps-01'");
  const staleRoute = await store.resolveStudioRoute(studio.studioId);
  assert.deepEqual(staleRoute, {
    ok: false,
    reason: "assigned_node_unavailable",
    studioId: studio.studioId,
    nodeId: "node-vps-01",
    broadcastState: "idle",
  });
  await pool.query("UPDATE castlink_control.nodes SET last_seen_at=now() WHERE node_id='node-vps-01'");

  const sentAt = Date.now();
  const heartbeatResult = await store.applyNodeHeartbeat({
    schemaVersion: 1,
    nodeId: "node-vps-01",
    sentAt,
    region: "frankfurt",
    nodeType: "cloud",
    activeStudios: 1,
    activeParticipants: 6,
    activeVideoTracks: 8,
    cpuLoad: 0.25,
    memoryLoad: 0.30,
    networkOutMbps: 42,
  });
  assert.equal(heartbeatResult.nodeId, "node-vps-01");

  const nodeAfterHeartbeat = (await store.listControlNodes()).find(node => node.nodeId === "node-vps-01");
  assert.equal(nodeAfterHeartbeat.activeStudios, 1);
  assert.equal(nodeAfterHeartbeat.activeParticipants, 6);
  assert.equal(nodeAfterHeartbeat.activeVideoTracks, 8);
  assert.equal(nodeAfterHeartbeat.cpuLoad, 0.25);
  assert.equal(nodeAfterHeartbeat.memoryLoad, 0.30);

  await assert.rejects(
    store.applyNodeHeartbeat({
      schemaVersion: 1,
      nodeId: "node-vps-01",
      sentAt,
      region: "frankfurt",
      nodeType: "cloud",
      activeStudios: 1,
      activeParticipants: 6,
      activeVideoTracks: 8,
    }),
    /Heartbeat replay or stale timestamp/,
  );

  const healthyRoute = await store.resolveStudioRoute(studio.studioId);
  assert.equal(healthyRoute.ok, true);
  assert.equal(healthyRoute.endpoint, "https://vps.example");

  await assert.rejects(
    store.applyNodeHeartbeat({
      schemaVersion: 1,
      nodeId: "node-vps-01",
      sentAt: Date.now(),
      region: "wrong-region",
      nodeType: "cloud",
      activeStudios: 0,
      activeParticipants: 0,
      activeVideoTracks: 0,
    }),
    /region mismatch/,
  );

  await pool.query("UPDATE castlink_control.studios SET broadcast_state='live' WHERE studio_id=$1", [studio.studioId]);
  const locked = await store.assignStudioAuto(studio.studioId);
  assert.deepEqual(locked, { ok: false, reason: "active_broadcast_locked" });

  const pinOtherWhileLive = await store.pinStudio(studio.studioId, "node-home-01");
  assert.deepEqual(pinOtherWhileLive, { ok: false, reason: "active_broadcast_locked" });

  console.log("PASS: owner control-plane store creates studios, auto-assigns capacity and locks live placement");
})().finally(async () => {
  await store.closeControlPlanePool().catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
