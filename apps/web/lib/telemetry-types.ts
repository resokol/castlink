export type StreamStat = {
  id: string; participant: string; name: string; direction: "in" | "out";
  kind: "audio" | "video"; source: string; codec: string | null;
  bitrateKbps: number | null; lossPct: number | null; lostPackets: number | null;
  jitterMs: number | null; rttMs: number | null; fps: number | null;
  width: number | null; height: number | null; bytes: number;
  freezes: number | null; protocol: string | null; candidateType: string | null;
  qualityLimitation: string | null;
  audio?: AudioReceiveDiagnostic;
};

export type AudioReceiveDiagnostic = {
  statsAt: number | null; intervalMs: number | null;
  receivedSamples: number | null; concealedSamples: number | null; concealmentEvents: number | null;
  receivedSamplesDelta: number | null; concealedSamplesDelta: number | null; concealmentEventsDelta: number | null;
  concealedPct: number | null; jitterBufferDelayMs: number | null; audioLevel: number | null;
};

export type AudioPlaybackDiagnostic = {
  enabled: boolean; subscribed?: boolean; trackState?: "live" | "ended" | null;
  paused?: boolean | null; muted?: boolean | null; readyState?: number | null;
  currentTime?: number | null; errorCode?: number | null; contextState?: string | null;
  recoveryAttempts?: number; lastRecoveryAt?: number | null; lastRecoveryReason?: string | null;
};

export type AudioHistorySummary = {
  samples: number; lossIntervals: number; concealmentIntervals: number;
  // Recovery totals are observed session counter maxima, not attempts limited to the time window.
  // Detailed page summaries are page-local and must not be added across pages.
  noSampleProgressIntervals: number; playbackWarnings: number; recoveryAttempts: number;
};

export type AudioHistoryResponse = {
  from: number; to: number; samples: TelemetrySample[]; nextCursor: string | null;
  limited: boolean; summary: AudioHistorySummary;
};

export type TelemetryRole = "guest" | "admin" | "moderator" | "studio" | "output" | "monitor";

export type TelemetrySample = {
  at: number; room: string; identity: string; name: string; session: string;
  role: TelemetryRole;
  state: string; quality: string; reconnects: number; uptimeSec: number;
  streams: StreamStat[];
  clientAt?: number;
  audioPlayback?: AudioPlaybackDiagnostic;
};

export type MetricPoint = {
  at: number; inbound: number | null; outbound: number | null;
  audioIn: number | null; videoIn: number | null; audioOut: number | null; videoOut: number | null;
  loss: number | null; jitter: number | null; rtt: number | null; connections: number;
};

export type ConnectionHistory = {
  session: string; identity: string; name: string; role: TelemetrySample["role"];
  firstSeen: number; lastSeen: number; latest: TelemetrySample;
};

export type HistoryResponse = {
  from: number; to: number; bucketMs: number; series: MetricPoint[];
  connections: ConnectionHistory[]; retainedFrom: number | null;
  audioSummary?: AudioHistorySummary;
  retention?: { days: number; maxBytes: number; availableFrom: number | null };
};

export function sumRates(streams: StreamStat[], direction: "in" | "out", kind?: "audio" | "video") {
  const values = streams.filter((s) => s.direction === direction && (!kind || s.kind === kind))
    .map((s) => s.bitrateKbps).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

export function mean(values: (number | null | undefined)[]) {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
