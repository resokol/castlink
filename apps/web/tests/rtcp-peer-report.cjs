const assert = require("node:assert/strict");
const { load } = require("./load-typescript.cjs");
const { observePeerReport, sanitizePeerReport } = load("../lib/rtcp-peer-report.ts");
const { sanitizeTelemetryStreams } = load("../lib/telemetry-sanitize.ts");
const { telemetryBody } = load("../lib/video-diagnostics.ts");

const local = { type: "outbound-rtp", id: "local", remoteId: "RR", ssrc: 123, kind: "video", timestamp: 10000, packetsSent: 100 };
const rr = { type: "remote-inbound-rtp", id: "RR", localId: "local", ssrc: 123, timestamp: 9800, reportsReceived: 12,
  fractionLost: .0625, packetsLost: 3, secret: "TURN password" };
const first = observePeerReport("out", local, rr);
assert.equal(first.report.fresh, false);
const stale = observePeerReport("out", { ...local, timestamp: 12000, packetsSent: 140 }, rr, first.marker);
assert.equal(stale.report.fresh, false);
assert.equal(stale.marker.localPackets, 100, "duplicate must not move the original RR baseline");
const fresh = observePeerReport("out", { ...local, timestamp: 14000, packetsSent: 200 },
  { ...rr, timestamp: 13800, reportsReceived: 13, bytesSent: 1 }, stale.marker);
assert.deepEqual(fresh.report, { kind: "remote-inbound-rtp", fresh: true, ageMs: 200, fractionLost: .0625 });
assert.equal(fresh.lossPct, 6.25);
const delta = observePeerReport("out", { ...local, timestamp: 14000, packetsSent: 200 },
  { ...rr, timestamp: 13800, reportsReceived: 13, fractionLost: undefined, packetsLost: 8 }, stale.marker);
assert.equal(delta.lossPct, 5);
for (const changed of [{ localId: "other" }, { id: "wrong" }, { type: "remote-outbound-rtp" }, { ssrc: 321 }, { kind: "audio" }, { timestamp: 10001 }]) {
  assert.equal(observePeerReport("out", local, { ...rr, ...changed }), undefined);
}
for (const [at, timestamp, reports] of [[12000,11900,12], [28000,11900,13], [19000,18900,11], [26000,25900,13]]) {
  const obs = observePeerReport("out", { ...local, timestamp: at }, { ...rr, timestamp, reportsReceived: reports }, first.marker);
  assert.equal(obs.report.fresh, false);
  assert.equal(obs.lossPct, null);
}
const down = { ...local, remoteId: undefined, id: "inbound", packetsReceived: 50, timestamp: 15000 };
const sr = { id: "SR", localId: "inbound", type: "remote-outbound-rtp", timestamp: 14000, remoteTimestamp: 1, reportsSent: 11,
  bytesSent: 45678, packetsSent: 50 };
const sr1 = observePeerReport("in", down, sr);
const sr2 = observePeerReport("in", { ...down, timestamp: 18000 }, { ...sr, timestamp: 17000, reportsSent: 13, packetsSent: 55 }, sr1.marker);
assert.deepEqual(sr2.report, { kind: "remote-outbound-rtp", fresh: true, ageMs: 1000, bytesSent: 45678, packetsSent: 55 });
const sent = { ...sr, timestamp: 17000, remoteTimestamp: 2001, reportsSent: 13, bytesSent: 55678, packetsSent: 55 };
const egress = observePeerReport("in", { ...down, timestamp: 18000 }, sent, sr1.marker);
assert.equal(egress.report.egressKbps, 40, "LiveKit egress uses the elapsed time on its own sender-report clock");
assert.equal(egress.report.egressIntervalMs, 2000);
for (const override of [{ remoteTimestamp: 0 }, { remoteTimestamp: undefined }, { remoteTimestamp: 20001 }, { bytesSent: 1 }, { reportsSent: 11 }]) {
  assert.equal(observePeerReport("in", { ...down, timestamp: 18000 }, { ...sent, ...override }, sr1.marker).report.egressKbps, undefined);
}
assert.equal(sanitizePeerReport({ ...egress.report, fresh: false }, "in").egressKbps, undefined);
assert.equal(sanitizePeerReport({ ...egress.report, egressIntervalMs: 2 }, "in").egressKbps, undefined);
assert.equal(observePeerReport("in", { ...down, packetsReceived: 1, timestamp: 18000 },
  { ...sr, timestamp: 17000, reportsSent: 13 }, sr1.marker).report.fresh, false);
assert.equal(sanitizePeerReport({ ...fresh.report, ageMs: 6001 }, "out").fresh, false);
assert.equal(sanitizePeerReport(fresh.report, "in"), undefined);
const safe = sanitizeTelemetryStreams([{ direction: "out", kind: "audio", trackSid: "TR_abc123", peerReport: { ...fresh.report, ip: "private", bytesSent: 99 } }])[0];
assert.deepEqual(safe.peerReport, fresh.report);
assert.equal(safe.trackSid, "TR_abc123");
assert.equal(sanitizeTelemetryStreams([{ direction: "out", kind: "audio" }])[0].peerReport, undefined);
const stress = { at: Date.now(), streams: Array.from({length: 245}, () => ({ ...safe, name: 'x'.repeat(60) })) };
const bounded = telemetryBody(stress);
assert.ok(Buffer.byteLength(bounded) <= 100_000);
const body = JSON.parse(bounded);
assert.equal(body.peerReportsLimited, true);
assert.ok(body.streams.every(s => s.kind === "audio"));
console.log("PASS linked RTCP reports, stale/reset/reconnect baseline, native loss, counter fallback, subscriber sender reports, allowlists and upload budget");
