const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load } = require("./load-typescript.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-minute-"));
process.env.STUDIOLINK_DATA_DIR = dir;
process.env.STUDIOLINK_STATS_DIR = path.join(dir, "stats");
const { roomDiagnosticsResponse } = load("../lib/room-diagnostics-export.ts");
const { roomDirectory } = load("../lib/telemetry-store.ts");
const { serverObservabilityStore } = load("../lib/server-observability-store.ts");
const { collectNodeKeyframes } = load("../lib/node-keyframes.ts");
const minute = Math.floor(Date.now() / 60_000) * 60_000 - 120_000;
const room = "incident-room";

async function testScrape() {
  const originalFetch = global.fetch;
  const originalUrl = process.env.CASTLINK_LIVEKIT_METRICS_URL;
  let requests = 0, incoming = 10, outgoing = 20, boot = 123, node = "ND_fixture", oversize = false;
  global.fetch = async (url, opts) => {
    requests++;
    assert.equal(url.href, "http://livekit:6789/metrics");
    assert.equal(opts.redirect, "error");
    return new Response(oversize ? "x".repeat(512 * 1024 + 1) :
      ["secret_metric{room=\"never_store\"} 4", "process_start_time_seconds " + boot,
        ...[["incoming", incoming], ["outgoing", outgoing]].filter(([, n]) => n !== null).map(([d, n]) =>
          `livekit_keyframe_total{direction="${d}",node_id="${node}",node_type="SERVER"} ${n}`)].join("\n"));
  };
  try {
    delete process.env.CASTLINK_LIVEKIT_METRICS_URL;
    assert.equal(await collectNodeKeyframes(minute), undefined); assert.equal(requests, 0);
    process.env.CASTLINK_LIVEKIT_METRICS_URL = "http://livekit:6789/metrics";
    assert.equal(await collectNodeKeyframes(minute), undefined);
    incoming += 3; outgoing += 17;
    assert.deepEqual(await collectNodeKeyframes(minute + 15000), { from: minute, at: minute + 15000, incoming: 3, outgoing: 17 });
    assert.deepEqual(await collectNodeKeyframes(minute + 30000), { from: minute + 15000, at: minute + 30000, incoming: 0, outgoing: 0 });
    boot++; assert.equal(await collectNodeKeyframes(minute + 45000), undefined);
    node = "ND_next"; assert.equal(await collectNodeKeyframes(minute + 60000), undefined);
    outgoing = null; incoming += 2;
    assert.deepEqual(await collectNodeKeyframes(minute + 75000), { from: minute + 60000, at: minute + 75000, incoming: 2, outgoing: null });
    assert.equal(await collectNodeKeyframes(minute + 115000), undefined);
    oversize = true; assert.equal(await collectNodeKeyframes(minute + 130000), undefined);
    oversize = false; assert.equal(await collectNodeKeyframes(minute + 145000), undefined);
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CASTLINK_LIVEKIT_METRICS_URL;
    else process.env.CASTLINK_LIVEKIT_METRICS_URL = originalUrl;
  }
}

async function testReport() {
  const store = serverObservabilityStore();
  function saveNode(at, from) {
    assert.equal(store.appendSample({ at, cpuPercent: 12, memoryUsedBytes: 1, memoryTotalBytes: 2,
      diskUsedBytes: 3, diskTotalBytes: 4, diskAvailableBytes: 1, networkInMbps: null, networkOutMbps: null,
      processRssBytes: 100, processUptimeSec: 10, configuredRooms: 2, activeRooms: 1, connections: 3, casters: 1,
      services: { web: "ok", livekit: "unavailable", roomStore: "ok" },
      keyframes: { at, from, incoming: 4, outgoing: 10, secret: "MUST_NOT_LEAK" } }), true);
  }
  saveNode(minute + 1000, minute - 14000); saveNode(minute + 16000, minute + 1000);
  function sample(at, id, direction, lossPct, overrides = {}) {
    return { at, room, identity: id, role: id === "sender" ? "guest" : "monitor",
      session: id + "-session-1", state: "connected", reconnects: 2, streams: [
        { id: "main", participant: "sender", trackSid: "TR_video", source: "camera", kind: "video", direction, lossPct, bitrateKbps: 1200 }
      ], ...overrides };
  }
  const rows = [sample(minute - 1, "outside", "out", 50), sample(minute, "sender", "out", 0),
    sample(minute + 40, "receiver1", "in", 12), sample(minute + 60, "receiver2", "in", 0),
    sample(minute + 3000, "sender", "out", 0), sample(minute + 3040, "receiver1", "in", 9),
    sample(minute + 3060, "receiver2", "in", 0), sample(minute + 16000, "receiver1", "in", null, { reconnects: 3 }),
    sample(minute + 17000, "receiver2", "in", null, { streams: [], state: "disconnected" }),
    sample(minute + 18000, "foreign", "in", 20, { room: "elsewhere" }), sample(minute + 60000, "outside", "out", 90)];
  const folder = roomDirectory(room); fs.mkdirSync(folder, { recursive: true });
  for (const sample of rows) fs.appendFileSync(path.join(folder, Math.floor(sample.at / 3600000) + ".jsonl"), JSON.stringify(sample) + "\n");
  const query = new URLSearchParams({ minutes: "15", minute: String(minute), to: String(minute + 60000), diagnostics: "analysis", nodeId: "forged" });
  const report = async (platform = false) => roomDiagnosticsResponse(room, query, undefined, platform ? "trusted-node" : undefined);
  const roomReport = await (await report()).json();
  assert.equal(roomReport.from, minute); assert.equal(roomReport.to, minute + 59999);
  assert.equal(roomReport.sampleCount, 8); assert.equal(roomReport.incident.slots, 12);
  assert.deepEqual(roomReport.incident.node, { samples: [], reason: "platform-access-required" });
  assert.equal(roomReport.incident.paths.length, 3);
  const bad = roomReport.incident.paths.find(p => p.receiver === "receiver1");
  assert.equal(bad.peakLossPct, 12); assert.equal(bad.slotsObserved, 2); assert.equal(bad.peakJitterMs, null);
  const receiver = roomReport.incident.clients.find(c => c.identity === "receiver1");
  assert.equal(receiver.reconnectDelta, 1);
  assert.deepEqual(roomReport.incident.clients.find(c => c.identity === "receiver2").states, ["connected", "disconnected"]);
  assert.ok(roomReport.diagnosis.findings.some(f => f.code === "receiver-path" && f.receiver === "receiver1"));
  const admin = await (await report(true)).json();
  assert.deepEqual(admin.incident.node.samples, [
    { at: minute + 1000, livekit: "unavailable" },
    { at: minute + 16000, livekit: "unavailable", keyframes: { at: minute + 16000, from: minute + 1000, incoming: 4, outgoing: 10 } },
  ]);
  query.set("diagnostics", "full");
  const ndjson = await (await report(true)).text();
  assert.doesNotMatch(ndjson, /MUST_NOT_LEAK|ND_fixture|secret_metric|elsewhere|outside/);
  assert.deepEqual(JSON.parse(ndjson.trim().split("\n").at(-1)), admin);
  query.set("participant", "receiver2"); query.set("diagnostics", "analysis");
  const filtered = await (await report()).json();
  assert.deepEqual(filtered.incident.paths.map(p => p.receiver), ["receiver2"]);
  query.set("minute", String(minute + 1));
  assert.equal((await report()).status, 400);
  store.close();
}

testScrape().then(testReport).then(() => console.log("PASS minute boundaries, comparison, missing data, filters, private node history, exports and bounded scraping"))
  .finally(() => fs.rmSync(dir, { recursive: true, force: true })).catch(err => { console.error(err); process.exitCode = 1; });
