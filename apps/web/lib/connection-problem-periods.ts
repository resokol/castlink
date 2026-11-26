import type { ConnectionProblemPeriod, StreamStat, TelemetrySample } from "./telemetry-types";
import { substantiallyLowerLayer, videoLayerMeasurement } from "./video-diagnostics";

// Reports normally arrive every two seconds. Keep a little context for comparing
// adjacent RTC counters, but never join symptoms across long gaps in observations.
const GAP = 8000;
const BIN = 2000;
const MAX_SHOWN = 10;

type Signals = Pick<ConnectionProblemPeriod, "lossPct" | "concealedPct" | "freezes" | "reconnect" | "poorQuality" | "videoLayerDrop">;
type Observation = Signals & { firstAt: number; lastAt: number };

function activeStream(stream: StreamStat) {
  const track = stream.video ?? stream.audioTrack;
  return !(track?.trackMuted || track?.publicationMuted || track?.mediaTrackMuted ||
    track?.mediaTrackEnabled === false || track?.mediaTrackReadyState === "ended" || stream.video?.receiverStreamState === "paused");
}

function trackKey(s: StreamStat) {
  return JSON.stringify([s.id, s.participant, s.source, s.trackSid ?? s.video?.trackSid]);
}

function merge(target: Observation, next: Observation) {
  target.firstAt = Math.min(target.firstAt, next.firstAt);
  target.lastAt = Math.max(target.lastAt, next.lastAt);
  target.lossPct = Math.max(target.lossPct, next.lossPct);
  target.concealedPct = Math.max(target.concealedPct, next.concealedPct);
  target.freezes = Math.max(target.freezes, next.freezes);
  target.reconnect ||= next.reconnect;
  target.poorQuality ||= next.poorQuality;
  if (next.videoLayerDrop) target.videoLayerDrop = true;
}

function badPercent(n: number | null | undefined) {
  return typeof n === "number" && n >= 3 && n <= 100 ? n : 0;
}

/** Called during the existing filtered history scan. Store only bins with measured symptoms. */
export function connectionProblemPeriods(from: number, to: number) {
  const bins = new Map<number, Observation>();
  function add(sample: TelemetrySample, previous?: TelemetrySample) {
    if (!Number.isSafeInteger(sample.at) || sample.at < from || sample.at > to || sample.state === "disconnected") return;
    const prior = previous && previous.identity === sample.identity && previous.session === sample.session &&
      previous.role === sample.role && previous.state !== "disconnected" && previous.at < sample.at &&
      sample.at - previous.at <= GAP ? previous : undefined;
    const reconnect = /^(reconnecting|signalreconnecting)$/i.test(sample.state) ||
      !!prior && Number.isSafeInteger(prior.reconnects) && sample.reconnects > prior.reconnects;
    const poorQuality = sample.state === "connected" && (sample.quality === "poor" || sample.quality === "lost");
    let lossPct = 0, concealedPct = 0, freezes = 0, videoLayerDrop = false;
    let beforeStreams: Map<string, StreamStat> | undefined;
    for (const stream of sample.streams) {
      if (!activeStream(stream)) continue;
      const rr = stream.peerReport;
      // A repeated sender report can keep a stale loss fraction for many samples.
      if (stream.direction === "in" || !rr || (rr.fresh && rr.ageMs <= 2500)) {
        lossPct = Math.max(lossPct, badPercent(stream.lossPct));
      }
      if (stream.direction !== "in") continue;
      if (stream.audio && (stream.audio.intervalMs ?? 0) > 0 && stream.audio.intervalMs! <= GAP) {
        concealedPct = Math.max(concealedPct, badPercent(stream.audio.concealedPct));
      }
      const count = stream.video?.freezeCount ?? stream.freezes;
      if (stream.kind !== "video" || !prior || prior.reconnects !== sample.reconnects || (!count && sample.role !== "studio")) continue;
      beforeStreams ??= new Map(prior.streams.filter(s => s.kind === "video" && s.direction === "in").map(s => [trackKey(s), s]));
      const old = beforeStreams.get(trackKey(stream));
      if (!old || !activeStream(old) || stream.bytes < old.bytes) continue;
      const prevAt = old.video?.statsAt, at = stream.video?.statsAt;
      if (at != null && prevAt != null && (at <= prevAt || at - prevAt > GAP)) continue;
      if (!videoLayerDrop && sample.role === "studio" && stream.video?.requestedQuality !== "low" && stream.video?.requestedQuality !== "medium") {
        const low = videoLayerMeasurement(stream), high = videoLayerMeasurement(old);
        videoLayerDrop = !!(low && high && substantiallyLowerLayer(low, high));
      }
      const last = old.video?.freezeCount ?? old.freezes;
      if (last != null && count != null && Number.isSafeInteger(last) && last >= 0 && Number.isSafeInteger(count)) {
        freezes = Math.max(freezes, count - last);
      }
    }
    if (!reconnect && !poorQuality && !lossPct && !concealedPct && !freezes && !videoLayerDrop) return;
    const obs = { firstAt: sample.at, lastAt: sample.at, lossPct, concealedPct, freezes, reconnect, poorQuality,
      ...(videoLayerDrop ? { videoLayerDrop: true } : {}) };
    const key = Math.floor(sample.at / BIN), bin = bins.get(key);
    if (bin) merge(bin, obs);
    else bins.set(key, obs);
  }
  function finish() {
    const episodes: Observation[] = [];
    for (const bin of [...bins.values()].sort((a, b) => a.firstAt - b.firstAt)) {
      const last = episodes.at(-1);
      if (last && bin.firstAt - last.lastAt <= GAP) merge(last, bin);
      else episodes.push({ ...bin });
    }
    const peak = (p: Observation) => Math.max(p.lossPct, p.concealedPct);
    episodes.sort((a, b) => Number(b.reconnect) - Number(a.reconnect) || b.freezes - a.freezes ||
      peak(b) - peak(a) || Number(!!b.videoLayerDrop) - Number(!!a.videoLayerDrop) ||
      (b.lastAt - b.firstAt) - (a.lastAt - a.firstAt) || b.lastAt - a.lastAt);
    const periods = episodes.slice(0, MAX_SHOWN).map(o => ({ ...o, from: Math.max(from, o.firstAt - GAP), to: Math.min(to, o.lastAt + GAP) }));
    return { total: episodes.length, periods };
  }
  return { add, finish };
}
