import type { StreamStat, TelemetrySample } from "./telemetry-types";

export type RoomMediaFindingCode = "sender-cpu" | "sender-bandwidth" | "sender-loss" |
  "receiver-decode" | "receiver-path" | "shared-path" | "unlocalized";

type Evidence = Partial<Record<"lossPct" | "concealedPct" | "freezes" | "droppedPct" | "healthyReceivers" |
  "affectedReceivers" | "senderLossPct" | "sfuEgressPacketsDelta" | "sfuEgressBytesDelta" | "decodedFrames" | "receivedFrames" | "decodeMsPerFrame" | "outboundKbps" | "availableOutgoingKbps" | "encodeMsPerFrame" | "fps" | "jitterMs", number>>;

export type RoomMediaFinding = {
  code: RoomMediaFindingCode;
  side: "sender" | "receiver" | "shared" | "unknown";
  confidence: "observed" | "likely" | "unknown";
  source: string; mediaSource: string; kind: StreamStat["kind"]; receiver: string | null;
  firstAt: number; lastAt: number; intervals: number; evidence: Evidence; receivers: string[];
};

export type RoomMediaDiagnosis = {
  coverage: {
    samples: number; firstAt: number | null; lastAt: number | null; participants: number;
    inbound: number; outbound: number; evaluable: number; detailedVideo: number; limited: boolean;
  };
  findings: RoomMediaFinding[];
};

// Collection runs every two seconds. Correlate by server receipt time, never by
// the independently clocked statsAt/clientAt of different browsers.
const MATCH_MS = 2500;
const MAX_COUNTER_GAP = 8000;
const MAX_FINDINGS = 48;

type Observation = {
  at: number; source: string; mediaSource: string; kind: StreamStat["kind"];
  receiver: string | null; session: string; publication: string; inactive: boolean; active: boolean; pixels?: number;
  cpu: boolean; bandwidth: boolean; decode: boolean; slowDecode: boolean; allSenderReportsFresh: boolean; evidence: Evidence;
};

type Bucket = { count: number; groups: Map<string, Map<string, Observation[]>> };
type Baseline = { at: number; rtcAt?: number; bytes?: number; freeze?: number; received?: number; decoded?: number;
  dropped?: number; encoded?: number; encodeTime?: number; decodeTime?: number; peerPackets?: number; peerBytes?: number };

function metric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function delta(before?: number, after?: number) {
  return before !== undefined && after !== undefined && after >= before ? after - before : undefined;
}

function peak(target: Evidence, key: keyof Evidence, value?: number) {
  if (value !== undefined) target[key] = Math.max(target[key] ?? 0, value);
}

function mergeEvidence(target: Evidence, source: Evidence) {
  for (const key of Object.keys(source) as (keyof Evidence)[]) peak(target, key, source[key]);
}

function hasSymptom(obs: Observation) {
  const e = obs.evidence;
  return obs.decode || (e.lossPct ?? 0) >= 3 || (e.concealedPct ?? 0) >= 3 || (e.freezes ?? 0) > 0 || (e.droppedPct ?? 0) >= 20;
}

// Missing metrics cannot act as a healthy control. Compare the same symptom,
// for example require a measured freeze delta for a freeze-only incident.
function comparableHealthy(obs: Observation, affected: Observation) {
  if (!obs.active || obs.inactive || hasSymptom(obs)) return false;
  // A healthy low-resolution subscription cannot clear a higher simulcast layer.
  if (obs.pixels && affected.pixels && Math.max(obs.pixels, affected.pixels) > 1.5 * Math.min(obs.pixels, affected.pixels)) return false;
  const e = obs.evidence, bad = affected.evidence;
  return (affected.decode && (e.decodedFrames ?? 0) >= 10) ||
    ((bad.lossPct ?? 0) >= 3 && (e.lossPct ?? Infinity) < 1) ||
    ((bad.concealedPct ?? 0) >= 3 && (e.concealedPct ?? Infinity) < 1) ||
    ((bad.freezes ?? 0) > 0 && e.freezes === 0) ||
    ((bad.droppedPct ?? 0) >= 20 && (e.droppedPct ?? Infinity) < 5);
}

function sameSymptom(a: Evidence, b: Evidence) {
  return ((a.lossPct ?? 0) >= 3 && (b.lossPct ?? 0) >= 3) ||
    ((a.concealedPct ?? 0) >= 3 && (b.concealedPct ?? 0) >= 3) ||
    ((a.freezes ?? 0) > 0 && (b.freezes ?? 0) > 0) ||
    ((a.droppedPct ?? 0) >= 20 && (b.droppedPct ?? 0) >= 20);
}

/** Feed one room in archive order. finish() flushes the last comparison window. */
export function createRoomMediaDiagnosis() {
  const coverage: RoomMediaDiagnosis["coverage"] = { samples: 0, firstAt: null, lastAt: null, participants: 0,
    inbound: 0, outbound: 0, evaluable: 0, detailedVideo: 0, limited: false };
  const identities = new Set<string>();
  const baselines = new Map<string, Baseline>();
  const buckets = new Map<number, Bucket>();
  const findings: { finding: RoomMediaFinding; scope: string; lastTick: number }[] = [];
  let room: string | undefined, newestTick = -Infinity, processed = -Infinity;

  function record(code: RoomMediaFindingCode, obs: Observation, evidence: Evidence, affected: string[], receiver = obs.receiver) {
    const side = code.startsWith("sender-") ? "sender" : code.startsWith("receiver-") ? "receiver" :
      code === "shared-path" ? "shared" : "unknown";
    const confidence = side === "sender" ? "observed" : side === "unknown" ? "unknown" : "likely";
    const tick = Math.floor(obs.at / MATCH_MS);
    const scope = JSON.stringify([code, obs.publication, receiver, receiver === null && obs.receiver !== null ? null : obs.session]);
    const entry = findings.find(row => row.scope === scope && obs.at - row.finding.lastAt <= MAX_COUNTER_GAP);
    if (entry) {
      entry.finding.firstAt = Math.min(entry.finding.firstAt, obs.at);
      entry.finding.lastAt = Math.max(entry.finding.lastAt, obs.at);
      if (entry.lastTick !== tick) entry.finding.intervals++;
      entry.lastTick = tick;
      mergeEvidence(entry.finding.evidence, evidence);
      for (const identity of affected) {
        if (entry.finding.receivers.length >= 8) break;
        if (!entry.finding.receivers.includes(identity)) entry.finding.receivers.push(identity);
      }
      return;
    }
    if (findings.length === MAX_FINDINGS) {
      let oldest = 0;
      for (let i = 1; i < findings.length; i++) if (findings[i].finding.lastAt < findings[oldest].finding.lastAt) oldest = i;
      findings.splice(oldest, 1);
      coverage.limited = true;
    }
    findings.push({ scope, lastTick: tick, finding: { code, side, confidence, source: obs.source, mediaSource: obs.mediaSource,
      kind: obs.kind, receiver, firstAt: obs.at, lastAt: obs.at, intervals: 1, evidence: { ...evidence }, receivers: affected.slice(0, 8) } });
  }

  function compare(obs: Observation, neighbors: Map<string, Observation[]>[]) {
    if (obs.inactive || (!obs.cpu && !obs.bandwidth && !hasSymptom(obs))) return;
    // Choose one closest observation per identity across adjacent windows. A
    // second SSRC, tab or reconnect from the same receiver is never a peer.
    const nearest = new Map<string, Observation>();
    for (const reporters of neighbors) {
      for (const [reporter, rows] of reporters) {
        for (const peer of rows) {
          const distance = Math.abs(peer.at - obs.at);
          const before = nearest.get(reporter);
          if (distance <= MATCH_MS && (!before || distance < Math.abs(before.at - obs.at))) nearest.set(reporter, peer);
        }
      }
    }
    const affected: string[] = [];
    let healthy = 0, cleanReceiverLegs = 0, decodingPeers = 0;
    for (const peer of nearest.values()) {
      if (!peer.receiver || peer.inactive || peer.receiver === obs.receiver) continue;
      if (hasSymptom(peer) && (!obs.receiver || (!peer.decode && sameSymptom(peer.evidence, obs.evidence)))) affected.push(peer.receiver);
      if (comparableHealthy(peer, obs)) {
        healthy++;
        if ((peer.evidence.lossPct ?? Infinity) < 1) cleanReceiverLegs++;
        if ((peer.evidence.decodedFrames ?? 0) >= 10) decodingPeers++;
      }
    }
    const evidence = { ...obs.evidence, affectedReceivers: affected.length + Number(obs.receiver !== null), healthyReceivers: healthy };
    if (obs.receiver === null) {
      if (obs.cpu) record("sender-cpu", obs, evidence, affected);
      if (obs.bandwidth) record("sender-bandwidth", obs, evidence, affected);
      if ((evidence.lossPct ?? 0) >= 3) record("sender-loss", obs, evidence, affected);
      return;
    }
    const sender = nearest.get("");
    if (sender?.inactive) return;
    if (sender?.evidence.outboundKbps !== undefined) evidence.outboundKbps = sender.evidence.outboundKbps;
    if (sender?.evidence.lossPct !== undefined && (sender.allSenderReportsFresh || sender.evidence.lossPct > 0)) {
      evidence.senderLossPct = sender.evidence.lossPct;
    }
    // An unchanged legacy loss estimate can just be the previous RTCP report.
    const cleanFirstLeg = sender?.active && sender.allSenderReportsFresh && (evidence.senderLossPct ?? Infinity) < 1;
    const senderLoss = (evidence.senderLossPct ?? 0) >= 3;
    const sfuTransmitted = (evidence.sfuEgressPacketsDelta ?? 0) > 0 || (evidence.sfuEgressBytesDelta ?? 0) > 0;
    // Concealment, freezes and frame drops describe receiver playout. One
    // receiver can exhibit them under publisher contention even with zero loss.
    const isolated = (evidence.lossPct ?? 0) >= 3 && (cleanReceiverLegs > 0 || (cleanFirstLeg && sfuTransmitted));
    const receivers = [obs.receiver, ...affected];
    if (obs.slowDecode || (obs.decode && decodingPeers > 0 && !senderLoss)) record("receiver-decode", obs, evidence, receivers);
    else if (affected.length && !healthy) record("shared-path", obs, evidence, receivers, null);
    else if (isolated && !affected.length && !senderLoss) record("receiver-path", obs, evidence, receivers);
    else record("unlocalized", obs, evidence, receivers);
  }

  function flushThrough(lastTick: number) {
    for (const tick of [...buckets.keys()].sort((a, b) => a - b)) {
      if (tick > lastTick || tick <= processed) continue;
      for (const [publication, reporters] of buckets.get(tick)!.groups) {
        const neighbors = [tick - 1, tick, tick + 1].flatMap(i => buckets.get(i)?.groups.get(publication) ?? []);
        for (const rows of reporters.values()) for (const obs of rows) compare(obs, neighbors);
      }
    }
    processed = Math.max(processed, lastTick);
    for (const tick of buckets.keys()) if (tick < lastTick) buckets.delete(tick);
  }

  function readLayer(obs: Observation, stream: StreamStat, reconnects: number) {
    const video = stream.video, audio = stream.audio;
    const track = video ?? stream.audioTrack;
    const key = JSON.stringify([obs.session, obs.publication, obs.receiver, stream.id, reconnects]);
    const before = baselines.get(key);
    const inactive = track?.publicationMuted || track?.trackMuted || track?.mediaTrackEnabled === false ||
      track?.mediaTrackMuted || track?.mediaTrackReadyState === "ended";
    if (inactive) {
      if (!before || before.at <= obs.at) baselines.delete(key);
      return;
    }
    obs.inactive = false;
    const sr = obs.receiver && stream.peerReport?.kind === "remote-outbound-rtp" && stream.peerReport.ageMs <= MATCH_MS
      ? stream.peerReport : undefined;
    const next: Baseline = { at: obs.at, rtcAt: metric(video?.statsAt ?? audio?.statsAt), bytes: metric(stream.bytes),
      peerPackets: metric(sr?.packetsSent), peerBytes: metric(sr?.bytesSent),
      freeze: metric(video?.freezeCount ?? stream.freezes), received: metric(video?.framesReceived),
      decoded: metric(video?.framesDecoded), dropped: metric(video?.framesDropped),
      encoded: metric(video?.framesEncoded), encodeTime: metric(video?.totalEncodeTime), decodeTime: metric(video?.totalDecodeTime) };
    const inSequence = !before || next.at > before.at;
    if (before && next.at < before.at) coverage.limited = true;
    if ((stream.kind === "video" || sr) && inSequence) {
      baselines.delete(key);
      if (baselines.size >= 4096) {
        const oldest = baselines.entries().next().value!;
        baselines.delete(oldest[0]);
        if (obs.at - oldest[1].at <= MAX_COUNTER_GAP) coverage.limited = true;
      }
      baselines.set(key, next);
    }
    const fresh = before && inSequence && next.at - before.at <= MAX_COUNTER_GAP &&
      (next.rtcAt === undefined || before.rtcAt === undefined ||
        (next.rtcAt > before.rtcAt && next.rtcAt - before.rtcAt <= MAX_COUNTER_GAP)) &&
      (Object.keys(next) as (keyof Baseline)[]).every(field =>
        next[field] === undefined || before[field] === undefined || next[field]! >= before[field]!);
    const change = (field: keyof Baseline) => fresh ? delta(before[field], next[field]) : undefined;
    const decoded = change("decoded"), dropped = change("dropped"), received = change("received"), encoded = change("encoded");
    const e = obs.evidence, rate = metric(stream.bitrateKbps), fps = metric(stream.fps);
    const active = (rate ?? 0) > 0 || (fps ?? 0) > 0 || (received ?? 0) > 0 || (encoded ?? 0) > 0 ||
      (audio?.receivedSamplesDelta ?? 0) > 0;
    // Inactive lower simulcast encodings can carry a stale limitation reason.
    if (!obs.receiver && !active && rate === 0) return;
    obs.active ||= active;
    if (active && stream.width && stream.height) obs.pixels = Math.max(obs.pixels ?? 0, stream.width * stream.height);
    const rr = stream.peerReport;
    const freshFraction = !obs.receiver && rr?.kind === "remote-inbound-rtp" && rr.fresh &&
      rr.ageMs <= MATCH_MS ? metric(rr.fractionLost) : undefined;
    if (!obs.receiver && active) obs.allSenderReportsFresh &&= freshFraction !== undefined && freshFraction <= 1;
    const loss = freshFraction !== undefined && freshFraction <= 1 ? freshFraction * 100 : metric(stream.lossPct);
    peak(e, "lossPct", loss);
    peak(e, "jitterMs", metric(stream.jitterMs));
    peak(e, "fps", fps);
    if (obs.receiver === null) {
      if (rate !== undefined) e.outboundKbps = (e.outboundKbps ?? 0) + rate;
      obs.cpu ||= active && stream.qualityLimitation === "cpu";
      obs.bandwidth ||= active && stream.qualityLimitation === "bandwidth";
      const available = metric(video?.availableOutgoingBitrate), time = change("encodeTime");
      if (available !== undefined) peak(e, "availableOutgoingKbps", available / 1000);
      if (time !== undefined && encoded) peak(e, "encodeMsPerFrame", time * 1000 / encoded);
    } else {
      // SR counters cover SFU transmissions. Their interval can differ from
      // local RTP sampling, so these totals cannot be subtracted from receipts.
      if (sr?.fresh) {
        peak(e, "sfuEgressPacketsDelta", change("peerPackets"));
        peak(e, "sfuEgressBytesDelta", change("peerBytes"));
      }
      if (audio && (audio.intervalMs ?? 0) > 0 && audio.intervalMs! <= MAX_COUNTER_GAP) {
        peak(e, "concealedPct", metric(audio.concealedPct));
      }
      peak(e, "freezes", change("freeze"));
      const decodeTime = change("decodeTime");
      const msPerFrame = decoded && decodeTime !== undefined ? 1000 * decodeTime / decoded : undefined;
      if (msPerFrame !== undefined) peak(e, "decodeMsPerFrame", msPerFrame);
      peak(e, "decodedFrames", decoded);
      peak(e, "receivedFrames", received);
      const lowLoss = (metric(stream.lossPct) ?? Infinity) < 1;
      obs.decode ||= decoded === 0 && (received ?? 0) >= 10 && lowLoss;
      if (decoded !== undefined && dropped !== undefined && decoded + dropped >= 10) {
        const pct = 100 * dropped / (decoded + dropped);
        peak(e, "droppedPct", pct);
        // Compare measured decoder work per frame to the arrival frame budget.
        // Packet loss and a large drop count alone do not identify CPU load.
        const elapsed = fresh ? (delta(before.rtcAt, next.rtcAt) ?? next.at - before.at) : undefined;
        if (elapsed && received && msPerFrame !== undefined && received >= 10 && lowLoss) {
          obs.slowDecode ||= pct >= 20 && msPerFrame >= elapsed / received;
          obs.decode ||= obs.slowDecode;
        }
      }
    }
  }

  function add(sample: TelemetrySample) {
    if (!Number.isFinite(sample.at) || !Array.isArray(sample.streams) || !sample.identity || !sample.session) return;
    room ??= sample.room;
    if (sample.room !== room) return;
    coverage.samples++;
    coverage.firstAt = Math.min(coverage.firstAt ?? sample.at, sample.at);
    coverage.lastAt = Math.max(coverage.lastAt ?? sample.at, sample.at);
    if (identities.size < 1024) identities.add(sample.identity);
    else if (!identities.has(sample.identity)) coverage.limited = true;
    coverage.participants = identities.size;
    coverage.limited ||= !!sample.videoDiagnosticsLimited || !!sample.peerReportsLimited;
    const tick = Math.floor(sample.at / MATCH_MS);
    if (tick < newestTick - 1 || tick <= processed) { coverage.limited = true; return; }
    if (tick > newestTick) { newestTick = tick; flushThrough(tick - 3); }
    if (sample.state === "disconnected") return;
    let bucket = buckets.get(tick);
    if (!bucket) { bucket = { count: 0, groups: new Map() }; buckets.set(tick, bucket); }
    const publications = new Map<string, Observation>();
    for (const stream of sample.streams) {
      if (!stream || (stream.kind !== "video" && stream.kind !== "audio") ||
          (stream.direction !== "in" && stream.direction !== "out")) continue;
      const receiver = stream.direction === "in" ? sample.identity : null;
      const source = receiver ? stream.participant : sample.identity;
      if (!source || receiver === source) continue;
      const publication = JSON.stringify([source, stream.kind, stream.source, stream.trackSid || stream.video?.trackSid || null]);
      let obs = publications.get(publication);
      if (!obs) {
        obs = { at: sample.at, source, mediaSource: stream.source, kind: stream.kind, receiver, session: sample.session,
          publication, inactive: true, active: false, cpu: false, bandwidth: false, decode: false, slowDecode: false, allSenderReportsFresh: true, evidence: {} };
        publications.set(publication, obs);
      }
      if (stream.video) coverage.detailedVideo++;
      readLayer(obs, stream, sample.reconnects);
    }
    for (const obs of publications.values()) {
      if (!obs.inactive) {
        if (obs.receiver === null) coverage.outbound++; else coverage.inbound++;
        if (obs.cpu || obs.bandwidth || obs.evidence.lossPct !== undefined || obs.evidence.freezes !== undefined ||
            obs.decode || obs.evidence.droppedPct !== undefined || obs.evidence.concealedPct !== undefined) coverage.evaluable++;
      }
      if (bucket.count >= 4096) { coverage.limited = true; continue; }
      let reporters = bucket.groups.get(obs.publication);
      if (!reporters) { reporters = new Map(); bucket.groups.set(obs.publication, reporters); }
      const reporter = obs.receiver ?? "";
      const rows = reporters.get(reporter) ?? [];
      if (rows.length >= 4 || (!rows.length && reporters.size >= 128)) { coverage.limited = true; continue; }
      if (rows.some(row => row.session === obs.session && row.at === obs.at)) continue;
      rows.push(obs); reporters.set(reporter, rows); bucket.count++;
    }
  }

  function finish(): RoomMediaDiagnosis {
    flushThrough(Infinity);
    const results = findings.map(({ finding }): RoomMediaFinding => {
      // A brief upstream impairment can reach different simulcast layers or
      // receiver sampling windows at different times. Require repeat evidence.
      if (finding.code === "receiver-path" && finding.intervals < 2) {
        return { ...finding, code: "unlocalized", side: "unknown", confidence: "unknown" };
      }
      return finding;
    });
    return { coverage: { ...coverage }, findings: results.sort((a, b) => b.lastAt - a.lastAt) };
  }

  return { add, finish };
}
