import { readRooms } from "@/lib/room-store";
import { readAccess, roomVersion, signAccess } from "@/lib/access";
import type { NextRequest, NextResponse } from "next/server";

const lifetimeSeconds = 24 * 60 * 60;
const cookieName = (room: string) => `castlink-room-admin-${roomVersion(room).slice(0, 24)}`;

export function newRoomAdminInvite(room: string, version: string) {
  return signAccess({ kind: "room-admin-invite", room, version }, lifetimeSeconds);
}

export function validRoomAdminInvite(value: string, room: string, version: string) {
  const session = readAccess(value);
  return session?.kind === "room-admin-invite" && session.room === room && session.version === version ? session : null;
}

export function setRoomAdminCookie(response: NextResponse, request: NextRequest, room: string, version: string, expiresAt: number) {
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(cookieName(room), signAccess({ kind: "room-admin", room, version }, maxAge), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax", path: "/", maxAge,
  });
}

export function clearRoomAdminCookie(response: NextResponse, room: string) {
  response.cookies.delete(cookieName(room));
}

export async function verifiedRoomAdminVersion(request: NextRequest, room: string) {
  const record = (await readRooms()).find(item => item.name === room);
  if (!record?.adminAccessVersion) return null;
  const session = readAccess(request.cookies.get(cookieName(room))?.value);
  return session?.kind === "room-admin" && session.room === room && session.version === record.adminAccessVersion ? record.adminAccessVersion : null;
}

export async function isRoomAdmin(request: NextRequest, room: string) {
  return !!(await verifiedRoomAdminVersion(request, room));
}

export const roomAdminLifetimeSeconds = lifetimeSeconds;
