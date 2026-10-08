import { atomicWriteJson, readJson, runtimeFile, storageSchemaVersion } from "./persistent-storage";
import { randomUUID } from "node:crypto";
import { readAccess, roomVersion, signAccess, accessStudioMatches } from "@/lib/access";
import { defaultStudioId, validateStudioId } from "@/lib/studio-scope";
import type { NextRequest, NextResponse } from "next/server";

const lifetimeSeconds = 24 * 60 * 60;
const storePath = () => runtimeFile("studiolink-moderator-access.json", process.env.STUDIOLINK_MODERATOR_ACCESS_FILE);
const scopedKey = (studioId: string, room: string) => `${validateStudioId(studioId)}\0${room}`;
async function scopedRoomKey(studioId: string, room: string, expectedCreatorId?: string) {
  const {readRooms}=await import("./room-store");
  const record=(await readRooms(studioId)).find(r=>r.name===room);
  if(expectedCreatorId && record?.creatorAccessId!==expectedCreatorId)throw new Error("Room creator association changed");
  return scopedKey(studioId,record?.creatorAccessId ? `creator:${record.creatorAccessId}` : room);
}
const studioCookieName = (studioId: string) => `castlink-moderator-${roomVersion(validateStudioId(studioId)).slice(0, 24)}`;
const legacyGlobalCookieName = "castlink-moderator";
const roomCookieName = (studioId: string, room: string) => `castlink-room-moderator-${roomVersion(scopedKey(studioId, room)).slice(0, 24)}`;
const legacyRoomCookieName = (room: string) => `castlink-room-moderator-${roomVersion(room).slice(0, 24)}`;

type ScopedSession = { studioId: string; room: string; inviteId: string; creatorAccessId?: string };
type Store = {
  schemaVersion: 1;
  version: string;
  versions?: Record<string, string>;
  scopedInvites: Record<string, Record<string, number>>;
  scopedSessions: Record<string, Record<string, ScopedSession>>;
  transferVersions?: Record<string,string>;
};

let queue: Promise<unknown> = Promise.resolve();
const emptyStore = (): Store => ({ schemaVersion: 1, version: "", versions: {}, scopedInvites: {}, scopedSessions: {} });

async function readStore(): Promise<Store> {
  try {
    const value = await readJson(storePath()) as any;
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        (value.schemaVersion !== undefined && value.schemaVersion !== storageSchemaVersion)) {
      throw new Error("Unsupported moderator access data schema");
    }
    return {
      schemaVersion: 1,
      version: typeof value.version === "string" ? value.version : "",
      versions: value.versions && typeof value.versions === "object" ? value.versions : {},
      scopedInvites: value.scopedInvites && typeof value.scopedInvites === "object" ? value.scopedInvites : {},
      transferVersions: value.transferVersions || {},
      scopedSessions: value.scopedSessions && typeof value.scopedSessions === "object" ? value.scopedSessions : {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw error;
  }
}

async function changeStore(change: (value: Store) => Store) {
  const operation = queue.catch(() => undefined).then(async () => {
    const next = change(await readStore());
    await atomicWriteJson(storePath(), next);
    return next;
  });
  queue = operation;
  return operation;
}

function studioVersion(store: Store, studioId: string) {
  const scope = validateStudioId(studioId);
  return store.versions?.[scope] || (scope === defaultStudioId() ? store.version : "");
}

export const moderatorLifetimeSeconds = lifetimeSeconds;

export function newModeratorInvite(version: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  return signAccess({ kind: "moderator-invite", studio: scope, version }, lifetimeSeconds);
}

export async function createModeratorInvite(studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  let version = "";
  await changeStore(current => {
    version = studioVersion(current, scope) || randomUUID();
    return { ...current, versions: { ...(current.versions || {}), [scope]: version } };
  });
  return { invite: newModeratorInvite(version, scope), version, expiresAt: Date.now() + lifetimeSeconds * 1000 };
}

export async function revokeModeratorInvites(studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const version = randomUUID();
  await changeStore(current => ({ ...current, versions: { ...(current.versions || {}), [scope]: version } }));
  return version;
}

export async function validModeratorInvite(value: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const claims = readAccess(value);
  const state = await readStore();
  return claims?.kind === "moderator-invite" && accessStudioMatches(claims, scope) &&
    !!studioVersion(state, scope) && claims.version === studioVersion(state, scope) ? claims : null;
}

export async function createRoomModeratorInvite(room: string, studioId = defaultStudioId(), expectedCreatorId?: string) {
  const {readRooms}=await import("./room-store");
  const record=(await readRooms(studioId)).find(r=>r.name===room);
  if(expectedCreatorId && record?.creatorAccessId!==expectedCreatorId)throw new Error("Room creator association changed");
  const creatorAccessId=record?.creatorAccessId;
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room);
  const id = randomUUID();
  const invite = signAccess({ kind: "room-moderator-invite", studio: scope, room, id, ...(creatorAccessId?{creatorAccessId}:{}) } as any, lifetimeSeconds);
  const claims: any = readAccess(invite);
  if (!claims || typeof claims.exp !== "number") throw new Error("Не удалось создать приглашение модератора");
  const expiresAt = claims.exp;
  await changeStore(current => ({
    ...current,
    scopedInvites: { ...current.scopedInvites, [key]: { ...(current.scopedInvites[key] || {}), [id]: expiresAt } },
  }));
  return { id, expiresAt, invite };
}

export async function validRoomModeratorInvite(value: string, room: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room);
  const claims: any = readAccess(value);
  if (claims?.kind !== "room-moderator-invite" || claims.room !== room || !accessStudioMatches(claims, scope) || typeof claims.id !== "string") return null;
  const {readRooms}=await import("./room-store");
  const record=(await readRooms(scope)).find(r=>r.name===room);
  if(!record || (record.creatorAccessId ?? undefined)!==(claims.creatorAccessId ?? undefined))return null;
  const state = await readStore();
  const expiresAt = state.scopedInvites[key]?.[claims.id] ??
    (scope === defaultStudioId() ? state.scopedInvites[room]?.[claims.id] : undefined);
  return expiresAt && expiresAt > Date.now() && claims.exp <= expiresAt
    ? { studioId: scope, room, inviteId: claims.id, creatorAccessId: record.creatorAccessId, exp: Math.min(claims.exp, expiresAt) }
    : null;
}

export async function acceptRoomModeratorInvite(room: string, inviteId: string, expiresAt: number, studioId = defaultStudioId(), creatorAccessId?: string) {
  const scope = validateStudioId(studioId);
  const {readRooms}=await import("./room-store");
  const record=(await readRooms(scope)).find(r=>r.name===room);
  if(!record || record.creatorAccessId!==creatorAccessId)throw new Error("Room creator association changed");
  const key = await scopedRoomKey(scope, room);
  const id = randomUUID();
  await changeStore(current => ({
    ...current,
    scopedSessions: {
      ...current.scopedSessions,
      [key]: { ...(current.scopedSessions[key] || {}), [id]: { studioId: scope, room, inviteId, ...(creatorAccessId?{creatorAccessId}:{}) } },
    },
  }));
  return { id, expiresAt: Math.min(expiresAt, Date.now() + lifetimeSeconds * 1000) };
}

export async function isModerator(request: NextRequest, room?: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const globalVersion = await verifiedModeratorVersion(request, undefined, scope);
  if (globalVersion) return true;
  return room ? !!(await verifiedRoomModeratorSession(request, room, scope)) : false;
}

export async function verifiedModeratorVersion(request: NextRequest, room?: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  if (room) {
    const scopedClaims: any = readAccess(request.cookies.get(roomCookieName(scope, room))?.value);
    if (scopedClaims?.kind === "room-moderator" && scopedClaims.room === room && accessStudioMatches(scopedClaims, scope) && typeof scopedClaims.id === "string") {
      const session = await verifiedRoomModeratorSession(request, room, scope);
      return session ? session.id : null;
    }
  }

  const current = readAccess(request.cookies.get(studioCookieName(scope))?.value);
  if (current?.kind === "moderator" && accessStudioMatches(current, scope)) {
    const state = await readStore();
    const version = studioVersion(state, scope);
    if (version && current.version === version) return version;
  }

  if (scope !== defaultStudioId()) return null;
  const legacy = readAccess(request.cookies.get(legacyGlobalCookieName)?.value);
  if (legacy?.kind !== "moderator" || legacy.studio !== undefined) return null;
  const state = await readStore();
  return state.version && legacy.version === state.version ? state.version : null;
}

export async function verifiedRoomModeratorSession(request: NextRequest, room: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room);
  let claims: any = readAccess(request.cookies.get(roomCookieName(scope, room))?.value);
  if ((!claims || claims.kind !== "room-moderator") && scope === defaultStudioId()) {
    claims = readAccess(request.cookies.get(legacyRoomCookieName(room))?.value);
  }
  if (claims?.kind !== "room-moderator" || claims.room !== room || !accessStudioMatches(claims, scope) || typeof claims.id !== "string") return null;
  const state = await readStore();
  const session = state.scopedSessions[key]?.[claims.id] ??
    (scope === defaultStudioId() ? state.scopedSessions[room]?.[claims.id] : undefined);
  if(session?.room!==room)return null;
  const {readRooms}=await import("./room-store");
  const record=(await readRooms(scope)).find(r=>r.name===room);
  return record && record.creatorAccessId===session.creatorAccessId ? { ...session, id: claims.id, expiresAt: claims.exp as number } : null;
}

export async function verifiedModeratorExpiresAt(request: NextRequest, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const version = await verifiedModeratorVersion(request, undefined, scope);
  if (!version) return null;
  for (const name of [studioCookieName(scope), ...(scope === defaultStudioId() ? [legacyGlobalCookieName] : [])]) {
    const claims = readAccess(request.cookies.get(name)?.value);
    if (claims?.kind === "moderator" && accessStudioMatches(claims, scope) && claims.version === version) return claims.exp;
  }
  return null;
}

export async function revokeRoomModeratorSession(room: string, id: string, studioId = defaultStudioId(), expectedCreatorId?: string) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room, expectedCreatorId);
  let removed: ScopedSession | undefined;
  await changeStore(current => {
    const sessions = { ...(current.scopedSessions[key] || {}) };
    removed = sessions[id]; delete sessions[id];
    const invites = { ...(current.scopedInvites[key] || {}) };
    if (removed?.inviteId) delete invites[removed.inviteId];
    return {
      ...current,
      scopedSessions: { ...current.scopedSessions, [key]: sessions },
      scopedInvites: { ...current.scopedInvites, [key]: invites },
    };
  });
  const {schedulePreparedRevocation}=await import("./reserve-source");schedulePreparedRevocation(scope,room,{kind:"moderator",credentialVersion:id});
  return removed;
}

export async function revokeRoomModeratorAccess(room: string, studioId = defaultStudioId(), expectedCreatorId?: string) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room, expectedCreatorId);
  let removedIds: string[]=[];
  await changeStore(current => {
    removedIds=Object.keys(current.scopedSessions[key] || {});
    return ({
    ...current,
    transferVersions: { ...(current.transferVersions || {}), [key]: randomUUID() },
    scopedInvites: { ...current.scopedInvites, [key]: {} },
    scopedSessions: { ...current.scopedSessions, [key]: {} },
  });
  });
  const {schedulePreparedRevocation}=await import("./reserve-source");schedulePreparedRevocation(scope,room,{kind:"moderator"});
  return removedIds;
}

export async function revokeRoomModeratorInvite(room: string, id: string, studioId = defaultStudioId(), expectedCreatorId?: string) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room, expectedCreatorId);
  let removed = false;
  await changeStore(current => {
    const invites = { ...(current.scopedInvites[key] || {}) };
    removed = typeof invites[id] === "number"; delete invites[id];
    return { ...current, scopedInvites: { ...current.scopedInvites, [key]: invites } };
  });
  return removed;
}

export async function listRoomModeratorSessions(room: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const key = await scopedRoomKey(scope, room);
  const state = await readStore();
  const sessions = state.scopedSessions[key] || (scope === defaultStudioId() ? state.scopedSessions[room] || {} : {});
  return Object.entries(sessions).map(([id, session]) => ({ id, studioId: session.studioId || scope, room: session.room, inviteId: session.inviteId }));
}

export function setModeratorCookie(response: NextResponse, request: NextRequest, version: string, expiresAt: number, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(studioCookieName(scope), signAccess({ kind: "moderator", studio: scope, version }, maxAge,expiresAt), cookieOptions(request, maxAge));
}

export function setRoomModeratorCookie(response: NextResponse, request: NextRequest, room: string, id: string, expiresAt: number, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(roomCookieName(scope, room), signAccess({ kind: "room-moderator", studio: scope, room, id } as any, maxAge), cookieOptions(request, maxAge));
}

function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function clearModeratorCookie(response: NextResponse, room?: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  response.cookies.delete(studioCookieName(scope));
  if (scope === defaultStudioId()) response.cookies.delete(legacyGlobalCookieName);
  if (room) {
    response.cookies.delete(roomCookieName(scope, room));
    if (scope === defaultStudioId()) response.cookies.delete(legacyRoomCookieName(room));
  }
}

export async function moderatorTransferVersion(room:string,studioId=defaultStudioId(),creatorAccessId?:string){const key=creatorAccessId?scopedKey(studioId,`creator:${creatorAccessId}`):await scopedRoomKey(studioId,room);return (await readStore()).transferVersions?.[key] || "initial";}
export async function globalModeratorAccessVersion(studioId=defaultStudioId()){return studioVersion(await readStore(),studioId);}
