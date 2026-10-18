import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { canHostNamedRoom } from "@/lib/room-studio-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { validStudioClient } from "@/lib/studio-control";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { PRIVATE_TALKBACK_LEASE_MS, privateTalkbackSessions, closePrivateTalkbackSession, loadPrivateTalkbackSessions, savePrivateTalkbackSessions, serializeTalkback, type PrivateTalkbackSession } from "../../../lib/talkback-session";

const client = () => new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const staff = async (request: NextRequest, room: string, studioId: string) => await canHostNamedRoom(request, room, studioId) || await isRoomAdmin(request, room, studioId) || await isModerator(request, room, studioId);
function guestMetadata(value: string, studioId: string) {
  try { const metadata = JSON.parse(value || "{}"); return metadata?.role === "guest" && metadata.studioId === studioId; } catch { return false; }
}
function armExpiry(session: PrivateTalkbackSession) {
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    void serializeTalkback(async () => {
      if (!privateTalkbackSessions.has(session.id)) return;
      try { await closePrivateTalkbackSession(session); }
      catch { session.expiresAt = Date.now() + 5000; armExpiry(session); }
    });
  }, Math.max(1, session.expiresAt - Date.now()));
  session.timer.unref?.();
}
async function validateSession(session: PrivateTalkbackSession, lk: RoomServiceClient) {
  if (session.endedAt) return false;
  if (session.closing || session.expiresAt <= Date.now()) { await closePrivateTalkbackSession(session, lk); return false; }
  try {
    const participant = await lk.getParticipant(session.parentRoom, session.target);
    if (participant.sid === session.targetSid && guestMetadata(participant.metadata, session.studioId)) return true;
  } catch { /* Missing current participant ends this exact session. */ }
  await closePrivateTalkbackSession(session, lk); return false;
}
async function offer(session: PrivateTalkbackSession, guest: boolean) {
  const identity = guest ? session.guestIdentity : session.staffIdentity;
  const token = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity, name: guest ? "Гость: приватный разговор" : session.staffName, ttl: "60s",
    metadata: JSON.stringify({ role: "private-talkback", studioId: session.studioId, sessionId: session.id }),
  });
  token.addGrant({ roomJoin: true, room: session.roomName, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
  return { active: true, sessionId: session.id, token: await token.toJwt(), roomName: session.roomName, identity, staffName: session.staffName, restoreMicrophone: session.restoreMicrophone };
}
async function handle(request: NextRequest, body: Record<string, unknown>, method: "GET" | "POST" | "DELETE") {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  let studioId: string;
  try { studioId = validateStudioId(typeof body.studioId === "string" && body.studioId ? body.studioId : defaultStudioId()); } catch { return json({ error: "Некорректный studioId" }, 400); }
  const room = typeof body.room === "string" ? body.room : "";
  if (!room || room.length > 100) return json({ error: "Некорректная комната" }, 400);
  const parentRoom = mediaRoomName(studioId, room), lk = client();
  let guestIdentity: string | undefined;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (method === "GET" || method === "DELETE" && bearer) {
    try {
      const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(bearer || "");
      if (!claims.sub?.startsWith("guest-") || claims.video?.room !== parentRoom || !guestMetadata(claims.metadata || "", studioId)) return json({ error: "Нет доступа к этому разговору" }, 403);
      guestIdentity = claims.sub;
    } catch { return json({ error: "Недействительный токен гостя" }, 401); }
  } else if (!await staff(request, room, studioId)) return json({ error: "Нужен доступ персонала" }, 401);
  const roomRecord = (await readRooms(studioId)).find(value => value.name === room);
  if (!roomRecord) return json({ error: "Комната не найдена" }, 404);
  const roomAssociation = JSON.stringify([roomRecord.creatorAccessId || roomRecord.transferRoomId || roomRecord.guestInviteVersion || "", roomRecord.studioPasswordHash || "", roomRecord.passwordHash || ""]);
  if (!guestIdentity && !validStudioClient(body.clientId)) return json({ error: "Недопустимый клиент" }, 400);
  const limit = consumeRateLimit(request, { scope: "private-talkback", limit: 180, windowMs: 60_000, subject: `${parentRoom}:${guestIdentity || body.clientId}` });
  if (!limit.ok) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) });
  await loadPrivateTalkbackSessions();
  return serializeTalkback(async () => {
    let pruned = false;
    for (const expired of Array.from(privateTalkbackSessions.values())) {
      if (expired.endedAt) { if (expired.endedAt <= Date.now() - 15 * 60_000) { privateTalkbackSessions.delete(expired.id); pruned = true; } continue; }
      if (expired.closing || expired.expiresAt <= Date.now() || expired.parentRoom === parentRoom && expired.roomAssociation !== roomAssociation) await closePrivateTalkbackSession(expired, lk);
    }
    if (pruned) await savePrivateTalkbackSessions();
    if (method === "GET") {
      const session = Array.from(privateTalkbackSessions.values()).find(value => !value.endedAt && value.parentRoom === parentRoom && value.target === guestIdentity);
      if (!session || !await validateSession(session, lk)) return json({ active: false });
      return json(await offer(session, true));
    }
    if (method === "DELETE" || body.action === "heartbeat") {
      const session = typeof body.sessionId === "string" ? privateTalkbackSessions.get(body.sessionId) : undefined;
      if (!session) return method === "DELETE" ? json({ ok: true, restoreMicrophone: false }) : json({ error: "Разговор завершён" }, 409);
      if (session.roomAssociation !== roomAssociation) return method === "DELETE" ? json({ ok: true, restoreMicrophone: false }) : json({ error: "Комната изменилась" }, 409);
      if (session.parentRoom !== parentRoom) return json({ error: "Нет доступа к этому разговору" }, 403);
      if (guestIdentity ? session.target !== guestIdentity : session.clientId !== body.clientId) return json({ error: "Нет доступа к этому разговору" }, 403);
      if (method === "DELETE") { await closePrivateTalkbackSession(session, lk); return json({ ok: true, restoreMicrophone: session.restoreMicrophone }); }
      if (!await validateSession(session, lk)) return json({ error: "Разговор завершён" }, 409);
      session.expiresAt = Date.now() + PRIVATE_TALKBACK_LEASE_MS; await savePrivateTalkbackSessions(); armExpiry(session);
      return json({ active: true, sessionId: session.id });
    }
    if (body.action !== undefined && body.action !== "start") return json({ error: "Неизвестная команда" }, 400);
    const target = typeof body.target === "string" ? body.target : "";
    if (!target.startsWith("guest-") || target.length > 200) return json({ error: "Выберите гостя" }, 400);
    let participant;
    try { participant = await lk.getParticipant(parentRoom, target); } catch { return json({ error: "Гость отключён" }, 409); }
    if (!guestMetadata(participant.metadata, studioId)) return json({ error: "Выберите гостя своей комнаты" }, 403);
    // One private conversation per guest and per staff client; stale leases are cleaned first.
    for (const previous of Array.from(privateTalkbackSessions.values())) {
      if (previous.endedAt || previous.parentRoom !== parentRoom || previous.target !== target && previous.clientId !== body.clientId) continue;
      if (await validateSession(previous, lk)) return json({ error: "Приватный разговор уже идёт" }, 409);
    }
    const id = randomUUID(), session: PrivateTalkbackSession = {
      id, studioId, room, roomAssociation, parentRoom, roomName: `castlink-private-${id}`, clientId: String(body.clientId), target, targetSid: participant.sid,
      staffIdentity: `private-staff-${randomUUID()}`, guestIdentity: `private-guest-${randomUUID()}`, staffName: "Студия",
      restoreMicrophone: participant.tracks.some(track => track.source === TrackSource.MICROPHONE && !track.muted),
      originalPermission: participant.permission ? { ...participant.permission } : { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [] },
      expiresAt: Date.now() + PRIVATE_TALKBACK_LEASE_MS,
    };
    privateTalkbackSessions.set(id, session);
    try {
      await savePrivateTalkbackSessions();
      await lk.createRoom({ name: session.roomName, maxParticipants: 2, emptyTimeout: 60, departureTimeout: 10 });
      for (const track of participant.tracks) if (track.source === TrackSource.MICROPHONE) await lk.mutePublishedTrack(parentRoom, target, track.sid, true);
      const allowedSources = session.originalPermission.canPublishSources?.length ? session.originalPermission.canPublishSources : [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
      const restrictedSources = allowedSources.filter(source => source !== TrackSource.MICROPHONE);
      await lk.updateParticipant(parentRoom, target, { permission: { ...session.originalPermission, canPublish: restrictedSources.length > 0 && session.originalPermission.canPublish !== false, canPublishSources: restrictedSources } });
      armExpiry(session);
      return json(await offer(session, false));
    } catch (error) { try { await closePrivateTalkbackSession(session, lk); } catch { armExpiry(session); } throw error; }
  });
}
export async function GET(request: NextRequest) {
  try { return await handle(request, { studioId: request.nextUrl.searchParams.get("studioId"), room: request.nextUrl.searchParams.get("room") }, "GET"); }
  catch { return json({ error: "Не удалось проверить приватный разговор" }, 502); }
}
export async function POST(request: NextRequest) {
  try { return await handle(request, await request.json(), "POST"); }
  catch { return json({ error: "Не удалось начать приватный разговор" }, 502); }
}
export async function DELETE(request: NextRequest) {
  try { return await handle(request, await request.json(), "DELETE"); }
  catch { return json({ error: "Не удалось завершить приватный разговор" }, 502); }
}
