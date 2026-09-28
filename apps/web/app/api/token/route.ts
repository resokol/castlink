import { createHmac, randomUUID } from "node:crypto";
import { AccessToken, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { canJoin, canView, isStudio, readAccess, roomVersion } from "@/lib/access";
import { verifiedRoomAdminVersion } from "@/lib/room-admin";
import { verifiedModeratorVersion, verifiedRoomModeratorSession } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { readStudioState, validStudioClient } from "@/lib/studio-control";
export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room") || "demo-room";
  const requestedIdentity = request.nextUrl.searchParams.get("identity") || "";
  const role = request.nextUrl.searchParams.get("role") || "guest";
  const clientId = request.nextUrl.searchParams.get("clientId") || "";
  const studioOwner = isStudio(request);
  const studioRole = role === "studio-moderator" || role === "talkback";
  const scopedRole = studioRole || role === "output" || role === "monitor";
  const verifiedAdminVersion = scopedRole && !studioOwner ? await verifiedRoomAdminVersion(request, room) : null;
  const roomAdmin = !!verifiedAdminVersion;
  const scopedModeratorSession = scopedRole && !studioOwner && !roomAdmin ? await verifiedRoomModeratorSession(request, room) : null;
  const serverModeratorVersion = scopedRole && !studioOwner && !roomAdmin && !scopedModeratorSession ? await verifiedModeratorVersion(request) : null;
  const serverModerator = !!serverModeratorVersion;
  const scopedModerator = !!scopedModeratorSession;
  const staffAllowed = studioOwner || roomAdmin || serverModerator || scopedModerator;
  if (role === "studio-panel" && !studioOwner) return NextResponse.json({ error: "Требуется вход в студию" }, { status: 401 });
  if (studioRole && !staffAllowed) return NextResponse.json({ error: "Требуется доступ модератора" }, { status: 401 });
  if ((role === "studio-moderator" || role === "talkback") && !validStudioClient(clientId)) return NextResponse.json({ error: "Недопустимый клиент" }, { status: 403 });
  if (role === "studio-panel") {
    const epoch = Number(request.nextUrl.searchParams.get("epoch"));
    if (!validStudioClient(clientId) || !Number.isSafeInteger(epoch) || epoch < 1) return NextResponse.json({ error: "Некорректный сеанс ведущего" }, { status: 403 });
    const state = await readStudioState(room);
    if (state.primaryClientId !== clientId || state.epoch !== epoch || state.leaseUntil <= Date.now()) return NextResponse.json({ error: "Сеанс ведущего истёк или заменён" }, { status: 403 });
  }
  const record = (await readRooms()).find(r => r.name === room);
  if (!record) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  const prefix = role === "output" ? "output-" : role === "monitor" ? "monitor-" : "guest-";
  if (!["studio-panel", "studio-moderator", "talkback", "guest", "output", "monitor"].includes(role) ||
      ((role === "guest" || role === "output" || role === "monitor") && requestedIdentity && !requestedIdentity.startsWith(prefix))) return NextResponse.json({ error: "Недопустимая роль" }, { status: 403 });
  const viewerGrant = readAccess(request.nextUrl.searchParams.get("access") || undefined);
  const hasViewerGrant = viewerGrant?.kind === "viewer" && viewerGrant.room === room && viewerGrant.version === roomVersion(record.passwordHash);
  const allowed = role === "studio-panel" || studioRole ? staffAllowed : role === "guest" ? canJoin(request, room, record.passwordHash) :
    role === "output" || role === "monitor" ? staffAllowed || hasViewerGrant : false;
  if (!allowed) return NextResponse.json({ error: role === "output" || role === "monitor" ? "Для выхода или монитора нужна ссылка просмотра или доступ персонала" : "Требуется пароль" }, { status: role === "output" || role === "monitor" ? 403 : 401 });
  const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) return NextResponse.json({ error: "LiveKit credentials are not configured" }, { status: 500 });
  let renewal: { identity: string; metadata: Record<string, unknown>; name: string } | undefined;
  if (["guest", "output", "monitor"].includes(role)) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (bearer) {
      try {
        const claims = await new TokenVerifier(apiKey, apiSecret).verify(bearer);
        const metadata = JSON.parse(claims.metadata || "{}");
        if (claims.video?.room !== room || claims.sub !== requestedIdentity || metadata.role !== role || !claims.sub?.startsWith(prefix)) return NextResponse.json({ error: "Токен продления не соответствует комнате или роли" }, { status: 403 });
        renewal = { identity: claims.sub, metadata, name: claims.name || "" };
      } catch { return NextResponse.json({ error: "Недействительный токен продления" }, { status: 401 }); }
    }
  }
  const principal = studioOwner ? "owner" : roomAdmin ? `room-admin:${room}:${verifiedAdminVersion}` : scopedModerator ? `room-moderator:${room}:${scopedModeratorSession!.id}` : serverModerator ? `server-moderator:${serverModeratorVersion}` : role;
  const principalTag = createHmac("sha256", apiSecret).update(`studiolink-participant-v1:${principal}`).digest("base64url").slice(0, 22);
  const identity = role === "studio-panel" ? "studio-panel-main" : role === "studio-moderator" ? `studio-moderator-${principalTag}-${clientId}` : role === "talkback" ? `talkback-${principalTag}-${clientId}` : renewal?.identity || `${prefix}${randomUUID()}`;
  const moderatorPanel = role === "studio-moderator" && request.nextUrl.searchParams.get("panelMode") === "moderator";
  const requestedName = request.nextUrl.searchParams.get("name") || identity;
  const name = role === "studio-panel" ? "Основная студия" : role === "talkback" ? "Разговор" : role === "studio-moderator" ? (!moderatorPanel && (studioOwner || roomAdmin) ? "Администратор" : "Модератор") : renewal?.name || requestedName.slice(0, 120);
  const outputTarget = role === "output" ? renewal?.metadata.outputTarget || request.nextUrl.searchParams.get("targetIdentity") || undefined : undefined;
  if (outputTarget !== undefined && (typeof outputTarget !== "string" || !outputTarget.startsWith("guest-") || outputTarget.length > 100)) return NextResponse.json({ error: "Недопустимый источник выходного потока" }, { status: 400 });
  const tokenRole = role;
  const moderatorVersion = (role === "studio-moderator" || role === "talkback") ? serverModeratorVersion : null;
  const controlAccessRole = role === "studio-panel" || role === "studio-moderator" || role === "talkback" ?
    studioOwner || roomAdmin ? "admin" : serverModerator ? "moderator" : scopedModerator ? "room-moderator" : undefined : undefined;
  const metadata = { role: tokenRole, ...(moderatorPanel ? { panelMode: "moderator" } : {}), ...(outputTarget ? { outputTarget } : {}), ...(role === "studio-moderator" || role === "talkback" ? { clientId } : {}),
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
  token.addGrant({ roomJoin: true, room,
    ...(publishSources ? { canPublish: true, canPublishSources: publishSources } : { canPublish: role === "studio-panel" || (role !== "output" && role !== "monitor" && role !== "studio-moderator" && role !== "talkback") }),
    canSubscribe: talkback ? false : true,
    canPublishData: role !== "studio-moderator" && role !== "talkback" && role !== "output" && role !== "monitor",
    canUpdateOwnMetadata: false,
  });
  return NextResponse.json({ token: await token.toJwt(), identity, role: tokenRole, canPublish: moderator || talkback || role === "studio-panel" || (role !== "output" && role !== "monitor") }, { headers: { "Cache-Control": "no-store" } });
}
