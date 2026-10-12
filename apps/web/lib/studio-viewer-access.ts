import { accessStudioMatches, readAccess, roomVersion, signAccess } from "./access";
import type { RoomRecord } from "./room-store";

const viewerIdentity = /^stream-viewer-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function studioViewerVersion(room: RoomRecord): string {
  return room.viewerAccessVersion || roomVersion(room.passwordHash);
}
export function studioViewingRoom(studioId: string, room: RoomRecord): string {
  return `castlink-view-${roomVersion(studioId + ":" + room.name + ":" + roomVersion(room.passwordHash)).slice(0, 32)}`;
}
export function verifiedStudioViewerInvite(value: string, studioId: string, room: RoomRecord) {
  const invite = readAccess(value);
  if (invite?.kind !== "studio-viewer" || invite.room !== room.name || !accessStudioMatches(invite, studioId) || invite.version !== studioViewerVersion(room) || !Number.isSafeInteger(invite.exp) || invite.exp <= Date.now() || invite.id !== undefined && !viewerIdentity.test(invite.id)) return null;
  return invite;
}
export function issueTransferredViewerInvite(studioId: string, room: RoomRecord, identity: string, expiresAt: number): string {
  if (!viewerIdentity.test(identity) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw new Error("Недействительная сессия просмотра");
  return signAccess({ kind: "studio-viewer", studio: studioId, room: room.name, version: studioViewerVersion(room), id: identity }, 30 * 86400, expiresAt);
}
