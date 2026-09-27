import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StudioDesired = { fps: number; bitrate: number; gain: number; onAir: boolean; preview: boolean };
export type StudioRoomState = {
  primaryClientId: string | null; leaseUntil: number; epoch: number; desired: StudioDesired; revision: number; actual: Record<string, unknown> | null;
};
const file = () => process.env.STUDIOLINK_STUDIO_CONTROL_FILE || "/tmp/studiolink-studio-control.json";
const defaults: StudioDesired = { fps: 60, bitrate: 12000, gain: 100, onAir: false, preview: false };
let queue: Promise<unknown> = Promise.resolve();
const serialize = <T>(fn: () => Promise<T>) => {
  const result = queue.then(fn, fn);
  queue = result.catch(() => {});
  return result;
};
async function load(): Promise<Record<string, StudioRoomState>> {
  try { const value = JSON.parse(await readFile(file(), "utf8")); return value && typeof value === "object" ? Object.assign(Object.create(null), value) : Object.create(null); }
  catch (e: any) { if (e?.code === "ENOENT") return {}; throw e; }
}
async function save(data: Record<string, StudioRoomState>) {
  await mkdir(path.dirname(file()), { recursive: true });
  const temp = `${file()}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await rename(temp, file());
}
export function validStudioRoom(room: unknown): room is string { return typeof room === "string" && room.length > 0 && room.length <= 100 && room.trim() === room && !/[\u0000-\u001f\u007f]/.test(room); }
export function validStudioClient(client: unknown): client is string { return typeof client === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(client); }
const blank = (): StudioRoomState => ({ primaryClientId: null, leaseUntil: 0, epoch: 0, desired: { ...defaults }, revision: 0, actual: null });
export async function readStudioState(room: string) {
  return serialize(async () => { const all = await load(); return Object.prototype.hasOwnProperty.call(all, room) ? all[room] : blank(); });
}
export async function joinStudio(room: string, clientId: string) {
  return serialize(async () => {
    const all = await load(), state = Object.prototype.hasOwnProperty.call(all, room) ? all[room] : blank(), now = Date.now();
    let role: "primary" | "moderator" = "moderator";
    if (!state.primaryClientId) { state.primaryClientId = clientId; state.epoch++; state.leaseUntil = now + 45_000; role = "primary"; }
    else if (state.primaryClientId === clientId) { state.leaseUntil = now + 45_000; role = "primary"; }
    all[room] = state; await save(all);
    return { state, role };
  });
}
export async function claimStudio(room: string, clientId: string) {
  return serialize(async () => {
    const all = await load(), state = Object.prototype.hasOwnProperty.call(all, room) ? all[room] : blank(), now = Date.now();
    if (state.primaryClientId && state.leaseUntil > now && state.primaryClientId !== clientId) return null;
    state.primaryClientId = clientId; state.leaseUntil = now + 45_000; state.epoch++;
    state.desired = { ...state.desired, onAir: false, preview: false }; state.actual = null;
    all[room] = state; await save(all); return state;
  });
}
export async function heartbeatStudio(room: string, clientId: string, epoch: number, actual?: Record<string, unknown>) {
  return serialize(async () => {
    const all = await load(), state = all[room];
    if (!state || state.primaryClientId !== clientId || state.epoch !== epoch) return null;
    state.leaseUntil = Date.now() + 45_000;
    if (actual && Object.keys(actual).length <= 32) {
      const incoming = actual.outbound as Record<string, unknown> | undefined;
      const previous = state.actual;
      const sourceAt = incoming?.measuredAt;
      const changed = typeof sourceAt === "number" && sourceAt !== previous?.outboundSourceAt;
      const age = typeof actual.outboundAgeMs === "number" && Number.isFinite(actual.outboundAgeMs) ? Math.max(0, actual.outboundAgeMs) : 0;
      state.actual = { ...actual, outboundSourceAt: sourceAt,
        outbound: incoming ? { ...incoming, measuredAt: changed ? Date.now() - age : (previous?.outbound as any)?.measuredAt ?? 0 } : null };
    }
    await save(all); return state;
  });
}
export async function releaseStudio(room: string, clientId: string, epoch: number) {
  return serialize(async () => {
    const all = await load(), state = all[room];
    if (!state || state.primaryClientId !== clientId || state.epoch !== epoch) return null;
    state.leaseUntil = 0; await save(all); return state;
  });
}
export async function resetStudioForTransfer(room: string) {
  return serialize(async () => {
    const all = await load(), state = Object.prototype.hasOwnProperty.call(all, room) ? all[room] : blank();
    state.primaryClientId = null; state.leaseUntil = 0; state.epoch++;
    state.desired = { ...state.desired, onAir: false, preview: false }; state.actual = null;
    all[room] = state; await save(all); return state;
  });
}
export async function updateStudioDesired(room: string, epoch: number, patch: unknown) {
  return serialize(async () => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
    const p = patch as Record<string, unknown>, keys = Object.keys(p);
    const valid = keys.length > 0 && keys.every(k => ["fps", "bitrate", "gain", "onAir", "preview"].includes(k)) &&
      (p.fps === undefined || [25, 30, 50, 60].includes(p.fps as number)) &&
      (p.bitrate === undefined || (Number.isInteger(p.bitrate) && (p.bitrate as number) >= 500 && (p.bitrate as number) <= 12000)) &&
      (p.gain === undefined || (Number.isInteger(p.gain) && (p.gain as number) >= 0 && (p.gain as number) <= 200)) &&
      (p.onAir === undefined || typeof p.onAir === "boolean") && (p.preview === undefined || typeof p.preview === "boolean");
    if (!valid) return null;
    const all = await load(), state = Object.prototype.hasOwnProperty.call(all, room) ? all[room] : null;
    if (!state || state.epoch !== epoch) return { stale: true as const };
    state.desired = { ...state.desired, ...p } as StudioDesired; state.revision++;
    all[room] = state; await save(all); return { state };
  });
}
