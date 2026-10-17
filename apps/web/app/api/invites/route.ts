import { createGuestInviteKey } from "../../../lib/guest-invite-key";
import { guestEntrySettings } from "../../../lib/guest-entry-settings";
import { readGuestEntrySettings, saveGuestEntrySettings } from "../../../lib/guest-entry-store";
import { diagnosticAssociation, validateDiagnosticAssociation, DiagnosticRoomConflict } from "../../../lib/media-room-association";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isStudio, roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { ensureRoomAccessVersions, readRooms, updateRooms, invalidateDiagnosticReceipts } from "@/lib/room-store";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";
import { canHostRoom, verifiedRoomStudioSession, requireRoomCreatorUnchanged } from "../../../lib/room-studio-access";
import { isStudioOwner } from "../../../lib/studio-owner-access";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const { room: name, action = "create", studioId: rawStudioId = "", diagnostic, expectedDiagnosticAssociation, entrySettings } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return new NextResponse(null, { status: 400 }); }
    if (typeof name !== "string" || !name.trim() || name.length > 100 || !["create", "revoke", "settings", "read-settings"].includes(action)) return new NextResponse(null, { status: 400 });
    if (diagnostic !== undefined && diagnostic !== true || diagnostic === true && action !== "create" || expectedDiagnosticAssociation !== undefined && diagnostic !== true) return new NextResponse(null, { status: 400 });
    if (diagnostic === true && !(await isStudioOwner(request, studioId))) return new NextResponse(null, { status: 403 });
    let room = (await readRooms(studioId)).find(r => r.name === name);
    if (!room) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    const creatorAuthorized=!!verifiedRoomStudioSession(request,room,studioId);
    if (!(await canHostRoom(request, room, studioId)) && !(await isRoomAdmin(request, room.name, studioId)) &&
        !(await isModerator(request, room.name, studioId))) return new NextResponse(null, { status: 401 });
    if (!room.guestInviteVersion && !room.creatorAccessId && !room.transferRoomId) room = await ensureRoomAccessVersions(room.name, studioId) || room;
    if (action === "read-settings") return NextResponse.json({ entrySettings: await readGuestEntrySettings(studioId, room) }, { headers: { "Cache-Control": "no-store" } });
    if (action === "settings") {
      const settings = guestEntrySettings(entrySettings);
      if (!room.creatorAccessId && !room.transferRoomId) {
        const expected = room;
        const updated = await updateRooms(current => {
          const target = current.find(item => item.name === name);
          if (!target || !isDeepStrictEqual(target, expected)) throw new DiagnosticRoomConflict("Room changed while saving entry settings");
          requireRoomCreatorUnchanged(request, expected, target, studioId, creatorAuthorized);
          return current.map(item => item === target ? { ...item, transferRoomId: randomUUID() } : item);
        }, studioId);
        room = updated.find(item => item.name === name)!;
      }
      await saveGuestEntrySettings(studioId, room, settings);
      return NextResponse.json({ ok: true });
    }
    if (diagnostic === true) {
      validateDiagnosticAssociation(expectedDiagnosticAssociation);
      let invite = "";
      await updateRooms(current => {
        const target = current.find(item => item.name === name);
        if (!target || !isDeepStrictEqual(diagnosticAssociation(target), expectedDiagnosticAssociation)) throw new DiagnosticRoomConflict("Diagnostic room association is invalid or changed");
        invite = signAccess({ kind: "invite", studio: studioId, room: target.name, version: target.guestInviteVersion }, 600);
        return current;
      }, studioId);
      return NextResponse.json({ path: `/room?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(name)}#invite=${encodeURIComponent(invite)}` }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "revoke") {
      const version = randomUUID();
      await updateRooms(rooms => {requireRoomCreatorUnchanged(request,room,rooms.find(r=>r.name===room!.name),studioId,creatorAuthorized);return rooms.map(item => item.name === room!.name ? { ...item, guestInviteVersion: version } : item);}, studioId);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    await invalidateDiagnosticReceipts(studioId, room.name);
    if (!room.guestInviteVersion) room = await ensureRoomAccessVersions(room.name, studioId) || room;
    const invite = await createGuestInviteKey(signAccess({ kind: "invite", studio: studioId, room: room.name, version: room.guestInviteVersion || roomVersion(room.passwordHash), entrySettings: entrySettings === undefined ? await readGuestEntrySettings(studioId, room) : guestEntrySettings(entrySettings) }, 30 * 86400));
    return NextResponse.json({ path: `${verifiedRoomStudioSession(request, room, studioId) ? "/" : "/room"}?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(room.name)}#invite=${encodeURIComponent(invite)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof DiagnosticRoomConflict) return NextResponse.json({ error: "Diagnostic room association is invalid or changed" }, { status: 409 }); return NextResponse.json({ error: "Не удалось изменить приглашение" }, { status: 400 }); }
}
