import { NextRequest, NextResponse } from "next/server";
import { canJoin, isStudio } from "../../../lib/access";
import { resolveStudioRoute } from "../../../lib/control-plane-store";
import { readRooms } from "../../../lib/room-store";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  let studioId: string;
  try {
    studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId());
  } catch {
    return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore });
  }

  const roomName = request.nextUrl.searchParams.get("room")?.trim() || "";
  const owner = isStudio(request);

  if (!owner) {
    if (!roomName || roomName.length > 100) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
    }
    const room = (await readRooms(studioId)).find(item => item.name === roomName);
    if (!room || !canJoin(request, roomName, room.passwordHash, studioId)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
    }
  }

  try {
    const route = await resolveStudioRoute(studioId);
    if (!route.ok) {
      const status = route.reason === "unassigned" ? 409 : 503;
      return NextResponse.json(route, { status, headers: noStore });
    }
    return NextResponse.json(owner ? route : {
      ok: true,
      studioId: route.studioId,
      endpoint: route.endpoint,
    }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось определить сервер студии" }, { status: 503, headers: noStore });
  }
}
