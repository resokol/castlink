import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

export type TransferRole = "studio" | "guest";
export type TransferTicket = { id: string; role: TransferRole; studioId: string; room: string; identity?: string; name?: string; ownerExpiresAt?: number; exp: number };
export type EligibleGuestSession = { identity: string; transferSessionId?: string };
type TransferState = {
  transfers: Record<string, { studioId: string; room: string; roomId: string; targetUrl: string; targetId: string; createdAt: number; exp: number }>;
  active: Record<string, { studioId: string; room: string; id: string; roomId: string; targetUrl: string; targetId: string; exp: number; startedAt?: number; eligibleSessions?: EligibleGuestSession[] }>;
  tickets: Record<string, TransferTicket>;
  nonces: Record<string, number>;
};
const statePath = () => process.env.STUDIOLINK_TRANSFER_STATE_FILE || "/tmp/studiolink-server-transfer.json";
let pending: Promise<unknown> = Promise.resolve();
const blank = (): TransferState => ({ transfers: {}, active: {}, tickets: {}, nonces: {} });

async function readState(): Promise<TransferState> {
  try { const saved = JSON.parse(await readFile(statePath(), "utf8")); return { ...blank(), ...saved, active: saved.active || {} }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return blank(); throw error; }
}
export function updateTransferState<T>(change: (state: TransferState) => T | Promise<T>): Promise<T> {
  const operation = pending.catch(() => undefined).then(async () => {
    const state = await readState();
    const result = await change(state);
    const now = Date.now();
    for (const [id, exp] of Object.entries(state.tickets)) if (exp.exp < now) delete state.tickets[id];
    for (const [id, exp] of Object.entries(state.nonces)) if (exp < now) delete state.nonces[id];
    for (const [id, transfer] of Object.entries(state.transfers)) if (transfer.exp < now) delete state.transfers[id];
    for (const [room, transfer] of Object.entries(state.active)) if (transfer.exp < now) delete state.active[room];
    await mkdir(path.dirname(statePath()), { recursive: true });
    await writeFile(statePath() + ".new", JSON.stringify(state), { mode: 0o600 });
    await rename(statePath() + ".new", statePath());
    return result;
  });
  pending = operation;
  return operation;
}

export function transferSecret() { return process.env.STUDIOLINK_TRANSFER_SECRET || ""; }
export type TransferTarget = { id: string; label: string; origin: string; lanOrigin?: string; lanPublicIps?: string[] };
function ipv4Parts(value: string): number[] | null {
  if (isIP(value) !== 4) return null;
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}
function isPrivateIPv4(value: string) {
  const p = ipv4Parts(value);
  if (!p) return false;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
function isPublicIPv4(value: string) {
  const p = ipv4Parts(value);
  if (!p || isPrivateIPv4(value)) return false;
  return !(p[0] >= 224 || p[0] === 255 ||
    (p[0] === 192 && p[1] === 0 && (p[2] === 0 || p[2] === 2)) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51 && p[2] === 100)) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113));
}
function validLanOrigin(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || isIP(url.hostname) !== 4 || !isPrivateIPv4(url.hostname) ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch { return undefined; }
}
function validLanPublicIps(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return undefined;
  const ips: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isPublicIPv4(item) || ips.includes(item)) return undefined;
    ips.push(item);
  }
  return ips;
}
function normalizeClientIp(value: string): string | undefined {
  const candidate = value.trim();
  if (isIP(candidate) === 4) return candidate;
  if (isIP(candidate) !== 6 || candidate.includes("%")) return undefined;
  let address = candidate.toLowerCase();
  if (address.includes(".")) {
    const split = address.lastIndexOf(":");
    const ipv4 = address.slice(split + 1), parts = ipv4Parts(ipv4);
    if (!parts || address.slice(0, split) !== "::ffff") return undefined;
    address = `${address.slice(0, split)}:${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group))) return undefined;
  const nums = groups.map(group => parseInt(group, 16));
  if (nums.slice(0, 5).some(group => group !== 0) || nums[5] !== 0xffff) return undefined;
  return `${nums[6] >> 8}.${nums[6] & 255}.${nums[7] >> 8}.${nums[7] & 255}`;
}
export function resolveClientTargetUrl(target: TransferTarget, forwardedFor: string | null | undefined): string {
  if (!target.lanOrigin || !target.lanPublicIps?.length || typeof forwardedFor !== "string" || forwardedFor.length > 2048) return target.origin;
  const chain = forwardedFor.split(",");
  if (!chain.length || chain.some(value => !value.trim())) return target.origin;
  const clientIp = normalizeClientIp(chain[chain.length - 1]);
  return clientIp && target.lanPublicIps.includes(clientIp) ? target.lanOrigin : target.origin;
}
export function transferTargets(): TransferTarget[] {
  const raw = process.env.STUDIOLINK_TRANSFER_TARGETS_JSON || "[]";
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("STUDIOLINK_TRANSFER_TARGETS_JSON must be an array");
  return value.map((item: any) => {
    const url = new URL(item.origin);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Transfer target must use HTTPS");
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id) || typeof item.label !== "string") throw new Error("Invalid transfer target");
    const target: TransferTarget = { id: item.id, label: item.label, origin: url.origin };
    const lanOrigin = validLanOrigin(item.lanOrigin), lanPublicIps = validLanPublicIps(item.lanPublicIps);
    if (lanOrigin && lanPublicIps) { target.lanOrigin = lanOrigin; target.lanPublicIps = lanPublicIps; }
    return target;
  });
}
export function transferServer() {
  const id = process.env.STUDIOLINK_TRANSFER_SERVER_ID || "";
  const label = process.env.STUDIOLINK_TRANSFER_SERVER_LABEL || id;
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw new Error("STUDIOLINK_TRANSFER_SERVER_ID is not configured");
  return { id, label };
}
export function peerOriginAllowed(origin: string) {
  try { return new URL(process.env.STUDIOLINK_TRANSFER_PEER_ORIGIN || "").origin === new URL(origin).origin && new URL(origin).protocol === "https:"; } catch { return false; }
}
export function transferOriginConfigured() {
  try { return new URL(process.env.STUDIOLINK_TRANSFER_ORIGIN || "").protocol === "https:"; } catch { return false; }
}
export function signBridge(timestamp: string, nonce: string, body: string) {
  const secret = transferSecret();
  if (!secret || secret.length < 32) throw new Error("STUDIOLINK_TRANSFER_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}
export function verifyBridge(timestamp: string, nonce: string, body: string, signature: string) {
  const at = Number(timestamp);
  if (!Number.isSafeInteger(at) || Math.abs(Date.now() - at) > 60_000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(nonce)) return false;
  try {
    const expected = Buffer.from(signBridge(timestamp, nonce, body), "hex"), actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}
export function transferRoomKey(studioId: string, room: string) {
  const defaultStudio = process.env.STUDIOLINK_DEFAULT_STUDIO_ID?.trim() || "studio-default";
  return studioId === defaultStudio ? room : `${studioId.length}:${studioId}:${room}`;
}
export function ticketHash(ticket: string) { return createHash("sha256").update(ticket).digest("hex"); }
export function newTicket(role: TransferRole, studioId: string, room: string, identity?: string, name?: string, ownerExpiresAt?: number): { token: string; hash: string; ticket: TransferTicket } {
  if (ownerExpiresAt !== undefined && (role !== "studio" || !Number.isSafeInteger(ownerExpiresAt) || ownerExpiresAt <= Date.now())) throw new Error("Invalid transfer authorization expiry");
  const token = randomBytes(32).toString("base64url");
  const ticket = { id: ticketHash(token), role, studioId, room, ...(identity ? { identity } : {}), ...(name ? { name } : {}),
    ...(ownerExpiresAt !== undefined ? { ownerExpiresAt } : {}), exp: Math.min(Date.now() + 5 * 60_000, ownerExpiresAt ?? Infinity) };
  return { token, hash: ticket.id, ticket };
}
