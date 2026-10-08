import { DiagnosticRoomConflict } from "./media-room-association";
import { applyDiagnosticRoomMutation } from "./diagnostic-room-revision";
import { createHash } from "node:crypto";
import { atomicWriteJson, readJson, runtimeFile, storageSchemaVersion } from "./persistent-storage";
import { createPostgresPool, PostgresRoomStoreBackend } from "./postgres-room-store";
import { defaultStudioId, validateStudioId } from "./studio-scope";

export type RoomRecord = {
  name: string;
  creatorAccessId?: string;
  studioPasswordHash?: string;
  diagnosticCreationId?: string;
  diagnosticRevision?: string;
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
  read(studioId: string): Promise<RoomRecord[]>;
  update(studioId: string, change: RoomMutation): Promise<RoomRecord[]>;
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

  constructor(private readonly pathname: () => string = () =>
    runtimeFile("studiolink-rooms.json", process.env.STUDIOLINK_ROOMS_FILE)) {}

  async read(studioId: string): Promise<RoomRecord[]> {
    if (validateStudioId(studioId) !== defaultStudioId()) throw new Error("JSON room store supports only the default studio");
    try {
      return normalizeRooms(await readJson(this.pathname()));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [{ name: "demo-room" }];
      throw error;
    }
  }

  update(studioId: string, change: RoomMutation) {
    if (validateStudioId(studioId) !== defaultStudioId()) return Promise.reject(new Error("JSON room store supports only the default studio"));
    const key=this.pathname(),symbol=Symbol.for("castlink.room-write-queues");const shared=globalThis as typeof globalThis & {[key:symbol]:Map<string,Promise<unknown>>|undefined};const queues=shared[symbol] ||= new Map<string,Promise<unknown>>();
    const operation = (queues.get(key)||Promise.resolve()).catch(() => undefined).then(async () => {
      const current = await this.read(studioId);
      const rooms = applyDiagnosticRoomMutation(current, change);
      const payload: RoomsFile = { schemaVersion: 1, rooms };
      await atomicWriteJson(this.pathname(), payload);
      return rooms;
    });
    queues.set(key,operation);
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

export function readRooms(studioId = defaultStudioId()): Promise<RoomRecord[]> {
  return backend.read(validateStudioId(studioId));
}

export function updateRooms(change: RoomMutation, studioId = defaultStudioId()): Promise<RoomRecord[]> {
 const scope=validateStudioId(studioId);let affected:Array<{room:string;select?:{kind:string}}>=[];
 return backend.update(scope,current=>{const next=change(current);affected=current.flatMap(old=>{const record=next.find(r=>r.name===old.name);if(!record||old.creatorAccessId!==record.creatorAccessId||old.studioPasswordHash!==record.studioPasswordHash||old.passwordHash!==record.passwordHash)return [{room:old.name}];if(old.adminAccessVersion!==record.adminAccessVersion)return [{room:old.name,select:{kind:'admin'}}];return [];});return next;}).then(async rooms=>{if(affected.length){const {schedulePreparedRevocation}=await import('./reserve-source');for(const item of affected)schedulePreparedRevocation(scope,item.room,item.select);}return rooms;});
}

export async function ensureRoomAccessVersions(name: string, studioId = defaultStudioId()): Promise<RoomRecord | undefined> {
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
  }), studioId);
  return ensured;
}

/** Server-only inventory. Callers must authorize a platform session or a signed node request. */
export async function readNodeRoomInventory(): Promise<Array<{ studioId: string; name: string }>> {
  if (backend instanceof PostgresRoomStoreBackend) return backend.inventory();
  return (await backend.read(defaultStudioId())).map(room => ({ studioId: defaultStudioId(), name: room.name }));
}

/** Mark only diagnostic receipts dirty before an authorized operator grant effect. */
export async function invalidateDiagnosticReceipts(studioId = defaultStudioId(), name?: string, expectedCreationId?: string | null): Promise<void> {
  await updateRooms(rooms => {
    if (expectedCreationId !== undefined) {
      const target = rooms.find(room => room.name === name);
      if (!target || (target.diagnosticCreationId ?? null) !== expectedCreationId) throw new DiagnosticRoomConflict("Operator room association changed");
    }
    return rooms.map(room => room.diagnosticRevision && (name === undefined || room.name === name)
      ? { ...room, diagnosticRevision: undefined } : room);
  }, studioId);
}
