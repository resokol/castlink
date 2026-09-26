export type StreamStat = {
  id: string; participant: string; name: string; direction: "in" | "out";
  kind: "audio" | "video"; source: string; codec: string | null;
  bitrateKbps: number | null; lossPct: number | null; lostPackets: number | null;
  jitterMs: number | null; rttMs: number | null; fps: number | null;
  width: number | null; height: number | null; bytes: number;
  freezes: number | null; protocol: string | null; candidateType: string | null;
  qualityLimitation: string | null;
};

export type TelemetrySample = {
  at: number; room: string; identity: string; name: string; session: string;
  role: "guest" | "studio" | "output" | "monitor";
  state: string; quality: string; reconnects: number; uptimeSec: number;
  streams: StreamStat[];
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
