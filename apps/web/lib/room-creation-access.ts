import { createHash, timingSafeEqual } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { atomicWriteJson, readJson, runtimeFile } from './persistent-storage';

const digest = (password: string) => createHash('sha256').update(password, 'utf8').digest('hex');
const settingsFile = () => runtimeFile('room-creation-password.json');

/** Persisted changes win over bootstrap configuration. Never fall back on corrupt data. */
export async function effectiveRoomCreationPasswordHash(): Promise<string | undefined> {
  const file = settingsFile();
  try {
    if ((await stat(file)).size > 2048) throw new Error('Invalid creation password setting');
    const saved = await readJson(file) as { schemaVersion?: unknown; hash?: unknown };
    if (!saved || saved.schemaVersion !== 1 || typeof saved.hash !== 'string' || !/^[a-f0-9]{64}$/.test(saved.hash)) throw new Error('Invalid creation password setting');
    return saved.hash;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const hash = process.env.ROOM_CREATION_PASSWORD_SHA256;
  if (hash !== undefined && hash !== '') return /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : undefined;
  const password = process.env.ROOM_CREATION_PASSWORD;
  return typeof password === 'string' && password.trim().length > 0 && password.length <= 256 ? digest(password) : undefined;
}

export async function roomCreationEnabled() {
  return !!(await effectiveRoomCreationPasswordHash());
}

export async function validRoomCreationPassword(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 256) return false;
  const expected = await effectiveRoomCreationPasswordHash();
  return !!expected && timingSafeEqual(Buffer.from(digest(value), 'hex'), Buffer.from(expected, 'hex'));
}

export async function changeRoomCreationPassword(current: unknown, next: unknown, authorize: () => Promise<boolean>) {
  if (typeof next !== 'string' || next.length < 8 || next.length > 256 || !next.trim() || /[\r\n\0]/.test(next)) return 'invalid-password';
  const key = settingsFile(), symbol = Symbol.for('castlink.room-creation-password-queues');
  const shared = globalThis as typeof globalThis & { [key: symbol]: Map<string, Promise<unknown>> | undefined };
  const queues = shared[symbol] ||= new Map<string, Promise<unknown>>();
  const operation = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(async () => {
    if (!(await authorize())) return 'unauthorized';
    if (!(await validRoomCreationPassword(current))) return 'denied';
    await atomicWriteJson(key, { schemaVersion: 1, hash: digest(next) });
    return 'changed';
  });
  queues.set(key, operation);
  try { return await operation; }
  finally { if (queues.get(key) === operation) queues.delete(key); }
}
