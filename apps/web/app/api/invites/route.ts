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
    const { room: name, action = "create", studioId: rawStudioId = "", diagnostic, expectedDiagnosticAssociation } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return new NextResponse(null, { status: 400 }); }
    if (typeof name !== "string" || !name.trim() || name.length > 100 || !["create", "revoke"].includes(action)) return new NextResponse(null, { status: 400 });
    if (diagnostic !== undefined && diagnostic !== true || diagnostic === true && action !== "create" || expectedDiagnosticAssociation !== undefined && diagnostic !== true) return new NextResponse(null, { status: 400 });
    if (diagnostic === true && !(await isStudioOwner(request, studioId))) return new NextResponse(null, { status: 403 });
    let room = (await readRooms(studioId)).find(r => r.name === name);
    if (!room) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    const creatorAuthorized=!!verifiedRoomStudioSession(request,room,studioId);
    if (!(await canHostRoom(request, room, studioId)) && !(await isRoomAdmin(request, room.name, studioId)) &&
        !(await isModerator(request, room.name, studioId))) return new NextResponse(null, { status: 401 });
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
    const invite = signAccess({ kind: "invite", studio: studioId, room: room.name, version: room.guestInviteVersion || roomVersion(room.passwordHash) }, 30 * 86400);
    return NextResponse.json({ path: `${verifiedRoomStudioSession(request, room, studioId) ? "/" : "/room"}?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(room.name)}#invite=${encodeURIComponent(invite)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof DiagnosticRoomConflict) return NextResponse.json({ error: "Diagnostic room association is invalid or changed" }, { status: 409 }); return NextResponse.json({ error: "Не удалось изменить приглашение" }, { status: 400 }); }
}
