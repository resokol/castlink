import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "@/lib/access";
import { clearRoomAdminCookie, isRoomAdmin, newRoomAdminInvite, roomAdminLifetimeSeconds, setRoomAdminCookie, validRoomAdminInvite } from "@/lib/room-admin";
import { readRooms, updateRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { canHostNamedRoom, canHostRoom, verifiedRoomStudioSession, requireRoomCreatorUnchanged } from "../../../lib/room-studio-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const roomName = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 100;

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room");
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return NextResponse.json({ allowed: false }, { status: 400, headers: noStore }); }
  if (!roomName(room) || !(await readRooms(studioId)).some(item => item.name === room)) return NextResponse.json({ allowed: false }, { status: 404, headers: noStore });
  const owner = await canHostNamedRoom(request, room, studioId);
  const allowed = owner || await isRoomAdmin(request, room, studioId);
  return NextResponse.json({ allowed, ...(owner ? { owner: true } : {}) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  if (Number(request.headers.get("content-length")) > 16_384) return new NextResponse(null, { status: 413 });
  let data: any;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return new NextResponse(null, { status: 413 });
    data = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const { action, room } = data ?? {};
  let studioId: string;
  try { studioId = validateStudioId(typeof data?.studioId === "string" && data.studioId.trim() ? data.studioId : defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore }); }
  if (!roomName(room) || !(await readRooms(studioId)).some(item => item.name === room)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404, headers: noStore });

  if (action === "logout") {
    const response = NextResponse.json({ ok: true }, { headers: noStore });
    clearRoomAdminCookie(response, room, studioId);
    return response;
  }
  if (action === "accept") {
    const record = (await readRooms(studioId)).find(item => item.name === room);
    const invite = typeof data.invite === "string" ? validRoomAdminInvite(data.invite, room, record?.adminAccessVersion || "", studioId) : null;
    if (!record?.adminAccessVersion || !invite) return NextResponse.json({ error: "Приглашение недействительно или отозвано" }, { status: 403, headers: noStore });
    const response = NextResponse.json({ allowed: true, room }, { headers: noStore });
    setRoomAdminCookie(response, request, room, record.adminAccessVersion, invite.exp, studioId);
    return response;
  }

  const expectedRoom=(await readRooms(studioId)).find(r=>r.name===room);
  const creatorAuthorized=!!expectedRoom && !!verifiedRoomStudioSession(request,expectedRoom,studioId);
  if ((action !== "create" && action !== "revoke") || !expectedRoom || !(creatorAuthorized || await canHostRoom(request, expectedRoom, studioId))) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
  let version = "";
  const rooms = await updateRooms(current => {
    requireRoomCreatorUnchanged(request,expectedRoom,current.find(r=>r.name===room),studioId,creatorAuthorized);
    return current.map(item => {
    if (item.name !== room) return item;
    version = action === "create" ? item.adminAccessVersion || randomUUID() : randomUUID();
    return { ...item, adminAccessVersion: version };
  });
  }, studioId);
  if (!rooms.some(item => item.name === room)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404, headers: noStore });
  if (action === "revoke") {
    let disconnected = true;
    const disconnectErrors: string[] = [];
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      const participants = await lk.listParticipants(mediaRoomName(studioId, room));
      for (const participant of participants) {
        if (!participant.identity.startsWith("studio-moderator-") || !participant.metadata) continue;
        let metadata: any;
        try {
          metadata = JSON.parse(participant.metadata);
        } catch { continue; /* Never disconnect an unverified participant. */ }
        if (metadata?.roomAdmin !== true || metadata.adminAccessVersion === version) continue;
        if (creatorAuthorized && metadata.adminAccessVersion !== expectedRoom.adminAccessVersion) continue;
        try { await lk.removeParticipant(mediaRoomName(studioId, room), participant.identity); }
        catch { disconnected = false; disconnectErrors.push(participant.identity); }
      }
    } catch (error) {
      disconnected = false;
      disconnectErrors.push(error instanceof Error ? error.message.slice(0, 120) : "LiveKit недоступен");
    }
    return NextResponse.json({ ok: true, disconnected, ...(disconnectErrors.length ? { disconnectErrors: disconnectErrors.slice(0, 16) } : {}) }, { headers: noStore });
  }
  const expiresAt = Date.now() + roomAdminLifetimeSeconds * 1000;
  const invite = newRoomAdminInvite(room, version, studioId);
  return NextResponse.json({ path: `/admin?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(room)}#invite=${encodeURIComponent(invite)}`, expiresAt }, { headers: noStore });
}
