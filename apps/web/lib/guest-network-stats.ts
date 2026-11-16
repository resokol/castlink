export type PacketLoss = { packets: number; percent: number };
export type GuestNetworkMetrics = {
  currentLoss: PacketLoss | null;
  totalLoss: PacketLoss | null;
  jitterMs: number | null;
  rttMs: number | null;
  stability: "Хорошая" | "Средняя" | "Плохая" | null;
};
type Counter = { at: number; received: number; lost: number };
type Interval = { at: number; received: number; lost: number };
export type GuestNetworkStatsState = {
  track?: object;
  kind?: "video" | "audio";
  counters: Map<string, Counter>;
  intervals: Interval[];
  received: number;
  lost: number;
  freshAt?: number;
  jitterMs: number | null;
  rttMs: number | null;
};
const WINDOW_MS = 10_000;
const FRESH_MS = 6000;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const loss = (received: number, lost: number): PacketLoss | null => {
  const packets = Math.max(0, lost);
  return received + packets > 0 ? { packets, percent: packets / (received + packets) * 100 } : null;
};

export function createGuestNetworkStatsState(): GuestNetworkStatsState {
  return { counters: new Map(), intervals: [], received: 0, lost: 0, jitterMs: null, rttMs: null };
}

/** History belongs to this participant session; RTP/track changes only reset the current window. */
export function sampleGuestNetworkStats(
  state: GuestNetworkStatsState,
  track: object | undefined,
  report: { forEach(callback: (stat: any) => void): void } | undefined,
  now: number,
  kind: "video" | "audio" = "video",
): GuestNetworkMetrics {
  const unknown = (): GuestNetworkMetrics => ({ currentLoss: null, totalLoss: loss(state.received, state.lost), jitterMs: null, rttMs: null, stability: null });
  if (!track) {
    // A muted/unsubscribed source may resume with the same cumulative counters.
    state.intervals = [];
    state.freshAt = undefined;
    return unknown();
  }
  if (state.track !== track || state.kind !== kind) {
    state.track = track;
    state.kind = kind;
    // LiveKit may replace the wrapper while reusing the receiver and RTP counters.
    state.intervals = [];
    state.freshAt = undefined;
  }
  if (!report) return unknown();
  const stats: any[] = [];
  report.forEach(stat => stats.push(stat));
  let received = 0, lost = 0, advanced = false, rebaseline = false;
  const jitters: number[] = [];
  for (const stat of stats) {
    if (stat.type !== "inbound-rtp" || (stat.kind ?? stat.mediaType) !== kind || stat.isRemote ||
        !finite(stat.timestamp) || !finite(stat.packetsReceived) || stat.packetsReceived < 0 || !finite(stat.packetsLost) ||
        (stat.id === undefined && stat.ssrc === undefined)) continue;
    const id = `${kind}:${stat.id ?? ""}:${stat.ssrc ?? ""}`;
    const next = { at: stat.timestamp, received: stat.packetsReceived, lost: Math.max(0, stat.packetsLost) };
    const prev = state.counters.get(id);
    if (prev && next.at <= prev.at) continue;
    advanced = true;
    if (finite(stat.jitter) && stat.jitter >= 0) jitters.push(stat.jitter * 1000);
    if (!prev || next.received < prev.received) {
      state.received += next.received;
      state.lost += next.lost;
      rebaseline = true;
    } else {
      const deltaReceived = next.received - prev.received;
      // WebRTC packetsLost may decrease when late packets arrive.
      const deltaLost = next.lost - prev.lost;
      state.received += deltaReceived;
      state.lost = Math.max(0, state.lost + deltaLost);
      if (next.at - prev.at > FRESH_MS || state.freshAt === undefined || now - state.freshAt > FRESH_MS) {
        rebaseline = true;
      } else {
        received += deltaReceived;
        lost += deltaLost;
      }
    }
    state.counters.set(id, next);
  }
  if (advanced) {
    if (rebaseline) state.intervals = [];
    else state.intervals.push({ at: now, received, lost });
    state.freshAt = now;
    state.jitterMs = jitters.length ? Math.round(Math.max(...jitters)) : null;
    const selected = stats.find(stat => stat.type === "transport" && stat.selectedCandidatePairId)?.selectedCandidatePairId;
    const pair = selected ? stats.find(stat => stat.type === "candidate-pair" && stat.id === selected)
      : stats.find(stat => stat.type === "candidate-pair" && stat.nominated && stat.state === "succeeded");
    state.rttMs = finite(pair?.currentRoundTripTime) && pair.currentRoundTripTime >= 0 ? Math.round(pair.currentRoundTripTime * 1000) : null;
  }
  state.intervals = state.intervals.filter(interval => interval.at > now - WINDOW_MS);
  if (state.freshAt === undefined || now - state.freshAt > FRESH_MS) return unknown();
  const totals = state.intervals.reduce((sum, interval) => ({ received: sum.received + interval.received, lost: sum.lost + interval.lost }), { received: 0, lost: 0 });
  const currentLoss = loss(totals.received, totals.lost);
  const jitter = state.jitterMs ?? 0, rtt = state.rttMs ?? 0;
  const stability = !currentLoss ? null : currentLoss.percent >= 5 || jitter > 60 || rtt > 300 ? "Плохая"
    : currentLoss.percent >= 1 || jitter > 30 || rtt > 150 ? "Средняя" : "Хорошая";
  return { currentLoss, totalLoss: loss(state.received, state.lost), jitterMs: state.jitterMs, rttMs: state.rttMs, stability };
}

/** Unit is supplied by translated UI copy; keep percent first in every locale. */
export function formatPacketLoss(value: PacketLoss | null | undefined, locale: string): string | null {
  if (!value || !finite(value.percent) || !finite(value.packets)) return null;
  const percent = value.percent > 0 && value.percent < .01 ? `<${(.01).toLocaleString(locale)}`
    : value.percent.toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${percent}% / ${value.packets.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
}
