import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ParticipantInfo } from "livekit-server-sdk";
import { storedLines } from "./diagnostic-record-lines";
import { openTelemetryHour, STATS_HOUR, telemetryHours } from "./telemetry-archives";
import { cleanupStats, roomDirectory } from "./telemetry-store";
import type { TelemetryRole } from "./telemetry-types";

type PublishedTrack = { participant: string; trackSid: string; kind: "audio" | "video"; muted: boolean };
export type RoomSfuSnapshot = { at: number; tracks: PublishedTrack[]; limited: boolean };
export type RoomSfuEvidenceHistory = {
  source: "livekit-room-service"; granularity: "publication"; perTrackRtp: "unavailable";
  samples: RoomSfuSnapshot[]; limited: boolean; observedSamples: number; clippedSnapshots: number; unreadableHours: number; skippedRecords: number;
  reason?: "unmapped-filter" | "no-observations" | "storage-unavailable";
};
type Options = { identity?: string; role?: TelemetryRole; session?: string; signal?: AbortSignal };

const maxTracks = 64;
const maxLineBytes = 64 * 1024;
const lastObservations = new Map<string, { at: number; digest: string }>();
// NUL is outside the media-room name alphabet. Hour files participate in the shared archive and byte budget.
const directoryFor = (room: string) => roomDirectory("\0sfu-publications\0" + room);
const snapshotDigest = (s: RoomSfuSnapshot) => createHash("sha256").update(JSON.stringify([s.tracks, s.limited])).digest("base64url");
const validId = (id: unknown, max: number): id is string =>
  typeof id === "string" && id.length > 0 && Buffer.byteLength(id) <= max && !/[\u0000-\u001f\u007f]/.test(id);

export function roomPublicationSnapshot(participants: ParticipantInfo[], at: number): RoomSfuSnapshot {
  const tracks: PublishedTrack[] = [];
  let limited = false;
  for (const p of participants) {
    for (const track of p.tracks ?? []) {
      // The protocol enum is AUDIO=0, VIDEO=1, DATA=2.
      if (track.type !== 0 && track.type !== 1) continue;
      if (!validId(p.identity, 160) || !validId(track.sid, 96) || typeof track.muted !== "boolean") {
        limited = true;
        continue;
      }
      if (tracks.length === maxTracks) return { at, tracks, limited: true };
      tracks.push({ participant: p.identity, trackSid: track.sid, kind: track.type === 0 ? "audio" : "video", muted: track.muted });
    }
  }
  tracks.sort((a, b) => a.trackSid.localeCompare(b.trackSid));
  return { at, tracks, limited };
}

/** An unchanged roster gets a fresh observation every minute. Changed snapshots are saved on the next monitor tick. */
export async function saveRoomSfuEvidence(room: string, snapshot: RoomSfuSnapshot) {
  const previous = lastObservations.get(room);
  const digest = snapshotDigest(snapshot);
  const hour = Math.floor(snapshot.at / STATS_HOUR);
  const repeated = previous && previous.digest === digest && snapshot.at >= previous.at &&
    snapshot.at - previous.at <= 120_000 && Math.floor(previous.at / STATS_HOUR) === hour;
  if (repeated && snapshot.at - previous.at < 60_000) return;
  const directory = directoryFor(room);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Hour-local references make a stable room one small heartbeat/minute, even with dozens of tracks.
  const file = path.join(directory, hour + ".jsonl");
  let needsSnapshot = !repeated;
  if (repeated) {
    try {
      // Eviction may remove an entire hour. A reference must never recreate an empty hour.
      await appendFile(file, JSON.stringify({ room, at: snapshot.at, anchor: digest }) + "\n",
        { flag: constants.O_APPEND | constants.O_WRONLY });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      needsSnapshot = true;
    }
  }
  if (needsSnapshot) await appendFile(file, JSON.stringify({ room, ...snapshot }) + "\n", { mode: 0o600 });
  lastObservations.delete(room);
  if (lastObservations.size >= 256) lastObservations.delete(lastObservations.keys().next().value!);
  lastObservations.set(room, { at: snapshot.at, digest });
  await cleanupStats();
}

// Read through the same allowlist as the writer. Never pass through a stored object or metadata to an export.
function readSnapshot(line: string | null, room: string, anchors: Map<string, RoomSfuSnapshot>): RoomSfuSnapshot | null {
  if (!line) return null;
  let raw;
  try { raw = JSON.parse(line); } catch { return null; }
  if (raw?.room !== room || !Number.isSafeInteger(raw.at)) return null;
  if (raw.anchor !== undefined) {
    const original = anchors.get(raw.anchor);
    return original && raw.at >= original.at ? { ...original, at: raw.at } : null;
  }
  if (!Array.isArray(raw.tracks) || raw.tracks.length > maxTracks || typeof raw.limited !== "boolean") return null;
  const tracks: PublishedTrack[] = [];
  for (const track of raw.tracks) {
    if (!track || !validId(track.participant, 160) || !validId(track.trackSid, 96) ||
        !["audio", "video"].includes(track.kind) || typeof track.muted !== "boolean") return null;
    tracks.push({ participant: track.participant, trackSid: track.trackSid, kind: track.kind, muted: track.muted });
  }
  const sample = { at: raw.at, tracks, limited: raw.limited };
  // A restarted or overlapping worker starts a new full snapshot. Never invent a missing anchor.
  if (anchors.size >= 8) anchors.delete(anchors.keys().next().value!);
  anchors.set(snapshotDigest(sample), sample);
  return { ...sample };
}

export async function* streamRoomSfuEvidence(room: string, from: number, to: number, options: Options = {}):
    AsyncGenerator<RoomSfuSnapshot, RoomSfuEvidenceHistory> {
  const signal = options.signal ?? new AbortController().signal;
  const history: RoomSfuEvidenceHistory = { source: "livekit-room-service", granularity: "publication",
    perTrackRtp: "unavailable", samples: [], observedSamples: 0, clippedSnapshots: 0, limited: false, unreadableHours: 0, skippedRecords: 0 };
  signal.throwIfAborted();
  if (options.role || options.session) return { ...history, reason: "unmapped-filter" };
  let hours: Awaited<ReturnType<typeof telemetryHours>>;
  try { hours = await telemetryHours(directoryFor(room)); }
  catch { return { ...history, limited: true, reason: "storage-unavailable" }; }
  // Keep at most one example per time bucket in the summary. The full download streams each observation.
  const buckets = new Set<number>();
  for (const hour of hours) {
    if ((hour.hour + 1) * STATS_HOUR <= from || hour.hour * STATS_HOUR > to) continue;
    signal.throwIfAborted();
    let opened: Awaited<ReturnType<typeof openTelemetryHour>>;
    try { opened = await openTelemetryHour(hour, 0, true); }
    catch { history.unreadableHours++; continue; }
    const close = () => opened.close();
    signal.addEventListener("abort", close, { once: true });
    try {
      signal.throwIfAborted();
      const anchors = new Map<string, RoomSfuSnapshot>();
      for await (const line of storedLines(opened.input, signal, maxLineBytes)) {
        signal.throwIfAborted();
        const sample = readSnapshot(line, room, anchors);
        if (!sample) { history.skippedRecords++; continue; }
        if (sample.at < from || sample.at > to) continue;
        if (sample.limited) { history.clippedSnapshots++; history.limited = true; }
        if (options.identity) {
          sample.tracks = sample.tracks.filter(track => track.participant === options.identity);
          if (!sample.tracks.length) continue;
        }
        history.observedSamples++;
        const bucket = Math.min(11, Math.floor(12 * (sample.at - from) / Math.max(1, to - from)));
        if (!buckets.has(bucket)) { buckets.add(bucket); history.samples.push(sample); }
        yield sample;
      }
    } catch {
      signal.throwIfAborted();
      history.unreadableHours++;
    } finally { signal.removeEventListener("abort", close); close(); }
  }
  signal.throwIfAborted();
  history.limited ||= history.skippedRecords > 0 || history.unreadableHours > 0 || history.observedSamples > history.samples.length;
  if (!history.observedSamples) history.reason = history.unreadableHours || history.skippedRecords ? "storage-unavailable" : "no-observations";
  return history;
}

export async function readRoomSfuEvidence(room: string, from: number, to: number, options: Options = {}) {
  const observations = streamRoomSfuEvidence(room, from, to, options);
  let next = await observations.next();
  while (!next.done) next = await observations.next();
  return next.value;
}
