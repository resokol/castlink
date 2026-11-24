import type { NodeKeyframes } from "./node-keyframes";
import type { MonitorServiceState } from "./server-monitor-types";
import type { TelemetrySample, StreamStat } from "./telemetry-types";

type PathMeasurement = {
  publisher: string; receiver: string | null; session: string; kind: StreamStat["kind"]; source: string; track: string | null;
  firstAt: number; lastAt: number; reports: number; slotsObserved: number;
  peakKbps: number | null; peakLossPct: number | null; peakJitterMs: number | null;
};
type ClientAvailability = {
  identity: string; session: string; firstAt: number; lastAt: number; slotsObserved: number;
  states: string[]; reconnectDelta: number | null;
};
export type IncidentNode = {
  reason?: "platform-access-required" | "no-observations" | "storage-unavailable";
  samples: { at: number; livekit: MonitorServiceState; keyframes?: NodeKeyframes }[];
};
export type MinuteEvidence = {
  slotMs: number; slots: number; limited: boolean;
  paths: PathMeasurement[]; clients: ClientAvailability[]; node: IncidentNode;
};

// Server receipt time on a single CastLink node. Each slot means at least one observation.
const slotMs = 5000;
const maxPaths = 256, maxClients = 128;
function peak(current: number | null, value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(current ?? value, value) : current;
}
export function createMinuteEvidence(from: number, to: number) {
  const slots = Math.ceil((to - from + 1) / slotMs);
  const paths = new Map<string, { row: PathMeasurement; observed: Set<number> }>();
  const clients = new Map<string, { row: ClientAvailability; observed: Set<number>; first: number | null; last: number | null }>();
  let limited = false;
  function add(sample: TelemetrySample) {
    if (sample.at < from || sample.at > to) return;
    const slot = Math.floor((sample.at - from) / slotMs);
    const key = JSON.stringify([sample.identity, sample.session]);
    let client = clients.get(key);
    if (!client && clients.size < maxClients) {
      client = { observed: new Set(), first: null, last: null, row: { identity: sample.identity, session: sample.session,
        firstAt: sample.at, lastAt: sample.at, states: [], slotsObserved: 0, reconnectDelta: null } };
      clients.set(key, client);
    }
    if (client) {
      client.observed.add(slot);
      const row = client.row;
      row.slotsObserved = client.observed.size;
      if (sample.state && !row.states.includes(sample.state)) {
        if (row.states.length < 8) row.states.push(sample.state);
        else limited = true;
      }
      if (sample.at <= row.firstAt) { row.firstAt = sample.at; client.first = sample.reconnects ?? null; }
      if (sample.at >= row.lastAt) { row.lastAt = sample.at; client.last = sample.reconnects ?? null; }
      row.reconnectDelta = row.lastAt > row.firstAt && client.first !== null && client.last !== null && client.last >= client.first
        ? client.last - client.first : null;
    } else limited = true;
    // Sum simulcast encodings of the same publication within this one browser report.
    const rates = new Map<string, number>();
    const reported = new Set<string>();
    for (const stream of sample.streams) {
      const receiver = stream.direction === "in" ? sample.identity : null;
      const publisher = receiver ? stream.participant : sample.identity;
      if (!publisher) continue;
      const track = stream.trackSid || stream.video?.trackSid || null;
      const path = JSON.stringify([publisher, receiver, sample.session, stream.kind, stream.source, track]);
      let entry = paths.get(path);
      if (!entry) {
        if (paths.size >= maxPaths) { limited = true; continue; }
        entry = { observed: new Set(), row: { publisher, receiver, session: sample.session, kind: stream.kind,
          source: stream.source, track, firstAt: sample.at, lastAt: sample.at, reports: 0, slotsObserved: 0,
          peakKbps: null, peakLossPct: null, peakJitterMs: null } };
        paths.set(path, entry);
      }
      const { row, observed } = entry;
      observed.add(slot);
      row.slotsObserved = observed.size;
      row.firstAt = Math.min(row.firstAt, sample.at);
      row.lastAt = Math.max(row.lastAt, sample.at);
      row.peakLossPct = peak(row.peakLossPct, stream.lossPct);
      row.peakJitterMs = peak(row.peakJitterMs, stream.jitterMs);
      if (typeof stream.bitrateKbps === "number") rates.set(path, (rates.get(path) ?? 0) + stream.bitrateKbps);
      if (!reported.has(path)) { reported.add(path); row.reports++; }
    }
    for (const [path, rate] of rates) {
      const row = paths.get(path)!.row;
      row.peakKbps = peak(row.peakKbps, rate);
    }
  }
  function finish(node: IncidentNode): MinuteEvidence {
    return { slotMs, slots, limited, paths: Array.from(paths.values(), entry => entry.row),
      clients: Array.from(clients.values(), entry => entry.row), node };
  }
  return { add, finish };
}

export async function incidentNode(from: number, to: number, platform: boolean): Promise<IncidentNode> {
  if (!platform) return { samples: [], reason: "platform-access-required" };
  try {
    const { serverObservabilityStore } = await import("./server-observability-store");
    const { samples, available } = serverObservabilityStore().readIncidentNode(from, to);
    if (!available) return { samples, reason: "storage-unavailable" };
    return samples.length ? { samples } : { samples, reason: "no-observations" };
  } catch { return { samples: [], reason: "storage-unavailable" }; }
}
