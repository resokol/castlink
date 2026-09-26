import { NextRequest, NextResponse } from "next/server";
import { canJoin, hashPassword, isStudio, roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { readRooms, updateRooms } from "@/lib/room-store";
export async function GET(request: NextRequest) {
  const rooms = await readRooms();
  const name = request.nextUrl.searchParams.get("name");
  if (name) {
    const room = rooms.find(r => r.name === name);
    return NextResponse.json({ exists: !!room, studioOnly: room?.studioOnly === true, passwordRequired: !!room?.passwordHash && !canJoin(request, name, room.passwordHash),
      ...(room && isStudio(request) ? { viewAccess: signAccess({ kind: "viewer", room: name, version: roomVersion(room.passwordHash) }, 30 * 86400) } : {}) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!isStudio(request)) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ rooms: rooms.map(r => r.name), protectedRooms: rooms.filter(r => r.passwordHash).map(r => r.name) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!isStudio(request) || !sameOrigin(request)) return new NextResponse(null, { status: 401 });
  try {
    const { action, name, newName, password = "", studioOnly } = await request.json();
    if (typeof name !== "string" || !name.trim() || name.length > 100 || typeof password !== "string" || password.length > 256) throw Error("Некорректные данные комнаты");
    const clean = name.trim();
    const rooms = await updateRooms(current => {
      if (action === "create") {
        if (current.some(r => r.name === clean)) throw Error("Комната уже существует");
        return [...current, { name: clean, ...(password ? { passwordHash: hashPassword(password) } : {}) }];
      }
      if (!current.some(r => r.name === clean)) throw Error("Комната не найдена");
      if (action === "mode") {
        if (typeof studioOnly !== "boolean") throw Error("Некорректный режим комнаты");
        return current.map(r => r.name === clean ? { ...r, studioOnly } : r);
      }
      if (action === "rename") {
        if (typeof newName !== "string" || !newName.trim() || newName.length > 100 || current.some(r => r.name === newName.trim())) throw Error("Недопустимое название комнаты");
        return current.map(r => r.name === clean ? { ...r, name: newName.trim() } : r);
      }
      if (action === "delete") {
        if (current.length < 2) throw Error("Нельзя удалить последнюю комнату");
        return current.filter(r => r.name !== clean);
      }
      throw Error("Неизвестное действие");
    });
    return NextResponse.json({ rooms: rooms.map(r => r.name) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка комнаты" }, { status: 400 }); }
}
