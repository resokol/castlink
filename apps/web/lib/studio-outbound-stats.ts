export type StudioOutboundMetrics = {
  resolution: string;
  videoKbps: number;
  audioKbps: number;
  fps: number;
};

export type StudioOutboundSample = StudioOutboundMetrics & {
  measuredAt: number;
  videoHistory: number[];
};

export type StudioOutboundView = {
  status: "live" | "waiting" | "stale" | "offline";
  sample?: StudioOutboundSample;
};

const MAX_HISTORY = 60;
const MAX_FRESH_AGE_MS = 10_000;
const MAX_FUTURE_SKEW_MS = 2_000;
const MAX_RATE_KBPS = 100_000;
const MAX_FPS = 240;
const MAX_RESOLUTION_EDGE = 16_384;

export function createStudioOutboundSample(metrics: StudioOutboundMetrics, videoHistory: number[], measuredAt = Date.now()): StudioOutboundSample {
  return {
    resolution: typeof metrics.resolution === "string" && metrics.resolution.length <= 24 ? metrics.resolution : "—",
    videoKbps: bounded(metrics.videoKbps, MAX_RATE_KBPS),
    audioKbps: bounded(metrics.audioKbps, MAX_RATE_KBPS),
    fps: bounded(metrics.fps, MAX_FPS),
    measuredAt: Number.isFinite(measuredAt) && measuredAt >= 0 ? measuredAt : Date.now(),
    videoHistory: videoHistory.filter(value => Number.isFinite(value) && value >= 0 && value <= MAX_RATE_KBPS).slice(-MAX_HISTORY),
  };
}

function bounded(value: number, max: number) {
  return Number.isFinite(value) && value >= 0 ? Math.min(value, max) : 0;
}

function parseFreshSample(value: unknown, now: number): StudioOutboundView {
  if (value == null) return { status: "waiting" };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "stale" };
  const sample = value as Record<string, unknown>;
  const resolution = sample.resolution;
  const dimensions = resolution === "—" || (typeof resolution === "string" && resolution.length <= 24 && new RegExp(`^\\d{1,${String(MAX_RESOLUTION_EDGE).length}}×\\d{1,${String(MAX_RESOLUTION_EDGE).length}}$`).test(resolution));
  const finiteBounded = (field: unknown, max: number): field is number => typeof field === "number" && Number.isFinite(field) && field >= 0 && field <= max;
  if (!dimensions || !finiteBounded(sample.videoKbps, MAX_RATE_KBPS) || !finiteBounded(sample.audioKbps, MAX_RATE_KBPS)
    || !finiteBounded(sample.fps, MAX_FPS) || !finiteBounded(sample.measuredAt, Number.MAX_SAFE_INTEGER)
    || !Array.isArray(sample.videoHistory) || sample.videoHistory.length > MAX_HISTORY
    || !sample.videoHistory.every(value => finiteBounded(value, MAX_RATE_KBPS))) return { status: "stale" };
  if (sample.measuredAt > now + MAX_FUTURE_SKEW_MS || now - sample.measuredAt > MAX_FRESH_AGE_MS) return { status: "stale" };
  const match = resolution === "—" ? null : (resolution as string).match(/^(\d+)×(\d+)$/);
  if (match && (Number(match[1]) > MAX_RESOLUTION_EDGE || Number(match[2]) > MAX_RESOLUTION_EDGE)) return { status: "stale" };
  return {
    status: "live",
    sample: {
      resolution: resolution as string,
      videoKbps: sample.videoKbps,
      audioKbps: sample.audioKbps,
      fps: sample.fps,
      measuredAt: sample.measuredAt,
      videoHistory: [...sample.videoHistory] as number[],
    },
  };
}

export function selectStudioOutboundView(
  role: "primary" | "moderator" | "connecting",
  localSample: unknown,
  remoteActual: unknown,
  primaryOnline: boolean,
  now = Date.now(),
): StudioOutboundView {
  if (role === "connecting") return { status: "waiting" };
  if (role === "primary") return parseFreshSample(localSample, now);
  if (!primaryOnline) return { status: "offline" };
  const outbound = remoteActual && typeof remoteActual === "object" && !Array.isArray(remoteActual)
    ? (remoteActual as Record<string, unknown>).outbound
    : undefined;
  return parseFreshSample(outbound, now);
}

// Translate server timestamps into the receiving browser clock once per response.
export function receiveStudioActual(value: any, receivedAt = Date.now()): any {
  if (!value || !value.outbound || typeof value.serverNow !== "number" || typeof value.outbound.measuredAt !== "number") return value;
  return { ...value, outbound: { ...value.outbound, measuredAt: receivedAt - Math.max(0, value.serverNow - value.outbound.measuredAt) } };
}
