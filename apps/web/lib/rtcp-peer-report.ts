import type { RtcpPeerReport, StreamStat } from "./telemetry-types";

const maxAgeMs = 6000;
type Direction = StreamStat["direction"];
type RtcStat = Record<string, any>;
export type RtcpReportMarker = { id: string; ssrc: unknown; at: number; reports: number | null; localPackets: number | null;
  peerPackets: number | null; peerBytes: number | null; peerAt: number | null; lost: number | null };

function nonnegative(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
}

export function sanitizePeerReport(raw: unknown, direction: Direction): RtcpPeerReport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const kind = direction === "out" ? "remote-inbound-rtp" : "remote-outbound-rtp";
  const ageMs = nonnegative(r.ageMs);
  if (r.kind !== kind || typeof r.fresh !== "boolean" || ageMs === null) return undefined;
  const fractionLost = nonnegative(r.fractionLost, 1), bytesSent = nonnegative(r.bytesSent), packetsSent = nonnegative(r.packetsSent);
  const fresh = r.fresh && ageMs <= maxAgeMs;
  const egressKbps = nonnegative(r.egressKbps, 1e6), egressIntervalMs = nonnegative(r.egressIntervalMs, 8000);
  return { kind, fresh, ageMs,
    ...(direction === "out" && fractionLost !== null ? { fractionLost } : {}),
    ...(direction === "in" && bytesSent !== null && Number.isSafeInteger(bytesSent) ? { bytesSent } : {}),
    ...(direction === "in" && packetsSent !== null && Number.isSafeInteger(packetsSent) ? { packetsSent } : {}),
    ...(direction === "in" && fresh && egressKbps !== null && egressIntervalMs !== null && egressIntervalMs >= 250
      ? { egressKbps, egressIntervalMs } : {}) };
}

/** Use local receipt time for freshness, and differences on the peer's own clock for its sending rate. */
export function observePeerReport(direction: Direction, local: RtcStat, remote: RtcStat | undefined, previous?: RtcpReportMarker) {
  const kind = direction === "out" ? "remote-inbound-rtp" : "remote-outbound-rtp";
  const localKind = local.kind ?? local.mediaType, remoteKind = remote?.kind ?? remote?.mediaType;
  if (!remote || remote.type !== kind || typeof local.id !== "string" || typeof remote.id !== "string" ||
      (local.remoteId ? local.remoteId !== remote.id : remote.localId !== local.id) ||
      (remote.localId != null && remote.localId !== local.id) ||
      (remote.ssrc != null && local.ssrc != null && remote.ssrc !== local.ssrc) ||
      (remoteKind && localKind && remoteKind !== localKind)) return;
  const at = nonnegative(remote.timestamp), localAt = nonnegative(local.timestamp);
  if (at === null || localAt === null || at > localAt) return;
  const ageMs = localAt - at;
  const reports = nonnegative(direction === "out" ? remote.reportsReceived : remote.reportsSent);
  const marker: RtcpReportMarker = { id: remote.id, ssrc: local.ssrc, at, reports,
    localPackets: nonnegative(direction === "out" ? local.packetsSent : local.packetsReceived),
    peerPackets: nonnegative(remote.packetsSent), peerBytes: nonnegative(remote.bytesSent),
    peerAt: nonnegative(remote.remoteTimestamp), lost: nonnegative(remote.packetsLost) };
  const fresh = !!previous && marker.id === previous.id && marker.ssrc === previous.ssrc &&
    at > previous.at && at - previous.at <= 10_000 && ageMs <= maxAgeMs &&
    (reports === null || previous.reports === null || reports > previous.reports) &&
    (marker.localPackets === null || previous.localPackets === null || marker.localPackets >= previous.localPackets) &&
    (marker.peerPackets === null || previous.peerPackets === null || marker.peerPackets >= previous.peerPackets);
  const egressIntervalMs = direction === "in" && fresh && previous?.peerAt != null && marker.peerAt !== null
    ? marker.peerAt - previous.peerAt : undefined;
  const egressKbps = egressIntervalMs && previous?.peerBytes != null && marker.peerBytes !== null && marker.peerBytes >= previous.peerBytes
    ? (marker.peerBytes - previous.peerBytes) * 8 / egressIntervalMs : undefined;
  const report = sanitizePeerReport({ kind, fresh, ageMs, fractionLost: remote.fractionLost,
    packetsSent: remote.packetsSent, bytesSent: remote.bytesSent, egressKbps, egressIntervalMs }, direction)!;
  let lossPct: number | null = null;
  if (direction === "out" && fresh && previous) {
    if (report.fractionLost !== undefined) lossPct = report.fractionLost * 100;
    else if (marker.localPackets !== null && previous.localPackets !== null && marker.lost !== null && previous.lost !== null &&
        marker.localPackets > previous.localPackets && marker.lost >= previous.lost) {
      lossPct = Math.min(100, 100 * (marker.lost - previous.lost) / (marker.localPackets - previous.localPackets));
    }
  }
  // Duplicate RR reads must not advance the packet baseline for the next actual report.
  const duplicate = previous && marker.id === previous.id && marker.ssrc === previous.ssrc &&
    (at === previous.at || reports !== null && reports === previous.reports);
  return { marker: duplicate ? previous : marker, report, lossPct };
}
