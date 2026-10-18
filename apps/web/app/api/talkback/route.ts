import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { canHostNamedRoom } from "@/lib/room-studio-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { validStudioClient, readStudioState } from "@/lib/studio-control";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { PRIVATE_TALKBACK_LEASE_MS, privateTalkbackSessions, closePrivateTalkbackSession, loadPrivateTalkbackSessions, savePrivateTalkbackSessions, beginPrivateTalkbackReply, endPrivateTalkbackReply, serializeTalkback, type PrivateTalkbackSession } from "../../../lib/talkback-session";

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
function panelMetadata(value: string, studioId: string, clientId: string) {
  try {
    const metadata = JSON.parse(value || "{}");
    return metadata.role === "studio-moderator" && metadata.studioId === studioId && metadata.clientId === clientId && ["admin", "moderator"].includes(metadata.panelMode) && ["admin", "moderator", "room-moderator"].includes(metadata.accessRole);
  } catch { return false; }
}
async function validateSession(session: PrivateTalkbackSession, lk: RoomServiceClient) {
  if (session.endedAt) return false;
  if (session.policyVersion !== 2 || session.closing || session.expiresAt <= Date.now()) { await closePrivateTalkbackSession(session, lk); return false; }
  try {
    const participant = await lk.getParticipant(session.parentRoom, session.target);
    const actor = await lk.getParticipant(session.parentRoom, session.actorIdentity!);
    const studio = await readStudioState(session.parentRoom);
    if (participant.sid === session.targetSid && guestMetadata(participant.metadata, session.studioId) && actor.sid === session.actorSid && panelMetadata(actor.metadata, session.studioId, session.clientId) && !(studio.primaryClientId === session.clientId && studio.leaseUntil > Date.now())) {
      if (session.reply?.active) await lk.getParticipant(session.roomName, session.guestIdentity);
      return true;
    }
  } catch { /* Missing or replaced participant ends this exact session. */ }
  await closePrivateTalkbackSession(session, lk); return false;
}
async function offer(session: PrivateTalkbackSession, guest: boolean) {
  const identity = guest ? session.guestIdentity : session.staffIdentity;
  const token = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity, name: guest ? "Гость: приватный разговор" : session.staffName, ttl: "60s",
    metadata: JSON.stringify({ role: "private-talkback", studioId: session.studioId, sessionId: session.id }),
  });
  // A reusable guest JWT must never re-enable publishing after reply-end restores the programme microphone.
  // Only reply-begin grants the currently connected private participant permission to publish.
  token.addGrant({ roomJoin: true, room: session.roomName, canPublish: !guest, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
  return { active: true, sessionId: session.id, token: await token.toJwt(), roomName: session.roomName, identity, staffName: session.staffName };
}
async function handle(request: NextRequest, body: Record<string, unknown>, method: "GET" | "POST" | "DELETE") {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  let studioId: string;
  try { studioId = validateStudioId(typeof body.studioId === "string" && body.studioId ? body.studioId : defaultStudioId()); } catch { return json({ error: "Некорректный studioId" }, 400); }
  const room = typeof body.room === "string" ? body.room : "";
  if (!room || room.length > 100) return json({ error: "Некорректная комната" }, 400);
  const parentRoom = mediaRoomName(studioId, room), lk = client();
  let guestIdentity: string | undefined;
  let actor: { identity: string; sid: string; name?: string; metadata: string } | undefined;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let claims;
  try { claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(bearer || ""); }
  catch { return json({ error: "Недействительный токен участника" }, 401); }
  if (claims.video?.room !== parentRoom) return json({ error: "Нет доступа к этой комнате" }, 403);
  const guestRequest = method === "GET" || body.action === "reply-begin" || body.action === "reply-end" || method === "DELETE" && claims.sub?.startsWith("guest-");
  if (guestRequest) {
    if (!claims.sub?.startsWith("guest-") || !guestMetadata(claims.metadata || "", studioId)) return json({ error: "Нет доступа к этому разговору" }, 403);
    guestIdentity = claims.sub;
  } else {
    if (!await staff(request, room, studioId)) return json({ error: "Нужен доступ персонала" }, 401);
    if (!claims.sub?.startsWith("studio-moderator-") || typeof body.clientId !== "string" || !validStudioClient(body.clientId) || !panelMetadata(claims.metadata || "", studioId, body.clientId)) return json({ error: "Приватная связь доступна только панели администратора или модератора" }, 403);
    try {
      const current = await lk.getParticipant(parentRoom, claims.sub), studio = await readStudioState(parentRoom);
      if (!panelMetadata(current.metadata, studioId, body.clientId) || studio.primaryClientId === body.clientId && studio.leaseUntil > Date.now()) return json({ error: "Основная студия не участвует в приватной связи" }, 403);
      actor = current;
    } catch { return json({ error: "Панель персонала отключена" }, 409); }
  }
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
      if (expired.policyVersion !== 2 || expired.closing || expired.expiresAt <= Date.now() || expired.parentRoom === parentRoom && expired.roomAssociation !== roomAssociation) await closePrivateTalkbackSession(expired, lk);
    }
    if (pruned) await savePrivateTalkbackSessions();
    if (method === "GET") {
      const session = Array.from(privateTalkbackSessions.values()).find(value => !value.endedAt && value.parentRoom === parentRoom && value.target === guestIdentity);
      if (!session || !await validateSession(session, lk)) return json({ active: false });
      return json(await offer(session, true));
    }
    if (method === "DELETE" || body.action === "heartbeat" || body.action === "reply-begin" || body.action === "reply-end") {
      const session = typeof body.sessionId === "string" ? privateTalkbackSessions.get(body.sessionId) : undefined;
      if (!session) return method === "DELETE" ? json({ ok: true }) : json({ error: "Разговор завершён", restoreMicrophone: false }, 409);
      if (session.parentRoom !== parentRoom || session.roomAssociation !== roomAssociation) return json({ error: "Комната изменилась", restoreMicrophone: false }, 409);
      if (guestIdentity ? session.target !== guestIdentity : session.clientId !== body.clientId || session.actorIdentity !== actor?.identity || session.actorSid !== actor?.sid) return json({ error: "Нет доступа к этому разговору" }, 403);
      if (method === "DELETE") { await closePrivateTalkbackSession(session, lk); return json({ ok: true }); }
      if (!await validateSession(session, lk)) return json({ error: "Разговор завершён. Микрофон эфира оставлен выключенным.", restoreMicrophone: false }, 409);
      if (body.action === "reply-begin") {
        const replyId = await beginPrivateTalkbackReply(session, randomUUID(), lk);
        return json({ ok: true, replyId });
      }
      if (body.action === "reply-end") {
        if (body.replyId !== undefined && body.replyId !== session.reply?.id) return json({ error: "Приватный ответ уже сменился", restoreMicrophone: false }, 409);
        const restoreMicrophone = await endPrivateTalkbackReply(session, lk, true);
        return json({ ok: true, restoreMicrophone });
      }
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
      staffIdentity: `private-staff-${randomUUID()}`, guestIdentity: `private-guest-${randomUUID()}`, staffName: actor?.name || "Персонал",
      policyVersion: 2, actorIdentity: actor!.identity, actorSid: actor!.sid, restoreMicrophone: false, originalPermission: {},
      expiresAt: Date.now() + PRIVATE_TALKBACK_LEASE_MS,
    };
    privateTalkbackSessions.set(id, session);
    try {
      await savePrivateTalkbackSessions();
      await lk.createRoom({ name: session.roomName, maxParticipants: 2, emptyTimeout: 60, departureTimeout: 10 });
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
