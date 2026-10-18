import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { readRooms, updateRooms, type RoomRecord } from "@/lib/room-store";
import { canHostRoom, verifiedRoomStudioSession } from "@/lib/room-studio-access";
import { isRoomAdmin, verifiedRoomAdminSession, setRoomAdminCookie } from "@/lib/room-admin";
import { moderatorTransferVersion, createRoomModeratorInvite, acceptRoomModeratorInvite, setRoomModeratorCookie, revokeRoomModeratorSession } from "@/lib/moderator-access";
import { studioOwnerSessionExpiresAt, studioOwnerTransferVersion, studioOwnerTransferVersionCurrent } from "@/lib/studio-owner-access";
import { defaultStudioId, validateStudioId, mediaRoomName } from "@/lib/studio-scope";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createParticipantRoleOffer, readParticipantRoleOffer, findParticipantRoleOffer, consumeParticipantRoleOffer } from "../../../lib/participant-role-store";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function association(studioId: string, record: RoomRecord) {
  return JSON.stringify([record.name, record.creatorAccessId || record.transferRoomId || record.guestInviteVersion || "", record.studioPasswordHash, record.passwordHash, record.adminAccessVersion, await moderatorTransferVersion(record.name, studioId, record.creatorAccessId)]);
}
async function participant(studioId: string, room: string, identity: string) {
  const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  const current = await lk.getParticipant(mediaRoomName(studioId, room), identity);
  const metadata = JSON.parse(current.metadata || "{}");
  if (!identity.startsWith("guest-") || metadata.role !== "guest" || metadata.studioId !== studioId || !current.sid) throw Error("Гость больше не подключён");
  return current;
}
async function handle(request: NextRequest, data: Record<string, unknown>, get = false) {
  if (!sameOrigin(request)) return reply({ error: "Недопустимый источник запроса" }, 403);
  let studioId: string;
  try { studioId = validateStudioId(typeof data.studioId === "string" && data.studioId ? data.studioId : defaultStudioId()); } catch { return reply({ error: "Некорректный studioId" }, 400); }
  const room = typeof data.room === "string" ? data.room : "";
  if (!room || room.length > 100) return reply({ error: "Некорректная комната" }, 400);
  let record = (await readRooms(studioId)).find(value => value.name === room);
  if (!record) return reply({ error: "Комната не найдена" }, 404);
  const limit = consumeRateLimit(request, { scope: "participant-role", limit: 180, windowMs: 60_000, subject: `${studioId}:${room}` });
  if (!limit.ok) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) });
  if (data.action === "offer") {
    if (data.role !== "admin" && data.role !== "moderator") return reply({ error: "Недопустимая роль" }, 400);
    const owner = await canHostRoom(request, record, studioId);
    if (!owner && (data.role === "admin" || !await isRoomAdmin(request, room, studioId))) return reply({ error: "Недостаточно прав" }, 403);
    if (typeof data.identity !== "string" || !/^guest-[A-Za-z0-9_-]{1,180}$/.test(data.identity) || typeof data.participantSid !== "string") return reply({ error: "Некорректная сессия гостя" }, 400);
    let target; try { target = await participant(studioId, room, data.identity); } catch { return reply({ error: "Гость больше не подключён" }, 409); }
    if (target.sid !== data.participantSid) return reply({ error: "Гость переподключился" }, 409);
    const creator = verifiedRoomStudioSession(request, record, studioId);
    const ownerVersion = owner && !creator ? await studioOwnerTransferVersion(request, studioId) : undefined;
    const issuer = owner ? creator?.exp || await studioOwnerSessionExpiresAt(request, studioId) : (await verifiedRoomAdminSession(request, room, studioId))?.exp;
    if (!issuer || issuer <= Date.now()) return reply({ error: "Доступ выдавшего назначение истёк" }, 403);
    const expected = record;
    if (data.role === "admin" && !record.adminAccessVersion) {
      const updated = await updateRooms(current => {
        const latest = current.find(value => value.name === room);
        if (!isDeepStrictEqual(latest, expected)) throw Error("Комната изменилась");
        return current.map(value => value === latest ? { ...value, adminAccessVersion: randomUUID() } : value);
      }, studioId);
      record = updated.find(value => value.name === room)!;
    }
    const captured = await association(studioId, record);
    const latest = (await readRooms(studioId)).find(value => value.name === room);
    if (!latest || !isDeepStrictEqual(latest, record)) return reply({ error: "Комната изменилась" }, 409);
    const offer = createParticipantRoleOffer({ studioId, room, association: captured, identity: data.identity, participantSid: target.sid, role: data.role, grantExpiresAt: Math.min(issuer, Date.now() + 86400_000), ...(ownerVersion ? { ownerVersion } : {}) });
    return reply({ ok: true, id: offer.id, role: offer.role, expiresAt: offer.expiresAt });
  }
  let identity: string;
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(token), metadata = JSON.parse(claims.metadata || "{}");
    if (!claims.sub?.startsWith("guest-") || claims.video?.room !== mediaRoomName(studioId, room) || metadata.role !== "guest" || metadata.studioId !== studioId || typeof data.identity === "string" && data.identity !== claims.sub) return reply({ error: "Нет доступа к назначению" }, 403);
    identity = claims.sub;
  } catch { return reply({ error: "Недействительная сессия гостя" }, 401); }
  let target; try { target = await participant(studioId, room, identity); } catch { return get ? reply({}) : reply({ error: "Гость отключён" }, 409); }
  const offer = get ? findParticipantRoleOffer(studioId, room, identity, target.sid) : typeof data.id === "string" ? readParticipantRoleOffer(data.id) : undefined;
  if (!offer) return get ? reply({}) : reply({ error: "Назначение истекло или уже принято" }, 409);
  if (offer.studioId !== studioId || offer.room !== room || offer.identity !== identity || offer.participantSid !== target.sid) return reply({ error: "Назначение относится к другой сессии" }, 409);
  const latest = (await readRooms(studioId)).find(value => value.name === room);
  if (!latest || await association(studioId, latest) !== offer.association || offer.ownerVersion && !await studioOwnerTransferVersionCurrent(offer.ownerVersion, studioId)) { consumeParticipantRoleOffer(offer.id); return get ? reply({}) : reply({ error: "Назначение отозвано" }, 409); }
  if (get) return reply({ offer: { id: offer.id, role: offer.role, expiresAt: offer.expiresAt } });
  if (data.action !== "accept" && data.action !== "decline") return reply({ error: "Недопустимая команда" }, 400);
  if (consumeParticipantRoleOffer(offer.id) !== offer) return reply({ error: "Назначение уже принято" }, 409);
  if (data.action === "decline") return reply({ ok: true });
  const response = reply({ allowed: true, role: offer.role, panelPath: `/${offer.role === "admin" ? "admin" : "moderator"}?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(room)}` });
  if (offer.role === "admin") setRoomAdminCookie(response, request, room, latest.adminAccessVersion!, offer.grantExpiresAt, studioId);
  else {
    const invite = await createRoomModeratorInvite(room, studioId, latest.creatorAccessId);
    const session = await acceptRoomModeratorInvite(room, invite.id, Math.min(invite.expiresAt, offer.grantExpiresAt), studioId, latest.creatorAccessId);
    const finalRecord = (await readRooms(studioId)).find(value => value.name === room);
    const unchanged = !!finalRecord && await association(studioId, finalRecord) === offer.association;
    let finalTarget;
    if (unchanged) try { finalTarget = await participant(studioId, room, identity); } catch { /* Connection vanished during credential writes. */ }
    if (!unchanged || finalTarget?.sid !== offer.participantSid || offer.expiresAt <= Date.now() || offer.grantExpiresAt <= Date.now()) {
      await revokeRoomModeratorSession(room, session.id, studioId, latest.creatorAccessId).catch(() => undefined);
      return reply({ error: "Назначение истекло или сессия гостя изменилась" }, 409);
    }
    setRoomModeratorCookie(response, request, room, session.id, session.expiresAt, studioId);
  }
  return response;
}
export async function GET(request: NextRequest) { try { return await handle(request, { studioId: request.nextUrl.searchParams.get("studioId"), room: request.nextUrl.searchParams.get("room"), identity: request.nextUrl.searchParams.get("identity") }, true); } catch { return reply({ error: "Не удалось проверить назначение" }, 503); } }
export async function POST(request: NextRequest) { try { const raw = await request.text(); if (raw.length > 4096) return reply({ error: "Запрос слишком большой" }, 413); const data = JSON.parse(raw); if (!data || typeof data !== "object" || Array.isArray(data)) return reply({ error: "Некорректный запрос" }, 400); return await handle(request, data); } catch { return reply({ error: "Не удалось изменить роль" }, 503); } }
