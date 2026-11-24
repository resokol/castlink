const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load } = require("./load-typescript.cjs");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-room-diagnostics-"));
process.env.STUDIOLINK_STATS_DIR = directory;
const store = load("../lib/telemetry-store.ts");
const archives = load("../lib/telemetry-archives.ts");
const openedHours = [];
const seenSfu = [];
const diagnostics = load("../lib/room-diagnostics-export.ts", {
  "./telemetry-archives": { ...archives, async openTelemetryHour(hour, ...args) {
    openedHours.push(hour.hour);
    return archives.openTelemetryHour(hour, ...args);
  } },
  "./room-sfu-evidence": { async *streamRoomSfuEvidence(room, from, to, options) {
    seenSfu.push({ room, from, to, ...options });
    if (!options.session) yield { at: Math.min(from + 2, to), tracks: [], limited: false };
    return { source: "livekit-room-service", samples: [], limited: false };
  } },
});
const room = "scoped-media-room", HOUR = 3600000;
const hour = Math.floor(Date.now() / HOUR) - 3;
const to = (hour + 2) * HOUR, firstAt = hour * HOUR + 100;
const dataDir = store.roomDirectory(room);
fs.mkdirSync(dataDir, { recursive: true });
const make = (at, change = {}) => ({ room, at, clientAt: at - 11, identity: "studio-panel-one", name: "Студия 🐻",
  role: "studio", session: "studio-session-1", state: "connected", quality: "good", uptimeSec: 13, reconnects: 1,
  streams: [
    { id: "a", kind: "audio", direction: "in", participant: "guest-1", audio: { receivedSamplesDelta: 96000, concealedPct: 1 } },
    { id: "v", kind: "video", direction: "out", participant: "studio-panel-one", video: { statsAt: 12, framesEncoded: 20, trackSid: "TR_1" } },
  ], audioPlayback: { enabled: true, muted: false }, videoDiagnosticsLimited: true,
  runtime: { visibility: "visible", browser: "firefox", environment: "desktop", loopLagMs: 12 },
  ...change });
const visit = (mode, extras = {}, target = room, signal) => diagnostics.roomDiagnosticsResponse(target,
  new URLSearchParams({ diagnostics: mode, to: String(to), minutes: "360", ...extras }), signal);
const records = async response => JSON.parse("[" + (await response.text()).trim().split("\n").join(",") + "]");
async function main() {
  const oldFile = path.join(dataDir, hour + ".jsonl"), newFile = path.join(dataDir, (hour + 1) + ".jsonl");
  const sample = make(firstAt);
  sample.runtime.unlisted = "DO_NOT_EXPORT";
  sample.streams[0].audio.unlisted = "DO_NOT_EXPORT";
  sample.streams[1].video.sdp = "DO_NOT_EXPORT";
  sample.secret = "DO_NOT_EXPORT";
  fs.writeFileSync(oldFile, [sample, make(firstAt + 1, {room: "foreign-room"}), make(firstAt + 2, {identity: "other-studio"}),
    make(firstAt + 3, {session: "other-session"}), make(firstAt + 4, {role: "admin"})].map(s => JSON.stringify(s) + "\n").join(""));
  fs.writeFileSync(newFile, JSON.stringify(make(firstAt + HOUR, { streams: [], state: "disconnected" })) + "\n");
  await archives.archiveTelemetryHour((await archives.telemetryHours(dataDir))[0]);
  const filter = { participant: sample.identity, role: sample.role, session: sample.session };
  const res = await visit("full", filter);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /attachment; filename="castlink-diagnostics-.*\.ndjson"/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(openedHours, [], "no disk scan begins before body demand");
  const full = await records(res);
  assert.deepEqual(openedHours, [hour, hour + 1], "one pass across raw and archived hours");
  assert.deepEqual(full.map(r => r.type), ["manifest", "sample", "sample", "summary"]);
  const exported = full[1].sample;
  assert.equal(exported.at, firstAt);
  assert.equal(exported.clientAt, firstAt - 11);
  assert.equal(exported.streams[0].audio.concealedPct, 1);
  assert.equal(exported.streams[1].video.trackSid, "TR_1");
  assert.equal(exported.audioPlayback.enabled, true);
  assert.equal(exported.runtime.loopLagMs, 12);
  assert.equal("packetsSent" in exported.streams[1].video, false, "unrecorded legacy counters remain absent");
  assert.equal(exported.videoDiagnosticsLimited, true);
  assert.ok(!JSON.stringify(full).includes("DO_NOT_EXPORT"));
  assert.equal(full[2].sample.state, "disconnected");
  const footer = full.at(-1);
  assert.equal(footer.sampleCount, 2);
  assert.equal(footer.complete, true);
  assert.equal(footer.firstAt, firstAt);
  assert.equal(footer.lastAt, firstAt + HOUR);
  assert.equal(footer.diagnosis.coverage.samples, 2);
  assert.deepEqual(await (await visit("analysis", filter)).json(), footer, "analysis sees the same evidence as the downloadable footer");
  assert.equal(seenSfu.at(-1).identity, sample.identity);
  assert.equal(seenSfu.at(-1).session, sample.session);
  const rangeEnd = firstAt + 3;
  const range = { from: String(firstAt + 2), to: String(rangeEnd) };
  const scopedResponse = await visit("full", range);
  assert.equal(scopedResponse.headers.get("x-castlink-diagnostics-range"), range.from + "-" + range.to);
  assert.match(scopedResponse.headers.get("content-disposition"), /attachment; filename="castlink-diagnostics-[a-zA-Z0-9_-]+\.ndjson"/);
  const scoped = await records(scopedResponse);
  assert.deepEqual(scoped[0].scope, { room, from: firstAt + 2, to: rangeEnd });
  assert.deepEqual(scoped.filter(r => r.type === "sample").map(r => r.sample.at), [firstAt + 2, rangeEnd]);
  assert.equal(seenSfu.at(-1).from, firstAt + 2);
  assert.equal(seenSfu.at(-1).to, rangeEnd);
  const scopedAnalysis = await visit("analysis", range);
  assert.equal(scopedAnalysis.headers.get("x-castlink-diagnostics-range"), range.from + "-" + range.to);
  assert.deepEqual(await scopedAnalysis.json(), scoped.at(-1));
  const filteredRange = await (await visit("analysis", { ...filter, from: String(firstAt), to: String(firstAt + 4) })).json();
  assert.equal(filteredRange.sampleCount, 1);
  assert.equal(filteredRange.firstAt, firstAt);
  const single = await (await visit("analysis", { from: String(firstAt), to: String(firstAt) })).json();
  assert.equal(single.sampleCount, 1);
  for (const [key, value] of [
    ["from", ""], ["from", " "], ["from", "NaN"], ["from", "123e2"], ["from", "0x123"],
    ["from", String(firstAt + 0.5)], ["from", String(rangeEnd + 1)], ["from", String(rangeEnd - 360 * 60_000 - 1)],
    ["to", ""], ["to", "1e12"], ["to", String(Date.now() + 60_000)], ["minute", String(hour * HOUR)],
  ]) {
    assert.equal((await visit("analysis", { ...range, [key]: value })).status, 400, "invalid " + key + "=" + value);
  }
  for (const duplicate of ["from", "to", "minutes", "diagnostics", "role", "session", "participant"]) {
    const p = new URLSearchParams({ diagnostics: "analysis", minutes: "360", ...range, role: "guest", session: sample.session, participant: sample.identity });
    p.append(duplicate, p.get(duplicate));
    assert.equal((await diagnostics.roomDiagnosticsResponse(room, p)).status, 400, "duplicate " + duplicate);
  }
  assert.equal((await diagnostics.roomDiagnosticsResponse(room, new URLSearchParams({ diagnostics: "analysis", from: range.from }))).status, 400);
  const empty = await (await visit("analysis", { participant: "missing" })).json();
  assert.equal(empty.sampleCount, 0);
  assert.equal(empty.firstAt, null);
  fs.appendFileSync(newFile, "malformed\n" + "x".repeat(3 * 1024 * 1024) + "\ntruncated");
  const withSfu = await records(await visit("full"));
  assert.equal(withSfu.at(-2).type, "sfu-sample");
  const partial = (await records(await visit("full", filter))).at(-1);
  assert.equal(partial.complete, false);
  assert.equal(partial.skippedRecords, 3);
  assert.equal(partial.sampleCount, 2);
  const compressed = oldFile + ".gz";
  const original = fs.readFileSync(compressed);
  fs.writeFileSync(compressed, "damaged gzip");
  const damaged = (await records(await visit("full", filter))).at(-1);
  assert.equal(damaged.complete, false);
  assert.equal(damaged.unreadableHours, 1);
  fs.writeFileSync(compressed, original);
  for (const invalid of [{ minutes: "5" }, { to: "bad" }, { session: "x" }, { role: "bad" }, { limit: "2" }, { cursor: "0:0" }]) {
    assert.equal((await visit("analysis", invalid)).status, 400);
  }
  const first = await visit("full");
  assert.equal((await visit("analysis")).status, 429);
  const other = await visit("full", {}, "second-room");
  assert.equal((await visit("full", {}, "third-room")).status, 429);
  const reader = first.body.getReader();
  await reader.read(); await reader.read();
  await reader.cancel();
  await other.body.cancel();
  const stop = new AbortController();
  const aborted = await visit("full", {}, room, stop.signal);
  const stoppedReader = aborted.body.getReader();
  await stoppedReader.read(); await stoppedReader.read();
  stop.abort();
  await assert.rejects(stoppedReader.read(), /abort/i);
  await new Promise(resolve => setImmediate(resolve));
  const retried = await visit("full"); assert.equal(retried.status, 200); await retried.body.cancel();

  // A 24-hour style selection surpassing the old per-export limits, consumed one line at a time.
  fs.rmSync(compressed);
  const output = fs.openSync(newFile, "w");
  const count = 50010, base = firstAt + HOUR;
  for (let i = 0; i < count; i++) fs.writeSync(output, JSON.stringify(make(base + i)) + "\n");
  fs.closeSync(output);
  const began = performance.now(), startHeap = process.memoryUsage().heapUsed;
  let lines = 0, bytes = 0, maxHeap = startHeap;
  const large = await visit("full", { minutes: "1440" });
  for await (const chunk of large.body) {
    bytes += chunk.byteLength;
    const record = JSON.parse(Buffer.from(chunk).toString());
    if (record.type === "sample") {
      assert.equal(record.sample.at, base + lines++);
      if (!(lines % 1000)) maxHeap = Math.max(maxHeap, process.memoryUsage().heapUsed);
    } else if (record.type === "summary") {
      assert.equal(record.complete, true); assert.equal(record.sampleCount, count);
    }
  }
  assert.equal(lines, count); assert.ok(bytes > 20 * 1024 * 1024);
  console.log(`PASS raw/gzip, access scope filters, allowlisted fields, clock fidelity, same analysis, damaged lines/hours, cancellation, backpressure, concurrency; ${lines} samples, ${(bytes / 1048576).toFixed(1)} MiB, ${((performance.now()-began)/1000).toFixed(2)} s, sampled heap growth ${((maxHeap-startHeap)/1048576).toFixed(1)} MiB`);
}
main().finally(() => fs.rmSync(directory, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1; });
