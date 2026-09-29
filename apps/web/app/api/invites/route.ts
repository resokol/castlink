import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isStudio, roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { ensureRoomAccessVersions, readRooms, updateRooms } from "@/lib/room-store";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const { room: name, action = "create" } = await request.json();
    if (typeof name !== "string" || !name.trim() || name.length > 100 || !["create", "revoke"].includes(action)) return new NextResponse(null, { status: 400 });
    let room = (await readRooms()).find(r => r.name === name);
    if (!room) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    if (!isStudio(request) && !(await isRoomAdmin(request, room.name)) && !(await isModerator(request, room.name))) return new NextResponse(null, { status: 401 });
    if (action === "revoke") {
      const version = randomUUID();
      await updateRooms(rooms => rooms.map(item => item.name === room!.name ? { ...item, guestInviteVersion: version } : item));
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!room.guestInviteVersion) room = await ensureRoomAccessVersions(room.name) || room;
    const invite = signAccess({ kind: "invite", room: room.name, version: room.guestInviteVersion || roomVersion(room.passwordHash) }, 30 * 86400);
    return NextResponse.json({ path: `/room?name=${encodeURIComponent(room.name)}#invite=${encodeURIComponent(invite)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Не удалось изменить приглашение" }, { status: 400 }); }
}
