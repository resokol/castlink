import { readRooms } from "@/lib/room-store";
import { readAccess, roomVersion, signAccess } from "@/lib/access";
import { defaultStudioId, validateStudioId } from "@/lib/studio-scope";
import type { NextRequest, NextResponse } from "next/server";

const lifetimeSeconds = 24 * 60 * 60;
const scopedHash = (studioId: string, room: string) => roomVersion(`${studioId}\0${room}`).slice(0, 24);
const cookieName = (studioId: string, room: string) => `castlink-room-admin-${scopedHash(studioId, room)}`;
const legacyCookieName = (room: string) => `castlink-room-admin-${roomVersion(room).slice(0, 24)}`;

function studioMatches(claims: ReturnType<typeof readAccess>, studioId: string) {
  return claims?.studio === studioId || (studioId === defaultStudioId() && claims?.studio === undefined);
}

export function newRoomAdminInvite(room: string, version: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  return signAccess({ kind: "room-admin-invite", studio: scope, room, version }, lifetimeSeconds);
}

export function validRoomAdminInvite(value: string, room: string, version: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const session = readAccess(value);
  return session?.kind === "room-admin-invite" && session.room === room && studioMatches(session, scope) && session.version === version ? session : null;
}

export function setRoomAdminCookie(response: NextResponse, request: NextRequest, room: string, version: string, expiresAt: number, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(cookieName(scope, room), signAccess({ kind: "room-admin", studio: scope, room, version }, maxAge), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax", path: "/", maxAge,
  });
}

export function clearRoomAdminCookie(response: NextResponse, room: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  response.cookies.delete(cookieName(scope, room));
  if (scope === defaultStudioId()) response.cookies.delete(legacyCookieName(room));
}

export async function verifiedRoomAdminVersion(request: NextRequest, room: string, studioId = defaultStudioId()) {
  const scope = validateStudioId(studioId);
  const record = (await readRooms(scope)).find(item => item.name === room);
  if (!record?.adminAccessVersion) return null;

  const current = readAccess(request.cookies.get(cookieName(scope, room))?.value);
  if (current?.kind === "room-admin" && current.room === room && studioMatches(current, scope) && current.version === record.adminAccessVersion) return record.adminAccessVersion;

  if (scope !== defaultStudioId()) return null;
  const legacy = readAccess(request.cookies.get(legacyCookieName(room))?.value);
  return legacy?.kind === "room-admin" && legacy.room === room && legacy.studio === undefined && legacy.version === record.adminAccessVersion
    ? record.adminAccessVersion
    : null;
}

export async function isRoomAdmin(request: NextRequest, room: string, studioId = defaultStudioId()) {
  return !!(await verifiedRoomAdminVersion(request, room, studioId));
}

export const roomAdminLifetimeSeconds = lifetimeSeconds;
