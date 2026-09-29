import { createHash } from "node:crypto";
import { atomicWriteJson, readJson, runtimeFile, storageSchemaVersion } from "./persistent-storage";

export type RoomRecord = {
  name: string;
  passwordHash?: string;
  passwordCiphertext?: string;
  studioOnly?: boolean;
  transferRoomId?: string;
  adminAccessVersion?: string;
  guestInviteVersion?: string;
  viewerAccessVersion?: string;
  outputAccessVersion?: string;
};

type RoomsFile = { schemaVersion: 1; rooms: RoomRecord[] };
const file = () => runtimeFile("studiolink-rooms.json", process.env.STUDIOLINK_ROOMS_FILE);
let pending: Promise<unknown> = Promise.resolve();

function normalizeRooms(value: unknown): RoomRecord[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === storageSchemaVersion &&
        Array.isArray((value as { rooms?: unknown }).rooms)
      ? (value as { rooms: unknown[] }).rooms
      : null;
  if (!raw) throw new Error("Unsupported rooms data schema");
  return raw
    .map((r: string | RoomRecord) => typeof r === "string" ? { name: r } : r)
    .filter((r: RoomRecord) => !!r && typeof r.name === "string");
}

export async function readRooms(): Promise<RoomRecord[]> {
  try {
    return normalizeRooms(await readJson(file()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [{ name: "demo-room" }];
    throw error;
  }
}

export function updateRooms(change: (rooms: RoomRecord[]) => RoomRecord[]) {
  const operation = pending.catch(() => undefined).then(async () => {
    const rooms = change(await readRooms());
    const payload: RoomsFile = { schemaVersion: 1, rooms };
    await atomicWriteJson(file(), payload);
    return rooms;
  });
  pending = operation;
  return operation;
}

export async function ensureRoomAccessVersions(name: string): Promise<RoomRecord | undefined> {
  let ensured: RoomRecord | undefined;
  await updateRooms(rooms => rooms.map(room => {
    if (room.name !== name) return room;
    const legacyVersion = createHash("sha256").update(room.passwordHash || "").digest("hex");
    const next = {
      ...room,
      guestInviteVersion: room.guestInviteVersion || legacyVersion,
      viewerAccessVersion: room.viewerAccessVersion || legacyVersion,
      outputAccessVersion: room.outputAccessVersion || legacyVersion,
    };
    ensured = next;
    return next;
  }));
  return ensured;
}
