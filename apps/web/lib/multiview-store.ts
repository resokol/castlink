import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";
import { readRooms, updateRooms, type RoomRecord } from "./room-store";
import { MultiviewError, validMultiviewId, validateMultiviewScene, type MultiviewScene } from "./multiview";
import { validateStudioId } from "./studio-scope";

type LayoutFile = { schemaVersion: 1; rooms: Record<string, MultiviewScene[]> };
const pathname = () => runtimeFile("studiolink-multiview.json");
const queueSymbol = Symbol.for("castlink.multiview-write-queues");

function associationKey(studioId: string, room: RoomRecord) {
  const identity = room.creatorAccessId ? `creator:${room.creatorAccessId}` : room.transferRoomId ? `legacy:${room.transferRoomId}` : undefined;
  return identity ? createHash("sha256").update(`${validateStudioId(studioId)}\0${identity}`).digest("hex") : undefined;
}

async function readFile(): Promise<LayoutFile> {
  try {
    const value = await readJson(pathname()) as LayoutFile;
    if (value?.schemaVersion !== 1 || !value.rooms || typeof value.rooms !== "object" || Array.isArray(value.rooms)) throw new Error("Invalid multiview storage schema");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, rooms: {} };
    throw error;
  }
}

/** Node-local sidecar, like studio control state; layouts are not replicated during transfer. */
export async function readMultiviewScenes(studioId: string, room: RoomRecord): Promise<MultiviewScene[]> {
  const key = associationKey(studioId, room);
  if (!key) return [];
  const stored = (await readFile()).rooms[key];
  if (stored === undefined) return [];
  if (!Array.isArray(stored) || stored.length > 16) throw new Error("Invalid multiview scene storage");
  return stored.map(validateMultiviewScene);
}

/** A new legacy association is created inside the existing serialized room transaction. */
async function ensureAssociation(studioId: string, expected: RoomRecord): Promise<RoomRecord> {
  if (associationKey(studioId, expected)) return expected;
  let associated: RoomRecord | undefined;
  await updateRooms(rooms => rooms.map(room => {
    if (room.name !== expected.name) return room;
    if (!isDeepStrictEqual(room, expected)) throw new MultiviewError("Комната изменилась. Повторите сохранение.", 409);
    associated = { ...room, transferRoomId: randomUUID() };
    return associated;
  }), studioId);
  if (!associated) throw new MultiviewError("Комната не найдена", 404);
  return associated;
}

export async function applyMultiviewScene(
  studioId: string,
  expected: RoomRecord,
  scene: MultiviewScene,
  expectedRevision: number,
  authorize: (room: RoomRecord) => Promise<boolean>,
): Promise<MultiviewScene> {
  const scope = validateStudioId(studioId);
  const shared = globalThis as typeof globalThis & { [queueSymbol]?: Map<string, Promise<unknown>> };
  const queues = shared[queueSymbol] ||= new Map();
  const file = pathname();
  const operation = (queues.get(file) || Promise.resolve()).catch(() => undefined).then(async () => {
    let current = (await readRooms(scope)).find(room => room.name === expected.name);
    if (!current) throw new MultiviewError("Комната не найдена", 404);
    if (!isDeepStrictEqual(current, expected)) throw new MultiviewError("Комната изменилась. Повторите сохранение.", 409);
    if (!await authorize(current)) throw new MultiviewError("Требуется доступ студии или администратора комнаты", 403);
    current = await ensureAssociation(scope, current);
    const key = associationKey(scope, current)!;
    const data = await readFile();
    const scenes = await readMultiviewScenes(scope, current);
    const previous = scenes.find(item => item.id === scene.id);
    if ((previous?.revision || 0) !== expectedRevision) throw new MultiviewError("Сцена уже изменена. Загрузите актуальную версию.", 409);
    if (!previous && scenes.length >= 16) throw new MultiviewError("В комнате может быть не более 16 сцен");
    const published = validateMultiviewScene({ ...scene, revision: expectedRevision + 1 });
    data.rooms[key] = previous ? scenes.map(item => item.id === scene.id ? published : item) : [...scenes, published];
    await atomicWriteJson(file, data);
    return published;
  });
  queues.set(file, operation);
  return operation;
}

/** Delete shares the apply queue: a stale tab cannot remove a newer applied revision. */
export async function deleteMultiviewScene(
  studioId: string,
  expected: RoomRecord,
  sceneId: string,
  expectedRevision: number,
  authorize: (room: RoomRecord) => Promise<boolean>,
): Promise<void> {
  if (!validMultiviewId(sceneId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new MultiviewError("Некорректная сцена или версия");
  const scope = validateStudioId(studioId);
  const shared = globalThis as typeof globalThis & { [queueSymbol]?: Map<string, Promise<unknown>> };
  const queues = shared[queueSymbol] ||= new Map();
  const file = pathname();
  const operation = (queues.get(file) || Promise.resolve()).catch(() => undefined).then(async () => {
    const current = (await readRooms(scope)).find(room => room.name === expected.name);
    if (!current) throw new MultiviewError("Комната не найдена", 404);
    if (!isDeepStrictEqual(current, expected)) throw new MultiviewError("Комната изменилась. Повторите удаление.", 409);
    if (!await authorize(current)) throw new MultiviewError("Требуется доступ студии или администратора комнаты", 403);
    const key = associationKey(scope, current);
    if (!key) throw new MultiviewError("Сцена не найдена", 404);
    const data = await readFile();
    const scenes = await readMultiviewScenes(scope, current);
    const previous = scenes.find(scene => scene.id === sceneId);
    if (!previous) throw new MultiviewError("Сцена не найдена", 404);
    if (previous.revision !== expectedRevision) throw new MultiviewError("Сцена уже изменена. Загрузите актуальную версию.", 409);
    data.rooms[key] = scenes.filter(scene => scene.id !== sceneId);
    await atomicWriteJson(file, data);
  });
  queues.set(file, operation);
  return operation;
}
