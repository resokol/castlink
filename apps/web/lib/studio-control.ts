import { atomicWriteJson, readJson, runtimeFile, storageSchemaVersion } from "./persistent-storage";

export type StudioDesired = { fps: number; bitrate: number; gain: number; onAir: boolean; preview: boolean; videoDeviceId: string | null; audioDeviceId: string | null; outputDeviceId: string | null; deviceRevision: number };
export type StudioRoomState = {
  primaryClientId: string | null; leaseUntil: number; epoch: number; desired: StudioDesired; revision: number; actual: Record<string, unknown> | null;
};
const file = () => runtimeFile("studiolink-studio-control.json", process.env.STUDIOLINK_STUDIO_CONTROL_FILE);
const defaults: StudioDesired = { fps: 60, bitrate: 12000, gain: 100, onAir: false, preview: false, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null, deviceRevision: 0 };
let queue: Promise<unknown> = Promise.resolve();
const serialize = <T>(fn: () => Promise<T>) => {
  const result = queue.then(fn, fn);
  queue = result.catch(() => {});
  return result;
};
async function load(): Promise<Record<string, StudioRoomState>> {
  try {
    const value = await readJson(file()) as any;
    const raw = value && typeof value === "object" && !Array.isArray(value) && value.schemaVersion === storageSchemaVersion ? value.rooms : value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Unsupported studio control data schema");
    const all = Object.assign(Object.create(null), raw);
    for (const state of Object.values(all) as StudioRoomState[]) if (state && typeof state === "object") state.desired = { ...defaults, ...(state.desired || {}) };
    return all;
  }
  catch (e: any) { if (e?.code === "ENOENT") return {}; throw e; }
}
async function save(data: Record<string, StudioRoomState>) {
  await atomicWriteJson(file(), { schemaVersion: 1, rooms: data });
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
    state.desired = { ...state.desired, onAir: false, preview: false, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null, deviceRevision: 0 }; state.actual = null;
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
      const devices = Array.isArray(actual.devices) ? actual.devices.slice(0, 128).flatMap((item: any) => {
        if (!item || typeof item !== "object" || !["videoinput", "audioinput", "audiooutput"].includes(item.kind) || typeof item.deviceId !== "string" || !item.deviceId.length || item.deviceId.length > 512 || typeof item.label !== "string") return [];
        return [{ deviceId: item.deviceId, label: item.label.slice(0, 256), kind: item.kind }];
      }) : [];
      state.actual = { ...actual, devices, outboundSourceAt: sourceAt,
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
    state.desired = { ...state.desired, onAir: false, preview: false, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null, deviceRevision: 0 }; state.actual = null;
    all[room] = state; await save(all); return state;
  });
}
export async function updateStudioDesired(room: string, epoch: number, patch: unknown) {
  return serialize(async () => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
    const p = patch as Record<string, unknown>, keys = Object.keys(p);
    const deviceKeys = ["videoDeviceId", "audioDeviceId", "outputDeviceId"];
    const hasDevicePatch = keys.some(k => deviceKeys.includes(k));
    const valid = keys.length > 0 && keys.every(k => ["fps", "bitrate", "gain", "onAir", "preview", ...deviceKeys].includes(k)) &&
      (p.fps === undefined || [25, 30, 50, 60].includes(p.fps as number)) &&
      (p.bitrate === undefined || (Number.isInteger(p.bitrate) && (p.bitrate as number) >= 500 && (p.bitrate as number) <= 12000)) &&
      (p.gain === undefined || (Number.isInteger(p.gain) && (p.gain as number) >= 0 && (p.gain as number) <= 200)) &&
      (p.onAir === undefined || typeof p.onAir === "boolean") && (p.preview === undefined || typeof p.preview === "boolean") &&
      deviceKeys.every(k => p[k] === undefined || (typeof p[k] === "string" && p[k].length > 0 && p[k].length <= 512));
    if (!valid) return null;
    const all = await load(), state = Object.prototype.hasOwnProperty.call(all, room) ? all[room] : null;
    if (!state || state.epoch !== epoch) return { stale: true as const };
    if (hasDevicePatch) {
      if (!state.primaryClientId || state.leaseUntil <= Date.now()) return null;
      const devices = Array.isArray(state.actual?.devices) ? state.actual.devices as Array<{deviceId:string;kind:string}> : [];
      for (const [field, kind] of [["videoDeviceId", "videoinput"], ["audioDeviceId", "audioinput"], ["outputDeviceId", "audiooutput"]] as const) {
        if (p[field] !== undefined && p[field] !== null && !devices.some(device => device.deviceId === p[field] && device.kind === kind)) return null;
      }
      const changingInput = p.videoDeviceId !== undefined || p.audioDeviceId !== undefined;
      if (changingInput && (state.desired.onAir || state.actual?.onAir === true || state.actual?.airBusy === true || p.onAir === true)) return null;
      state.desired = { ...state.desired, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null, ...p, deviceRevision: state.desired.deviceRevision + 1 } as StudioDesired;
    } else state.desired = { ...state.desired, ...p } as StudioDesired;
    state.revision++;
    all[room] = state; await save(all); return { state };
  });
}
