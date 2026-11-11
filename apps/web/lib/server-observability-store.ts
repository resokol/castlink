import { DatabaseSync } from "node:sqlite";
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, statSync } from "node:fs";
import path from "node:path";
import { productionDataDir } from "./persistent-storage";
import { safeServerEvent } from "./server-event-sanitize";
import type { PendingServerEvent, ServerEvent, ServerEventLevel, ObservabilityStorage } from "./server-event-types";
import type { ServerMonitorSample } from "./server-monitor-types";

export const OBSERVABILITY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MONITOR_INTERVAL_MS = 15000;
const metricKeys = ["cpuPercent", "memoryUsedBytes", "memoryTotalBytes", "diskUsedBytes", "diskTotalBytes", "diskAvailableBytes", "networkInMbps", "networkOutMbps", "processRssBytes", "processUptimeSec", "configuredRooms", "activeRooms", "connections", "casters"] as const;
type StoreOptions = { clock?: () => number; metricLimit?: number; eventLimit?: number; maxBytes?: number; walBytes?: number };

function sampleFrom(value: unknown): ServerMonitorSample | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.at) || Number(input.at) < 0) return null;
  const output: Record<string, unknown> = { at: input.at };
  for (const key of metricKeys) {
    const n = input[key];
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) return null;
    if ((key === "processRssBytes" || key === "processUptimeSec") && n === null) return null;
    output[key] = n;
  }
  if (Number(output.cpuPercent) > 100) return null;
  if (!input.services || typeof input.services !== "object") return null;
  const services = input.services as Record<string, unknown>;
  output.services = {};
  for (const name of ["web", "livekit", "roomStore"]) {
    if (!["ok", "unavailable", "unconfigured"].includes(String(services[name]))) return null;
    (output.services as Record<string, unknown>)[name] = services[name];
  }
  return output as unknown as ServerMonitorSample;
}

export function aggregateMonitorSamples(samples: ServerMonitorSample[], windowMs: number, maxPoints = 720, windowEnd = samples.at(-1)?.at ?? Date.now()) {
  const resolutionMs = Math.max(MONITOR_INTERVAL_MS, Math.ceil(windowMs / (maxPoints * MONITOR_INTERVAL_MS)) * MONITOR_INTERVAL_MS);
  if (resolutionMs === MONITOR_INTERVAL_MS) return { history: samples.slice(-maxPoints), resolutionMs, aggregation: "raw" as const };
  const buckets = new Map<number, ServerMonitorSample[]>();
  const gaps = new Set<number>();
  let previousAt: number | undefined;
  for (const sample of samples) {
    const start = windowEnd - windowMs;
    const from = start + Math.min(maxPoints - 1, Math.floor((sample.at - start) / resolutionMs)) * resolutionMs;
    if (previousAt !== undefined && sample.at - previousAt > MONITOR_INTERVAL_MS * 3) gaps.add(from);
    previousAt = sample.at;
    buckets.set(from, [...(buckets.get(from) || []), sample]);
  }
  const history = [...buckets.entries()].map(([from, points]) => {
    const last = points.at(-1)!;
    const result = { ...last, from, ...(gaps.has(from) ? { gapBefore: true } : {}), services: { ...last.services } };
    for (const key of metricKeys) {
      if (key === "processUptimeSec") continue;
      const values = points.flatMap(point => point[key] === null ? [] : [point[key] as number]);
      (result as unknown as Record<string, unknown>)[key] = values.length ? Math.max(...values) : null;
    }
    for (const prefix of ["memory", "disk"] as const) {
      const used = `${prefix}UsedBytes` as const, total = `${prefix}TotalBytes` as const;
      const peak = points.filter(point => point[used] !== null && (point[total] ?? 0) > 0).sort((a, b) => b[used]! / b[total]! - a[used]! / a[total]!)[0];
      result[used] = peak?.[used] ?? null; result[total] = peak?.[total] ?? null;
      if (prefix === "disk") result.diskAvailableBytes = peak?.diskAvailableBytes ?? null;
    }
    for (const service of ["web", "livekit", "roomStore"] as const) result.services[service] = points.some(point => point.services[service] === "unavailable") ? "unavailable" : points.some(point => point.services[service] === "unconfigured") ? "unconfigured" : "ok";
    return result;
  }).slice(-maxPoints);
  return { history, resolutionMs, aggregation: "max" as const };
}

/** Small synchronous transactions, a 25 ms lock timeout and hard disk limits keep diagnostics subordinate to serving. */
export class ServerObservabilityStore {
  private db: DatabaseSync | null = null;
  private retryAt = 0;
  private failed = false;
  private dropped = 0;
  private corrupt = 0;
  private closed = false;
  private readonly clock: () => number;
  private readonly metricLimit: number;
  private readonly eventLimit: number;
  private readonly maxBytes: number;
  private readonly walBytes: number;
  constructor(readonly filename: string, options: StoreOptions = {}) {
    this.clock = options.clock || Date.now;
    this.metricLimit = options.metricLimit || 5760;
    this.eventLimit = options.eventLimit || 20000;
    this.maxBytes = options.maxBytes || 48 * 1024 * 1024;
    this.walBytes = options.walBytes || 8 * 1024 * 1024;
  }
  private open() {
    if (this.closed || this.clock() < this.retryAt) return null;
    if (this.db) return this.db;
    let candidate: DatabaseSync | null = null;
    try {
      const directory = path.dirname(this.filename);
      mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
      if (!existsSync(this.filename)) closeSync(openSync(this.filename, "wx", 0o600));
      if (!lstatSync(this.filename).isFile()) throw new Error("invalid_observability_file");
      chmodSync(this.filename, 0o600);
      candidate = new DatabaseSync(this.filename);
      candidate.exec(`PRAGMA busy_timeout=25; PRAGMA page_size=4096; PRAGMA max_page_count=${Math.floor(this.maxBytes / 4096)}; PRAGMA cache_size=-8192; PRAGMA cache_spill=OFF;`);
      candidate.exec("CREATE TABLE IF NOT EXISTS metrics(at INTEGER PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,level TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS events_time ON events(at); CREATE INDEX IF NOT EXISTS events_level_id ON events(level,id); CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY,value INTEGER NOT NULL);");
      candidate.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA wal_autocheckpoint=256; PRAGMA journal_size_limit=${this.walBytes};`);
      this.dropped += Number(candidate.prepare("SELECT value FROM counters WHERE name='dropped'").get()?.value || 0);
      this.db = candidate; this.failed = false;
      return candidate;
    } catch {
      try { candidate?.close(); } catch { /* Failed opens must not leak handles. */ }
      this.failed = true; this.retryAt = this.clock() + 30000;
      return null;
    }
  }
  storage(samplerRunning = observabilitySamplerRunning()): ObservabilityStorage {
    const key = Symbol.for("castlink.server-observability-worker");
    const workerFailed = (globalThis as typeof globalThis & { [key: symbol]: { failed?: boolean } | undefined })[key]?.failed;
    return { state: this.failed || !this.db || this.corrupt || workerFailed ? "unavailable" : "ok", droppedEvents: this.dropped, samplerRunning, ...(this.corrupt ? { corruptRecords: this.corrupt } : {}) };
  }
  addDroppedEvents(count: number) { this.dropped += count; }
  private prune(db: DatabaseSync, incomingMetrics: number, incomingEvents: number, chunk: number) {
    const threshold = this.clock() - OBSERVABILITY_RETENTION_MS;
    db.prepare("DELETE FROM metrics WHERE at IN (SELECT at FROM metrics WHERE at<=? OR at<COALESCE((SELECT at FROM metrics ORDER BY at DESC LIMIT 1 OFFSET ?),-1) ORDER BY at LIMIT ?)").run(threshold, Math.max(0, this.metricLimit - incomingMetrics - 1), chunk);
    const pages = Number(db.prepare("PRAGMA page_count").get()?.page_count || 0);
    const free = Number(db.prepare("PRAGMA freelist_count").get()?.freelist_count || 0);
    const pressure = (pages - free) * 4096 > this.maxBytes * 0.85;
    const removed = db.prepare("DELETE FROM events WHERE id IN (SELECT id FROM events WHERE at<=? OR id<COALESCE((SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET ?),-1) OR ? ORDER BY id LIMIT ?)").run(threshold, Math.max(0, this.eventLimit - incomingEvents - 1), Number(pressure), Math.max(chunk, incomingEvents));
    if (pressure) this.addDroppedEvents(Number(removed.changes));
    db.prepare("INSERT INTO counters(name,value) VALUES('dropped',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(this.dropped);
  }
  private checkpoint(db: DatabaseSync) {
    if (!existsSync(`${this.filename}-wal`) || statSync(`${this.filename}-wal`).size === 0) return true;
    const result = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    return !Number(result?.busy) && statSync(`${this.filename}-wal`).size === 0;
  }
  private transactionChunk() {
    // Reserve1MiB for schema/index overhead and128KiB per changed row, including B-tree rebalancing.
    // One transaction changes at most4*chunk rows; dirty pages cannot spill/rewrite before COMMIT.
    return Math.min(16, Math.floor((this.walBytes - 1024 * 1024) / (4 * 128 * 1024)));
  }
  private write(fn: (db: DatabaseSync) => void, incomingMetrics = 0, incomingEvents = 0) {
    const db = this.open();
    if (!db) return false;
    try {
      const chunk = this.transactionChunk();
      if (chunk < 1 || incomingEvents > chunk || !this.checkpoint(db)) throw new Error("observability_wal_budget");
      db.exec("BEGIN IMMEDIATE");
      this.prune(db, incomingMetrics, incomingEvents, chunk);
      fn(db); db.exec("COMMIT");
      this.failed = !this.checkpoint(db);
      return true;
    } catch {
      try { db.exec("ROLLBACK"); } catch { /* No active transaction after a failed BEGIN. */ }
      this.failed = true;
      return false;
    }
  }
  appendSample(sample: ServerMonitorSample) {
    const safe = sampleFrom(sample);
    return !!safe && this.write(db => db.prepare("INSERT OR REPLACE INTO metrics(at,payload) VALUES (?,?)").run(safe.at, JSON.stringify(safe)), 1);
  }
  appendEvents(events: PendingServerEvent[]) {
    const safe = events.slice(0, 100).flatMap(event => { const clean = safeServerEvent(event.level, event.event, event.fields, event.at); return clean ? [clean] : []; });
    this.addDroppedEvents(events.length - safe.length);
    if (!safe.length) return true;
    const chunk = Math.max(1, this.transactionChunk());
    for (let at = 0; at < safe.length; at += chunk) {
      const batch = safe.slice(at, at + chunk);
      if (!this.write(db => { const insert = db.prepare("INSERT INTO events(at,level,payload) VALUES(?,?,?)"); for (const event of batch) insert.run(event.at, event.level, JSON.stringify(event)); }, 0, batch.length)) { this.addDroppedEvents(safe.length - at); return false; }
    }
    return true;
  }
  readMetrics(windowMs: number) {
    this.corrupt = 0;
    const db = this.open();
    const samples: ServerMonitorSample[] = [];
    if (db) try {
      const rows = db.prepare("SELECT payload FROM metrics WHERE at>? AND at<=? ORDER BY at DESC LIMIT ?").all(this.clock() - OBSERVABILITY_RETENTION_MS, this.clock(), this.metricLimit);
      for (const row of rows.reverse()) {
        try { const value = sampleFrom(JSON.parse(String(row.payload))); if (value) samples.push(value); else this.corrupt++; }
        catch { this.corrupt++; }
      }
    } catch { this.failed = true; }
    const latest = samples.at(-1) || null;
    return { ...aggregateMonitorSamples(samples.filter(sample => sample.at > this.clock() - windowMs), windowMs, 720, this.clock()), latest, windowMs, storage: this.storage() };
  }
  readEvents(level: ServerEventLevel | "all", cursor?: number, limit = 50) {
    this.corrupt = 0;
    const db = this.open();
    const events: ServerEvent[] = [];
    let nextCursor: number | null = null;
    if (db) try {
      const rows = db.prepare("SELECT id,payload FROM events WHERE at>? AND at<=? AND id<? AND (?='all' OR level=?) ORDER BY id DESC LIMIT ?").all(this.clock() - OBSERVABILITY_RETENTION_MS, this.clock(), cursor ?? Number.MAX_SAFE_INTEGER, level, level, Math.min(50, limit) + 1);
      const consumed = rows.slice(0, limit);
      for (const row of consumed) {
        try {
          const raw = JSON.parse(String(row.payload));
          const safe = safeServerEvent(raw.level, raw.event, raw.fields || {}, raw.at);
          if (safe) events.push({ ...safe, id: Number(row.id) }); else this.corrupt++;
        } catch { this.corrupt++; }
      }
      if (rows.length > limit) nextCursor = Number(consumed.at(-1)!.id);
    } catch { this.failed = true; }
    return { generatedAt: this.clock(), retentionMs: OBSERVABILITY_RETENTION_MS, events, nextCursor, storage: this.storage() };
  }
  close() { this.closed = true; try { this.db?.close(); } catch { /* Shutdown remains best effort. */ } this.db = null; }
}

const key = Symbol.for("castlink.server-observability-store");
export function serverObservabilityStore() {
  const shared = globalThis as typeof globalThis & { [key: symbol]: ServerObservabilityStore | undefined };
  return shared[key] ||= new ServerObservabilityStore(path.join(productionDataDir(), "runtime", "server-observability.sqlite"));
}
export function observabilitySamplerRunning() {
  const key = Symbol.for("castlink.server-observability-worker");
  const state = (globalThis as typeof globalThis & { [key: symbol]: { started?: boolean; stopped?: boolean } | undefined })[key];
  return !!state?.started && !state.stopped;
}
