import type { TelemetrySample, VideoDiagnostic } from "./telemetry-types";

const counters = ["statsAt", "framesSent", "framesEncoded", "framesReceived", "framesDecoded", "framesDropped",
  "keyFramesEncoded", "keyFramesDecoded", "freezeCount", "totalFreezesDuration", "totalEncodeTime", "totalDecodeTime",
  "totalPacketSendDelay", "packetsSent", "packetsReceived", "nackCount", "pliCount", "firCount",
  "jitterBufferDelay", "jitterBufferEmittedCount", "captureFrames", "captureFps", "availableOutgoingBitrate"] as const;
const states = ["publicationMuted", "trackMuted", "mediaTrackEnabled", "mediaTrackMuted"] as const;
type TrackState = Partial<Pick<VideoDiagnostic, "trackSid" | "mediaTrackReadyState" | typeof states[number]>>;

/** Only operational scalars: never store raw RTC reports, device IDs, labels, SDP or addresses. */
export function sanitizeVideoDiagnostic(value: unknown): VideoDiagnostic | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const result: Record<string, unknown> = Object.fromEntries(counters.map(key => {
    const n = v[key];
    return [key, typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e15 ? n : null];
  }));
  for (const key of states) result[key] = typeof v[key] === "boolean" ? v[key] : null;
  result.trackSid = typeof v.trackSid === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(v.trackSid) ? v.trackSid : null;
  result.mediaTrackReadyState = v.mediaTrackReadyState === "live" || v.mediaTrackReadyState === "ended" ? v.mediaTrackReadyState : null;
  return result as VideoDiagnostic;
}

/** Read only the existing report; callers pass its explicitly linked local media source. */
export function videoDiagnostic(stat: Record<string, any>, source?: Record<string, any>, pair?: Record<string, any>, track: TrackState = {}): VideoDiagnostic {
  const capture = source?.type === "media-source" && source.kind === "video" ? source : undefined;
  return sanitizeVideoDiagnostic({
    ...Object.fromEntries(counters.map(key => [key, stat[key]])), ...track,
    statsAt: stat.timestamp, captureFrames: capture?.frames, captureFps: capture?.framesPerSecond,
    availableOutgoingBitrate: pair?.availableOutgoingBitrate,
  })!;
}

/** Match the ingestion UTF-8 budget without sacrificing existing audio/runtime/basic video data. */
export function telemetryBody(sample: TelemetrySample): string {
  const body = JSON.stringify(sample), encoder = new TextEncoder();
  if (encoder.encode(body).length <= 100_000 || !sample.streams.some(stream => stream.video)) return body;
  const bounded = { ...sample, streams: sample.streams.map(stream => ({ ...stream })), videoDiagnosticsLimited: true };
  let bytes = encoder.encode(JSON.stringify(bounded)).length;
  // Local publications are collected first. Retain their diagnostics preferentially.
  for (let i = bounded.streams.length - 1; i >= 0 && bytes > 100_000; i--) {
    const stream = bounded.streams[i];
    if (!stream.video) continue;
    bytes -= encoder.encode(',"video":' + JSON.stringify(stream.video)).length;
    delete stream.video;
  }
  return JSON.stringify(bounded);
}
