import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin, setAccessCookie, roomVersion } from "@/lib/access";
import { readRooms, updateRooms, type RoomRecord } from "@/lib/room-store";
import { resetStudioForTransfer, readStudioState, validStudioClient } from "@/lib/studio-control";
import { newTicket, peerOriginAllowed, resolveClientTargetUrl, signBridge, ticketHash, transferOriginConfigured, transferRoomKey, transferServer, transferTargets, transferSecret, updateTransferState, verifyBridge, type EligibleGuestSession, type TransferAuthorization } from "@/lib/server-transfer";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { isStudioOwner, setStudioOwnerCookie, studioOwnerSessionExpiresAt } from "../../../lib/studio-owner-access";
import { commitStudioTransfer } from "../../../lib/control-plane-client";
import { requestId, serverLog } from "../../../lib/server-log";
import { canHostRoom, requireRoomCreatorUnchanged, setRoomStudioCookie, verifiedRoomStudioSession } from "../../../lib/room-studio-access";
import { verifiedTransferAuthority, roomTransferCredentialVersion, targetModeratorCredentialVersion } from "../../../lib/transfer-authority";
import { setRoomAdminCookie } from "@/lib/room-admin";
import { acceptRoomModeratorInvite, setRoomModeratorCookie } from "@/lib/moderator-access";

import { currentStudioOwnerAccessVersion } from "../../../lib/control-plane-client";
import { disarmSourceReserve } from "../../../lib/reserve-source";
import { ownTransferSession } from "../../../lib/transfer-sessions";
import { installTransferredRoom, transferLiveKitReady } from "../../../lib/transfer-room";
import { roomTransferTargets, sendPeerBridge, verifyPeerBridge, targetRequest, transferIdentity, transferHealthIdentity } from "../../../lib/transfer-peer";

export const runtime = "nodejs";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
const message = (error: unknown) => error instanceof Error ? error.message : "Не удалось переключить сервер";

function transferSessionFromMetadata(raw: unknown): string | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") throw new Error("Некорректные метаданные участника LiveKit");
  let metadata: any;
  try { metadata = JSON.parse(raw); } catch { throw new Error("Некорректные метаданные участника LiveKit"); }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Некорректные метаданные участника LiveKit");
  if (metadata.role !== undefined && metadata.role !== "guest") return null;
  if (metadata.transferSessionId === undefined) return undefined;
  if (typeof metadata.transferSessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(metadata.transferSessionId)) throw new Error("Некорректный идентификатор гостевой сессии");
  return metadata.transferSessionId;
}
async function captureEligibleGuestSessions(room: string): Promise<EligibleGuestSession[]> {
  const client = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const participants = await Promise.race([
      client.listParticipants(room),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Время ожидания списка участников LiveKit истекло")), 5000); }),
    ]);
    if (!Array.isArray(participants)) throw new Error("LiveKit вернул некорректный список участников");
    const eligible: EligibleGuestSession[] = [];
    for (const participant of participants as any[]) {
      const identity = participant?.identity;
      if (typeof identity !== "string") continue;
      if (identity === "studio-panel-main" || identity.startsWith("studio-moderator-")) {
        let metadata: any; try { metadata = JSON.parse(participant.metadata || "{}"); } catch { throw new Error("Некорректные метаданные персонала LiveKit"); }
        const authorization = metadata?.transferAuthorization as TransferAuthorization | undefined;
        if (!["studio-panel", "studio-moderator"].includes(metadata?.role) || !validStudioClient(metadata.clientId) || !authorization || !["creator", "owner", "admin", "moderator"].includes(authorization.kind) || !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= Date.now()) continue;
        eligible.push({ identity, role: metadata.role, clientId: metadata.clientId, authorization });
        continue;
      }
      if (!identity.startsWith("guest-")) continue;
      const transferSessionId = transferSessionFromMetadata(participant.metadata);
      if (transferSessionId === null) continue;
      eligible.push({ identity, ...(transferSessionId ? { transferSessionId } : {}) });
    }
    return eligible;
  } finally { if (timeout) clearTimeout(timeout); }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  if (action === "health") {
    try { const identity = await transferHealthIdentity(); return json({ enabled: !!identity.origin, ...identity, liveKitReady: await transferLiveKitReady() }); }
    catch { return json({ enabled: false, liveKitReady: false }); }
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) {
    let ownerStudioId: string;
    try { ownerStudioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
    catch { return json({ error: "Некорректный studioId" }, 400); }
    const selectedName = request.nextUrl.searchParams.get("room");
    const selectedRoom = selectedName ? (await readRooms(ownerStudioId)).find(room => room.name === selectedName) : undefined;
    if (!(selectedRoom ? await canHostRoom(request, selectedRoom, ownerStudioId) : await isStudioOwner(request, ownerStudioId))) return new NextResponse(null, { status: 401 });
    try {
      const current = await transferIdentity();
      const targets = await Promise.all((await roomTransferTargets(selectedRoom?.creatorAccessId || selectedRoom?.transferRoomId || "")).map(async target => {
        try {
          const response = await targetRequest(target, "/api/server-transfer?action=health", {timeoutMs:3000});
          const status = await response.json();
          const available = response.ok && status.enabled && status.liveKitReady === true && (target.peer ? status.installationId === target.peer.installationId : status.id === target.id);
          return { id: target.id, label: target.label, origin: target.origin, available, ...(!available ? { reason: response.ok && (target.peer ? status.installationId !== target.peer.installationId : status.id !== target.id) ? "Идентификаторы серверов не совпадают" : "Сервер или LiveKit недоступен" } : {}) };
        } catch { return { id:target.id,label:target.label,origin:target.origin, available: false, reason: "Сервер недоступен" }; }
      }));
      return json({ current, targets });
    } catch (error) { return json({ error: message(error) }, 503); }
  }

  const room = request.nextUrl.searchParams.get("room") || "";
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return json({ error: "Некорректный studioId" }, 400); }
  if (!room) return json({});
  try {
    const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(bearer);
    const identity = claims.sub || "";
    const mediaRoom = mediaRoomName(studioId, room);
    if (claims.video?.room === mediaRoom && (identity === "studio-panel-main" || identity.startsWith("studio-moderator-"))) {
      let metadata: any; try { metadata = JSON.parse(claims.metadata || "{}"); } catch { return new NextResponse(null, { status: 403 }); }
      if (metadata?.studioId !== studioId || !["studio-panel", "studio-moderator"].includes(metadata.role) || !validStudioClient(metadata.clientId)) return new NextResponse(null, { status: 403 });
      const transfer = await updateTransferState(state => state.active[transferRoomKey(studioId, room)]);
      if (!transfer || transfer.exp < Date.now()) return json({});
      const captured = transfer.eligibleSessions?.find(session => session.identity === identity && session.role === metadata.role && session.clientId === metadata.clientId);
      const signed = metadata.transferAuthorization as TransferAuthorization | undefined;
      if (!captured?.authorization || !signed || captured.authorization.kind !== signed.kind || captured.authorization.credentialVersion !== signed.credentialVersion || captured.authorization.creatorAccessId !== signed.creatorAccessId) return json({});
      const record = (await readRooms(studioId)).find(item => item.name === room);
      if (!record || record.transferRoomId !== transfer.roomId) return json({});
      const authorization = await verifiedTransferAuthority(request, record, studioId, signed.kind, Math.min(captured.authorization.expiresAt, signed.expiresAt, typeof claims.exp === "number" ? claims.exp*1000 : Infinity));
      if (!authorization || authorization.credentialVersion !== signed.credentialVersion || authorization.creatorAccessId !== signed.creatorAccessId) return new NextResponse(null, { status: 403 });
      const target = (await roomTransferTargets(transfer.roomId)).find(candidate => candidate.id === transfer.targetId && candidate.origin === transfer.targetUrl);
      if (!target) return json({});
      const role = authorization.kind === "creator" || authorization.kind === "owner" && !metadata.panelMode ? "studio" : authorization.kind === "moderator" ? "moderator" : "admin";
      const issued = await sendPeerBridge(target, { action: "ticket", sourceOrigin: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", roomId:transfer.roomId, transferId: transfer.id, studioId, role, identity, name: claims.name || identity, authorization: { ...authorization, ...(role === "admin" ? { kind: "admin" } : {}) }, primary: metadata.role === "studio-panel" });
      return json({ targetUrl: target.origin, clientTargetUrl: resolveClientTargetUrl(target, request.headers.get("x-forwarded-for")), transferId: transfer.id, ticket: issued.ticket, studioId, room, role, identity, name: claims.name || identity });
    }
    if (!identity.startsWith("guest-") || claims.video?.room !== mediaRoom) return new NextResponse(null, { status: 403 });
    let tokenStudioId = defaultStudioId();
    if (claims.metadata !== undefined) {
      if (typeof claims.metadata !== "string") return json({});
      try {
        const metadata = JSON.parse(claims.metadata);
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || metadata.role !== "guest") return json({});
        tokenStudioId = typeof metadata.studioId === "string" ? validateStudioId(metadata.studioId) : defaultStudioId();
      } catch { return json({}); }
    }
    if (tokenStudioId !== studioId) return new NextResponse(null, { status: 403 });
    const activeKey = transferRoomKey(studioId, room);
    const transfer = await updateTransferState(state => state.active[activeKey]);
    if (!transfer || transfer.exp < Date.now() || !Array.isArray(transfer.eligibleSessions)) return json({});
    let transferSessionId: string | undefined;
    if (claims.metadata !== undefined) {
      if (typeof claims.metadata !== "string") return json({});
      try {
        const metadata = JSON.parse(claims.metadata);
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || metadata.role !== "guest") return json({});
        if (metadata.transferSessionId !== undefined) {
          if (typeof metadata.transferSessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(metadata.transferSessionId)) return json({});
          transferSessionId = metadata.transferSessionId;
        }
      } catch { return json({}); }
    }
    const wasConnected = transfer.eligibleSessions.some(session => session.identity === identity &&
      (transferSessionId ? session.transferSessionId === transferSessionId : !session.transferSessionId));
    if (!wasConnected) return json({});
    if (!transferSessionId) {
      const tokenDate = Number.isFinite(claims.nbf) ? claims.nbf : Number.isFinite(claims.iat) ? claims.iat : undefined;
      if (tokenDate === undefined || !Number.isFinite(transfer.startedAt) || transfer.startedAt! <= 0 || tokenDate * 1000 > transfer.startedAt!) return json({});
    }
    let target;
    try { target = (await roomTransferTargets(transfer.roomId)).find(candidate => candidate.id === transfer.targetId && candidate.origin === transfer.targetUrl); }
    catch { return json({}); }
    if (!target) return json({});
    const currentRoom = (await readRooms(studioId)).find(item => item.name === room);
    if (!currentRoom || currentRoom.transferRoomId !== transfer.roomId) return json({});
    let signedGuest: TransferAuthorization | undefined;
    try { signedGuest = JSON.parse(claims.metadata || "{}").transferAuthorization; } catch { return json({}); }
    const guestAuthorization = await verifiedTransferAuthority(request,currentRoom,studioId,"guest",Math.min(typeof claims.exp === "number" ? claims.exp*1000 : Infinity,signedGuest?.expiresAt ?? Infinity));
    if (!guestAuthorization || signedGuest && (signedGuest.kind !== "guest" || signedGuest.roomId !== transfer.roomId || signedGuest.credentialVersion !== guestAuthorization.credentialVersion || signedGuest.creatorAccessId !== guestAuthorization.creatorAccessId)) return new NextResponse(null,{status:403});
    const clientTargetUrl = resolveClientTargetUrl(target, request.headers.get("x-forwarded-for"));
    const issued = await sendPeerBridge(target, { action: "ticket", sourceOrigin: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", roomId:transfer.roomId, transferId: transfer.id, studioId, role: "guest", identity, name: claims.name || identity, authorization:guestAuthorization });
    return json({ targetUrl: transfer.targetUrl, clientTargetUrl, transferId: transfer.id, ticket: issued.ticket, studioId, room, role: "guest", identity, name: claims.name || identity });
  } catch { return json({}); }
}

export async function POST(request: NextRequest) {
  const reqId = requestId(request), started = Date.now();
  const raw = await request.text();
  if (raw.length > 16_384) return new NextResponse(null, { status: 413 });
  let data: any;
  try { data = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return new NextResponse(null, { status: 400 });
  const action = request.nextUrl.searchParams.get("action") || (typeof data.action === "string" ? data.action : "");
  let studioId: string;
  try { studioId = validateStudioId(typeof data.studioId === "string" && data.studioId.trim() ? data.studioId : defaultStudioId()); }
  catch { return json({ error: "Некорректный studioId" }, 400); }
  if (action === "bridge") {
    const timestamp = request.headers.get("x-studiolink-transfer-time") || "";
    const nonce = request.headers.get("x-studiolink-transfer-nonce") || "";
    const signature = request.headers.get("x-studiolink-transfer-signature") || "";
    const verifiedPeer = await verifyPeerBridge(data,raw,request.headers);
    if (!verifiedPeer) return new NextResponse(null, { status: 401 });
    const fresh = await updateTransferState(state => {
      if (state.nonces[nonce]) return false;
      state.nonces[nonce] = Date.now() + 120_000;
      return true;
    });
    if (!fresh) return new NextResponse(null, { status: 409 });

    if (data.action === "prepare") {
      const record = data.roomRecord as RoomRecord;
      const transferId = String(data.transferId || "");
      const roomId = record?.transferRoomId;
      const ownerExpiresAt = data.ownerExpiresAt;
      const authorization = data.authorization as TransferAuthorization | undefined;
      if (ownerExpiresAt !== undefined && (!Number.isSafeInteger(ownerExpiresAt) || ownerExpiresAt <= Date.now() || ownerExpiresAt > Date.now() + 30 * 86400_000 + 60_000)) return json({ error: "Некорректный срок доступа студии" }, 400);
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(transferId) || !record || typeof record.name !== "string" || !record.name.trim() || record.name.length > 100 || typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(roomId) || (record.passwordHash !== undefined && (typeof record.passwordHash !== "string" || !/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(record.passwordHash))) || (record.studioOnly !== undefined && typeof record.studioOnly !== "boolean")) return json({ error: "Некорректная подготовка комнаты" }, 400);
      if (authorization && (authorization.roomId !== roomId || !["creator", "owner"].includes(authorization.kind) || !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= Date.now() || authorization.expiresAt > Date.now()+30*86400_000+60_000)) return json({ error: "Некорректные полномочия переноса" }, 400);
      if ((record.creatorAccessId !== undefined || record.studioPasswordHash !== undefined) && (typeof record.creatorAccessId !== "string" || !/^[0-9a-f-]{36}$/i.test(record.creatorAccessId) || typeof record.studioPasswordHash !== "string" || !/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(record.studioPasswordHash))) return json({ error: "Некорректные полномочия комнаты" }, 400);
      if (authorization?.kind === "creator" && (authorization.creatorAccessId !== record.creatorAccessId || !record.studioPasswordHash || authorization.credentialVersion !== roomVersion(record.studioPasswordHash))) return json({ error: "Полномочия создателя не совпадают" }, 403);
      if (!await transferLiveKitReady()) return json({ error: "LiveKit целевого сервера недоступен" }, 503);
      const primaryClientId = authorization ? randomUUID() : undefined;
      try { await installTransferredRoom(studioId, record, primaryClientId, data.guestPassword); }
      catch(error) { return json({error:message(error)},409); }
      const targetAuthorization = authorization ? { ...authorization, ...(authorization.kind === "owner" ? {credentialVersion:"scoped:"+await currentStudioOwnerAccessVersion(studioId)}:{}), clientId: primaryClientId } : undefined;
      const issued = newTicket("studio", studioId, record.name, undefined, undefined, ownerExpiresAt, targetAuthorization);
      const targetIdentity = await transferIdentity();
      await updateTransferState(state => {
        state.transfers[transferId] = { studioId, room: record.name, roomId, targetUrl: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", targetId: targetIdentity.id, createdAt: Date.now(), exp: Date.now() + 5 * 60_000, ...(primaryClientId ? { primaryClientId } : {}),...(verifiedPeer.peer?{peerId:verifiedPeer.peer.id}:{}) };
        state.tickets[issued.hash] = issued.ticket;
        delete state.active[transferRoomKey(studioId, record.name)];
      });
      serverLog("info", "transfer.prepare.accepted", { requestId: reqId, studioId, room: record.name, transferId, status: 200, durationMs: Date.now() - started });
      return json({ ok: true, ticket: issued.token });
    }

    if (data.action === "ticket") {
      const transfer = await updateTransferState(state => state.transfers[String(data.transferId || "")]);
      if (!transfer || transfer.exp < Date.now()) return json({ error: "Перенос комнаты истёк" }, 410);
      if (transfer.peerId !== verifiedPeer.peer?.id) return json({error:"Перенос принадлежит другой паре серверов"},403);
      if (!["guest", "studio", "admin", "moderator"].includes(data.role) || typeof data.identity !== "string" || !(data.role === "guest" ? data.identity.startsWith("guest-") : data.identity === "studio-panel-main" || data.identity.startsWith("studio-moderator-")) || typeof data.name !== "string" || data.name.length > 120) return json({ error: "Недопустимая роль" }, 403);
      if (transfer.studioId !== studioId) return json({ error: "Перенос относится к другой студии" }, 403);
      const record = (await readRooms(studioId)).find(room => room.name === transfer.room && room.transferRoomId === transfer.roomId);
      if (!record) return json({ error: "Комната переноса изменилась" }, 409);
      const incoming = data.authorization as TransferAuthorization | undefined;
      if (data.role !== "guest" && !incoming || incoming && (incoming.roomId !== transfer.roomId || !Number.isSafeInteger(incoming.expiresAt) || incoming.expiresAt <= Date.now() || incoming.expiresAt > Date.now()+30*86400_000+60_000 || incoming.creatorAccessId && incoming.creatorAccessId !== record.creatorAccessId)) return json({ error: "Полномочия переноса изменились" }, 403);
      const kind = data.role === "studio" ? incoming?.kind : data.role;
      if (data.role === "studio" && !["creator", "owner"].includes(kind) || incoming && incoming.kind !== kind) return json({ error: "Полномочия не соответствуют роли" }, 403);
      if (kind === "creator" && (!record.studioPasswordHash || incoming?.credentialVersion !== roomVersion(record.studioPasswordHash))) return json({ error: "Доступ создателя изменился" }, 403);
      const authorization: TransferAuthorization = { ...incoming, kind, roomId: transfer.roomId, expiresAt: incoming?.expiresAt ?? transfer.exp, ...(record.creatorAccessId ? { creatorAccessId: record.creatorAccessId } : {}), ...(kind === "owner" ? {credentialVersion:"scoped:"+await currentStudioOwnerAccessVersion(studioId)}:{}), ...(data.role === "studio" ? { clientId: data.primary === true ? transfer.primaryClientId : randomUUID() } : {}), ...(data.role === "guest" ? { credentialVersion: roomVersion(record.passwordHash) } : data.role === "admin" ? { credentialVersion: record.adminAccessVersion } : data.role === "moderator" ? { credentialVersion: await targetModeratorCredentialVersion(record,studioId) } : {}) };
      const issued = newTicket(data.role, studioId, transfer.room, data.identity, data.name, undefined, authorization);
      await updateTransferState(state => { state.tickets[issued.hash] = issued.ticket; });
      return json({ ticket: issued.token });
    }
    return new NextResponse(null, { status: 400 });
  }

  if (action === "accept") {
    if (!request.headers.get("origin") || !sameOrigin(request)) return new NextResponse(null, { status: 403 });
    if (typeof data?.ticket !== "string" || data.ticket.length > 256) return new NextResponse(null, { status: 400 });
    const ticket = await updateTransferState(state => {
      const hash = ticketHash(data.ticket), value = state.tickets[hash];
      if (!value || value.exp < Date.now() || typeof data.studioId === "string" && value.studioId !== studioId) return null;
      delete state.tickets[hash];state.consumed[hash]=Date.now();
      return value;
    });
    if (!ticket) return new NextResponse(null, { status: 401 });
    studioId = validateStudioId(ticket.studioId);
    const room = (await readRooms(studioId)).find(r => r.name === ticket.room);
    if (!room) return new NextResponse(null, { status: 401 });
    const authorization = ticket.authorization;
    if (authorization && (authorization.roomId !== room.transferRoomId || authorization.expiresAt <= Date.now() || authorization.kind === "creator" && (room.creatorAccessId !== authorization.creatorAccessId || !room.studioPasswordHash || roomVersion(room.studioPasswordHash) !== authorization.credentialVersion))) return new NextResponse(null, { status: 401 });
    if (authorization?.kind === "owner" && authorization.credentialVersion !== "scoped:"+await currentStudioOwnerAccessVersion(studioId)) return new NextResponse(null,{status:401});
    if (authorization && (authorization.creatorAccessId && authorization.creatorAccessId !== room.creatorAccessId || authorization.kind === "admin" && authorization.credentialVersion !== room.adminAccessVersion || authorization.kind === "moderator" && authorization.credentialVersion !== await targetModeratorCredentialVersion(room,studioId) || authorization.kind === "guest" && authorization.credentialVersion !== roomVersion(room.passwordHash))) return new NextResponse(null, { status: 401 });
    const response = json({ studioId, room: ticket.room, role: ticket.role, ...(authorization?.kind === "creator" || ticket.role === "guest" && room.creatorAccessId ? { entryPath: "/" } : {}), ...(authorization?.clientId ? { clientId: authorization.clientId } : {}), ...(ticket.identity ? { identity: ticket.identity } : {}), ...(ticket.name ? { name: ticket.name } : {}) });
    if (ticket.role === "studio" && authorization?.kind === "creator") setRoomStudioCookie(response, request, room, studioId, authorization.expiresAt);
    else if (ticket.role === "studio") await setStudioOwnerCookie(response, request, studioId, ticket.ownerExpiresAt ?? authorization?.expiresAt ?? ticket.exp);
    else if (ticket.role === "admin" && authorization && room.adminAccessVersion) setRoomAdminCookie(response, request, room.name, room.adminAccessVersion, authorization.expiresAt, studioId);
    else if (ticket.role === "moderator" && authorization) {
      const session = await acceptRoomModeratorInvite(room.name, randomUUID(), authorization.expiresAt, studioId, room.creatorAccessId);
      setRoomModeratorCookie(response, request, room.name, session.id, session.expiresAt, studioId);
    } else if (ticket.role === "guest") setAccessCookie(response, request, "guest", room.name, room.passwordHash || "", studioId, authorization?.expiresAt);
    else return new NextResponse(null, { status: 401 });
    return response;
  }

  if (!request.headers.get("origin") || !sameOrigin(request)) return new NextResponse(null, { status: 401 });
  if (action !== "start" || typeof data?.room !== "string" || typeof data?.targetId !== "string") return new NextResponse(null, { status: 400 });
  const record = (await readRooms(studioId)).find(r => r.name === data.room);
  if (!record) return await isStudioOwner(request, studioId) ? json({ error: "Комната не найдена" }, 404) : new NextResponse(null, { status: 401 });
  const creatorSession = verifiedRoomStudioSession(request, record, studioId);
  if (!creatorSession && !await isStudioOwner(request, studioId)) return new NextResponse(null, { status: 401 });
  try {
    const own = await ownTransferSession(request,studioId,record.name);
    const current = await readStudioState(mediaRoomName(studioId,record.name));
    if (own.metadata.role !== "studio-panel" || own.metadata.clientId !== data.clientId || current.primaryClientId !== data.clientId || current.leaseUntil <= Date.now() || !["creator","owner"].includes(own.authority.kind)) return json({error:"Перенос запускает только основная студия"},403);
  } catch(error) { return json({error:message(error)},403); }
  let target;
  try { target = (await roomTransferTargets(record.creatorAccessId || record.transferRoomId || "")).find(item => item.id === data.targetId); } catch (error) { return json({ error: message(error) }, 503); }
  if (!target) return json({ error: "Целевой сервер не разрешён" }, 400);
  if (!target.peer && (!transferSecret() || !transferOriginConfigured())) return json({ error: "Не настроена пара серверов" }, 503);
  const ownerExpiresAt = creatorSession?.exp ?? await studioOwnerSessionExpiresAt(request, studioId);
  if (!ownerExpiresAt) return json({ error: "Сеанс студии истёк. Выполните вход снова." }, 401);
  const startedAt = Date.now();
  let eligibleSessions: EligibleGuestSession[];
  try { eligibleSessions = await captureEligibleGuestSessions(mediaRoomName(studioId, record.name)); }
  catch (error) { return json({ error: `Не удалось получить список участников исходной комнаты: ${message(error)}` }, 503); }
  try {
    await disarmSourceReserve(studioId,record.name);
    const transferId = randomUUID().replaceAll("-", "");
    const roomId = record.creatorAccessId || record.transferRoomId || randomUUID();
    const authorization: TransferAuthorization = { kind: creatorSession ? "creator" : "owner", expiresAt: ownerExpiresAt, roomId, ...(creatorSession ? { creatorAccessId: record.creatorAccessId, credentialVersion: roomVersion(record.studioPasswordHash) } : {}) };
    const prepared = await sendPeerBridge(target, { action: "prepare", sourceOrigin: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", transferId, studioId, ...(creatorSession ? {} : { ownerExpiresAt }), authorization, roomRecord: { name: record.name, transferRoomId: roomId, ...(record.creatorAccessId ? { creatorAccessId: record.creatorAccessId, studioPasswordHash: record.studioPasswordHash } : {}), ...(record.passwordHash ? { passwordHash: record.passwordHash } : {}), ...(record.studioOnly ? { studioOnly: true } : {}) } });
    if (typeof prepared?.ticket !== "string" || prepared.ticket.length < 32 || prepared.ticket.length > 256) throw new Error("Целевой сервер вернул некорректный билет студии");
    await updateRooms(list => {
      const current = list.find(room => room.name === record.name);
      requireRoomCreatorUnchanged(request, record, current, studioId, !!creatorSession);
      if (!current || current.creatorAccessId !== record.creatorAccessId || current.studioPasswordHash !== record.studioPasswordHash || current.passwordHash !== record.passwordHash || current.transferRoomId !== record.transferRoomId || ownerExpiresAt <= Date.now()) throw new Error("Комната или полномочия изменились до переноса");
      return list.map(room => room === current ? { ...room, transferRoomId: roomId } : room);
    }, studioId);
    if (studioId !== defaultStudioId()) await commitStudioTransfer(studioId, target.id);
    await updateTransferState(state => { state.active[transferRoomKey(studioId, record.name)] = { studioId, room: record.name, id: transferId, roomId, targetUrl: target.origin, targetId: target.id, exp: Date.now() + 5 * 60_000, startedAt, eligibleSessions }; });
    serverLog("info", "transfer.started", { requestId: reqId, studioId, room: record.name, transferId, targetNodeId: target.id, eligibleGuests: eligibleSessions.length, status: 200, durationMs: Date.now() - started });
    return json({ ok: true, targetUrl: target.origin, clientTargetUrl: resolveClientTargetUrl(target, request.headers.get("x-forwarded-for")), transferId, ticket: prepared.ticket, studioId, room: record.name, role: "studio" });
  } catch (error) {
    serverLog("error", "transfer.start_failed", { requestId: reqId, studioId, room: record.name, targetNodeId: target.id, status: 502, reason: message(error), durationMs: Date.now() - started });
    return json({ error: message(error) }, 502);
  }
}
