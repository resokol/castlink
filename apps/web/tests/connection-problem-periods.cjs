const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { load } = require("./load-typescript.cjs");
const { connectionProblemPeriods } = load("../lib/connection-problem-periods.ts");
const now = Date.now(), start = now - 360000;
const sample = (offset, streams, extra = {}) => ({ room: "demo", session: "speaker-session", role: "guest",
  identity: "speaker", name: "Speaker", at: start + offset, state: "connected", quality: "good", reconnects: 4, streams, ...extra });
const video = (count = 0, extra = {}) => ({ id: "in:v", participant: "speaker", kind: "video", direction: "in",
  source: "camera", bytes: 123, lostPackets: 987, freezes: count, ...extra });
const block = connectionProblemPeriods(start, now);
const base = sample(0, [video(12)]);
block.add(base);
block.add(sample(2000, [video(12, { lossPct: 12 })]), base);
block.add(sample(4000, [video(14)]), sample(2000, [video(12)]));
block.add(sample(6000, [{ id: "a", kind: "audio", direction: "in", audio: { intervalMs: 2000, concealedPct: 7 } }]));
block.add(sample(16000, [], { state: "reconnecting" }));
const group = block.finish();
assert.equal(group.total, 2);
assert.equal(group.periods[0].reconnect, true, "connection recovery is prioritized");
assert.deepEqual(group.periods[1], { firstAt: start + 2000, lastAt: start + 6000, from: start, to: start + 14000,
  freezes: 2, lossPct: 12, concealedPct: 7, reconnect: false, poorQuality: false });

const clean = connectionProblemPeriods(start, now);
clean.add(base);
clean.add(sample(1000, [video(2)]), base); // counter reset
clean.add(sample(22000, [video(14)], { reconnects: 8 }), base); // unobserved gap
clean.add(sample(3000, [video(15)], { session: "another" }), base);
clean.add(sample(3000, [video(15, { participant: "other" })]), base);
clean.add(sample(3000, [video(15, { video: { trackMuted: true }, lossPct: 50 })]), base);
clean.add(sample(5000, [video(20, { direction: "out", lossPct: 6, peerReport: { fresh: false, ageMs: 10 } })]));
clean.add(sample(6000, [], { state: "disconnected", quality: "poor" }));
clean.add(sample(6001, [{ id: "a", kind: "audio", direction: "in", audio: { intervalMs: 20000, concealedPct: 10 } }]));
assert.equal(clean.finish().total, 0);
const reconnect = connectionProblemPeriods(start, now);
reconnect.add(sample(2000, [], { reconnects: 5 }), base);
assert.equal(reconnect.finish().periods[0].reconnect, true);
const many = connectionProblemPeriods(start, now);
for (let i = 15; i >= 0; i--) many.add(sample(i * 20000, [video(0, { lossPct: 3 + i })]));
assert.equal(many.finish().total, 16);
assert.equal(many.finish().periods.length, 10);
assert.equal(many.finish().periods[0].lossPct, 18);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-suggest-"));
process.env.STUDIOLINK_STATS_DIR = dir;
const { roomDirectory, readHistory } = load("../lib/telemetry-store.ts");
(async () => {
  const room = roomDirectory("demo");
  fs.mkdirSync(room, { recursive: true });
  for (const row of [base, sample(2000, [video(13)], { quality: "poor" }), sample(2000, [], { identity: "host", session: "host-session", role: "studio" })]) {
    fs.appendFileSync(path.join(room, Math.floor(row.at / 3600000) + ".jsonl"), JSON.stringify(row) + "\n");
  }
  const all = await readHistory("demo", 15, undefined, false, undefined, undefined, now);
  assert.equal(all.problemPeriods.periods[0].freezes, 1);
  assert.equal(all.problemPeriods.periods[0].poorQuality, true);
  assert.equal((await readHistory("demo", 15, "host-session", false, "host", "studio", now)).problemPeriods.total, 0);
  console.log("PASS automatic connection periods, counter resets, gaps, ranking, context and filtered history");
})().finally(() => fs.rmSync(dir, { recursive: true, force: true })).catch(e => { console.error(e); process.exitCode = 1; });
