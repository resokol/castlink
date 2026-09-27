import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import {
  acceptRoomModeratorInvite, clearModeratorCookie, createModeratorInvite, createRoomModeratorInvite,
  isModerator, verifiedRoomModeratorSession, listRoomModeratorSessions, revokeModeratorInvites, revokeRoomModeratorAccess,
  revokeRoomModeratorInvite, revokeRoomModeratorSession, setModeratorCookie, setRoomModeratorCookie,
  validModeratorInvite, validRoomModeratorInvite,
} from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const bad = (error: string, status = 403) => NextResponse.json({ error }, { status, headers: noStore });
async function roomExists(room: string): Promise<boolean> {
  return !!room && (await readRooms()).some(item => item.name === room);
}
export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room");
  const owner = isStudio(request);
  if (room) {
    if (!(await roomExists(room))) return bad("Комната не найдена", 404);
    const roomAdmin = !owner && await isRoomAdmin(request, room);
    const scopedModerator = !owner && !roomAdmin && !!(await verifiedRoomModeratorSession(request, room));
    const globalModerator = !owner && !roomAdmin && await isModerator(request);
    const allowed = owner || roomAdmin || scopedModerator || globalModerator;
    const response: any = { allowed, scope: roomAdmin || scopedModerator ? "room" : "server", room,
      ...(owner ? { owner: true, role: "owner", canInvite: true } : roomAdmin ? { role: "room-admin", canInvite: true } : scopedModerator ? { role: "room-moderator", canInvite: false } : globalModerator ? { role: "moderator", canInvite: false } : {}) };
    if (roomAdmin) {
      const sessions = await listRoomModeratorSessions(room);
      try {
        const { RoomServiceClient } = await import("livekit-server-sdk");
        const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
        const participants = await lk.listParticipants(room);
        const ids = new Map(participants.flatMap((participant: any) => {
          try {
            const metadata = JSON.parse(participant.metadata || "{}");
            if (participant.identity.startsWith("studio-moderator-") && metadata?.roomModeratorRoom === room && typeof metadata.roomModeratorSessionId === "string") return [[metadata.roomModeratorSessionId, { identity: participant.identity, name: participant.name || participant.identity }]];
          } catch {}
          return [];
        }));
        response.moderators = sessions.flatMap(session => { const participant = ids.get(session.id); return participant ? [{ id: session.id, ...participant }] : []; });
      } catch { response.moderators = []; response.rosterAvailable = false; }
    }
    return NextResponse.json(response, { headers: noStore });
  }
  const globalModerator = !owner && await isModerator(request);
  const rooms = await readRooms();
  const scopedRooms = globalModerator || owner ? [] : (await Promise.all(rooms.map(async item => await isModerator(request, item.name) ? item.name : null))).filter((name): name is string => !!name);
  return NextResponse.json({ allowed: owner || globalModerator || scopedRooms.length > 0,
    ...(owner ? { owner: true, role: "owner", canInvite: true, scope: "server" } : globalModerator ? { role: "moderator", canInvite: false, scope: "server" } : scopedRooms.length ? { role: "room-moderator", canInvite: false, scope: "room", rooms: scopedRooms } : {}) }, { headers: noStore });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return bad("Недопустимый источник запроса", 403);
  if (Number(request.headers.get("content-length")) > 16_384) return new NextResponse(null, { status: 413 });
  let data: any;
  try { const raw = await request.text(); if (raw.length > 16_384) return new NextResponse(null, { status: 413 }); data = JSON.parse(raw); }
  catch { return bad("Некорректный JSON", 400); }
  const action = data?.action;
  if (action === "logout") { const response = NextResponse.json({ ok: true }, { headers: noStore }); clearModeratorCookie(response, typeof data.room === "string" ? data.room : undefined); return response; }
  if (action === "accept") {
    const globalClaims = typeof data.invite === "string" ? await validModeratorInvite(data.invite) : null;
    if (globalClaims) {
      const response = NextResponse.json({ allowed: true, scope: "server", role: "moderator" }, { headers: noStore });
      setModeratorCookie(response, request, globalClaims.version!, globalClaims.exp); return response;
    }
    if (typeof data.room !== "string" || typeof data.invite !== "string") return bad("Приглашение недействительно или отозвано", 403);
    const scopedClaims = await validRoomModeratorInvite(data.invite, data.room);
    if (!scopedClaims) return bad("Приглашение недействительно или отозвано", 403);
    const session = await acceptRoomModeratorInvite(data.room, scopedClaims.inviteId, scopedClaims.exp);
    const response = NextResponse.json({ allowed: true, scope: "room", role: "room-moderator", room: data.room }, { headers: noStore });
    setRoomModeratorCookie(response, request, data.room, session.id, session.expiresAt); return response;
  }
  const owner = isStudio(request);
  const room = typeof data?.room === "string" ? data.room : "";
  const roomAdmin = !owner && !!room && await isRoomAdmin(request, room);
  if (action === "create") {
    if (owner) {
      if (!(await roomExists(room))) return bad("Комната не найдена", 404);
      const { invite, expiresAt } = await createModeratorInvite();
      return NextResponse.json({ path: `/moderator?room=${encodeURIComponent(room)}#invite=${encodeURIComponent(invite)}`, expiresAt, scope: "server" }, { headers: noStore });
    }
    if (!roomAdmin || !(await roomExists(room))) return bad("Недостаточно прав или комната не найдена", roomAdmin ? 404 : 403);
    const { invite, expiresAt, id } = await createRoomModeratorInvite(room);
    return NextResponse.json({ path: `/moderator?room=${encodeURIComponent(room)}#invite=${encodeURIComponent(invite)}`, expiresAt, scope: "room", inviteId: id }, { headers: noStore });
  }
  if (action === "revoke") {
    if (!owner) return bad("Недостаточно прав", 403);
    const version = await revokeModeratorInvites();
    let disconnected = true; const disconnectErrors: string[] = [];
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      for (const item of await readRooms()) {
        let participants: any[];
        try { participants = await lk.listParticipants(item.name); }
        catch (error) { disconnected = false; disconnectErrors.push(`${item.name}:${error instanceof Error ? error.message.slice(0, 100) : "LiveKit недоступен"}`); continue; }
        for (const participant of participants) {
          if (!participant.metadata) continue;
          let metadata: any; try { metadata = JSON.parse(participant.metadata); } catch { continue; }
          if (metadata?.accessRole !== "moderator" || typeof metadata.moderatorAccessVersion !== "string" || metadata.moderatorAccessVersion === version || !(participant.identity.startsWith("studio-moderator-") || participant.identity.startsWith("talkback-"))) continue;
          try { await lk.removeParticipant(item.name, participant.identity); } catch { disconnected = false; disconnectErrors.push(`${item.name}:${participant.identity}`); }
        }
      }
    } catch (error) { disconnected = false; disconnectErrors.push(error instanceof Error ? error.message.slice(0, 120) : "LiveKit недоступен"); }
    return NextResponse.json({ ok: true, disconnected, ...(disconnectErrors.length ? { disconnectErrors: disconnectErrors.slice(0, 16) } : {}) }, { headers: noStore });
  }
  if (action === "revoke-room") {
    if (!roomAdmin || !(await roomExists(room))) return bad("Недостаточно прав или комната не найдена", roomAdmin ? 404 : 403);
    await revokeRoomModeratorAccess(room);
    let disconnected = true;
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      for (const participant of await lk.listParticipants(room)) {
        try { const m = JSON.parse(participant.metadata || "{}"); if (m?.roomModeratorRoom === room && typeof m.roomModeratorSessionId === "string" && (participant.identity.startsWith("studio-moderator-") || participant.identity.startsWith("talkback-"))) await lk.removeParticipant(room, participant.identity); }
        catch { /* Never remove a participant whose scoped role cannot be verified. */ }
      }
    } catch { disconnected = false; }
    return NextResponse.json({ ok: true, disconnected }, { headers: noStore });
  }
  if (action === "revoke-session") {
    if (!roomAdmin || !(await roomExists(room)) || typeof data.id !== "string") return bad("Недостаточно прав", 403);
    const session = await revokeRoomModeratorSession(room, data.id);
    if (!session) return bad("Сессия модератора не найдена", 404);
    let disconnected = true;
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      for (const participant of await lk.listParticipants(room)) {
        try { const metadata = JSON.parse(participant.metadata || "{}"); if (metadata?.roomModeratorRoom === room && metadata.roomModeratorSessionId === data.id && (participant.identity.startsWith("studio-moderator-") || participant.identity.startsWith("talkback-"))) await lk.removeParticipant(room, participant.identity); }
        catch { /* Do not remove unverified staff. */ }
      }
    } catch { disconnected = false; }
    return NextResponse.json({ ok: true, disconnected }, { headers: noStore });
  }
  if (action === "revoke-invite") {
    if (!roomAdmin || !(await roomExists(room)) || typeof data.id !== "string") return bad("Недостаточно прав", 403);
    const ok = await revokeRoomModeratorInvite(room, data.id);
    return ok ? NextResponse.json({ ok: true }, { headers: noStore }) : bad("Приглашение не найдено", 404);
  }
  return bad("Неизвестное действие", 400);
}
