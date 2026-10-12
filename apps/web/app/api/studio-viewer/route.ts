import { localNodeAdmission } from "../../../lib/node-admission";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { readStudioState, validStudioClient } from "@/lib/studio-control";
import { ensureRoomAccessVersions, readRooms, updateRooms, invalidateDiagnosticReceipts } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { canHostNamedRoom, verifiedRoomStudioSession, requireRoomCreatorUnchanged } from "../../../lib/room-studio-access";

import { studioViewingRoom, studioViewerVersion, verifiedStudioViewerInvite } from "../../../lib/studio-viewer-access";

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
    const creatorAuthorized=!!verifiedRoomStudioSession(request,record,studioId);
    if (data.action === "create" || data.action === "revoke") {
      if (!(await canHostNamedRoom(request, record.name, studioId)) && !await isRoomAdmin(request, record.name, studioId)) return answer({ error: "Ссылку выдаёт студия или администратор комнаты" }, 403);
      if (data.action === "revoke") {
        const version = randomUUID();
        await updateRooms(rooms => {requireRoomCreatorUnchanged(request,record,rooms.find(r=>r.name===record!.name),studioId,creatorAuthorized);return rooms.map(item => item.name === record!.name ? { ...item, viewerAccessVersion: version } : item);}, studioId);
        return answer({ ok: true });
      }
      await invalidateDiagnosticReceipts(studioId, record.name);
      if (!record.viewerAccessVersion) record = await ensureRoomAccessVersions(record.name, studioId) || record;
      const invite = signAccess({ kind: "studio-viewer", studio: studioId, room: record.name, version: record.viewerAccessVersion || roomVersion(record.passwordHash) }, 30 * 86400);
      return answer({ path: `/watch?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(record.name)}#invite=${encodeURIComponent(invite)}`, expiresAt: Date.now() + 30 * 86400_000 });
    }
    const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
    if (!key || !secret) return answer({ error: "Медиасервер не настроен" }, 503);
    let viewingRoom = studioViewingRoom(studioId, record);
    const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, secret);
    if (process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1") {
      const admission=await localNodeAdmission(viewingRoom);
      if(!admission.allowed) return answer({error:"Нода не принимает подключения"},503);
    }
    if (data.action === "publisher") {
      if (!(await canHostNamedRoom(request, record.name, studioId)) || !validStudioClient(data.clientId)) return answer({ error: "Поток передаёт основная студия" }, 403);
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
    let invite = typeof data.invite === "string" ? verifiedStudioViewerInvite(data.invite, studioId, record) : null;
    if (!invite) return answer({ error: "Ссылка просмотра истекла или недействительна" }, 403);
    // Legacy rooms also need a stable association before viewer capabilities are minted.
    if (!record.creatorAccessId && !record.transferRoomId) {
      const previous = record;
      const rooms = await updateRooms(rooms => rooms.map(item => item.name === previous.name && !item.creatorAccessId && !item.transferRoomId ? { ...item, transferRoomId: randomUUID() } : item), studioId);
      record = rooms.find(item => item.name === previous.name)!;
      if (!record) return answer({ error: "Комната не найдена" }, 404);
      invite = verifiedStudioViewerInvite(data.invite, studioId, record);
      if (!invite) return answer({ error: "Ссылка просмотра истекла или недействительна" }, 403);
      viewingRoom = studioViewingRoom(studioId, record);
    }
    const inviteExpiresAt = invite.exp;
    const authorization = {
      kind: "studio-viewer", roomId: record.creatorAccessId || record.transferRoomId!,
      ...(record.creatorAccessId ? { creatorAccessId: record.creatorAccessId } : {}),
      credentialVersion: studioViewerVersion(record), expiresAt: inviteExpiresAt,
    };
    const viewerToken = async (identity: string) => {
      const token = new AccessToken(key, secret, { identity, name: "Зритель потока студии", ttl: Math.min(300, Math.max(1, Math.floor((inviteExpiresAt - Date.now()) / 1000))), metadata: JSON.stringify({ role: "studio-viewer", studioId, transferSessionId: identity.slice("stream-viewer-".length), transferAuthorization: authorization }) });
      token.addGrant({ room: viewingRoom, roomJoin: true, canPublish: false, canPublishData: false, canSubscribe: true, canUpdateOwnMetadata: false });
      return token.toJwt();
    };
    if (data.action === "join") {
      const identity = invite.id || `stream-viewer-${randomUUID()}`;
      return answer({ token: await viewerToken(identity), identity });
    }
    if (data.action === "subscribe") {
      const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
      if (!bearer) return answer({ error: "Нет доступа к просмотру" }, 401);
      const claims = await new TokenVerifier(key, secret).verify(bearer);
      const metadata = JSON.parse(claims.metadata || "{}");
      const signed = metadata.transferAuthorization;
      if (!claims.sub?.startsWith("stream-viewer-") || claims.video?.room !== viewingRoom || metadata.role !== "studio-viewer" || metadata.studioId !== studioId || metadata.transferSessionId !== claims.sub.slice("stream-viewer-".length) || invite.id && invite.id !== claims.sub || !signed || signed.kind !== "studio-viewer" || signed.roomId !== authorization.roomId || signed.creatorAccessId !== authorization.creatorAccessId || signed.credentialVersion !== authorization.credentialVersion || signed.expiresAt !== invite.exp || signed.expiresAt <= Date.now()) return answer({ error: "Нет доступа к просмотру" }, 403);
      const participants = await lk.listParticipants(viewingRoom);
      const main = participants.find(p => p.identity === "studio-panel-main");
      const tracks = main?.tracks.filter(track => !track.muted).map(track => track.sid) || [];
      const renewed = !claims.exp || claims.exp * 1000 - Date.now() < 120_000 ? await viewerToken(claims.sub) : undefined;
      return answer({ online: !!main, tracks: tracks.length, ...(renewed ? { token: renewed } : {}) });
    }
    return answer({ error: "Неизвестное действие" }, 400);
  } catch { return answer({ error: "Не удалось открыть поток студии" }, 502); }
}
