import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin, setAccessCookie } from "@/lib/access";
import { readRooms, updateRooms, type RoomRecord } from "@/lib/room-store";
import { resetStudioForTransfer } from "@/lib/studio-control";
import { newTicket, peerOriginAllowed, resolveClientTargetUrl, signBridge, ticketHash, transferOriginConfigured, transferRoomKey, transferServer, transferTargets, transferSecret, updateTransferState, verifyBridge, type EligibleGuestSession } from "@/lib/server-transfer";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { isStudioOwner, setStudioOwnerCookie } from "../../../lib/studio-owner-access";
import { commitStudioTransfer } from "../../../lib/control-plane-client";

export const runtime = "nodejs";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
const message = (error: unknown) => error instanceof Error ? error.message : "Не удалось переключить сервер";

async function liveKitReady() {
  const url = process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880";
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return false;
  try {
    await Promise.race([
      new RoomServiceClient(url, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).listRooms(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("LiveKit timeout")), 3000)),
    ]);
    return true;
  } catch { return false; }
}
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
      if (typeof identity !== "string" || !identity.startsWith("guest-")) continue;
      const transferSessionId = transferSessionFromMetadata(participant.metadata);
      if (transferSessionId === null) continue;
      eligible.push({ identity, ...(transferSessionId ? { transferSessionId } : {}) });
    }
    return eligible;
  } finally { if (timeout) clearTimeout(timeout); }
}
async function sendBridge(origin: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload), timestamp = String(Date.now()), nonce = randomUUID().replaceAll("-", "");
  const response = await fetch(`${origin}/api/server-transfer?action=bridge`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(7000), headers: {
    "content-type": "application/json", "x-studiolink-transfer-time": timestamp, "x-studiolink-transfer-nonce": nonce, "x-studiolink-transfer-signature": signBridge(timestamp, nonce, body),
  }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Целевой сервер ответил ${response.status}`);
  return data;
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  if (action === "health") {
    try { return json({ enabled: transferSecret().length >= 32 && transferOriginConfigured() && peerOriginAllowed(process.env.STUDIOLINK_TRANSFER_PEER_ORIGIN || "") && transferTargets().length > 0, ...transferServer(), liveKitReady: await liveKitReady() }); }
    catch { return json({ enabled: false, liveKitReady: false }); }
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) {
    let ownerStudioId: string;
    try { ownerStudioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
    catch { return json({ error: "Некорректный studioId" }, 400); }
    if (!await isStudioOwner(request, ownerStudioId)) return new NextResponse(null, { status: 401 });
    try {
      const current = transferServer();
      const targets = await Promise.all(transferTargets().map(async target => {
        try {
          const response = await fetch(`${target.origin}/api/server-transfer?action=health`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
          const status = await response.json();
          const available = response.ok && status.enabled && status.liveKitReady === true && status.id === target.id;
          return { id: target.id, label: target.label, origin: target.origin, available, ...(!available ? { reason: response.ok && status.id !== target.id ? "Идентификаторы серверов не совпадают" : "Сервер или LiveKit недоступен" } : {}) };
        } catch { return { ...target, available: false, reason: "Сервер недоступен" }; }
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
    try { target = transferTargets().find(candidate => candidate.id === transfer.targetId && candidate.origin === transfer.targetUrl); }
    catch { return json({}); }
    if (!target) return json({});
    const clientTargetUrl = resolveClientTargetUrl(target, request.headers.get("x-forwarded-for"));
    const issued = await sendBridge(transfer.targetUrl, { action: "ticket", sourceOrigin: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", transferId: transfer.id, studioId, role: "guest", identity, name: claims.name || identity });
    return json({ targetUrl: transfer.targetUrl, clientTargetUrl, transferId: transfer.id, ticket: issued.ticket, studioId, room, role: "guest", identity, name: claims.name || identity });
  } catch { return json({}); }
}

export async function POST(request: NextRequest) {
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
    if (!verifyBridge(timestamp, nonce, raw, signature)) return new NextResponse(null, { status: 401 });
    const fresh = await updateTransferState(state => {
      if (state.nonces[nonce]) return false;
      state.nonces[nonce] = Date.now() + 120_000;
      return true;
    });
    if (!fresh) return new NextResponse(null, { status: 409 });
    if (!peerOriginAllowed(typeof data.sourceOrigin === "string" ? data.sourceOrigin : "")) return new NextResponse(null, { status: 403 });

    if (data.action === "prepare") {
      const record = data.roomRecord as RoomRecord;
      const transferId = String(data.transferId || "");
      const roomId = record?.transferRoomId;
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(transferId) || !record || typeof record.name !== "string" || !record.name.trim() || record.name.length > 100 || typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(roomId) || (record.passwordHash !== undefined && (typeof record.passwordHash !== "string" || !/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(record.passwordHash))) || (record.studioOnly !== undefined && typeof record.studioOnly !== "boolean")) return json({ error: "Некорректная подготовка комнаты" }, 400);
      if (!await liveKitReady()) return json({ error: "LiveKit целевого сервера недоступен" }, 503);
      try {
        await updateRooms(list => {
          const existing = list.find(r => r.name === record.name);
          if (existing && existing.transferRoomId !== roomId) throw new Error("На целевом сервере уже есть другая комната с таким именем");
          const freshAccess = {
            guestInviteVersion: randomUUID(),
            viewerAccessVersion: randomUUID(),
            outputAccessVersion: randomUUID(),
          };
          return existing
            ? list.map(r => r.name === record.name ? {
                name: record.name,
                transferRoomId: roomId,
                ...freshAccess,
                ...(record.passwordHash ? { passwordHash: record.passwordHash, ...(r.passwordHash === record.passwordHash && r.passwordCiphertext ? { passwordCiphertext: r.passwordCiphertext } : {}) } : {}),
                ...(record.studioOnly ? { studioOnly: true } : {}),
              } : r)
            : [...list, {
                name: record.name,
                transferRoomId: roomId,
                ...freshAccess,
                ...(record.passwordHash ? { passwordHash: record.passwordHash } : {}),
                ...(record.studioOnly ? { studioOnly: true } : {}),
              }];
        }, studioId);
      } catch (error) { return json({ error: message(error) }, 409); }
      const installedRoom = (await readRooms(studioId)).find(item => item.name === record.name && item.transferRoomId === roomId);
      if (!installedRoom) return json({ error: "Подготовленная комната не найдена" }, 409);
      const stateRoom = mediaRoomName(studioId, record.name);
      await resetStudioForTransfer(stateRoom);
      const issued = newTicket("studio", studioId, record.name);
      await updateTransferState(state => {
        state.transfers[transferId] = { studioId, room: record.name, roomId, targetUrl: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", targetId: transferServer().id, createdAt: Date.now(), exp: Date.now() + 5 * 60_000 };
        state.tickets[issued.hash] = issued.ticket;
        delete state.active[transferRoomKey(studioId, record.name)];
      });
      return json({ ok: true, ticket: issued.token });
    }

    if (data.action === "ticket") {
      const transfer = await updateTransferState(state => state.transfers[String(data.transferId || "")]);
      if (!transfer || transfer.exp < Date.now()) return json({ error: "Перенос комнаты истёк" }, 410);
      if (data.role !== "guest" || typeof data.identity !== "string" || !data.identity.startsWith("guest-") || typeof data.name !== "string" || data.name.length > 120) return json({ error: "Недопустимая роль" }, 403);
      if (transfer.studioId !== studioId) return json({ error: "Перенос относится к другой студии" }, 403);
      const issued = newTicket("guest", studioId, transfer.room, data.identity, data.name);
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
      if (!value || value.exp < Date.now() || value.studioId !== studioId) return null;
      delete state.tickets[hash];
      return value;
    });
    if (!ticket) return new NextResponse(null, { status: 401 });
    const room = (await readRooms(studioId)).find(r => r.name === ticket.room);
    if (!room) return new NextResponse(null, { status: 401 });
    const response = json({ studioId, room: ticket.room, role: ticket.role, ...(ticket.identity ? { identity: ticket.identity } : {}), ...(ticket.name ? { name: ticket.name } : {}) });
    if (ticket.role === "studio") await setStudioOwnerCookie(response, request, studioId, ticket.exp);
    else setAccessCookie(response, request, "guest", room.name, room.passwordHash || "", studioId);
    return response;
  }

  if (!await isStudioOwner(request, studioId) || !request.headers.get("origin") || !sameOrigin(request)) return new NextResponse(null, { status: 401 });
  if (action !== "start" || typeof data?.room !== "string" || typeof data?.targetId !== "string") return new NextResponse(null, { status: 400 });
  const record = (await readRooms(studioId)).find(r => r.name === data.room);
  if (!record) return json({ error: "Комната не найдена" }, 404);
  let target;
  try { target = transferTargets().find(item => item.id === data.targetId); } catch (error) { return json({ error: message(error) }, 503); }
  if (!target) return json({ error: "Целевой сервер не разрешён" }, 400);
  if (!transferSecret() || !transferOriginConfigured()) return json({ error: "Не настроена пара серверов" }, 503);
  const startedAt = Date.now();
  let eligibleSessions: EligibleGuestSession[];
  try { eligibleSessions = await captureEligibleGuestSessions(mediaRoomName(studioId, record.name)); }
  catch (error) { return json({ error: `Не удалось получить список участников исходной комнаты: ${message(error)}` }, 503); }
  try {
    const transferId = randomUUID().replaceAll("-", "");
    const roomId = record.transferRoomId || randomUUID();
    await updateRooms(list => list.map(room => room.name === record.name ? { ...room, transferRoomId: roomId } : room), studioId);
    const prepared = await sendBridge(target.origin, { action: "prepare", sourceOrigin: process.env.STUDIOLINK_TRANSFER_ORIGIN || "", transferId, studioId, roomRecord: { name: record.name, transferRoomId: roomId, ...(record.passwordHash ? { passwordHash: record.passwordHash } : {}), ...(record.studioOnly ? { studioOnly: true } : {}) } });
    if (typeof prepared?.ticket !== "string" || prepared.ticket.length < 32 || prepared.ticket.length > 256) throw new Error("Целевой сервер вернул некорректный билет студии");
    if (studioId !== defaultStudioId()) await commitStudioTransfer(studioId, target.id);
    await updateTransferState(state => { state.active[transferRoomKey(studioId, record.name)] = { studioId, room: record.name, id: transferId, roomId, targetUrl: target.origin, targetId: target.id, exp: Date.now() + 5 * 60_000, startedAt, eligibleSessions }; });
    return json({ ok: true, targetUrl: target.origin, clientTargetUrl: resolveClientTargetUrl(target, request.headers.get("x-forwarded-for")), transferId, ticket: prepared.ticket, studioId, room: record.name, role: "studio" });
  } catch (error) { return json({ error: message(error) }, 502); }
}
