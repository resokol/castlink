import { createMinuteEvidence, incidentNode } from "./incident-minute";
import { readRoomServerLoad } from "./room-server-load";
import { storedLines } from "./diagnostic-record-lines";
import { sanitizeAudioPlayback } from "./audio-diagnostics";
import { sanitizeRuntimeDiagnostic } from "./runtime-diagnostics";
import { createRoomMediaDiagnosis } from "./room-media-diagnosis";
import { streamRoomSfuEvidence, type RoomSfuSnapshot } from "./room-sfu-evidence";
import { roomDirectory } from "./telemetry-store";
import { historyEnd, openTelemetryHour, statsRetentionDays, STATS_HOUR, telemetryHours } from "./telemetry-archives";
import { sanitizeTelemetryStreams, telemetryMetric, telemetryText } from "./telemetry-sanitize";
import type { TelemetryRole, TelemetrySample } from "./telemetry-types";
import type { NodeCpuSample, RoomDiagnosticsReport, RoomDiagnosticsScope } from "./room-diagnostics-types";

const roles: TelemetryRole[] = ["guest", "admin", "moderator", "studio", "output", "monitor"];
const periods = [15, 60, 360, 720, 1440];
const protocol = "castlink-room-diagnostics-v1";
const noStore = { "Cache-Control": "no-store" };
const shared = globalThis as typeof globalThis & { castlinkDiagnosticsRooms?: Set<string> };
const activeRooms = shared.castlinkDiagnosticsRooms ??= new Set<string>();

/** Review bounds are inclusive node-receipt timestamps. Require both so a missing bound cannot widen a report. */
export function explicitDiagnosticsRange(params: URLSearchParams) {
  if (!params.has("from")) return undefined;
  const rawFrom = params.get("from")!, rawTo = params.get("to") ?? "";
  const from = Number(rawFrom), to = Number(rawTo);
  const minutes = Number(params.get("minutes") ?? "15");
  if (new Set(params.keys()).size !== params.size || params.has("minute") ||
    !/^(0|[1-9]\d*)$/.test(rawFrom) || !/^(0|[1-9]\d*)$/.test(rawTo) ||
    !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to || to > Date.now() ||
    !periods.includes(minutes) || to - from > minutes * 60_000) throw Error("invalid_history_query");
  return { from, to };
}

function requestedScope(room: string, params: URLSearchParams): RoomDiagnosticsScope {
  const minutes = Number(params.get("minutes") || 15);
  const identity = params.get("participant") || undefined;
  const session = params.get("session") || undefined;
  const role = params.get("role") as TelemetryRole || undefined;
  if (!room || room.length > 512 || !periods.includes(minutes) ||
    identity && identity.length > 160 || session && !/^[a-zA-Z0-9-]{10,80}$/.test(session) ||
    role && !roles.includes(role) || params.has("cursor") || params.has("limit")) throw Error("invalid_history_query");
  const to = historyEnd(params.has("to") ? Number(params.get("to")) : undefined);
  const range = explicitDiagnosticsRange(params);
  if (range) return { room, ...range, identity, session, role };
  if (params.has("minute")) {
    const minute = Number(params.get("minute"));
    if (!Number.isSafeInteger(minute) || minute % 60_000 || minute > to || minute + 59_999 < to - minutes * 60_000) throw Error("invalid_history_query");
    return { room, from: minute, to: Math.min(to, minute + 59_999), minute, identity, session, role };
  }
  return { room, from: to - minutes * 60_000, to, identity, session, role };
}

function matches(sample: TelemetrySample, scope: RoomDiagnosticsScope) {
  return sample.room === scope.room && sample.at >= scope.from && sample.at <= scope.to &&
    (!scope.identity || sample.identity === scope.identity) && (!scope.role || sample.role === scope.role) &&
    (!scope.session || sample.session === scope.session);
}

/** Sanitizers fill missing metrics for new submissions. Keep missing fields absent in legacy exports. */
function keepStoredFields(clean: object, stored: object) {
  const source = stored as { [key: string]: unknown };
  const target = clean as { [key: string]: unknown };
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key)) delete target[key];
    else if (target[key] && source[key] && typeof target[key] === "object" && typeof source[key] === "object") {
      keepStoredFields(target[key] as object, source[key] as object);
    }
  }
}

function storedSample(line: string | null, scope: RoomDiagnosticsScope): TelemetrySample | "skip" | null {
  if (!line) return null;
  let raw: TelemetrySample;
  try { raw = JSON.parse(line); } catch { return null; }
  if (!raw || typeof raw.room !== "string" || !Number.isSafeInteger(raw.at) || typeof raw.identity !== "string" ||
    typeof raw.session !== "string" || !roles.includes(raw.role) || !Array.isArray(raw.streams) || raw.streams.length > 256) return null;
  if (!matches(raw, scope)) return "skip";
  const streams = sanitizeTelemetryStreams(raw.streams);
  if (streams.length !== raw.streams.length) return null;
  const clean: TelemetrySample = {
    at: raw.at, clientAt: telemetryMetric(raw.clientAt, 1e15) ?? undefined, room: raw.room,
    identity: raw.identity, session: raw.session, role: raw.role, name: telemetryText(raw.name),
    state: telemetryText(raw.state, 30), quality: telemetryText(raw.quality, 30),
    reconnects: telemetryMetric(raw.reconnects, 100000) ?? 0, uptimeSec: telemetryMetric(raw.uptimeSec) ?? 0,
    streams, audioPlayback: sanitizeAudioPlayback(raw.audioPlayback),
    runtime: raw.role === "studio" && raw.identity.startsWith("studio-panel-") ? sanitizeRuntimeDiagnostic(raw.runtime) : undefined,
    ...(raw.peerReportsLimited === true ? { peerReportsLimited: true } : {}),
    ...(raw.videoDiagnosticsLimited === true ? { videoDiagnosticsLimited: true } : {}),
  };
  keepStoredFields(clean, raw);
  return clean;
}

type Manifest = { type: "manifest"; format: string; summaryRequired: true; scope: RoomDiagnosticsScope; retentionDays: number; earliestRetainedHour: number | null };
type DiagnosticRecord = Manifest | { type: "sample"; sample: TelemetrySample } | { type: "sfu-sample"; sample: RoomSfuSnapshot }
  | { type: "server-load-sample"; sample: NodeCpuSample } | ({ type: "summary" } & RoomDiagnosticsReport);

async function* diagnosticRecords(scope: RoomDiagnosticsScope, full: boolean, signal: AbortSignal, platform: boolean): AsyncGenerator<DiagnosticRecord> {
  signal.throwIfAborted();
  const hours = await telemetryHours(roomDirectory(scope.room));
  if (full) yield { type: "manifest", format: protocol, summaryRequired: true, scope, retentionDays: statsRetentionDays(),
    earliestRetainedHour: hours.length ? hours[0].hour * STATS_HOUR : null };
  const diagnosis = createRoomMediaDiagnosis();
  const minuteEvidence = scope.minute !== undefined ? createMinuteEvidence(scope.from, scope.to) : undefined;
  let sampleCount = 0, skippedRecords = 0, unreadableHours = 0;
  let firstAt: number | null = null, lastAt: number | null = null;
  for (const hour of hours) {
    if ((hour.hour + 1) * STATS_HOUR <= scope.from || hour.hour * STATS_HOUR > scope.to) continue;
    signal.throwIfAborted();
    let opened: Awaited<ReturnType<typeof openTelemetryHour>>;
    try { opened = await openTelemetryHour(hour, 0, true); }
    catch { unreadableHours++; continue; }
    const close = () => opened.close();
    signal.addEventListener("abort", close, { once: true });
    try {
      signal.throwIfAborted();
      for await (const line of storedLines(opened.input, signal)) {
        signal.throwIfAborted();
        const sample = storedSample(line, scope);
        if (sample === null) { skippedRecords++; continue; }
        if (sample === "skip") continue;
        sampleCount++;
        firstAt = firstAt === null ? sample.at : Math.min(firstAt, sample.at);
        lastAt = lastAt === null ? sample.at : Math.max(lastAt, sample.at);
        diagnosis.add(sample);
        minuteEvidence?.add(sample);
        if (full) yield { type: "sample", sample };
      }
    } catch (error) {
      signal.throwIfAborted();
      // A retention eviction or damaged gzip member must be visible in the report footer.
      if (!(error instanceof Error) || !("code" in error)) throw error;
      unreadableHours++;
    } finally {
      signal.removeEventListener("abort", close);
      close();
    }
  }
  signal.throwIfAborted();
  const observations = streamRoomSfuEvidence(scope.room, scope.from, scope.to, { ...scope, signal });
  let next = await observations.next();
  try {
    while (!next.done) {
      if (full) yield { type: "sfu-sample", sample: next.value };
      next = await observations.next();
    }
  } finally {
    // A cancelled consumer discards the generator's summary and closes its current file.
    if (!next.done) await observations.return(undefined!);
  }
  const sfu = next.value;
  signal.throwIfAborted();
  const findings = diagnosis.finish();
  const { summary: serverLoad, originals } = await readRoomServerLoad(scope.from, scope.to, findings.findings, platform);
  signal.throwIfAborted();
  if (full) {
    for (const sample of originals) {
      signal.throwIfAborted();
      yield { type: "server-load-sample", sample };
    }
  }
  const incident = minuteEvidence?.finish(await incidentNode(scope.from, scope.to, platform));
  const complete = incident?.node.reason !== "storage-unavailable" && !skippedRecords && !unreadableHours && !sfu.skippedRecords && !sfu.unreadableHours &&
    sfu.reason !== "storage-unavailable" && serverLoad.reason !== "storage-unavailable";
  yield { type: "summary", ...scope, firstAt, lastAt, sampleCount, skippedRecords, unreadableHours, complete, diagnosis: findings, sfu, serverLoad, ...(incident ? { incident } : {}) };
}

function attachment(scope: RoomDiagnosticsScope, explicitRange: boolean) {
  const readable = scope.room.slice(0, 100).replace(new RegExp("[^\\p{L}\\p{N}_-]", "gu"), "_");
  const ascii = readable.replace(/[^A-Za-z0-9_-]/g, "_");
  const date = new Date(scope.to).toISOString().replace(/[:.]/g, "-");
  const duration = scope.minute !== undefined ? 1 : (scope.to - scope.from) / 60_000;
  const suffix = explicitRange ? `-${scope.from}-${scope.to}.ndjson` : `-${date}-${duration}min.ndjson`;
  const fallback = `attachment; filename="castlink-diagnostics-${ascii}${suffix}"`;
  return readable === ascii ? fallback : fallback + `; filename*=UTF-8''castlink-diagnostics-${encodeURIComponent(readable)}${suffix}`;
}

function downloadBody(records: AsyncGenerator<DiagnosticRecord>, abort: AbortController, release: () => void) {
  const encoder = new TextEncoder();
  let idle: ReturnType<typeof setTimeout>;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const finish = () => {
    clearTimeout(idle);
    abort.signal.removeEventListener("abort", stop);
    release();
  };
  const stop = () => {
    controller.error(abort.signal.reason);
    void records.return(undefined).finally(finish).catch(() => undefined);
  };
  const resetIdle = () => {
    idle = setTimeout(() => abort.abort(new Error("diagnostics_download_idle")), 120_000);
    idle.unref();
  };
  return new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      abort.signal.addEventListener("abort", stop, { once: true });
      if (abort.signal.aborted) stop();
      else resetIdle();
    },
    async pull() {
      clearTimeout(idle);
      try {
        const next = await records.next();
        abort.signal.throwIfAborted();
        if (next.done) { controller.close(); finish(); return; }
        controller.enqueue(encoder.encode(JSON.stringify(next.value) + "\n"));
        if (next.value.type === "summary") {
          controller.close();
          await records.return(undefined);
          finish();
        } else resetIdle();
      } catch (error) { controller.error(error); finish(); }
    },
    cancel() {
      abort.abort();
      return records.return(undefined).then(finish);
    },
  }, { highWaterMark: 0 });
}

export async function roomDiagnosticsResponse(room: string, params: URLSearchParams, requestSignal?: AbortSignal, nodeId?: string) {
  let scope: RoomDiagnosticsScope;
  try { scope = requestedScope(room, params); }
  catch { return Response.json({ error: "invalid_history_query" }, { status: 400, headers: noStore }); }
  if (activeRooms.size >= 2 || activeRooms.has(room)) {
    return Response.json({ error: "diagnostics_busy" }, { status: 429, headers: { ...noStore, "Retry-After": "5" } });
  }
  const abort = new AbortController();
  const cancel = () => abort.abort(requestSignal?.reason);
  requestSignal?.addEventListener("abort", cancel, { once: true });
  if (requestSignal?.aborted) cancel();
  activeRooms.add(room);
  // Both abort and the final stream pull can finish in the same tick.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeRooms.delete(room);
    requestSignal?.removeEventListener("abort", cancel);
  };
  const full = params.get("diagnostics") === "full";
  const explicitRange = params.has("from");
  const headers = { ...noStore, "X-Castlink-Diagnostics": protocol, "X-Content-Type-Options": "nosniff",
    ...(explicitRange ? { "X-Castlink-Diagnostics-Range": `${scope.from}-${scope.to}` } : {}),
    ...(scope.minute !== undefined ? { "X-Castlink-Incident-Minute": String(scope.minute) } : {}),
    ...(nodeId ? { "X-Castlink-Node-Id": nodeId } : {}) };
  // Only the super-admin and HMAC-authenticated node routes supply this trusted argument.
  const records = diagnosticRecords(scope, full, abort.signal, !!nodeId);
  if (full) return new Response(downloadBody(records, abort, release), { headers: { ...headers,
    "Content-Type": "application/x-ndjson; charset=utf-8", "Content-Disposition": attachment(scope, explicitRange), "X-Accel-Buffering": "no" } });
  try {
    for await (const record of records) if (record.type === "summary") return Response.json(record, { headers });
    throw Error("diagnostics_summary_missing");
  } catch { return Response.json({ error: "history_unavailable" }, { status: 503, headers: noStore }); }
  finally { release(); }
}
