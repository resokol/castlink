const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { nodeEligible, selectNode } = require("../lib/node-scheduler.ts");

const now = Date.now();
const base = {
  state: "active",
  health: "healthy",
  lastSeenAt: now,
  maxActiveStudios: 4,
  maxParticipants: 24,
  maxVideoTracks: 32,
  activeStudios: 0,
  activeParticipants: 0,
  activeVideoTracks: 0,
  cpuLoad: 0.2,
  memoryLoad: 0.2,
};

const vps = { ...base, nodeId: "node-vps", name: "VPS", region: "frankfurt", activeStudios: 2, activeParticipants: 10, activeVideoTracks: 12 };
const home = { ...base, nodeId: "node-home", name: "Home", region: "home", activeStudios: 1, activeParticipants: 4, activeVideoTracks: 4 };

const auto = selectNode([vps, home], { studioId: "studio-a", now, expectedParticipants: 4, expectedVideoTracks: 4 });
assert.equal(auto.ok, true);
assert.equal(auto.node.nodeId, "node-home", "scheduler should prefer node with more spare capacity");

const region = selectNode([vps, home], { studioId: "studio-b", now, preferredRegion: "frankfurt", expectedParticipants: 1, expectedVideoTracks: 1 });
assert.equal(region.ok, true);

const full = { ...home, activeStudios: 4 };
assert.equal(nodeEligible(full, { studioId: "studio-c", now }), false);

const stale = { ...home, lastSeenAt: now - 60_000 };
assert.equal(nodeEligible(stale, { studioId: "studio-c", now }), false);

const pinned = selectNode([vps, home], { studioId: "studio-d", now, pinnedNodeId: "node-vps", expectedParticipants: 2, expectedVideoTracks: 2 });
assert.equal(pinned.ok, true);
assert.equal(pinned.reason, "pinned");
assert.equal(pinned.node.nodeId, "node-vps");

const badPinned = selectNode([{ ...vps, health: "offline" }, home], { studioId: "studio-d", now, pinnedNodeId: "node-vps" });
assert.deepEqual(badPinned, { ok: false, reason: "pinned_node_unavailable" });

const none = selectNode([
  { ...vps, activeStudios: 4 },
  { ...home, activeParticipants: 24 },
], { studioId: "studio-e", now });
assert.deepEqual(none, { ok: false, reason: "no_capacity" });

const live = selectNode([vps, home], { studioId: "studio-live", now, activeBroadcast: true });
assert.deepEqual(live, { ok: false, reason: "active_broadcast_locked" });

const tiedA = { ...base, nodeId: "node-a", name: "A", region: "x" };
const tiedB = { ...base, nodeId: "node-b", name: "B", region: "x" };
const deterministic = selectNode([tiedB, tiedA], { studioId: "studio-f", now });
assert.equal(deterministic.ok, true);
assert.equal(deterministic.node.nodeId, "node-a", "tie-break must be deterministic");

console.log("PASS: node scheduler enforces health/capacity, pinning, stable broadcast and deterministic placement");
