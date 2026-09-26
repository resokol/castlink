import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { mean, sumRates, type ConnectionHistory, type HistoryResponse, type MetricPoint, type TelemetrySample } from "./telemetry-types";

const HOUR = 3_600_000;
const retention = 26 * HOUR;
const storeRoot = () => process.env.STUDIOLINK_STATS_DIR || path.join(process.cwd(), ".studiolink-data", "stats");
const roomDirectory = (room: string) => path.join(storeRoot(), createHash("sha256").update(room).digest("hex"));
let lastCleanup = 0;
let pending: Promise<void> = Promise.resolve();

async function cleanup() {
  if (Date.now() - lastCleanup < HOUR) return;
  lastCleanup = Date.now();
  const root = storeRoot();
  for (const room of await readdir(root)) {
    if (!/^[a-f0-9]{64}$/.test(room)) continue;
    for (const file of await readdir(path.join(root, room))) {
      if (/^\d+\.jsonl$/.test(file) && Number(file.slice(0, -6)) * HOUR < Date.now() - retention) {
        await unlink(path.join(root, room, file)).catch(() => undefined);
      }
    }
  }
}

export async function saveSample(sample: TelemetrySample) {
  const write = async () => {
    const directory = roomDirectory(sample.room);
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, `${Math.floor(sample.at / HOUR)}.jsonl`), JSON.stringify(sample) + "\n", { mode: 0o600 });
    await cleanup();
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

export async function readHistory(room: string, minutes: number, selectedSession?: string): Promise<HistoryResponse> {
  const to = Date.now(), from = to - minutes * 60_000;
  const bucketMs = Math.max(10_000, Math.ceil(minutes * 60_000 / 360 / 10_000) * 10_000);
  const connections = new Map<string, ConnectionHistory>();
  const buckets = new Map<number, Map<string, Bucket>>();
  let retainedFrom: number | null = null;
  const directory = roomDirectory(room);
  let files: string[];
  try { files = await readdir(directory); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { from, to, bucketMs, connections: [], series: [], retainedFrom };
    throw e;
  }
  files = files.filter((f) => /^\d+\.jsonl$/.test(f) && Number(f.slice(0, -6)) * HOUR >= from - HOUR).sort();
  for (const file of files) {
    const lines = createInterface({ input: createReadStream(path.join(directory, file)), crlfDelay: Infinity });
    for await (const line of lines) {
      let sample: TelemetrySample;
      try { sample = JSON.parse(line); } catch { continue; }
      if (sample.at < from || sample.at > to) continue;
      retainedFrom = retainedFrom === null ? sample.at : Math.min(retainedFrom, sample.at);
      const previous = connections.get(sample.session);
      if (!previous) connections.set(sample.session, { session: sample.session, identity: sample.identity,
        name: sample.name, role: sample.role, firstSeen: sample.at, lastSeen: sample.at, latest: sample });
      else {
        previous.firstSeen = Math.min(previous.firstSeen, sample.at);
        if (sample.at >= previous.lastSeen) { previous.lastSeen = sample.at; previous.latest = sample; }
      }
      if (selectedSession && selectedSession !== sample.session) continue;
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
  const visible = [...connections.values()].filter(c => c.lastSeen > cleared || (c.latest.state !== "disconnected" && to - c.lastSeen < 35000));
  return { from, to, bucketMs, series, retainedFrom, connections: visible.sort((a, b) => b.lastSeen - a.lastSeen) };
}
