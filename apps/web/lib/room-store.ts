import { createHash } from "node:crypto";
import { atomicWriteJson, readJson, runtimeFile, storageSchemaVersion } from "./persistent-storage";
import { createPostgresPool, PostgresRoomStoreBackend } from "./postgres-room-store";

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
export type RoomMutation = (rooms: RoomRecord[]) => RoomRecord[];

export interface RoomStoreBackend {
  read(): Promise<RoomRecord[]>;
  update(change: RoomMutation): Promise<RoomRecord[]>;
}

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

export class JsonRoomStoreBackend implements RoomStoreBackend {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly pathname: () => string = () =>
    runtimeFile("studiolink-rooms.json", process.env.STUDIOLINK_ROOMS_FILE)) {}

  async read(): Promise<RoomRecord[]> {
    try {
      return normalizeRooms(await readJson(this.pathname()));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [{ name: "demo-room" }];
      throw error;
    }
  }

  update(change: RoomMutation) {
    const operation = this.pending.catch(() => undefined).then(async () => {
      const rooms = change(await this.read());
      const payload: RoomsFile = { schemaVersion: 1, rooms };
      await atomicWriteJson(this.pathname(), payload);
      return rooms;
    });
    this.pending = operation;
    return operation;
  }
}

function createBackend(): RoomStoreBackend {
  const selected = (process.env.CASTLINK_STORAGE_BACKEND || "json").trim().toLowerCase();
  if (selected === "json") return new JsonRoomStoreBackend();
  if (selected === "postgres") return new PostgresRoomStoreBackend(createPostgresPool());
  throw new Error(`Unsupported CASTLINK_STORAGE_BACKEND: ${selected}`);
}

const backend: RoomStoreBackend = createBackend();

export async function validateRoomStore() {
  if (backend instanceof PostgresRoomStoreBackend) await backend.validate();
}

export function readRooms(): Promise<RoomRecord[]> {
  return backend.read();
}

export function updateRooms(change: RoomMutation): Promise<RoomRecord[]> {
  return backend.update(change);
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
