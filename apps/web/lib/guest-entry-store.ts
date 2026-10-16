import { atomicWriteJson, readJson, runtimeFile } from './persistent-storage';
import { guestEntrySettings, type GuestEntrySettings } from './guest-entry-settings';
import type { RoomRecord } from './room-store';
const file = () => runtimeFile('castlink-guest-entry.json');
const key = (studioId: string, room: RoomRecord) => JSON.stringify([studioId, ...(room.creatorAccessId ? ["creator", room.creatorAccessId] : room.transferRoomId ? ["transfer", room.transferRoomId] : ["legacy", room.name, room.guestInviteVersion || ""])]);
const queueKey = Symbol.for("castlink.guest-entry-write-queue");
const shared = globalThis as typeof globalThis & { [queueKey]?: Promise<unknown> };
async function read(): Promise<Record<string, GuestEntrySettings>> { try { return await readJson(file()) as Record<string, GuestEntrySettings>; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; } }
export async function readGuestEntrySettings(studioId: string, room: RoomRecord) { return guestEntrySettings((await read())[key(studioId, room)]); }
export async function saveGuestEntrySettings(studioId: string, room: RoomRecord, settings: GuestEntrySettings) {
  const run = (shared[queueKey] || Promise.resolve()).then(async () => { const data = await read(); data[key(studioId, room)] = guestEntrySettings(settings); await atomicWriteJson(file(), data); });
  shared[queueKey] = run.catch(() => undefined); await run;
}
