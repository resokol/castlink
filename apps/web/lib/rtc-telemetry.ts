"use client";

import { retainSessionHttpBearer } from "./session-http-bearer";
import { readTrackStats } from "./media-stats";
import { telemetryContext } from "./telemetry-context";
import { Room, RoomEvent, Track } from "livekit-client";
import type { AudioPlaybackDiagnostic, StreamStat, TelemetrySample } from "./telemetry-types";
import { audioReceiveDiagnostic, sanitizeAudioPlayback, type AudioCounters } from "./audio-diagnostics";

type Counter = { at: number; bytes: number; packets: number | null; lost: number | null };
const numberOrNull = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const millis = (value: unknown) => { const n = numberOrNull(value); return n === null ? null : n * 1000; };
const tokenExpiresAt = (value: string) => telemetryContext(value, "").expiresAt;

export function rateDelta(previous: Counter | undefined, next: Counter) {
  if (!previous || next.at <= previous.at || next.bytes < previous.bytes) return { bitrateKbps: null, lossPct: null };
  const bitrateKbps = (next.bytes - previous.bytes) * 8 / (next.at - previous.at);
  if (next.packets === null || previous.packets === null || next.lost === null || previous.lost === null ||
      next.packets < previous.packets || next.lost < previous.lost) return { bitrateKbps, lossPct: null };
  const lost = next.lost - previous.lost;
  const packets = next.packets - previous.packets;
  return { bitrateKbps, lossPct: packets + lost > 0 ? Math.min(100, lost / (packets + lost) * 100) : null };
}

export function startRoomTelemetry(room: Room, roomName: string, initialToken: string, studioControl?: { clientId: string; epoch: number; role: "studio-panel" | "studio-moderator" }, viewAccess = "", playbackDiagnostic?: () => AudioPlaybackDiagnostic | undefined) {
  const scope = telemetryContext(initialToken, roomName);
  const httpBearer = retainSessionHttpBearer(initialToken);
  const session = crypto.randomUUID();
  const started = Date.now();
  const previous = new Map<string, Counter>();
  const previousAudio = new Map<string, AudioCounters>();
  let token = initialToken, tokenAt = Date.now(), reconnects = 0, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const identity = room.localParticipant.identity;
  const role: TelemetrySample["role"] = identity.startsWith("studio-panel-") ? "studio" :
    identity.startsWith("output-") ? "output" : identity.startsWith("monitor-") ? "monitor" : "guest";
  const onReconnect = () => { reconnects++; };
  room.on(RoomEvent.Reconnecting, onReconnect);
  room.on(RoomEvent.SignalReconnecting, onReconnect);

  const playback = () => { try { return sanitizeAudioPlayback(playbackDiagnostic?.()); } catch { return undefined; } };
  const base = (): Omit<TelemetrySample, "streams"> => ({
    at: Date.now(), room: scope.mediaRoom, identity, name: room.localParticipant.name || identity,
    session, role, state: room.state, quality: room.localParticipant.connectionQuality,
    reconnects, uptimeSec: Math.round((Date.now() - started) / 1000),
    audioPlayback: playback(),
  });
  const send = (sample: TelemetrySample, keepalive = false) => fetch("/api/stats", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(sample), keepalive, signal: AbortSignal.timeout(5000),
  });

  const collect = async () => {
    const cycleStarted = Date.now();
    try {
      const expiresAt = tokenExpiresAt(token);
      if (expiresAt !== null ? expiresAt - Date.now() < 120_000 : Date.now() - tokenAt > 50 * 60_000) {
        const tokenUrl = studioControl
          ? `/api/token?room=${encodeURIComponent(scope.roomName)}&role=${studioControl.role}&clientId=${encodeURIComponent(studioControl.clientId)}${studioControl.role === "studio-panel" ? `&epoch=${encodeURIComponent(String(studioControl.epoch))}` : ""}`
          : `/api/token?room=${encodeURIComponent(scope.roomName)}&identity=${encodeURIComponent(identity)}&role=${role === "studio" ? "studio-panel" : role}`;
        const scopedTokenUrl = `${tokenUrl}&studioId=${encodeURIComponent(scope.studioId)}${scope.moderatorPanel ? "&panelMode=moderator" : ""}`;
        const response = await fetch(scopedTokenUrl, { signal: AbortSignal.timeout(5000), headers: {
          authorization: `Bearer ${token}`,
          ...(viewAccess ? { "x-castlink-view-access": viewAccess } : {}),
        }, cache: "no-store" });
        if (response.ok && !stopped) {
          const next = (await response.json()).token;
          if (!stopped && typeof next === "string" && httpBearer.update(next)) { token = next; tokenAt = Date.now(); }
        }
      }
      const streams: StreamStat[] = [];
      const seen = new Set<string>();
      const statsDeadline = Date.now() + 1000;
      const publications = [room.localParticipant, ...room.remoteParticipants.values()].flatMap(participant =>
        [...participant.trackPublications.values()].map(publication => ({ participant, publication })))
        .sort((a, b) => Number(b.publication.kind === Track.Kind.Audio) - Number(a.publication.kind === Track.Kind.Audio));
      for (const { participant, publication } of publications) {
        if (stopped || Date.now() >= statsDeadline) break;
        const direction = participant.isLocal ? "out" : "in";
        if (!publication.track || (publication.kind !== Track.Kind.Audio && publication.kind !== Track.Kind.Video)) continue;
        const track = publication.track;
        let report: RTCStatsReport | undefined;
        try { report = await readTrackStats(track, "getRTCStatsReport", Math.min(600, Math.max(1, statsDeadline - Date.now()))); } catch { continue; }
        if (stopped) return;
        if (publication.track !== track) continue;
        if (!report) continue;
        const stats: Record<string, any>[] = [];
        report.forEach((stat) => stats.push(stat));
        const transport = stats.find((s) => s.type === "transport" && s.selectedCandidatePairId);
        const pair = (transport && report.get(transport.selectedCandidatePairId)) || stats.find((s) => s.type === "candidate-pair" && s.state === "succeeded" && (s.nominated || s.selected));
        const candidate = pair ? report.get(pair.localCandidateId) : undefined;
        for (const stat of stats) {
          if (stat.type !== (direction === "in" ? "inbound-rtp" : "outbound-rtp") || stat.isRemote) continue;
          const id = `${direction}:${stat.id}`;
          // Participant + publication avoids mixing counters between track replacements.
          const counterKey = `${participant.identity}:${publication.trackSid}:${id}`;
          if (seen.has(counterKey)) continue;
          seen.add(counterKey);
          const remote = direction === "out" ? (report.get(stat.remoteId) || stats.find((s) => s.type === "remote-inbound-rtp" && s.localId === stat.id)) : undefined;
          const packets = numberOrNull(direction === "in" ? stat.packetsReceived : stat.packetsSent);
          const lost = numberOrNull(direction === "in" ? stat.packetsLost : remote?.packetsLost);
          const next = { at: stat.timestamp, bytes: Number((direction === "in" ? stat.bytesReceived : stat.bytesSent) || 0), packets, lost };
          const delta = rateDelta(previous.get(counterKey), next);
          // Outbound packetsSent already includes packets lost at the receiver.
          if (direction === "out") {
            const prev = previous.get(counterKey);
            delta.lossPct = prev && packets !== null && prev.packets !== null && lost !== null && prev.lost !== null &&
              packets > prev.packets && lost >= prev.lost ? Math.min(100, (lost - prev.lost) / (packets - prev.packets) * 100) : null;
          }
          previous.set(counterKey, next);
          let audio;
          if (direction === "in" && publication.kind === Track.Kind.Audio) {
            const diagnostic = audioReceiveDiagnostic(stat, previousAudio.get(counterKey));
            previousAudio.set(counterKey, diagnostic.counters);
            audio = diagnostic.diagnostic;
          }
          streams.push({ id, participant: participant.identity, name: participant.name || participant.identity,
            direction, kind: publication.kind === Track.Kind.Video ? "video" : "audio", source: publication.source,
            codec: report.get(stat.codecId)?.mimeType ?? null, ...delta, lostPackets: lost,
            jitterMs: millis(direction === "in" ? stat.jitter : remote?.jitter),
            rttMs: millis(remote?.roundTripTime ?? pair?.currentRoundTripTime),
            fps: numberOrNull(stat.framesPerSecond), width: numberOrNull(stat.frameWidth), height: numberOrNull(stat.frameHeight),
            bytes: next.bytes, freezes: numberOrNull(stat.freezeCount), protocol: candidate?.protocol ?? null,
            candidateType: candidate?.candidateType ?? null, qualityLimitation: stat.qualityLimitationReason ?? null,
            ...(audio ? { audio } : {}),
          });
        }
      }
      for (const key of previous.keys()) if (!seen.has(key)) previous.delete(key);
      for (const key of previousAudio.keys()) if (!seen.has(key)) previousAudio.delete(key);
      if (!stopped) await send({ ...base(), streams });
    } catch { /* A telemetry failure must never interrupt the call. */ }
    finally { if (!stopped) timer = setTimeout(collect, Math.max(0, 2000 - (Date.now() - cycleStarted))); }
  };
  void collect();
  return () => {
    stopped = true;
    httpBearer.release();
    if (timer) clearTimeout(timer);
    room.off(RoomEvent.Reconnecting, onReconnect);
    room.off(RoomEvent.SignalReconnecting, onReconnect);
    void send({ ...base(), state: "disconnected", streams: [] }, true).catch(() => undefined);
  };
}
