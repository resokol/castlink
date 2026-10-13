import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { mean, sumRates, type AudioHistoryResponse, type ConnectionHistory, type HistoryResponse, type MetricPoint, type TelemetryRole, type TelemetrySample } from "./telemetry-types";
import { addAudioSummary, emptyAudioSummary } from "./audio-diagnostics";
import { rememberLiveSample } from "./live-telemetry-cache";
import { persistentStatsDir } from "./persistent-storage";
import { archiveTelemetryHour, historyEnd, openTelemetryHour, statsMaxBytes, statsRetentionDays, telemetryHours, STATS_HOUR } from "./telemetry-archives";

const HOUR = STATS_HOUR;
const storeRoot = () => persistentStatsDir();
const roomDirectory = (room: string) => path.join(storeRoot(), createHash("sha256").update(room).digest("hex"));
let lastCleanup = 0;
let pending: Promise<void> = Promise.resolve();

export async function cleanupStats(force = false) {
  if (!force && Date.now() - lastCleanup < HOUR) return;
  lastCleanup = Date.now();
  const root = storeRoot();
  const filesToKeep: { paths: string[]; hour: number; size: number }[] = [];
  let totalBytes = 0;
  for (const room of await readdir(root)) {
    if (!/^[a-f0-9]{64}$/.test(room)) continue;
    const directory = path.join(root, room);
    for (const hour of await telemetryHours(directory)) {
      const paths = [hour.raw, hour.gzip, hour.index].filter((value): value is string => !!value);
      if ((hour.hour + 1) * HOUR <= Date.now() - statsRetentionDays() * 24 * HOUR) {
        for (const absolute of paths) await unlink(absolute).catch(() => undefined);
        continue;
      }
      if ((hour.hour + 1) * HOUR <= Date.now() - 26 * HOUR) await archiveTelemetryHour(hour);
    }
    // Re-scan after compression so the global budget includes both archives and retained raw sources.
    for (const hour of await telemetryHours(directory)) {
      const paths = [hour.raw, hour.gzip, hour.index].filter((value): value is string => !!value);
      let size = 0;
      for (const absolute of paths) { try { size += (await stat(absolute)).size; } catch {} }
      totalBytes += size; filesToKeep.push({ paths, hour: hour.hour * HOUR, size });
    }
  }
  const maxBytes = statsMaxBytes();
  if (totalBytes > maxBytes) {
    filesToKeep.sort((a, b) => a.hour - b.hour);
    for (const file of filesToKeep) {
      if (totalBytes <= maxBytes) break;
      for (const absolute of file.paths) {
        try { const size = (await stat(absolute)).size; await unlink(absolute); totalBytes -= size; } catch {}
      }
    }
  }
}

export async function saveSample(sample: TelemetrySample) {
  rememberLiveSample(sample);
  const write = async () => {
    const directory = roomDirectory(sample.room);
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, `${Math.floor(sample.at / HOUR)}.jsonl`), JSON.stringify(sample) + "\n", { mode: 0o600 });
    await cleanupStats();
  };
  pending = pending.catch(() => undefined).then(write);
  await pending;
}

export async function clearDisconnected(room: string) {
  const directory = roomDirectory(room);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "cleared.json"), JSON.stringify({ before: Date.now() }), { mode: 0o600 });
}

type Sum = { total: number; count: number };
type Bucket = { metrics: Record<string, Sum>; active: boolean };
const fields = ["inbound", "outbound", "audioIn", "videoIn", "audioOut", "videoOut", "loss", "jitter", "rtt"] as const;

export async function readHistory(room: string, minutes: number, selectedSession?: string, precise = false, selectedIdentity?: string, selectedRole?: TelemetryRole, endAt?: number): Promise<HistoryResponse> {
  const to = historyEnd(endAt), from = to - minutes * 60_000;
  const bucketMs = precise ? 2000 : Math.max(10_000, Math.ceil(minutes * 60_000 / 360 / 10_000) * 10_000);
  const connections = new Map<string, ConnectionHistory>();
  const buckets = new Map<number, Map<string, Bucket>>();
  let retainedFrom: number | null = null;
  const audioSummary = emptyAudioSummary(), recoveryBySession = new Map<string, number>();
  const directory = roomDirectory(room);
  const hours = await telemetryHours(directory);
  const retention = { days: statsRetentionDays(), maxBytes: statsMaxBytes(), availableFrom: hours.length ? hours[0].hour * HOUR : null };
  for (const hour of hours.filter(hour => hour.hour * HOUR >= from - HOUR && hour.hour * HOUR <= to)) {
    const opened = await openTelemetryHour(hour), lines = createInterface({ input: opened.input, crlfDelay: Infinity });
    try {
    for await (const line of lines) {
      let sample: TelemetrySample;
      try { sample = JSON.parse(line); } catch { continue; }
      if (sample.at < from || sample.at > to) continue;
      if (sample.room !== room) continue;
      const previous = connections.get(sample.session);
      if (!previous) connections.set(sample.session, { session: sample.session, identity: sample.identity,
        name: sample.name, role: sample.role, firstSeen: sample.at, lastSeen: sample.at, latest: sample });
      else {
        previous.firstSeen = Math.min(previous.firstSeen, sample.at);
        if (sample.at >= previous.lastSeen) { previous.lastSeen = sample.at; previous.latest = sample; previous.name = sample.name; previous.role = sample.role; }
      }
      if (selectedSession && selectedSession !== sample.session) continue;
      if (selectedIdentity && selectedIdentity !== sample.identity) continue;
      if (selectedRole && selectedRole !== sample.role) continue;
      addAudioSummary(audioSummary, sample, recoveryBySession);
      retainedFrom = retainedFrom === null ? sample.at : Math.min(retainedFrom, sample.at);
      const at = Math.floor(sample.at / bucketMs) * bucketMs;
      let bucket = buckets.get(at);
      if (!bucket) { bucket = new Map(); buckets.set(at, bucket); }
      let session = bucket.get(sample.session);
      if (!session) { session = { metrics: {}, active: false }; bucket.set(sample.session, session); }
      if (sample.state === "disconnected") continue;
      session.active = true;
      const metrics = {
        inbound: sumRates(sample.streams, "in"), outbound: sumRates(sample.streams, "out"),
        audioIn: sumRates(sample.streams, "in", "audio"), videoIn: sumRates(sample.streams, "in", "video"),
        audioOut: sumRates(sample.streams, "out", "audio"), videoOut: sumRates(sample.streams, "out", "video"),
        loss: mean(sample.streams.map((s) => s.lossPct)), jitter: mean(sample.streams.map((s) => s.jitterMs)),
        rtt: mean(sample.streams.map((s) => s.rttMs)),
      };
      for (const field of fields) {
        const value = metrics[field];
        if (value === null) continue;
        const metric = session.metrics[field] ?? { total: 0, count: 0 };
        metric.total += value; metric.count++;
        session.metrics[field] = metric;
      }
    }
    } finally { lines.close(); opened.close(); }
  }
  const series: MetricPoint[] = [];
  for (let at = Math.floor(from / bucketMs) * bucketMs; at <= to; at += bucketMs) {
    const sessions = [...(buckets.get(at)?.values() ?? [])].filter((s) => s.active);
    const point: MetricPoint = { at, inbound: null, outbound: null, audioIn: null, videoIn: null,
      audioOut: null, videoOut: null, loss: null, jitter: null, rtt: null, connections: sessions.length };
    for (const field of fields) {
      const values = sessions.map((s) => s.metrics[field]).filter(Boolean).map((s) => s.total / s.count);
      point[field] = values.length ? (["loss", "jitter", "rtt"].includes(field) ? mean(values) : values.reduce((a, b) => a + b, 0)) : null;
    }
    series.push(point);
  }
  let cleared = 0;
  try { cleared = JSON.parse(await readFile(path.join(directory, "cleared.json"), "utf8")).before || 0; } catch {}
  const visible = [...connections.values()].filter(c =>
    (!selectedSession || c.session === selectedSession) &&
    (!selectedIdentity || c.identity === selectedIdentity) &&
    (!selectedRole || c.role === selectedRole) &&
    // Reset affects the live list; selecting a historical day must still show its connections.
    (endAt !== undefined || c.lastSeen > cleared || (c.latest.state !== "disconnected" && to - c.lastSeen < 35000)));
  return { from, to, bucketMs, series, retainedFrom, retention, audioSummary, connections: visible.sort((a, b) => b.lastSeen - a.lastSeen) };
}

/** Exact stored samples, with scoped filtering before the page limit. No media or tokens. */
export async function readAudioHistory(room: string, minutes: number, options: {
  session?: string; identity?: string; role?: TelemetryRole; limit?: number; cursor?: string; to?: number;
} = {}): Promise<AudioHistoryResponse> {
  if (![15, 60, 360, 720, 1440].includes(minutes)) throw new Error("invalid_audio_period");
  const to = historyEnd(options.to);
  const from = to - minutes * 60_000;
  const limit = options.limit ?? 1000;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2000) throw new Error("invalid_audio_limit");
  if (options.cursor && !/^\d{1,12}:\d{1,12}$/.test(options.cursor)) throw new Error("invalid_audio_cursor");
  const [cursorHour, cursorOffset] = options.cursor?.split(":").map(Number) ?? [0, 0];
  if (options.cursor && (cursorHour * HOUR < from - HOUR || cursorHour * HOUR > to)) throw new Error("invalid_audio_cursor");
  const response: AudioHistoryResponse = { from, to, samples: [], nextCursor: null, limited: false, summary: emptyAudioSummary() };
  const directory = roomDirectory(room), recoveryBySession = new Map<string, number>();
  const hours = await telemetryHours(directory);
  let scannedBytes = 0, responseBytes = 0;
  for (const savedHour of hours.filter(hour => hour.hour * HOUR >= from - HOUR && hour.hour * HOUR <= to)) {
    const hour = savedHour.hour;
    if (hour < cursorHour) continue;
    const requestedOffset = hour === cursorHour ? cursorOffset : 0;
    const opened = await openTelemetryHour(savedHour, requestedOffset);
    let offset = opened.start;
    const lines = createInterface({ input: opened.input, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        const bytes = Buffer.byteLength(line, "utf8") + 1;
        offset += bytes; scannedBytes += bytes;
        if (offset <= requestedOffset) continue;
        let sample: TelemetrySample | undefined;
        try { sample = JSON.parse(line); } catch {}
        if (sample && sample.room === room && sample.at >= from && sample.at <= to &&
          (!options.session || sample.session === options.session) && (!options.identity || sample.identity === options.identity) &&
          (!options.role || sample.role === options.role) && (sample.audioPlayback || sample.streams?.some(s => s.kind === "audio"))) {
          const detail: TelemetrySample = { at: sample.at, clientAt: sample.clientAt, room: sample.room, identity: sample.identity,
            name: sample.name, session: sample.session, role: sample.role, state: sample.state, quality: sample.quality,
            reconnects: sample.reconnects, uptimeSec: sample.uptimeSec, audioPlayback: sample.audioPlayback,
            streams: sample.streams.filter(s => s.kind === "audio") };
          const detailBytes = Buffer.byteLength(JSON.stringify(detail), "utf8");
          if (response.samples.length && responseBytes + detailBytes > 2 * 1024 * 1024) {
            response.nextCursor = `${hour}:${offset - bytes}`; response.limited = true; return response;
          }
          responseBytes += detailBytes;
          response.samples.push(detail);
          addAudioSummary(response.summary, sample, recoveryBySession);
        }
        if (response.samples.length >= limit || scannedBytes >= 32 * 1024 * 1024) {
          response.nextCursor = `${hour}:${offset}`;
          response.limited = true;
          return response;
        }
      }
    } finally { lines.close(); opened.close(); }
  }
  return response;
}
