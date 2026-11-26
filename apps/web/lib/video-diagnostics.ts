import type { StreamStat, TelemetrySample, VideoDiagnostic } from "./telemetry-types";

export type VideoLayerMeasurement = { codec: string; width: number; height: number; kbps: number; requestedQuality?: VideoDiagnostic["requestedQuality"]; requestedShortSide?: number };

export function videoLayerMeasurement(stream: StreamStat): VideoLayerMeasurement | undefined {
  const { width, height, codec, bitrateKbps } = stream;
  if (!codec || !width || width < 0 || !height || height < 0 || !bitrateKbps || bitrateKbps < 0) return;
  return { codec: codec.toLowerCase(), width, height, kbps: bitrateKbps,
    ...(stream.video?.requestedQuality ? { requestedQuality: stream.video.requestedQuality } : {}),
    ...(stream.video?.requestedShortSide !== undefined ? { requestedShortSide: stream.video.requestedShortSide } : {}) };
}

export function substantiallyLowerLayer(low: VideoLayerMeasurement, high: VideoLayerMeasurement) {
  // Compare against a larger layer only when the preview actually requested that size.
  if (low.requestedQuality === "adaptive" && (low.requestedShortSide ?? 0) < Math.min(high.width, high.height)) return false;
  return low.codec === high.codec && low.width < high.width && low.height < high.height &&
    2 * low.width * low.height <= high.width * high.height && 2 * low.kbps <= high.kbps;
}

const counters = ["statsAt", "framesSent", "framesEncoded", "framesReceived", "framesDecoded", "framesDropped",
  "keyFramesEncoded", "keyFramesDecoded", "freezeCount", "totalFreezesDuration", "totalEncodeTime", "totalDecodeTime",
  "totalPacketSendDelay", "packetsSent", "packetsReceived", "nackCount", "pliCount", "firCount",
  "jitterBufferDelay", "jitterBufferEmittedCount", "captureFrames", "captureFps", "availableOutgoingBitrate"] as const;
const states = ["publicationMuted", "trackMuted", "mediaTrackEnabled", "mediaTrackMuted"] as const;
type TrackState = Partial<Pick<VideoDiagnostic, "trackSid" | "mediaTrackReadyState" | "requestedQuality" | "requestedShortSide" | "receiverStreamState" | typeof states[number]>>;

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
  if (v.requestedQuality === "adaptive" && typeof v.requestedShortSide === "number" && Number.isSafeInteger(v.requestedShortSide) && v.requestedShortSide >= 0 && v.requestedShortSide <= 32768) result.requestedShortSide = v.requestedShortSide;
  if (v.requestedQuality === "adaptive" || v.requestedQuality === "low" || v.requestedQuality === "medium" || v.requestedQuality === "high") result.requestedQuality = v.requestedQuality;
  if (v.receiverStreamState === "active" || v.receiverStreamState === "paused") result.receiverStreamState = v.receiverStreamState;
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
  if (encoder.encode(body).length <= 100_000) return body;
  const bounded = { ...sample, streams: sample.streams.map(stream => ({ ...stream })) };
  let bytes = encoder.encode(JSON.stringify(bounded)).length;
  for (let i = bounded.streams.length - 1; i >= 0 && bytes > 100_000; i--) {
    const stream = bounded.streams[i];
    if (!stream.peerReport && !stream.trackSid) continue;
    if (stream.peerReport) bytes -= encoder.encode(',"peerReport":' + JSON.stringify(stream.peerReport)).length;
    if (stream.trackSid) bytes -= encoder.encode(',"trackSid":' + JSON.stringify(stream.trackSid)).length;
    delete stream.peerReport; delete stream.trackSid;
    if (!bounded.peerReportsLimited) { bounded.peerReportsLimited = true; bytes += ',"peerReportsLimited":true'.length; }
  }
  // Local publications are collected first. Retain their diagnostics preferentially.
  for (let i = bounded.streams.length - 1; i >= 0 && bytes > 100_000; i--) {
    const stream = bounded.streams[i];
    if (!stream.video) continue;
    bytes -= encoder.encode(',"video":' + JSON.stringify(stream.video)).length;
    delete stream.video;
    if (!bounded.videoDiagnosticsLimited) { bounded.videoDiagnosticsLimited = true; bytes += ',"videoDiagnosticsLimited":true'.length; }
  }
  return JSON.stringify(bounded);
}
