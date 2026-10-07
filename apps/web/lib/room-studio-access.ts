import type { NextRequest, NextResponse } from "next/server";
import { accessStudioMatches, readAccess, roomVersion, signAccess } from "./access";
import type { RoomRecord } from "./room-store";
import { isStudioOwner } from "./studio-owner-access";
import { validateStudioId } from "./studio-scope";
const lifetime = 30 * 86400;
const cookieName = (id: string) => `castlink-room-studio-${roomVersion(id).slice(0,24)}`;
export function verifiedRoomStudioSession(request: NextRequest, room: RoomRecord, studioId: string) {
  if (!room.creatorAccessId || !room.studioPasswordHash) return null;
  const claims = readAccess(request.cookies.get(cookieName(room.creatorAccessId))?.value);
  return claims?.kind === "room-studio" && claims.id === room.creatorAccessId && accessStudioMatches(claims, validateStudioId(studioId)) && claims.version === roomVersion(room.studioPasswordHash) ? claims : null;
}
export async function canHostRoom(request: NextRequest, room: RoomRecord, studioId: string) {
  return !!verifiedRoomStudioSession(request,room,studioId) || await isStudioOwner(request,studioId);
}
export function setRoomStudioCookie(response: NextResponse, request: NextRequest, room: RoomRecord, studioId: string) {
  if (!room.creatorAccessId || !room.studioPasswordHash) throw new Error("Room studio credentials missing");
  response.cookies.set(cookieName(room.creatorAccessId),signAccess({kind:"room-studio",studio:validateStudioId(studioId),id:room.creatorAccessId,version:roomVersion(room.studioPasswordHash)},lifetime),{httpOnly:true,secure:request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")==="https",sameSite:"lax",path:"/",maxAge:lifetime});
}
export function clearRoomStudioCookie(response: NextResponse, room: RoomRecord) {
  if (room.creatorAccessId) response.cookies.set(cookieName(room.creatorAccessId),"",{httpOnly:true,sameSite:"lax",path:"/",maxAge:0});
}
export async function canHostNamedRoom(request: NextRequest, name: unknown, studioId: string) {
  if(typeof name !== "string" || !name) return false;
  const { readRooms } = await import("./room-store");
  const room = (await readRooms(studioId)).find(record=>record.name===name);
  return !!room && await canHostRoom(request,room,studioId);
}
/** Called inside the room-store mutation to prevent rename/delete/recreation races. */
export function requireRoomCreatorUnchanged(request: NextRequest, expected: RoomRecord | undefined, current: RoomRecord | undefined, studioId: string, creatorAuthorized: boolean) {
  if (!creatorAuthorized) return;
  if (!expected || !current || current.creatorAccessId !== expected.creatorAccessId || current.studioPasswordHash !== expected.studioPasswordHash || !verifiedRoomStudioSession(request,current,studioId)) throw new Error("Room creator association changed");
}
