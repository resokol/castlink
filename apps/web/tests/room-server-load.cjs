const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load } = require("./load-typescript.cjs");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-diagnosis-cpu-"));
process.env.STUDIOLINK_DATA_DIR = directory;
process.env.STUDIOLINK_STATS_DIR = path.join(directory, "stats");
const { serverObservabilityStore } = load("../lib/server-observability-store.ts");
const store = serverObservabilityStore();
const { readRoomServerLoad } = load("../lib/room-server-load.ts");
const roomServerLoad = async (...args) => (await readRoomServerLoad(...args)).summary;
const { roomDiagnosticsResponse } = load("../lib/room-diagnostics-export.ts");
const now = Date.now(), base = now - 2 * 3600000;
const sample = (offset, cpuPercent) => ({ at: base + offset, cpuPercent, memoryUsedBytes: 500, memoryTotalBytes: 6000, diskUsedBytes: 900,
  diskTotalBytes: 11110, diskAvailableBytes: 7000, networkInMbps: 924, networkOutMbps: 898, processRssBytes: 1000,
  processUptimeSec: 200, configuredRooms: 13, activeRooms: 9, connections: 99, casters: 37,
  services: { web: "ok", livekit: "ok", roomStore: "ok" } });
async function main() {
  const local = await roomServerLoad(base, now, [], false);
  assert.equal(local.reason, "platform-access-required");
  assert.deepEqual(local.samples, []); assert.deepEqual(local.overlaps, []);
  assert.ok(!fs.existsSync(store.filename), "an ordinary report does not touch SQLite");
  assert.equal((await roomServerLoad(base, now, [], true)).reason, "no-observations");
  assert.ok(!fs.existsSync(store.filename), "an empty node report does not create a monitoring database");
  // One sustained episode. Isolated spikes and gaps > 22.5 seconds cannot create an episode.
  for (const [offset, cpu] of [[-15000, 99], [0, 85], [15000, 90], [30000, 100], [45000, 22],
    [60000, 90], [75000, null], [90000, 95], [121000, 93], [136000, 96], [151000, 80]]) {
    const monitor = sample(offset, cpu);
    if (offset === 15000 || offset === 30000) monitor.services.livekit = "unavailable";
    assert.equal(store.appendSample(monitor), true);
  }
  const findings = [
    { firstAt: base + 1000, lastAt: base + 16000 }, // two measured anchors within the episode
    { firstAt: base - 3000, lastAt: base + 90000 }, // interior spans it, endpoints do not
    { firstAt: base + 30000, lastAt: base + 30000 }, // coincident endpoints count once
  ];
  const result = await roomServerLoad(base, base + 140000, findings, true);
  assert.equal(result.scope, "node-os");
  assert.equal(result.clock, "node-unix-ms");
  assert.equal(result.observedSamples, 8);
  assert.deepEqual(result.elevated, [{ from: base, to: base + 30000, peakPercent: 100, samples: 3 }]);
  assert.deepEqual(result.overlaps.map(row => [row.findingIndex, row.at - base]), [[0,1000], [0,16000], [2,30000]]);
  assert.ok(result.samples.every(row => Object.keys(row).sort().join() === "at,cpuPercent"));
  assert.ok(result.samples.every(row => row.at >= base && row.at <= base + 140000));
  assert.doesNotMatch(JSON.stringify(result), /memory|disk|network|casters|connections|services|configuredRooms/i);
  for (let i = 0; i < 150; i++) assert.equal(store.appendSample(sample(600000 + i * 15000, i % 101)), true);
  const query = new URLSearchParams({ diagnostics: "analysis", nodeId: "forged-node", minutes: "360", to: String(now) });
  const ordinary = await (await roomDiagnosticsResponse("room", query)).json();
  assert.equal(ordinary.serverLoad.reason, "platform-access-required", "query nodeId cannot grant host metrics");
  const platform = await (await roomDiagnosticsResponse("room", query, undefined, "verified-node")).json();
  assert.deepEqual(platform.verdicts, [{location:"inside", reason:"livekit-api-check-failed", at:base+30000}]);
  assert.deepEqual(ordinary.verdicts, [{location:"unknown", reason:"insufficient-data"}]);
  assert.equal(platform.serverLoad.observedSamples, 160);
  query.set("diagnostics", "full");
  const originalRead = store.readCpuSamples.bind(store);
  let reads = 0;
  store.readCpuSamples = (...args) => { reads++; return originalRead(...args); };
  const full = await (await roomDiagnosticsResponse("room", query, undefined, "verified-node")).text();
  const lines = full.trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(lines.at(-1).verdicts, platform.verdicts);
  assert.deepEqual(lines.at(-1).serverLoad, platform.serverLoad);
  const cpuRecords = lines.filter(record => record.type === "server-load-sample").map(record => record.sample);
  assert.ok(cpuRecords.length > 120 && cpuRecords.length > platform.serverLoad.samples.length);
  assert.deepEqual(cpuRecords, originalRead(now - 360 * 60_000, now).samples);
  assert.deepEqual(cpuRecords.find(point => point.at === base + 75000), {at: base + 75000, cpuPercent: null});
  assert.equal(platform.serverLoad.storedSamples, cpuRecords.length);
  assert.equal(reads, 1, "originals and summary use the same SQLite query");
  const roomDownload = await (await roomDiagnosticsResponse("room", query)).text();
  assert.ok(!roomDownload.includes("server-load-sample"));
  assert.equal(reads, 1, "ordinary downloads cannot read monitoring history");
  const { saveRoomSfuEvidence } = load("../lib/room-sfu-evidence.ts");
  for (const offset of [14999, 15000, 30000, 30001]) {
    await saveRoomSfuEvidence("room", { at: base + offset, limited: false,
      tracks: [{ participant: "guest", trackSid: "TR_" + offset, kind: "video", muted: false }] });
  }
  query.set("from", String(base + 15000)); query.set("to", String(base + 30000));
  const clippedResponse = await roomDiagnosticsResponse("room", query, undefined, "verified-node");
  const clipped = (await clippedResponse.text()).trim().split("\n").map(JSON.parse);
  for (const type of ["sfu-sample", "server-load-sample"]) {
    assert.deepEqual(clipped.filter(row => row.type === type).map(row => row.sample.at), [base + 15000, base + 30000], type);
  }
  query.set("diagnostics", "analysis");
  const clippedAnalysis = await (await roomDiagnosticsResponse("room", query, undefined, "verified-node")).json();
  assert.deepEqual(clippedAnalysis, clipped.at(-1));
  const scopedRoom = await (await roomDiagnosticsResponse("room", query)).json();
  assert.equal(scopedRoom.serverLoad.reason, "platform-access-required");
  const empty = await roomServerLoad(base - 3 * 86400000, base - 2 * 86400000, [], true);
  assert.equal(empty.reason, "no-observations");

  // Exercise selection of actual peak times in bounded windows, and the retained episode count.
  const many = Array.from({ length: 400 }, (_, i) => ({ at: base + i * 15000, cpuPercent: i % 4 === 3 ? 70 : 86 + i % 4 }));
  const { readRoomServerLoad: dense } = load("../lib/room-server-load.ts", { "./server-observability-store":
    { serverObservabilityStore: () => ({ readCpuSamples: () => ({ available: true, samples: many }) }) } });
  const { summary: denseReport, originals } = await dense(base, many.at(-1).at, [{ firstAt: many.at(-3).at, lastAt: many.at(-3).at }], true);
  assert.deepEqual(originals, many, "all 400 originals survive the 120-point display limit");
  assert.equal(denseReport.observedSamples, 400);
  assert.ok(denseReport.samples.length <= 120);
  assert.equal(denseReport.elevated.length, 48);
  assert.equal(denseReport.limited, true);
  assert.equal(denseReport.overlaps.length, 1, "a later episode still correlates after display slots fill");
  assert.ok(denseReport.samples.every(point => many.some(raw => raw.at === point.at && raw.cpuPercent === point.cpuPercent)));
  store.close();
  assert.equal((await roomServerLoad(base, now, [], true)).reason, "storage-unavailable");
  console.log("PASS stored CPU only, room access isolation, time selection and retention, threshold duration, missing intervals, exact incident anchors, bounded peak series and episodes, report/download parity");
}
main().finally(() => { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }).catch(error => { console.error(error); process.exitCode = 1; });
