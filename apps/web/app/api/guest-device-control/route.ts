import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DataPacket_Kind, RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { canHostNamedRoom } from "@/lib/room-studio-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "@/lib/studio-scope";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { guestDeviceEntry } from "@/lib/guest-device-control-state";
import { GUEST_DEVICE_REQUEST_TOPIC, GUEST_DEVICE_REQUEST_TTL, GUEST_DEVICE_STATE_TTL, parseGuestDevice, parseGuestDeviceState, type GuestDeviceOutcome } from "@/lib/guest-device-control";

const client = () => new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const scopeMatches = (metadata: Record<string, unknown>, studioId: string) => metadata.studioId === studioId || studioId === defaultStudioId() && metadata.studioId === undefined;
async function handle(request: NextRequest, body: Record<string, unknown>) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  let studioId: string;
  try { studioId = validateStudioId(typeof body.studioId === "string" && body.studioId ? body.studioId : defaultStudioId()); }
  catch { return new NextResponse(null, { status: 400 }); }
  const room = typeof body.room === "string" ? body.room : "", identity = typeof body.identity === "string" ? body.identity : "";
  if (!room || !identity.startsWith("guest-") || identity.length > 200) return new NextResponse(null, { status: 400 });
  const reporting = body.action === "report";
  const mediaRoom = mediaRoomName(studioId, room);
  // Device inventory is private to the caster and this room's studio/admin.
  if (!reporting && !await canHostNamedRoom(request, room, studioId) && !await isRoomAdmin(request, room, studioId)) return new NextResponse(null, { status: 401 });
  if (reporting) {
    try {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(token);
      const metadata = JSON.parse(claims.metadata || "{}");
      if (claims.sub !== identity || claims.video?.room !== mediaRoom || metadata.role !== "guest" || !scopeMatches(metadata, studioId)) return new NextResponse(null, { status: 403 });
    } catch { return new NextResponse(null, { status: 401 }); }
  }
  if (!(await readRooms(studioId)).some(value => value.name === room)) return new NextResponse(null, { status: 404 });
  const entry = guestDeviceEntry(`${mediaRoom}|${identity}`);
  const lk = client();
  let participant;
  try { participant = await lk.getParticipant(mediaRoom, identity); }
  catch {
    if (body.action === "read") return NextResponse.json({ offline: true, request: entry.request, result: entry.result }, { headers: { "cache-control": "no-store" } });
    return NextResponse.json({ error: "Кастер больше не подключён" }, { status: 409 });
  }
  let metadata;
  try { metadata = JSON.parse(participant.metadata || "{}"); } catch { return new NextResponse(null, { status: 403 }); }
  if (metadata?.role !== "guest" || !scopeMatches(metadata, studioId)) return new NextResponse(null, { status: 403 });
  if (entry.participantSid && entry.participantSid !== participant.sid || entry.request && entry.request.participantSid !== participant.sid) {
    entry.request = undefined; entry.result = undefined;
  }
  const currentState = entry.participantSid === participant.sid && !!entry.stateAt && entry.stateAt >= Date.now() - GUEST_DEVICE_STATE_TTL;
  if (body.action === "read") return NextResponse.json({ participantSid: participant.sid, state: currentState ? entry.state : undefined, request: entry.request, result: entry.result }, { headers: { "cache-control": "no-store" } });
  const limit = consumeRateLimit(request, { scope: "guest-device-control", limit: 120, windowMs: 60_000, subject: `${mediaRoom}:${identity}` });
  if (!limit.ok) return NextResponse.json({ error: "Слишком много запросов устройств" }, { status: 429, headers: rateLimitHeaders(limit) });
  if (body.participantSid !== participant.sid) return NextResponse.json({ error: "Кастер уже переподключился. Обновите состояние." }, { status: 409 });
  if (reporting) {
    const state = parseGuestDeviceState(body.state);
    if (!state) return new NextResponse(null, { status: 400 });
    if (body.requestId !== undefined) {
      const pending = entry.request;
      if (!pending || pending.id !== body.requestId || pending.participantSid !== participant.sid || pending.expiresAt <= Date.now()) return NextResponse.json({ error: "Запрос устройства уже устарел" }, { status: 409 });
      if (!["applied", "saved", "declined", "failed"].includes(String(body.outcome))) return new NextResponse(null, { status: 400 });
      const kind = pending.target.kind, id = pending.target.deviceId;
      if ((body.outcome === "applied" || body.outcome === "saved") && (state.selected[kind] !== id || !state.devices.some(device => device.kind === kind && device.deviceId === id))) return new NextResponse(null, { status: 409 });
      if (body.outcome === "applied" && (state.actual[kind] !== id || kind === "audiooutput" && !state.outputSupported || kind === "audioinput" && !state.microphoneEnabled || kind === "videoinput" && !state.cameraEnabled)) return new NextResponse(null, { status: 409 });
      if (body.outcome === "saved" && (kind === "audiooutput" || kind === "audioinput" && state.microphoneEnabled || kind === "videoinput" && state.cameraEnabled)) return new NextResponse(null, { status: 409 });
      entry.result = { id: pending.id, outcome: body.outcome as GuestDeviceOutcome, ...(body.outcome === "failed" && typeof body.error === "string" ? { error: body.error.slice(0, 300) } : {}) };
      entry.request = undefined;
    }
    entry.state = state; entry.participantSid = participant.sid; entry.stateAt = Date.now();
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "request") return new NextResponse(null, { status: 400 });
  const target = parseGuestDevice(body.target);
  if (!target) return new NextResponse(null, { status: 400 });
  const reported = currentState && entry.state?.devices.find(device => device.kind === target.kind && device.deviceId === target.deviceId);
  if (!reported || target.kind === "audiooutput" && !entry.state?.outputSupported) return NextResponse.json({ error: "Устройство недоступно в подтверждённом списке кастера" }, { status: 409 });
  if (entry.request && entry.request.expiresAt > Date.now() && entry.request.participantSid === participant.sid) return NextResponse.json({ error: "Предыдущий запрос устройства ещё ожидает ответа" }, { status: 409 });
  const now = Date.now();
  const command = { id: randomUUID(), participantSid: participant.sid, issuedAt: now, expiresAt: now + GUEST_DEVICE_REQUEST_TTL, target: reported };
  entry.request = command; entry.result = undefined;
  try { await lk.sendData(mediaRoom, new TextEncoder().encode(JSON.stringify(command)), DataPacket_Kind.RELIABLE, { destinationIdentities: [identity], topic: GUEST_DEVICE_REQUEST_TOPIC }); }
  catch (cause) { if (entry.request?.id === command.id) entry.request = undefined; throw cause; }
  return NextResponse.json({ requested: true, request: command });
}
export async function GET(request: NextRequest) {
  try { return await handle(request, { action: "read", studioId: request.nextUrl.searchParams.get("studioId"), room: request.nextUrl.searchParams.get("room"), identity: request.nextUrl.searchParams.get("identity") }); }
  catch { return NextResponse.json({ error: "Не удалось получить устройства кастера" }, { status: 502 }); }
}
export async function POST(request: NextRequest) {
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return new NextResponse(null, { status: 400 }); return await handle(request, body); }
  catch { return NextResponse.json({ error: "Не удалось запросить смену устройства кастера" }, { status: 502 }); }
}
