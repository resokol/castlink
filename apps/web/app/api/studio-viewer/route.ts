import { localNodeAdmission } from "../../../lib/node-admission";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { accessStudioMatches, isStudio, readAccess, roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { readStudioState, validStudioClient } from "@/lib/studio-control";
import { ensureRoomAccessVersions, readRooms, updateRooms, invalidateDiagnosticReceipts } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { isStudioOwner } from "../../../lib/studio-owner-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const answer = (body: object, status = 200) => NextResponse.json(body, { status, headers });
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return answer({ error: "Недопустимый источник запроса" }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 8192) return answer({ error: "Запрос слишком большой" }, 413);
    const data = JSON.parse(raw);
    if (typeof data.room !== "string") return answer({ error: "Не указана комната" }, 400);
    let studioId: string;
    try { studioId = validateStudioId(typeof data.studioId === "string" && data.studioId.trim() ? data.studioId : defaultStudioId()); }
    catch { return answer({ error: "Некорректный studioId" }, 400); }
    let record = (await readRooms(studioId)).find(item => item.name === data.room);
    if (!record) return answer({ error: "Комната не найдена" }, 404);
    if (data.action === "create" || data.action === "revoke") {
      if (!(await isStudioOwner(request, studioId)) && !await isRoomAdmin(request, record.name, studioId)) return answer({ error: "Ссылку выдаёт студия или администратор комнаты" }, 403);
      if (data.action === "revoke") {
        const version = randomUUID();
        await updateRooms(rooms => rooms.map(item => item.name === record!.name ? { ...item, viewerAccessVersion: version } : item), studioId);
        return answer({ ok: true });
      }
      await invalidateDiagnosticReceipts(studioId, record.name);
      if (!record.viewerAccessVersion) record = await ensureRoomAccessVersions(record.name, studioId) || record;
      const invite = signAccess({ kind: "studio-viewer", studio: studioId, room: record.name, version: record.viewerAccessVersion || roomVersion(record.passwordHash) }, 30 * 86400);
      return answer({ path: `/watch?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(record.name)}#invite=${encodeURIComponent(invite)}`, expiresAt: Date.now() + 30 * 86400_000 });
    }
    const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
    if (!key || !secret) return answer({ error: "Медиасервер не настроен" }, 503);
    const viewingRoom = `castlink-view-${roomVersion(studioId + ":" + record.name + ":" + roomVersion(record.passwordHash)).slice(0, 32)}`;
    const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, secret);
    if (process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1") {
      const admission=await localNodeAdmission(viewingRoom);
      if(!admission.allowed) return answer({error:"Нода не принимает подключения"},503);
    }
    if (data.action === "publisher") {
      if (!(await isStudioOwner(request, studioId)) || !validStudioClient(data.clientId)) return answer({ error: "Поток передаёт основная студия" }, 403);
      const state = await readStudioState(mediaRoomName(studioId, record.name));
      if (state.primaryClientId !== data.clientId || state.epoch !== data.epoch || state.leaseUntil <= Date.now()) return answer({ error: "Нет активной сессии основной студии" }, 403);
      let participants: Awaited<ReturnType<typeof lk.listParticipants>> = [];
      try { participants = await lk.listParticipants(viewingRoom); }
      catch (error: any) { if (error?.status === 404 || error?.code === "not_found") participants = []; else throw error; }
      const viewerCount = participants.filter(p => p.identity.startsWith("stream-viewer-")).length;
      if (!viewerCount) return answer({ viewerCount: 0, room: viewingRoom });
      const publisher = new AccessToken(key, secret, { identity: "studio-panel-main", name: "Studio Return", ttl: "5m", metadata: JSON.stringify({ role: "stream-publisher", studioId }) });
      publisher.addGrant({ room: viewingRoom, roomJoin: true, canPublish: true, canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE], canPublishData: false, canSubscribe: false });
      return answer({ viewerCount, room: viewingRoom, token: await publisher.toJwt() });
    }
    const invite = typeof data.invite === "string" ? readAccess(data.invite) : null;
    if (invite?.kind !== "studio-viewer" || invite.room !== record.name || !accessStudioMatches(invite, studioId) || invite.version !== (record.viewerAccessVersion || roomVersion(record.passwordHash))) return answer({ error: "Ссылка просмотра истекла или недействительна" }, 403);
    if (data.action === "join") {
      const identity = `stream-viewer-${randomUUID()}`;
      const token = new AccessToken(key, secret, { identity, name: "Зритель потока студии", ttl: "5m", metadata: JSON.stringify({ role: "studio-viewer", studioId }) });
      token.addGrant({ room: viewingRoom, roomJoin: true, canPublish: false, canPublishData: false, canSubscribe: true });
      return answer({ token: await token.toJwt(), identity });
    }
    if (data.action === "subscribe") {
      const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
      if (!bearer) return answer({ error: "Нет доступа к просмотру" }, 401);
      const claims = await new TokenVerifier(key, secret).verify(bearer);
      const metadata = JSON.parse(claims.metadata || "{}");
      if (!claims.sub?.startsWith("stream-viewer-") || claims.video?.room !== viewingRoom || metadata.role !== "studio-viewer" || metadata.studioId !== studioId) return answer({ error: "Нет доступа к просмотру" }, 403);
      const participants = await lk.listParticipants(viewingRoom);
      const main = participants.find(p => p.identity === "studio-panel-main");
      const tracks = main?.tracks.filter(track => !track.muted).map(track => track.sid) || [];

      let renewed: string | undefined;
      if (!claims.exp || claims.exp * 1000 - Date.now() < 120_000) {
        const next = new AccessToken(key, secret, { identity: claims.sub, name: "Зритель потока студии", ttl: "5m", metadata: JSON.stringify({ role: "studio-viewer", studioId }) });
        next.addGrant({ room: viewingRoom, roomJoin: true, canPublish: false, canPublishData: false, canSubscribe: true });
        renewed = await next.toJwt();
      }
      return answer({ online: !!main, tracks: tracks.length, ...(renewed ? { token: renewed } : {}) });
    }
    return answer({ error: "Неизвестное действие" }, 400);
  } catch { return answer({ error: "Не удалось открыть поток студии" }, 502); }
}
