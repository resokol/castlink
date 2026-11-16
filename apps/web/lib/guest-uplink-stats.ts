import type { GuestNetworkMetrics, PacketLoss } from "./guest-network-stats";

type Counter = { at: number; sent: number; lost: number; reports?: number; measurements?: number };
export type GuestUplinkStatsState = {
  track?: object; kind?: "video" | "audio"; counters: Map<string, Counter>;
  intervals: { at: number; sent: number; lost: number }[];
  sent: number; lost: number; freshAt?: number; jitterMs: number | null; rttMs: number | null;
};
export const GUEST_UPLINK_FRESH_MS = 12000;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const loss = (sent: number, lost: number): PacketLoss | null => sent > 0 ? { packets: Math.max(0, lost), percent: Math.min(100, Math.max(0, lost) / sent * 100) } : null;
export function guestNetworkGrade(current: PacketLoss | null, jitter: number | null, rtt: number | null): GuestNetworkMetrics["stability"] {
  return !current ? null : current.percent >= 5 || (jitter ?? 0) > 60 || (rtt ?? 0) > 300 ? "Плохая"
    : current.percent >= 1 || (jitter ?? 0) > 30 || (rtt ?? 0) > 150 ? "Средняя" : "Хорошая";
}
export function createGuestUplinkStatsState(): GuestUplinkStatsState {
  return { counters: new Map(), intervals: [], sent: 0, lost: 0, jitterMs: null, rttMs: null };
}
export function sampleGuestUplinkStats(state: GuestUplinkStatsState, track: object | undefined,
  report: { forEach(callback: (stat: any) => void): void } | undefined, now: number, kind: "video" | "audio"): GuestNetworkMetrics {
  const unknown = (): GuestNetworkMetrics => ({ currentLoss: null, totalLoss: loss(state.sent, state.lost), jitterMs: null, rttMs: null, stability: null });
  if (!track || state.track !== track || state.kind !== kind) {
    state.intervals = []; state.freshAt = undefined; state.track = track; state.kind = kind;
  }
  if (!track) return unknown();
  if (report) {
    const stats: any[] = []; report.forEach(stat => stats.push(stat));
    let sent = 0, lost = 0, advanced = false, baseline = false, valid = 0;
    const jitters: number[] = [], rtts: number[] = [], ages: number[] = [];
    for (const local of stats) {
      if (local.type !== "outbound-rtp" || local.isRemote || (local.kind ?? local.mediaType) !== kind ||
          !finite(local.timestamp) || !finite(local.packetsSent) || local.packetsSent <= 0 || local.active === false || local.id == null) continue;
      const prefix = `${kind}:${local.id}:${local.ssrc ?? ""}:`;
      const known = [...state.counters].find(([key]) => key.startsWith(prefix))?.[1];
      const remote = stats.find(stat => stat.type === "remote-inbound-rtp" &&
        (local.remoteId != null ? stat.id === local.remoteId : stat.localId === local.id));
      if (!remote || (remote.localId != null && remote.localId !== local.id) ||
          ((remote.kind ?? remote.mediaType) != null && (remote.kind ?? remote.mediaType) !== kind) ||
          (remote.ssrc != null && local.ssrc != null && remote.ssrc !== local.ssrc) ||
          !finite(remote.timestamp) || local.timestamp - remote.timestamp > GUEST_UPLINK_FRESH_MS ||
          !finite(remote.packetsLost) || remote.packetsLost > local.packetsSent) {
        // A paused video layer can retain old positive counters without new RTCP.
        if (kind === "video" && known && local.packetsSent === known.sent) continue;
        baseline = true; continue;
      }
      valid++;
      const key = `${kind}:${local.id}:${local.ssrc ?? ""}:${remote.id}`;
      const previous = state.counters.get(key);
      const next: Counter = { at: remote.timestamp, sent: local.packetsSent, lost: Math.max(0, remote.packetsLost),
        reports: finite(remote.reportsReceived) ? remote.reportsReceived : undefined,
        measurements: finite(remote.roundTripTimeMeasurements) ? remote.roundTripTimeMeasurements : undefined };
      // A newly obtained local report is not evidence of a new RTCP receiver report.
      if (previous && (next.at <= previous.at || (next.reports !== undefined && previous.reports !== undefined && next.reports === previous.reports))) continue;
      advanced = true;
      ages.push(Math.max(0, local.timestamp - remote.timestamp));
      if (finite(remote.jitter) && remote.jitter >= 0) jitters.push(remote.jitter * 1000);
      if (finite(remote.roundTripTime) && remote.roundTripTime >= 0) rtts.push(remote.roundTripTime * 1000);
      if (!previous || next.sent < previous.sent || (next.reports !== undefined && previous.reports !== undefined && next.reports < previous.reports)) {
        state.sent += next.sent; state.lost += next.lost; baseline = true;
      } else {
        const deltaSent = next.sent - previous.sent, deltaLost = next.lost - previous.lost;
        state.sent += deltaSent; state.lost = Math.max(0, state.lost + deltaLost);
        if (state.freshAt === undefined || now - state.freshAt > GUEST_UPLINK_FRESH_MS || next.at - previous.at > 10000) baseline = true;
        else { sent += deltaSent; lost += deltaLost; }
      }
      state.counters.set(key, next);
    }
    if (baseline && !advanced || !valid) { state.freshAt = undefined; state.intervals = []; return unknown(); }
    if (advanced) {
      if (baseline) state.intervals = []; else state.intervals.push({ at: now, sent, lost });
      state.freshAt = now - Math.max(...ages);
      state.jitterMs = jitters.length ? Math.round(Math.max(...jitters)) : null;
      state.rttMs = rtts.length ? Math.round(Math.max(...rtts)) : null;
    }
  }
  state.intervals = state.intervals.filter(interval => interval.at > now - 10000);
  if (state.freshAt === undefined || now - state.freshAt > GUEST_UPLINK_FRESH_MS) return unknown();
  const recent = state.intervals.reduce((sum, interval) => ({ sent: sum.sent + interval.sent, lost: sum.lost + interval.lost }), { sent: 0, lost: 0 });
  const currentLoss = loss(recent.sent, recent.lost);
  return { currentLoss, totalLoss: loss(state.sent, state.lost), jitterMs: state.jitterMs, rttMs: state.rttMs,
    stability: guestNetworkGrade(currentLoss, state.jitterMs, state.rttMs) };
}
