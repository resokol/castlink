type Counter = { bytes: number; at: number };
export type GuestReceiveCounters = WeakMap<object, Map<string, Counter>>;

/** RTP payload bitrate received by this studio, independently per track/SSRC. */
export function readGuestReceiveBitrate(state: GuestReceiveCounters, track: object, report: RTCStatsReport | undefined, kind: "audio" | "video"): number | null {
  if (!report) return null;
  const previous = state.get(track) || new Map<string, Counter>();
  state.set(track, previous);
  const seen = new Set<string>();
  let total = 0, measured = false;
  report.forEach((stat: any) => {
    if (stat.type !== "inbound-rtp" || stat.isRemote || (stat.kind || stat.mediaType) !== kind) return;
    const { bytesReceived: bytes, timestamp: at, id } = stat;
    if (typeof id !== "string" || !Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(at)) return;
    if (seen.has(id)) return;
    seen.add(id);
    const last = previous.get(id);
    if (last && at <= last.at) return;
    previous.set(id, { bytes, at });
    if (!last || bytes < last.bytes) return;
    total += (bytes - last.bytes) * 8 / (at - last.at);
    measured = true;
  });
  for (const id of previous.keys()) if (!seen.has(id)) previous.delete(id);
  return measured ? Math.round(total) : null;
}
