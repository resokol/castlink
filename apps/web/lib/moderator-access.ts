import { readFile, rename, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readAccess, roomVersion, signAccess } from "@/lib/access";
import type { NextRequest, NextResponse } from "next/server";

const lifetimeSeconds = 24 * 60 * 60;
const storePath = () => process.env.STUDIOLINK_MODERATOR_ACCESS_FILE || "/tmp/studiolink-moderator-access.json";
const globalCookieName = "castlink-moderator";
const roomCookieName = (room: string) => `castlink-room-moderator-${roomVersion(room).slice(0, 24)}`;
type ScopedSession = { room: string; inviteId: string };
type Store = { version: string; scopedInvites: Record<string, Record<string, number>>; scopedSessions: Record<string, Record<string, ScopedSession>> };
let queue: Promise<unknown> = Promise.resolve();
const emptyStore = (): Store => ({ version: "", scopedInvites: {}, scopedSessions: {} });
async function readStore(): Promise<Store> {
  try {
    const value = JSON.parse(await readFile(storePath(), "utf8"));
    return { version: typeof value.version === "string" ? value.version : "", scopedInvites: value.scopedInvites && typeof value.scopedInvites === "object" ? value.scopedInvites : {}, scopedSessions: value.scopedSessions && typeof value.scopedSessions === "object" ? value.scopedSessions : {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw error;
  }
}
async function changeStore(change: (value: Store) => Store) {
  const operation = queue.catch(() => undefined).then(async () => {
    const next = change(await readStore());
    await mkdir(path.dirname(storePath()), { recursive: true });
    await writeFile(`${storePath()}.new`, JSON.stringify(next), { mode: 0o600 });
    await rename(`${storePath()}.new`, storePath());
    return next;
  });
  queue = operation;
  return operation;
}

export const moderatorLifetimeSeconds = lifetimeSeconds;
export function newModeratorInvite(version: string) { return signAccess({ kind: "moderator-invite", version }, lifetimeSeconds); }
export async function createModeratorInvite() {
  let version = "";
  await changeStore(current => { version = current.version || randomUUID(); return { ...current, version }; });
  return { invite: newModeratorInvite(version), version, expiresAt: Date.now() + lifetimeSeconds * 1000 };
}
export async function revokeModeratorInvites() {
  const version = randomUUID();
  await changeStore(current => ({ ...current, version }));
  return version;
}
export async function validModeratorInvite(value: string) {
  const claims = readAccess(value);
  const state = await readStore();
  return claims?.kind === "moderator-invite" && !!state.version && claims.version === state.version ? claims : null;
}
export async function createRoomModeratorInvite(room: string) {
  const id = randomUUID();
  const invite = signAccess({ kind: "room-moderator-invite", room, id } as any, lifetimeSeconds);
  const claims: any = readAccess(invite);
  if (!claims || typeof claims.exp !== "number") throw new Error("Не удалось создать приглашение модератора");
  const expiresAt = claims.exp;
  await changeStore(current => ({ ...current, scopedInvites: { ...current.scopedInvites, [room]: { ...(current.scopedInvites[room] || {}), [id]: expiresAt } } }));
  return { id, expiresAt, invite };
}
export async function validRoomModeratorInvite(value: string, room: string) {
  const claims: any = readAccess(value);
  if (claims?.kind !== "room-moderator-invite" || claims.room !== room || typeof claims.id !== "string") return null;
  const state = await readStore();
  const expiresAt = state.scopedInvites[room]?.[claims.id];
  return expiresAt && expiresAt > Date.now() && claims.exp <= expiresAt ? { room, inviteId: claims.id, exp: Math.min(claims.exp, expiresAt) } : null;
}
export async function acceptRoomModeratorInvite(room: string, inviteId: string, expiresAt: number) {
  const id = randomUUID();
  await changeStore(current => ({ ...current, scopedSessions: { ...current.scopedSessions, [room]: { ...(current.scopedSessions[room] || {}), [id]: { room, inviteId } } } }));
  return { id, expiresAt: Math.min(expiresAt, Date.now() + lifetimeSeconds * 1000) };
}
export async function isModerator(request: NextRequest, room?: string) {
  const globalVersion = await verifiedModeratorVersion(request);
  if (globalVersion) return true;
  return room ? !!(await verifiedRoomModeratorSession(request, room)) : false;
}
export async function verifiedModeratorVersion(request: NextRequest, room?: string) {
  if (room) {
    const scopedClaims: any = readAccess(request.cookies.get(roomCookieName(room))?.value);
    if (scopedClaims?.kind === "room-moderator" && scopedClaims.room === room && typeof scopedClaims.id === "string") {
      const session = await verifiedRoomModeratorSession(request, room);
      return session ? session.id : null;
    }
  }
  const claims = readAccess(request.cookies.get(globalCookieName)?.value);
  if (claims?.kind !== "moderator") return null;
  const state = await readStore();
  return state.version && claims.version === state.version ? state.version : null;
}
export async function verifiedRoomModeratorSession(request: NextRequest, room: string) {
  const claims: any = readAccess(request.cookies.get(roomCookieName(room))?.value);
  if (claims?.kind !== "room-moderator" || claims.room !== room || typeof claims.id !== "string") return null;
  const state = await readStore();
  const session = state.scopedSessions[room]?.[claims.id];
  return session?.room === room ? { ...session, id: claims.id } : null;
}
export async function revokeRoomModeratorSession(room: string, id: string) {
  let removed: ScopedSession | undefined;
  await changeStore(current => {
    const sessions = { ...(current.scopedSessions[room] || {}) };
    removed = sessions[id]; delete sessions[id];
    const invites = { ...(current.scopedInvites[room] || {}) };
    if (removed?.inviteId) delete invites[removed.inviteId];
    return { ...current, scopedSessions: { ...current.scopedSessions, [room]: sessions }, scopedInvites: { ...current.scopedInvites, [room]: invites } };
  });
  return removed;
}
export async function revokeRoomModeratorAccess(room: string) {
  await changeStore(current => {
    const scopedInvites = { ...current.scopedInvites, [room]: {} };
    const scopedSessions = { ...current.scopedSessions, [room]: {} };
    return { ...current, scopedInvites, scopedSessions };
  });
}
export async function revokeRoomModeratorInvite(room: string, id: string) {
  let removed = false;
  await changeStore(current => {
    const invites = { ...(current.scopedInvites[room] || {}) };
    removed = typeof invites[id] === "number"; delete invites[id];
    return { ...current, scopedInvites: { ...current.scopedInvites, [room]: invites } };
  });
  return removed;
}
export async function listRoomModeratorSessions(room: string) {
  const state = await readStore();
  return Object.entries(state.scopedSessions[room] || {}).map(([id, session]) => ({ id, room: session.room, inviteId: session.inviteId }));
}
export function setModeratorCookie(response: NextResponse, request: NextRequest, version: string, expiresAt: number) {
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(globalCookieName, signAccess({ kind: "moderator", version }, maxAge), cookieOptions(request, maxAge));
}
export function setRoomModeratorCookie(response: NextResponse, request: NextRequest, room: string, id: string, expiresAt: number) {
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(roomCookieName(room), signAccess({ kind: "room-moderator", room, id } as any, maxAge), cookieOptions(request, maxAge));
}
function cookieOptions(request: NextRequest, maxAge: number) {
  return { httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https", sameSite: "lax" as const, path: "/", maxAge };
}
export function clearModeratorCookie(response: NextResponse, room?: string) {
  response.cookies.delete(globalCookieName);
  if (room) response.cookies.delete(roomCookieName(room));
}
