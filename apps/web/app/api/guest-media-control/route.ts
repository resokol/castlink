import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DataPacket_Kind, RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { canHostNamedRoom } from "@/lib/room-studio-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { guestConnectionRoutes } from "@/lib/connection-route-config";
import { guestMediaControlEntry } from "@/lib/guest-media-control-state";
import { GUEST_MEDIA_SETTINGS_TOPIC, parseGuestMediaSettingsPatch, parseGuestMediaSettingsState } from "@/lib/guest-media-control";

const client = () => new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const scopeMatches = (metadata: Record<string, unknown>, studioId: string) => metadata.studioId === studioId || studioId === defaultStudioId() && metadata.studioId === undefined;
const staff = async (request: NextRequest, room: string, studioId: string) => await canHostNamedRoom(request, room, studioId) || await isRoomAdmin(request, room, studioId) || await isModerator(request, room, studioId);

async function handle(request: NextRequest, body: Record<string, unknown>) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  let studioId: string;
  try { studioId = validateStudioId(typeof body.studioId === "string" && body.studioId ? body.studioId : defaultStudioId()); }
  catch { return new NextResponse(null, { status: 400 }); }
  const room = typeof body.room === "string" ? body.room : "", identity = typeof body.identity === "string" ? body.identity : "";
  if (!room || !identity.startsWith("guest-") || identity.length > 200) return new NextResponse(null, { status: 400 });
  const report = body.action === "report";
  let guestProof: Record<string, unknown> | undefined;
  if (!report && !await staff(request, room, studioId)) return new NextResponse(null, { status: 401 });
  const mediaRoom = mediaRoomName(studioId, room);
  if (report) {
    try {
      const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(bearer);
      const metadata = JSON.parse(claims.metadata || "{}");
      if (claims.sub !== identity || claims.video?.room !== mediaRoom || metadata.role !== "guest" || !scopeMatches(metadata, studioId)) return new NextResponse(null, { status: 403 });
      guestProof = metadata;
    } catch { return new NextResponse(null, { status: 401 }); }
  }
  if (!(await readRooms(studioId)).some(value => value.name === room)) return new NextResponse(null, { status: 404 });
  const lk = client();
  const entry = guestMediaControlEntry(`${mediaRoom}|${identity}`);
  let participant;
  try { participant = await lk.getParticipant(mediaRoom, identity); }
  catch {
    if (body.action === "read" && (entry.state || entry.command || entry.result)) return NextResponse.json({ offline: true, state: entry.state, command: entry.command, result: entry.result, connectionRoutes: guestConnectionRoutes() }, { headers: { "cache-control": "no-store" } });
    // A failed route join can still report its error over authenticated HTTPS.
    const pending = entry.command;
    if (!report || !guestProof || typeof body.error !== "string" || !body.error || !pending || pending.id !== body.commandId || pending.expiresAt <= Date.now() || body.participantSid !== pending.participantSid) return NextResponse.json({ error: "Гость больше не подключён" }, { status: 409 });
    participant = { sid: pending.participantSid, metadata: JSON.stringify(guestProof) };
  }
  let metadata: Record<string, unknown>;
  try { metadata = JSON.parse(participant.metadata || "{}"); }
  catch { return new NextResponse(null, { status: 403 }); }
  if (!metadata || metadata.role !== "guest" || !scopeMatches(metadata, studioId)) return new NextResponse(null, { status: 403 });
  if (body.action === "read") {
    return NextResponse.json({ participantSid: participant.sid, state: entry.participantSid === participant.sid ? entry.state : undefined, command: entry.command, result: entry.result, connectionRoutes: guestConnectionRoutes() }, { headers: { "cache-control": "no-store" } });
  }
  const limit = consumeRateLimit(request, { scope: "guest-media-settings", limit: 120, windowMs: 60_000, subject: `${mediaRoom}:${identity}` });
  if (!limit.ok) return NextResponse.json({ error: "Слишком много команд гостю" }, { status: 429, headers: rateLimitHeaders(limit) });
  if (report) {
    const state = parseGuestMediaSettingsState(body.state);
    const failedOriginalSession = typeof body.error === "string" && !!body.error && typeof body.commandId === "string" && entry.command?.id === body.commandId && body.participantSid === entry.command.participantSid;
    if (!state || body.participantSid !== participant.sid && !failedOriginalSession) return new NextResponse(null, { status: 409 });
    if (body.commandId !== undefined) {
      if (typeof body.commandId !== "string" || entry.command?.id !== body.commandId || entry.command.expiresAt <= Date.now()) return NextResponse.json({ error: "Команда уже устарела" }, { status: 409 });
      let error = typeof body.error === "string" ? body.error.slice(0, 300) : undefined;
      const requestedCodec = entry.command.patch.videoCodec;
      if (!error && requestedCodec && (state.videoCodec !== requestedCodec || state.videoEnabled !== false && state.actualVideoCodec !== requestedCodec)) error = "Гость не подтвердил выбранный видеокодек";
      entry.result = { id: body.commandId, ok: !error, ...(error ? { error } : {}) };
      entry.command = undefined;
    }
    entry.state = state; entry.participantSid = String(body.participantSid);
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "command") return new NextResponse(null, { status: 400 });
  const patch = parseGuestMediaSettingsPatch(body.patch);
  if (!patch) return new NextResponse(null, { status: 400 });
  if (typeof body.participantSid !== "string" || body.participantSid !== participant.sid) return NextResponse.json({ error: "Гость уже переподключился. Обновите состояние." }, { status: 409 });
  if (patch.connectionRoute === "relay" && !guestConnectionRoutes().relay.configured) return NextResponse.json({ error: "Запасной маршрут TURN на сервере не настроен" }, { status: 409 });
  if (entry.command && entry.command.expiresAt > Date.now()) return NextResponse.json({ error: "Предыдущая команда ещё выполняется" }, { status: 409 });
  const now = Date.now();
  const command = { id: randomUUID(), participantSid: participant.sid, issuedAt: now, expiresAt: now + 60_000, patch };
  entry.command = command;
  entry.result = undefined;
  try { await lk.sendData(mediaRoom, new TextEncoder().encode(JSON.stringify(command)), DataPacket_Kind.RELIABLE, { destinationIdentities: [identity], topic: GUEST_MEDIA_SETTINGS_TOPIC }); }
  catch (cause) { if (entry.command?.id === command.id) entry.command = undefined; throw cause; }
  return NextResponse.json({ ok: true, requested: true, command });
}

export async function GET(request: NextRequest) {
  try { return await handle(request, { action: "read", studioId: request.nextUrl.searchParams.get("studioId"), room: request.nextUrl.searchParams.get("room"), identity: request.nextUrl.searchParams.get("identity") }); }
  catch { return NextResponse.json({ error: "Гость больше не подключён" }, { status: 502 }); }
}
export async function POST(request: NextRequest) {
  try { return await handle(request, await request.json()); }
  catch { return NextResponse.json({ error: "Не удалось изменить настройки гостя" }, { status: 502 }); }
}
