import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isStudio, sameOrigin } from "@/lib/access";
import { isModerator, verifiedRoomModeratorSession } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";

const dir = "/tmp/studiolink-moves";
const safe = (v:string) => Buffer.from(v).toString("base64url");

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const { room, identity, targetRoom, studioId: rawStudioId = "" } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
    if (typeof room !== "string" || typeof identity !== "string" || typeof targetRoom !== "string" || !room || !identity || !targetRoom || room === targetRoom) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const owner = isStudio(request);
    const scopedModerator = !owner && studioId === defaultStudioId() && typeof room === "string" && !!(await verifiedRoomModeratorSession(request, room));
    const moderator = !owner && !scopedModerator && studioId === defaultStudioId() && await isModerator(request);
    if (!owner && !moderator) return new NextResponse(null, { status: 401 });
    if (moderator && !identity.startsWith("guest-")) return NextResponse.json({ error: "Можно переводить только гостей" }, { status: 403 });
    const rooms = await readRooms(studioId);
    if (!rooms.some(item => item.name === room) || !rooms.some(item => item.name === targetRoom)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safe(studioId + "|" + room + "|" + identity)), JSON.stringify({ targetRoom, createdAt: Date.now() }), "utf8");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Не удалось перевести гостя" }, { status: 400 }); }
}
