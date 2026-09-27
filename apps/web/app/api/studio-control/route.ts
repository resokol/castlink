import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { claimStudio, heartbeatStudio, joinStudio, readStudioState, releaseStudio, updateStudioDesired, validStudioClient, validStudioRoom } from "@/lib/studio-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const snapshot = (state: Awaited<ReturnType<typeof readStudioState>>, clientId: string, redactActual = false) => ({
  role: state.primaryClientId === clientId ? "primary" as const : "moderator" as const,
  epoch: state.epoch, revision: state.revision, desired: state.desired,
  primaryOnline: !!state.primaryClientId && state.leaseUntil > Date.now(), ...(redactActual ? {} : { actual: state.actual ? { ...state.actual, serverNow: Date.now() } : null }),
});

async function authorizedRoom(room: string) {
  return (await readRooms()).some(record => record.name === room);
}
export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room"), clientId = request.nextUrl.searchParams.get("clientId");
  const owner = isStudio(request);
  const admin = !owner && validStudioRoom(room) ? await isRoomAdmin(request, room) : false;
  const moderator = !owner && !admin && validStudioRoom(room) ? await isModerator(request, room) : false;
  if (!owner && !admin && !moderator) return NextResponse.json({ error: "Войдите в студию" }, { status: 401, headers: noStore });
  if (!validStudioRoom(room) || !validStudioClient(clientId)) return NextResponse.json({ error: "Некорректная комната или клиент" }, { status: 400 });
  if (!(await authorizedRoom(room))) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  const state = await readStudioState(room);
  return NextResponse.json(snapshot(state, admin || moderator || request.nextUrl.searchParams.get("mode") === "admin" ? "admin-readonly" : clientId, moderator), { headers: noStore });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 16_384) return new NextResponse(null, { status: 413 });
  let data: any;
  try { const raw = await request.text(); if (raw.length > 16_384) return new NextResponse(null, { status: 413 }); data = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const { action, room, clientId } = data ?? {};
  const owner = isStudio(request);
  const admin = !owner && validStudioRoom(room) ? await isRoomAdmin(request, room) : false;
  const moderator = !owner && !admin && validStudioRoom(room) ? await isModerator(request, room) : false;
  if (!owner && !admin && !moderator) return NextResponse.json({ error: "Войдите в студию" }, { status: 401, headers: noStore });
  if (!validStudioRoom(room) || !validStudioClient(clientId) || !["join", "claim", "heartbeat", "command", "release"].includes(action)) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!(await authorizedRoom(room))) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  try {
    if (action === "join") {
      if (admin || moderator || data.mode === "admin") return NextResponse.json(snapshot(await readStudioState(room), "admin-readonly", moderator), { headers: noStore });
      const result = await joinStudio(room, clientId);
      return NextResponse.json(snapshot(result.state, clientId), { headers: noStore });
    }
    if (moderator) return NextResponse.json({ error: "Модератор может только просматривать состояние студии" }, { status: 403, headers: noStore });
    if (action === "claim") {
      if (admin) return NextResponse.json({ error: "Room-admin не может занять эфир" }, { status: 403 });
      const state = await claimStudio(room, clientId);
      if (!state) return NextResponse.json({ error: "Ведущий ещё подключён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId), { headers: noStore });
    }
    if (!Number.isSafeInteger(data.epoch) || data.epoch < 1) return NextResponse.json({ error: "Некорректная версия ведущего" }, { status: 400 });
    if (admin && action !== "command") return NextResponse.json({ error: "Room-admin не может управлять ведущей сессией" }, { status: 403 });
    if (action === "heartbeat") {
      if (data.actual !== undefined && (!data.actual || typeof data.actual !== "object" || Array.isArray(data.actual) || Object.keys(data.actual).length > 32)) return NextResponse.json({ error: "Некорректное состояние" }, { status: 400 });
      const state = await heartbeatStudio(room, clientId, data.epoch, data.actual);
      if (!state) return NextResponse.json({ error: "Сеанс ведущего истёк или заменён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId), { headers: noStore });
    }
    if (admin && (!data.patch || typeof data.patch !== "object" || Array.isArray(data.patch) || Object.keys(data.patch).some(key => !["fps", "bitrate", "gain", "onAir"].includes(key)))) {
      return NextResponse.json({ error: "Room-admin не может менять предварительный просмотр" }, { status: 403 });
    }
    if (action === "release") {
      const state = await releaseStudio(room, clientId, data.epoch);
      if (!state) return NextResponse.json({ error: "Сеанс ведущего заменён" }, { status: 409 });
      return NextResponse.json(snapshot(state, clientId), { headers: noStore });
    }
    const result = await updateStudioDesired(room, data.epoch, data.patch);
    if (result && "stale" in result) return NextResponse.json({ error: "Состояние студии изменилось" }, { status: 409 });
    if (!result) return NextResponse.json({ error: "Некорректные настройки" }, { status: 400 });
    return NextResponse.json(snapshot(result.state, clientId), { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить состояние студии" }, { status: 500 });
  }
}
