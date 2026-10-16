import type { NextRequest } from "next/server";
import { guestEntryFromAccess, guestAccessExpiresAt, roomVersion } from "./access";
import type { RoomRecord } from "./room-store";
import { verifiedRoomStudioSession } from "./room-studio-access";
import { studioOwnerSessionExpiresAt, studioOwnerTransferVersion } from "./studio-owner-access";
import { verifiedRoomAdminSession } from "./room-admin";
import { verifiedModeratorVersion, verifiedModeratorExpiresAt, verifiedRoomModeratorSession, moderatorTransferVersion } from "./moderator-access";
import type { TransferAuthorization } from "./server-transfer";

export const roomTransferId = (room: RoomRecord) => room.creatorAccessId || room.transferRoomId || "";
export const roomTransferCredentialVersion = (room: RoomRecord) => roomVersion(JSON.stringify([room.creatorAccessId || "", room.studioPasswordHash || "", room.passwordHash || ""]));

/** Recheck cookies and current revocation state; a signed media JWT alone never restores staff rights. */
export async function verifiedTransferAuthority(request: NextRequest, room: RoomRecord, studioId: string, kind: TransferAuthorization["kind"], cap = Infinity): Promise<TransferAuthorization | null> {
  let expiry: number | null = null, version: string | undefined;
  if (kind === "creator") {
    const claims = verifiedRoomStudioSession(request, room, studioId);
    expiry = claims?.exp ?? null; version = roomVersion(room.studioPasswordHash);
  } else if (kind === "owner") { expiry = await studioOwnerSessionExpiresAt(request, studioId); version = expiry ? await studioOwnerTransferVersion(request,studioId) : undefined; }
  else if (kind === "admin") {
    const claims = await verifiedRoomAdminSession(request, room.name, studioId);
    expiry = claims?.exp ?? null; version = claims?.version;
  } else if (kind === "moderator") {
    const claims = await verifiedRoomModeratorSession(request, room.name, studioId);
    if (claims) { expiry = claims.expiresAt; version = claims.id; }
    else { version = await verifiedModeratorVersion(request, undefined, studioId) ?? undefined; expiry = version ? await verifiedModeratorExpiresAt(request, studioId) : null; }
  } else if (kind === "studio-viewer") return null;
  else if (kind === "guest") { expiry = guestAccessExpiresAt(request, room.name, room.passwordHash, studioId); version = roomVersion(room.passwordHash); }
  if (!expiry || Math.min(expiry, cap) <= Date.now()) return null;
  return { kind, ...(kind === "guest" ? { entrySettings: guestEntryFromAccess(request, room.name, room.passwordHash, studioId) } : {}), expiresAt: Math.min(expiry, cap), roomId: roomTransferId(room), ...(room.creatorAccessId ? { creatorAccessId: room.creatorAccessId } : {}), ...(version ? { credentialVersion: version } : {}) };
}

export async function targetModeratorCredentialVersion(room:RoomRecord,studioId:string){return roomVersion(roomTransferCredentialVersion(room)+":"+await moderatorTransferVersion(room.name,studioId,room.creatorAccessId));}
