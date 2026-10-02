import { createHmac, randomUUID } from "node:crypto";
import { admissionConfigured, localNodeAdmission } from "../../../lib/node-admission";
import { reserveStaffDisplayName } from "../../../lib/staff-display-name";
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { accessStudioMatches, canJoin, isStudio, readAccess, roomVersion } from "@/lib/access";
import { verifiedRoomAdminVersion } from "@/lib/room-admin";
import { verifiedModeratorVersion, verifiedRoomModeratorSession } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { readStudioState, validStudioClient } from "@/lib/studio-control";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";
import { isStudioOwner } from "../../../lib/studio-owner-access";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";

async function staffDisplayName(mediaRoom: string, identity: string, label: "Администратор" | "Модератор", requested: string) {
  if (requested.trim()) return requested.trim().slice(0,120);
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new Error("livekit_credentials_missing");
  const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, secret);
  let participants: Array<{identity:string;name?:string}>;
  try { participants = await lk.listParticipants(mediaRoom); }
  catch (error) {
    if ((error as {code?:string;status?:number})?.code === "not_found" || (error as {status?:number})?.status === 404) participants = [];
    else throw error;
  }
  return reserveStaffDisplayName(mediaRoom,identity,label,requested,participants);
}

export async function GET(request: NextRequest) {
  const reqId = requestId(request);
  const started = Date.now();
  const room = request.nextUrl.searchParams.get("room") || "demo-room";
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
  const mediaRoom = mediaRoomName(studioId, room);
  const requestedIdentity = request.nextUrl.searchParams.get("identity") || "";
  const role = request.nextUrl.searchParams.get("role") || "guest";
  const clientId = request.nextUrl.searchParams.get("clientId") || "";
  const tokenSourceLimit = consumeRateLimit(request, { scope: "token-issue-source", limit: 1200, windowMs: 60_000 });
  const tokenLimit = consumeRateLimit(request, { scope: "token-issue-scope", limit: 600, windowMs: 60_000, subject: `${studioId}:${role}` });
  const deniedTokenLimit = !tokenSourceLimit.ok ? tokenSourceLimit : !tokenLimit.ok ? tokenLimit : null;
  if (deniedTokenLimit) return NextResponse.json({ error: "Слишком много запросов токена" }, { status: 429, headers: requestHeaders(reqId, { "Cache-Control": "no-store", ...rateLimitHeaders(deniedTokenLimit) }) });
  const studioOwner = await isStudioOwner(request, studioId);
  const studioRole = role === "studio-moderator" || role === "talkback";
  const scopedRole = studioRole || role === "output" || role === "monitor";
  const verifiedAdminVersion = scopedRole && !studioOwner ? await verifiedRoomAdminVersion(request, room, studioId) : null;
  const roomAdmin = !!verifiedAdminVersion;
  const scopedModeratorSession = scopedRole && !studioOwner && !roomAdmin
    ? await verifiedRoomModeratorSession(request, room, studioId)
    : null;
  const serverModeratorVersion = scopedRole && !studioOwner && !roomAdmin && !scopedModeratorSession
    ? await verifiedModeratorVersion(request, undefined, studioId)
    : null;
  const serverModerator = !!serverModeratorVersion;
  const scopedModerator = !!scopedModeratorSession;
  const staffAllowed = studioOwner || roomAdmin || serverModerator || scopedModerator;
  if (role === "studio-panel" && !studioOwner) return NextResponse.json({ error: "Требуется вход в студию" }, { status: 401 });
  if (studioRole && !staffAllowed) return NextResponse.json({ error: "Требуется доступ модератора" }, { status: 401 });
  if ((role === "studio-moderator" || role === "talkback") && !validStudioClient(clientId)) return NextResponse.json({ error: "Недопустимый клиент" }, { status: 403 });
  if (role === "studio-panel") {
    const epoch = Number(request.nextUrl.searchParams.get("epoch"));
    if (!validStudioClient(clientId) || !Number.isSafeInteger(epoch) || epoch < 1) return NextResponse.json({ error: "Некорректный сеанс ведущего" }, { status: 403 });
    const state = await readStudioState(mediaRoom);
    if (state.primaryClientId !== clientId || state.epoch !== epoch || state.leaseUntil <= Date.now()) return NextResponse.json({ error: "Сеанс ведущего истёк или заменён" }, { status: 403 });
  }
  const record = (await readRooms(studioId)).find(r => r.name === room);
  if (!record) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  const prefix = role === "output" ? "output-" : role === "monitor" ? "monitor-" : "guest-";
  if (!["studio-panel", "studio-moderator", "talkback", "guest", "output", "monitor"].includes(role) ||
      ((role === "guest" || role === "output" || role === "monitor") && requestedIdentity && !requestedIdentity.startsWith(prefix))) return NextResponse.json({ error: "Недопустимая роль" }, { status: 403 });
  const viewerGrantValue = request.headers.get("x-castlink-view-access") || request.nextUrl.searchParams.get("access") || undefined;
  const viewerGrant = readAccess(viewerGrantValue);
  const hasViewerGrant = viewerGrant?.kind === "viewer" && viewerGrant.room === room && accessStudioMatches(viewerGrant, studioId) && viewerGrant.version === (record.outputAccessVersion || roomVersion(record.passwordHash));
  const allowed = role === "studio-panel" || studioRole ? staffAllowed : role === "guest" ? canJoin(request, room, record.passwordHash, studioId) :
    role === "output" || role === "monitor" ? staffAllowed || hasViewerGrant : false;
  if (!allowed) return NextResponse.json({ error: role === "output" || role === "monitor" ? "Для выхода или монитора нужна ссылка просмотра или доступ персонала" : "Требуется пароль" }, { status: role === "output" || role === "monitor" ? 403 : 401 });
  const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    serverLog("error", "token.issue_failed", { requestId: reqId, studioId, room, role, status: 500, reason: "livekit_credentials_missing", durationMs: Date.now() - started });
    return NextResponse.json({ error: "LiveKit credentials are not configured" }, { status: 500, headers: requestHeaders(reqId) });
  }
  let renewal: { identity: string; metadata: Record<string, unknown>; name: string } | undefined;
  if (["guest", "output", "monitor"].includes(role)) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (bearer) {
      try {
        const claims = await new TokenVerifier(apiKey, apiSecret).verify(bearer);
        const metadata = JSON.parse(claims.metadata || "{}");
        if (claims.video?.room !== mediaRoom || claims.sub !== requestedIdentity || metadata.role !== role || metadata.studioId !== studioId || !claims.sub?.startsWith(prefix)) return NextResponse.json({ error: "Токен продления не соответствует студии, комнате или роли" }, { status: 403 });
        renewal = { identity: claims.sub, metadata, name: claims.name || "" };
      } catch { return NextResponse.json({ error: "Недействительный токен продления" }, { status: 401 }); }
    }
  }
  const principal = studioOwner ? `owner:${studioId}` : roomAdmin ? `room-admin:${studioId}:${room}:${verifiedAdminVersion}` : scopedModerator ? `room-moderator:${studioId}:${room}:${scopedModeratorSession!.id}` : serverModerator ? `server-moderator:${studioId}:${serverModeratorVersion}` : `${studioId}:${role}`;
  const principalTag = createHmac("sha256", apiSecret).update(`studiolink-participant-v1:${principal}`).digest("base64url").slice(0, 22);
  const identity = role === "studio-panel" ? "studio-panel-main" : role === "studio-moderator" ? `studio-moderator-${principalTag}-${clientId}` : role === "talkback" ? `talkback-${principalTag}-${clientId}` : renewal?.identity || `${prefix}${randomUUID()}`;
  if (process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1") {
    try {
      const admission = await localNodeAdmission(mediaRoom,identity);
      if (!admission.allowed) return NextResponse.json({ error:"Нода отключена или это подключение отозвано",reason:admission.reason }, {status:admission.blocked ? 403 : 503,headers:{"Cache-Control":"no-store"}});
    } catch { return NextResponse.json({ error:"Не удалось проверить состояние ноды" }, {status:503,headers:{"Cache-Control":"no-store"}}); }
  }
  const moderatorPanel = role === "studio-moderator" && request.nextUrl.searchParams.get("panelMode") === "moderator";
  const requestedName = request.nextUrl.searchParams.get("name") || "";
  const staffLabel = !moderatorPanel && (studioOwner || roomAdmin) ? "Администратор" : "Модератор";
  let name: string;
  try {
    name = role === "studio-panel" ? "Основная студия" : role === "talkback" ? "Разговор" : role === "studio-moderator" ? await staffDisplayName(mediaRoom, identity, staffLabel, requestedName) : renewal?.name || (requestedName || identity).slice(0, 120);
  } catch {
    return NextResponse.json({ error: "Не удалось подготовить имя персонала. Повторите вход." }, { status: 503, headers: requestHeaders(reqId, { "Cache-Control": "no-store" }) });
  }
  const outputTarget = role === "output" ? renewal?.metadata.outputTarget || request.nextUrl.searchParams.get("targetIdentity") || undefined : undefined;
  if (outputTarget !== undefined && (typeof outputTarget !== "string" || !outputTarget.startsWith("guest-") || outputTarget.length > 100)) return NextResponse.json({ error: "Недопустимый источник выходного потока" }, { status: 400 });
  const tokenRole = role;
  const moderatorVersion = (role === "studio-moderator" || role === "talkback") ? serverModeratorVersion : null;
  const controlAccessRole = role === "studio-panel" || role === "studio-moderator" || role === "talkback" ?
    studioOwner || roomAdmin ? "admin" : serverModerator ? "moderator" : scopedModerator ? "room-moderator" : undefined : undefined;
  const metadata = { role: tokenRole, studioId, roomDisplayName: room, ...(moderatorPanel ? { panelMode: "moderator" } : {}), ...(outputTarget ? { outputTarget } : {}), ...(role === "studio-moderator" || role === "talkback" ? { clientId } : {}),
    ...(roomAdmin && verifiedAdminVersion ? { roomAdmin: true, adminAccessVersion: verifiedAdminVersion } : {}),
    ...(controlAccessRole ? { accessRole: controlAccessRole } : {}),
    ...(moderatorVersion ? { moderatorAccessVersion: moderatorVersion } : {}),
    ...(scopedModeratorSession && (role === "studio-moderator" || role === "talkback") ? { roomModeratorRoom: room, roomModeratorSessionId: scopedModeratorSession.id } : {}),
    ...(role === "talkback" ? { talkbackForClientId: clientId } : {}),
    ...(role === "guest" ? { transferSessionId: renewal?.metadata.transferSessionId || randomUUID() } : {}) };
  const token = new AccessToken(apiKey, apiSecret, { identity, name, ttl: studioRole && (roomAdmin || serverModerator || scopedModerator) ? "5m" : "2h", metadata: JSON.stringify(metadata) });
  const talkback = role === "talkback";
  const moderator = role === "studio-moderator";
  const publishSources = moderator ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : talkback ? [TrackSource.MICROPHONE] : undefined;
  token.addGrant({ roomJoin: true, room: mediaRoom,
    ...(publishSources ? { canPublish: true, canPublishSources: publishSources } : { canPublish: role === "studio-panel" || (role !== "output" && role !== "monitor" && role !== "studio-moderator" && role !== "talkback") }),
    canSubscribe: talkback ? false : true,
    canPublishData: role !== "studio-moderator" && role !== "talkback" && role !== "output" && role !== "monitor",
    canUpdateOwnMetadata: false,
  });
  serverLog("info", "token.issued", { requestId: reqId, studioId, room, mediaRoom, role: tokenRole, identity, status: 200, durationMs: Date.now() - started });
  return NextResponse.json({ token: await token.toJwt(), identity, name, role: tokenRole, canPublish: moderator || talkback || role === "studio-panel" || (role !== "output" && role !== "monitor") }, { headers: requestHeaders(reqId, { "Cache-Control": "no-store" }) });
}
