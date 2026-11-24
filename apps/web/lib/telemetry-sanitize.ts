import { sanitizePeerReport } from "./rtcp-peer-report";
import { sanitizeAudioReceive, sanitizeAudioTrack } from "./audio-diagnostics";
import { sanitizeVideoDiagnostic } from "./video-diagnostics";
import type { StreamStat } from "./telemetry-types";

export const telemetryText = (value: unknown, length = 160) => typeof value === "string" ? value.slice(0, length) : "";
export const telemetryMetric = (value: unknown, max = 1e12): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : null;

export function sanitizeTelemetryStreams(streams: unknown[]): StreamStat[] {
  return streams.filter((s: any) => s && ["in", "out"].includes(s.direction) && ["audio", "video"].includes(s.kind))
      .map((s: any): StreamStat => ({
        id: telemetryText(s.id), participant: telemetryText(s.participant), name: telemetryText(s.name), direction: s.direction, kind: s.kind,
        source: telemetryText(s.source, 40), codec: telemetryText(s.codec, 80) || null,
        bitrateKbps: telemetryMetric(s.bitrateKbps, 1e7), lossPct: telemetryMetric(s.lossPct, 100), lostPackets: telemetryMetric(s.lostPackets),
        jitterMs: telemetryMetric(s.jitterMs), rttMs: telemetryMetric(s.rttMs), fps: telemetryMetric(s.fps, 1000),
        width: telemetryMetric(s.width, 16384), height: telemetryMetric(s.height, 16384), bytes: telemetryMetric(s.bytes) ?? 0,
        freezes: telemetryMetric(s.freezes), protocol: telemetryText(s.protocol, 20) || null,
        candidateType: telemetryText(s.candidateType, 30) || null, qualityLimitation: telemetryText(s.qualityLimitation, 40) || null,
        ...(typeof s.trackSid === "string" && /^[a-zA-Z0-9_-]{1,96}$/.test(s.trackSid) ? { trackSid: s.trackSid } : {}),
        ...(s.peerReport ? { peerReport: sanitizePeerReport(s.peerReport, s.direction) } : {}),
        ...(s.kind === "audio" && s.direction === "in" ? { audio: sanitizeAudioReceive(s.audio) } : {}),
        ...(s.kind === "audio" ? { audioTrack: sanitizeAudioTrack(s.audioTrack, s.direction === "out") } : {}),
        ...(s.kind === "video" ? { video: sanitizeVideoDiagnostic(s.video) } : {}),
      }));
}
