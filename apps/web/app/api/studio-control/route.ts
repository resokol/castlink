import {sourceSessionMoved} from "../../../lib/reserve-source";
import { DiagnosticRoomConflict } from "../../../lib/media-room-association";
import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { readRooms, invalidateDiagnosticReceipts } from "@/lib/room-store";
import { claimStudio, heartbeatStudio, joinStudio, readStudioState, releaseStudio, updateStudioDesired, validStudioClient, validStudioRoom } from "@/lib/studio-control";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";
import { canHostNamedRoom } from "../../../lib/room-studio-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const snapshot = (state: Awaited<ReturnType<typeof readStudioState>>, clientId: string, redactActual = false, canClaim = false) => ({
  canClaim,
  role: state.primaryClientId === clientId ? "primary" as const : "moderator" as const,
  epoch: state.epoch, revision: state.revision, desired: redactActual ? { ...state.desired, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null } : state.desired,
  primaryOnline: !!state.primaryClientId && state.leaseUntil > Date.now(), ...(redactActual ? {} : { actual: state.actual ? { ...state.actual, serverNow: Date.now() } : null }),
});

async function authorizedRoom(room: string, studioId: string) {
  return (await readRooms(studioId)).some(record => record.name === room);
}
export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room"), clientId = request.nextUrl.searchParams.get("clientId");
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore }); }
  const stateRoom = validStudioRoom(room) ? mediaRoomName(studioId, room) : "";
  const owner = await canHostNamedRoom(request, room, studioId);
  const admin = !owner && validStudioRoom(room) ? await isRoomAdmin(request, room, studioId) : false;
  const moderator = !owner && !admin && validStudioRoom(room) ? await isModerator(request, room, studioId) : false;
  if (!owner && !admin && !moderator) return NextResponse.json({ error: "Войдите в студию" }, { status: 401, headers: noStore });
  if (!validStudioRoom(room) || !validStudioClient(clientId)) return NextResponse.json({ error: "Некорректная комната или клиент" }, { status: 400 });
  if (!(await authorizedRoom(room, studioId))) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  const state = await readStudioState(stateRoom);
  return NextResponse.json(snapshot(state, admin || moderator || request.nextUrl.searchParams.get("mode") === "admin" ? "admin-readonly" : clientId, moderator, owner && request.nextUrl.searchParams.get("mode") !== "admin"), { headers: noStore });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 16_384) return new NextResponse(null, { status: 413 });
  let data: any;
  try { const raw = await request.text(); if (raw.length > 16_384) return new NextResponse(null, { status: 413 }); data = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const { action, room, clientId } = data ?? {};
  let studioId: string;
  try { studioId = validateStudioId(typeof data?.studioId === "string" && data.studioId.trim() ? data.studioId : defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore }); }
  const heartbeatAction = action === "heartbeat";
  const sourceLimit = consumeRateLimit(request, {
    scope: heartbeatAction ? "studio-heartbeat-source" : "studio-control-source",
    limit: heartbeatAction ? 600 : 180,
    windowMs: 60_000,
  });
  const controlLimit = consumeRateLimit(request, {
    scope: heartbeatAction ? "studio-heartbeat-client" : "studio-control-client",
    limit: heartbeatAction ? 180 : 90,
    windowMs: 60_000,
    subject: `${studioId}:${typeof clientId === "string" ? clientId : "anon"}`,
  });
  const deniedLimit = !sourceLimit.ok ? sourceLimit : !controlLimit.ok ? controlLimit : null;
  if (deniedLimit) return NextResponse.json({ error: "Слишком много команд управления" }, { status: 429, headers: { ...noStore, ...rateLimitHeaders(deniedLimit) } });
  const stateRoom = validStudioRoom(room) ? mediaRoomName(studioId, room) : "";
  const owner = await canHostNamedRoom(request, room, studioId);
  const admin = !owner && validStudioRoom(room) ? await isRoomAdmin(request, room, studioId) : false;
  const moderator = !owner && !admin && validStudioRoom(room) ? await isModerator(request, room, studioId) : false;
  if (!owner && !admin && !moderator) return NextResponse.json({ error: "Войдите в студию" }, { status: 401, headers: noStore });
  if (!validStudioRoom(room) || !validStudioClient(clientId) || !["join", "claim", "heartbeat", "command", "release"].includes(action)) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const authorizedRecord = (await readRooms(studioId)).find(record => record.name === room);
  if (!authorizedRecord) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  if (action !== "release" && await sourceSessionMoved(studioId,room,undefined,clientId,authorizedRecord.creatorAccessId||authorizedRecord.transferRoomId||"")) return NextResponse.json({error:"Эта студия переведена на резервный сервер",moved:true},{status:409,headers:noStore});
  const dirtyOperatorRoom = () => invalidateDiagnosticReceipts(studioId, room, authorizedRecord.diagnosticCreationId ?? null);
  try {
    if (action === "join") {
      if (admin || moderator || data.mode === "admin") return NextResponse.json(snapshot(await readStudioState(stateRoom), "admin-readonly", moderator), { headers: noStore });
      await dirtyOperatorRoom();
      const result = await joinStudio(stateRoom, clientId);
      return NextResponse.json(snapshot(result.state, clientId, false, owner), { headers: noStore });
    }
    if (moderator) return NextResponse.json({ error: "Модератор может только просматривать состояние студии" }, { status: 403, headers: noStore });
    if (action === "claim") {
      if (admin) return NextResponse.json({ error: "Room-admin не может занять эфир" }, { status: 403 });
      await dirtyOperatorRoom();
      const state = await claimStudio(stateRoom, clientId);
      if (!state) return NextResponse.json({ error: "Ведущий ещё подключён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId, false, owner), { headers: noStore });
    }
    if (!Number.isSafeInteger(data.epoch) || data.epoch < 1) return NextResponse.json({ error: "Некорректная версия ведущего" }, { status: 400 });
    if (admin && action !== "command") return NextResponse.json({ error: "Room-admin не может управлять ведущей сессией" }, { status: 403 });
    if (action === "heartbeat") {
      if (data.actual !== undefined && (!data.actual || typeof data.actual !== "object" || Array.isArray(data.actual) || Object.keys(data.actual).length > 32)) return NextResponse.json({ error: "Некорректное состояние" }, { status: 400 });
      const state = await heartbeatStudio(stateRoom, clientId, data.epoch, data.actual);
      if (!state) return NextResponse.json({ error: "Сеанс ведущего истёк или заменён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId, false, owner), { headers: noStore });
    }
    if (admin && (!data.patch || typeof data.patch !== "object" || Array.isArray(data.patch) || Object.keys(data.patch).some(key => !["fps", "bitrate", "videoCodec", "simulcast", "gain", "outputMuted", "videoSource", "onAir", "videoDeviceId", "audioDeviceId", "outputDeviceId"].includes(key)))) {
      return NextResponse.json({ error: "Room-admin не может менять предварительный просмотр" }, { status: 403 });
    }
    if (action === "release") {
      await dirtyOperatorRoom();
      const state = await releaseStudio(stateRoom, clientId, data.epoch);
      if (!state) return NextResponse.json({ error: "Сеанс ведущего заменён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId, false, owner), { headers: noStore });
    }
    await dirtyOperatorRoom();
    const result = await updateStudioDesired(stateRoom, data.epoch, data.patch);
    if (result && "stale" in result) return NextResponse.json({ error: "Состояние студии изменилось" }, { status: 409 });
    if (!result) return NextResponse.json({ error: "Некорректные настройки" }, { status: 400 });
    return NextResponse.json(snapshot(result.state, clientId, false, owner), { headers: noStore });
  } catch (error) {
    if (error instanceof DiagnosticRoomConflict) return NextResponse.json({ error: "Комната изменилась до команды управления" }, { status: 409, headers: noStore });
    return NextResponse.json({ error: "Не удалось сохранить состояние студии" }, { status: 500 });
  }
}
