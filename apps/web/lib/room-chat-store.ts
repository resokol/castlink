import { createHash } from "node:crypto";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, PersistentDataError, readJson, runtimeFile } from "./persistent-storage";
import type { RoomChatScope, StoredRoomChatMessage } from "./room-chat-types";

export const ROOM_CHAT_RETENTION_MS = 86_400_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 3_600_000;
const CLEANUP_BATCH_SIZE = 100;
const OWNED_FILE = /^[a-f0-9]{64}\.json$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type NewMessage = Omit<StoredRoomChatMessage, "timestamp">;
type Envelope = { schemaVersion: 1; scopeKey: string; messages: StoredRoomChatMessage[] };
type SharedState = {
  queues: Map<string, Promise<void>>;
  cleanup: Map<string, { at: number; cursor: string }>;
};
const stateKey = Symbol.for("castlink.room-chat-store.v1");
const sharedGlobal = globalThis as typeof globalThis & { [stateKey]?: SharedState };
const shared = sharedGlobal[stateKey] ||= { queues: new Map(), cleanup: new Map() };

function queued<T>(file: string, run: () => Promise<T>): Promise<T> {
  const result = (shared.queues.get(file) || Promise.resolve()).then(run);
  const tail = result.then(() => undefined, () => undefined);
  shared.queues.set(file, tail);
  void tail.then(() => { if (shared.queues.get(file) === tail) shared.queues.delete(file); });
  return result;
}

function currentTime(now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid room chat server time");
  return now;
}

function scopeLocation(scope: RoomChatScope) {
  if (!scope || typeof scope.studioId !== "string" || !scope.studioId.trim() || scope.studioId.length > 512 ||
      typeof scope.roomAssociation !== "string" || !scope.roomAssociation.trim() || scope.roomAssociation.length > 4096) {
    throw new Error("Invalid room chat scope");
  }
  const key = createHash("sha256").update(JSON.stringify([scope.studioId, scope.roomAssociation])).digest("hex");
  const dir = runtimeFile("room-chat");
  return { key, dir, file: path.join(dir, key + ".json") };
}

function validMessage(value: unknown): value is StoredRoomChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as StoredRoomChatMessage;
  return typeof message.id === "string" && UUID.test(message.id) &&
    typeof message.message === "string" && !!message.message.trim() && message.message.length <= 4000 &&
    typeof message.identity === "string" && !!message.identity.trim() && message.identity.length <= 512 &&
    typeof message.name === "string" && message.name.length <= 512 &&
    Number.isSafeInteger(message.timestamp) && message.timestamp >= 0;
}

async function load(file: string, key: string): Promise<StoredRoomChatMessage[]> {
  try {
    if ((await stat(file)).size > MAX_FILE_BYTES) throw new PersistentDataError("Room chat exceeds storage limit", file);
    const data = await readJson(file) as Envelope;
    if (!data || data.schemaVersion !== 1 || data.scopeKey !== key || !Array.isArray(data.messages) || !data.messages.every(validMessage)) {
      throw new PersistentDataError("Invalid room chat data", file);
    }
    const ids = new Set<string>();
    for (const message of data.messages) {
      const id = message.id.toLowerCase();
      if (ids.has(id)) throw new PersistentDataError("Invalid duplicate room chat ID", file);
      ids.add(id);
    }
    return data.messages;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persist(file: string, key: string, messages: StoredRoomChatMessage[]) {
  if (!messages.length) {
    try { await unlink(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    return;
  }
  const data: Envelope = { schemaVersion: 1, scopeKey: key, messages };
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_FILE_BYTES) throw new Error("Room chat storage limit reached");
  await atomicWriteJson(file, data);
}

async function prune(file: string, key: string, now: number) {
  const all = await load(file, key);
  const active = all.filter(message => message.timestamp > now - ROOM_CHAT_RETENTION_MS);
  if (active.length !== all.length) await persist(file, key, active);
  return active;
}

// Lazy, bounded cleanup also reaches inactive rooms; it never traverses directories
// or touches other runtime files. A corrupt room stays intact for recovery.
async function cleanup(dir: string, now: number) {
  const previous = shared.cleanup.get(dir);
  if (previous && now >= previous.at && now - previous.at < CLEANUP_INTERVAL_MS) return;
  const checkpoint = { at: now, cursor: previous?.cursor || "" };
  shared.cleanup.set(dir, checkpoint);
  try {
    const files = (await readdir(dir, { withFileTypes: true }))
      .filter(entry => entry.isFile() && OWNED_FILE.test(entry.name)).map(entry => entry.name).sort();
    const after = files.filter(name => name > checkpoint.cursor);
    const batch = (after.length ? after : files).slice(0, CLEANUP_BATCH_SIZE);
    for (const name of batch) {
      await queued(path.join(dir, name), () => prune(path.join(dir, name), name.slice(0, -5), now)).catch(() => undefined);
      checkpoint.cursor = name;
    }
  } catch { /* The requested room's own read/write still reports storage errors. */ }
}

export async function readRoomChat(scope: RoomChatScope, now = Date.now()): Promise<StoredRoomChatMessage[]> {
  currentTime(now);
  const { key, dir, file } = scopeLocation(scope);
  await cleanup(dir, now);
  return queued(file, () => prune(file, key, now));
}

export async function appendRoomChat(scope: RoomChatScope, value: NewMessage, now = Date.now()): Promise<StoredRoomChatMessage> {
  currentTime(now);
  const input: StoredRoomChatMessage = { id: value?.id?.toLowerCase(), message: value?.message, identity: value?.identity, name: value?.name, timestamp: now };
  if (!validMessage(input)) throw new Error("Invalid room chat message");
  const { key, dir, file } = scopeLocation(scope);
  await cleanup(dir, now);
  return queued(file, async () => {
    const messages = await prune(file, key, now);
    const existing = messages.find(message => message.id.toLowerCase() === input.id);
    if (existing) {
      if (existing.identity !== input.identity || existing.message !== input.message) throw new Error("Room chat message ID conflict");
      return existing;
    }
    await persist(file, key, [...messages, input]);
    return input;
  });
}
