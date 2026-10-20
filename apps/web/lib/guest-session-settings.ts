import type { GuestMediaSettingsState } from "./guest-media-control";
import type { RoomRecord } from "./room-store";

export const GUEST_SESSION_SETTINGS_TTL = 15 * 60_000;
type Snapshot = { metadata: Record<string, unknown>; media?: GuestMediaSettingsState };
type Entry = Snapshot & { lastSeenAt: number; disconnectedAt?: number };
const keySymbol = Symbol.for("castlink.guest-session-settings");
const shared = globalThis as typeof globalThis & { [keySymbol]?: Map<string, Entry> };
const entries = shared[keySymbol] ||= new Map<string, Entry>();
const key = (studioId: string, room: RoomRecord, identity: string) => JSON.stringify([studioId, room.creatorAccessId || room.transferRoomId || [room.name, room.guestInviteVersion || room.passwordHash || ""], identity]);
function prune(now: number) {
  for (const [id, entry] of entries) if (now >= (entry.disconnectedAt ?? entry.lastSeenAt) + GUEST_SESSION_SETTINGS_TTL) entries.delete(id);
}
/** Only current server participant metadata and authenticated guest reports enter this cache. */
export function rememberGuestSessionSettings(studioId: string, room: RoomRecord, identity: string, metadata: Record<string, unknown>, media?: GuestMediaSettingsState) {
  const now = Date.now(); prune(now);
  const id = key(studioId, room, identity), previous = entries.get(id);
  if (!previous && entries.size >= 2048) entries.delete(entries.keys().next().value!);
  const saved: Record<string, unknown> = {};
  for (const field of ["studioImageTransform", "videoRotation", "videoMaxBitrateKbps", "videoHeight", "cameraCapture"] as const) if (metadata[field] !== undefined) saved[field] = structuredClone(metadata[field]);
  entries.set(id, { metadata: saved, ...(media || previous?.media ? { media: structuredClone(media || previous!.media!) } : {}), lastSeenAt: now });
}
export function markGuestSessionDisconnected(studioId: string, room: RoomRecord, identity: string) {
  prune(Date.now());
  const entry = entries.get(key(studioId, room, identity));
  if (entry && entry.disconnectedAt === undefined) entry.disconnectedAt = Date.now();
}
/** Reading an offline entry never extends its lifetime. */
export function readGuestSessionSettings(studioId: string, room: RoomRecord, identity: string): Snapshot | undefined {
  prune(Date.now());
  const entry = entries.get(key(studioId, room, identity));
  return entry ? structuredClone({ metadata: entry.metadata, ...(entry.media ? { media: entry.media } : {}) }) : undefined;
}
