"use client";

import { Room, RoomEvent, Track } from "livekit-client";
import type { StreamStat, TelemetrySample } from "./telemetry-types";

type Counter = { at: number; bytes: number; packets: number | null; lost: number | null };
const numberOrNull = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const millis = (value: unknown) => { const n = numberOrNull(value); return n === null ? null : n * 1000; };

export function rateDelta(previous: Counter | undefined, next: Counter) {
  if (!previous || next.at <= previous.at || next.bytes < previous.bytes) return { bitrateKbps: null, lossPct: null };
  const bitrateKbps = (next.bytes - previous.bytes) * 8 / (next.at - previous.at);
  if (next.packets === null || previous.packets === null || next.lost === null || previous.lost === null ||
      next.packets < previous.packets || next.lost < previous.lost) return { bitrateKbps, lossPct: null };
  const lost = next.lost - previous.lost;
  const packets = next.packets - previous.packets;
  return { bitrateKbps, lossPct: packets + lost > 0 ? Math.min(100, lost / (packets + lost) * 100) : null };
}

export function startRoomTelemetry(room: Room, roomName: string, initialToken: string) {
  const session = crypto.randomUUID();
  const started = Date.now();
  const previous = new Map<string, Counter>();
  let token = initialToken, tokenAt = Date.now(), reconnects = 0, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const identity = room.localParticipant.identity;
  const role: TelemetrySample["role"] = identity.startsWith("studio-panel-") ? "studio" :
    identity.startsWith("output-") ? "output" : identity.startsWith("monitor-") ? "monitor" : "guest";
  const onReconnect = () => { reconnects++; };
  room.on(RoomEvent.Reconnecting, onReconnect);
  room.on(RoomEvent.SignalReconnecting, onReconnect);

  const base = (): Omit<TelemetrySample, "streams"> => ({
    at: Date.now(), room: roomName, identity, name: room.localParticipant.name || identity,
    session, role, state: room.state, quality: room.localParticipant.connectionQuality,
    reconnects, uptimeSec: Math.round((Date.now() - started) / 1000),
  });
  const send = (sample: TelemetrySample, keepalive = false) => fetch("/api/stats", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(sample), keepalive,
  });

  const collect = async () => {
    try {
      if (Date.now() - tokenAt > 50 * 60_000) {
        const response = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&role=${role === "studio" ? "studio-panel" : role}&access=${encodeURIComponent(new URLSearchParams(window.location.search).get("access") || "")}`);
        if (response.ok) { token = (await response.json()).token; tokenAt = Date.now(); }
      }
      const streams: StreamStat[] = [];
      const seen = new Set<string>();
      for (const participant of [room.localParticipant, ...room.remoteParticipants.values()]) {
        const direction = participant.isLocal ? "out" : "in";
        for (const publication of participant.trackPublications.values()) {
          if (!publication.track || (publication.kind !== Track.Kind.Audio && publication.kind !== Track.Kind.Video)) continue;
          let report: RTCStatsReport | undefined;
          try { report = await publication.track.getRTCStatsReport(); } catch { continue; }
          if (!report) continue;
          const stats: Record<string, any>[] = [];
          report.forEach((stat) => stats.push(stat));
          const transport = stats.find((s) => s.type === "transport" && s.selectedCandidatePairId);
          const pair = (transport && report.get(transport.selectedCandidatePairId)) || stats.find((s) => s.type === "candidate-pair" && s.state === "succeeded" && (s.nominated || s.selected));
          const candidate = pair ? report.get(pair.localCandidateId) : undefined;
          for (const stat of stats) {
            if (stat.type !== (direction === "in" ? "inbound-rtp" : "outbound-rtp") || stat.isRemote) continue;
            const id = `${direction}:${stat.id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const remote = direction === "out" ? (report.get(stat.remoteId) || stats.find((s) => s.type === "remote-inbound-rtp" && s.localId === stat.id)) : undefined;
            const packets = numberOrNull(direction === "in" ? stat.packetsReceived : stat.packetsSent);
            const lost = numberOrNull(direction === "in" ? stat.packetsLost : remote?.packetsLost);
            const next = { at: stat.timestamp, bytes: Number((direction === "in" ? stat.bytesReceived : stat.bytesSent) || 0), packets, lost };
            const delta = rateDelta(previous.get(id), next);
            // Outbound packetsSent already includes packets lost at the receiver.
            if (direction === "out") {
              const prev = previous.get(id);
              delta.lossPct = prev && packets !== null && prev.packets !== null && lost !== null && prev.lost !== null &&
                packets > prev.packets && lost >= prev.lost ? Math.min(100, (lost - prev.lost) / (packets - prev.packets) * 100) : null;
            }
            previous.set(id, next);
            streams.push({ id, participant: participant.identity, name: participant.name || participant.identity,
              direction, kind: publication.kind === Track.Kind.Video ? "video" : "audio", source: publication.source,
              codec: report.get(stat.codecId)?.mimeType ?? null, ...delta, lostPackets: lost,
              jitterMs: millis(direction === "in" ? stat.jitter : remote?.jitter),
              rttMs: millis(remote?.roundTripTime ?? pair?.currentRoundTripTime),
              fps: numberOrNull(stat.framesPerSecond), width: numberOrNull(stat.frameWidth), height: numberOrNull(stat.frameHeight),
              bytes: next.bytes, freezes: numberOrNull(stat.freezeCount), protocol: candidate?.protocol ?? null,
              candidateType: candidate?.candidateType ?? null, qualityLimitation: stat.qualityLimitationReason ?? null,
            });
          }
        }
      }
      if (!stopped) await send({ ...base(), streams });
    } catch { /* A telemetry failure must never interrupt the call. */ }
    finally { if (!stopped) timer = setTimeout(collect, 10_000); }
  };
  void collect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    room.off(RoomEvent.Reconnecting, onReconnect);
    room.off(RoomEvent.SignalReconnecting, onReconnect);
    void send({ ...base(), state: "disconnected", streams: [] }, true).catch(() => undefined);
  };
}
