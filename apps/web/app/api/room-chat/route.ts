import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { canHostNamedRoom } from "@/lib/room-studio-access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { readRooms, type RoomRecord } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { appendRoomChatSnapshot, clearRoomChat, readRoomChatSnapshot, RoomChatGenerationConflict, ROOM_CHAT_RETENTION_MS } from "@/lib/room-chat-store";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyRoomChatToken, issueRoomChatToken } from "@/lib/room-chat-auth";
import { managedGuestIdentity } from "@/lib/guest-admission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
// Matches the signed field issued by /api/token. A recreated room cannot inherit history access.
const association = (room: RoomRecord) => room.creatorAccessId || room.slotAssociationId || room.guestInviteVersion || JSON.stringify([room.name, room.passwordHash || "legacy"]);
const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 120);
class ClearAccessError extends Error {
  constructor(public readonly status: number) { super(status === 409 ? "Комната изменилась" : "Нет доступа к очистке чата"); }
}

async function canClear(request: NextRequest, current: Awaited<ReturnType<typeof context>>) {
  return await canHostNamedRoom(request, current.roomName, current.studioId) ||
    await isRoomAdmin(request, current.roomName, current.studioId) || await isModerator(request, current.roomName, current.studioId);
}

async function context(request: NextRequest) {
  const roomName = request.nextUrl.searchParams.get("room") || "";
  if (!roomName || roomName.length > 100) throw new Error("scope");
  const studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId());
  const record = (await readRooms(studioId)).find(room => room.name === roomName);
  if (!record) throw new Error("scope");
  return { roomName, studioId, scope: { studioId, roomAssociation: association(record) } };
}

async function liveAuthor(request: NextRequest, current: Awaited<ReturnType<typeof context>>, renewing = false) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!token || !key || !secret) return null;
  try {
    const verified = await verifyRoomChatToken(token, key, secret, renewing);
    if (!verified) return null;
    const { claims, metadata } = verified;
    if (!claims.sub || !["guest", "studio-panel", "studio-moderator"].includes(metadata.role) ||
        claims.video?.room !== mediaRoomName(current.studioId, current.roomName) || !metadata.roomChatOnly && claims.video?.canPublishData === false ||
        metadata.studioId !== current.studioId || metadata.roomDisplayName !== current.roomName || metadata.roomChatAssociation !== current.scope.roomAssociation) return null;
    if (renewing && metadata.role !== "guest") return null;
    // Removing a LiveKit participant is best effort. Revalidate staff cookies as
    // well so revoked grants cannot survive through a still-connected/replayed JWT.
    if (metadata.role !== "guest" && !await canHostNamedRoom(request, current.roomName, current.studioId) &&
        !await isRoomAdmin(request, current.roomName, current.studioId) && !await isModerator(request, current.roomName, current.studioId)) return null;
    const client = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, secret);
    const participant = await client.getParticipant(claims.video.room, claims.sub);
    const live = JSON.parse(participant.metadata || "{}");
    if (!participant.sid || participant.identity !== claims.sub || participant.permission?.canPublishData === false ||
        live.role !== metadata.role || live.studioId !== current.studioId || live.roomChatAssociation !== current.scope.roomAssociation) return null;
    if (renewing || metadata.roomChatOnly) {
      if (typeof metadata.transferSessionId !== "string" || !metadata.transferSessionId || live.transferSessionId !== metadata.transferSessionId) return null;
    }
    if (metadata.role === "guest") {
      const managed = await managedGuestIdentity(current.scope, claims.sub);
      if (managed && managed.state !== "admitted") return null;
    }
    return { identity: claims.sub, name: cleanName(participant.name || claims.name || claims.sub), metadata };
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Недопустимый источник запроса" }, 403);
  try {
    const current = await context(request);
    if (request.nextUrl.searchParams.get("credential") === "1") {
      const author = await liveAuthor(request, current, true);
      if (!author) return reply({ error: "Нет действующей гостевой сессии" }, 401);
      const limit = consumeRateLimit(request, { scope: "room-chat-credential", subject: author.identity, limit: 30, windowMs: 60000 });
      if (!limit.ok) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) });
      const token = await issueRoomChatToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, author.identity, author.name, mediaRoomName(current.studioId, current.roomName), author.metadata);
      return reply({ token, identity: author.identity });
    }
    const staff = await canHostNamedRoom(request, current.roomName, current.studioId) || await isRoomAdmin(request, current.roomName, current.studioId);
    const download = request.nextUrl.searchParams.get("format") === "txt";
    if (download ? !staff : !staff && !await liveAuthor(request, current)) return reply({ error: "Нет доступа к истории чата" }, 403);
    const now = Date.now(), { messages, generation } = await readRoomChatSnapshot(current.scope, now);
    if (download) {
      const lines = messages.map(message => `[${new Date(message.timestamp).toISOString()}] ${cleanName(message.name || message.identity)}: ${message.message.replace(/\r?\n/g, "\r\n  ")}`);
      const content = `\ufeffCastLink · ${current.roomName}\r\n${new Date(now - ROOM_CHAT_RETENTION_MS).toISOString()} — ${new Date(now).toISOString()}\r\n\r\n${lines.join("\r\n")}`;
      return new NextResponse(content, { headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="castlink-chat-24h.txt"', "X-Content-Type-Options": "nosniff" } });
    }
    return reply({ messages, generation, from: now - ROOM_CHAT_RETENTION_MS, to: now });
  } catch { return reply({ error: "Не удалось загрузить историю чата" }, 503); }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Недопустимый источник запроса" }, 403);
  if (Number(request.headers.get("content-length")) > 32000) return reply({ error: "Слишком длинное сообщение" }, 413);
  try {
    const current = await context(request);
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) return reply({ error: "Необходим токен комнаты" }, 401);
    const author = await liveAuthor(request, current);
    if (!author) return reply({ error: "Нет действующего подключения к комнате" }, 401);
    const limit = consumeRateLimit(request, { scope: "room-chat-send", subject: `${current.studioId}:${author.identity}`, limit: 120, windowMs: 60000 });
    if (!limit.ok) return NextResponse.json({ error: "Слишком много сообщений" }, { status: 429, headers: rateLimitHeaders(limit) });
    const raw = await request.text();
    if (raw.length > 32000) return reply({ error: "Слишком длинное сообщение" }, 413);
    let data; try { data = JSON.parse(raw); } catch { return reply({ error: "Некорректное сообщение" }, 400); }
    if (!data || typeof data.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id) || typeof data.message !== "string" || !data.message.trim() || data.message.length > 4000 ||
        data.generation !== undefined && (!Number.isSafeInteger(data.generation) || data.generation < 0)) return reply({ error: "Некорректное сообщение" }, 400);
    // Recheck the persistent generation after the LiveKit request.
    const latest = await context(request);
    if (latest.scope.roomAssociation !== current.scope.roomAssociation) return reply({ error: "Комната изменилась" }, 409);
    const result = await appendRoomChatSnapshot(current.scope, { id: data.id, message: data.message.trim(), identity: author.identity, name: author.name }, data.generation);
    return reply(result);
  } catch (error) {
    if (error instanceof RoomChatGenerationConflict) return reply({ error: "Чат был очищен. Повторите отправку сообщения", generation: error.generation }, 409);
    return reply({ error: "Не удалось сохранить сообщение" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Недопустимый источник запроса" }, 403);
  try {
    const current = await context(request);
    if (!await canClear(request, current)) return reply({ error: "Нет доступа к очистке чата" }, 403);
    const limit = consumeRateLimit(request, { scope: "room-chat-clear", subject: `${current.studioId}:${current.scope.roomAssociation}`, limit: 30, windowMs: 60000 });
    if (!limit.ok) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) });
    const snapshot = await clearRoomChat(current.scope, Date.now(), async () => {
      // The queue may wait for a pending write. Revalidate the live room and
      // cookie grant inside that queue so revoked staff cannot clear afterward.
      const latest = await context(request);
      if (latest.scope.roomAssociation !== current.scope.roomAssociation) throw new ClearAccessError(409);
      if (!await canClear(request, latest)) throw new ClearAccessError(403);
    });
    return reply(snapshot);
  } catch (error) {
    if (error instanceof ClearAccessError) return reply({ error: error.message }, error.status);
    return reply({ error: "Не удалось очистить чат" }, 503);
  }
}
