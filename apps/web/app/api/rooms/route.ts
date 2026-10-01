import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canJoin, decryptRoomPassword, encryptRoomPassword, hashPassword, isStudio, roomVersion, sameOrigin, signAccess } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator, verifiedRoomModeratorSession } from "@/lib/moderator-access";
import { ensureRoomAccessVersions, readRooms, updateRooms } from "@/lib/room-store";
import { readStudioState } from "@/lib/studio-control";
import { RoomServiceClient } from "livekit-server-sdk";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { isStudioOwner } from "../../../lib/studio-owner-access";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
export async function GET(request: NextRequest) {
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
  const rooms = await readRooms(studioId);
  const name = request.nextUrl.searchParams.get("name");
  if (name) {
    let room = rooms.find(r => r.name === name);
    const owner = await isStudioOwner(request, studioId);
    if (room && owner && (!room.guestInviteVersion || !room.viewerAccessVersion || !room.outputAccessVersion)) {
      room = await ensureRoomAccessVersions(name, studioId) || room;
    }
    const admin = !!room && !owner && await isRoomAdmin(request, name, studioId);
    const moderator = !!room && !owner && !admin && await isModerator(request, name, studioId);
    const scopedModerator = !!room && !owner && !admin && await verifiedRoomModeratorSession(request, name, studioId);
    return NextResponse.json({ exists: !!room, studioOnly: room?.studioOnly === true, passwordRequired: !!room?.passwordHash && !canJoin(request, name, room.passwordHash, studioId),
      ...(room && (owner || admin || moderator || scopedModerator) ? { passwordSet: !!room.passwordHash, guestPassword: decryptRoomPassword(room.passwordCiphertext) || undefined } : {}),
      ...(room && (owner || admin || moderator || scopedModerator) ? { viewAccess: signAccess({ kind: "viewer", studio: studioId, room: name, version: room.outputAccessVersion || roomVersion(room.passwordHash) }, 30 * 86400) } : {}) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (await isStudioOwner(request, studioId) || await isModerator(request, undefined, studioId)) return NextResponse.json({ studioId, rooms: rooms.map(r => r.name), protectedRooms: rooms.filter(r => r.passwordHash).map(r => r.name) }, { headers: { "Cache-Control": "no-store" } });
  const scopedRooms = (await Promise.all(rooms.map(async item => await verifiedRoomModeratorSession(request, item.name, studioId) ? item.name : null))).filter((room): room is string => !!room);
  if (!scopedRooms.length) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ rooms: scopedRooms, protectedRooms: rooms.filter(r => scopedRooms.includes(r.name) && r.passwordHash).map(r => r.name) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const reqId = requestId(request);
  const started = Date.now();
  if (!sameOrigin(request)) {
    serverLog("warn", "rooms.denied", { requestId: reqId, reason: "origin", status: 403 });
    return new NextResponse(null, { status: 403, headers: requestHeaders(reqId) });
  }
  try {
    const { action, name, newName, password = "", studioOnly, studioId: rawStudioId = "" } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: requestHeaders(reqId) }); }
    const owner = await isStudioOwner(request, studioId);
    const cleanName = typeof name === "string" ? name.trim() : "";
    const admin = !owner && !!cleanName && await isRoomAdmin(request, cleanName, studioId);
    const scopedModerator = !owner && !admin && !!cleanName && !!(await verifiedRoomModeratorSession(request, cleanName, studioId));
    const moderator = !owner && !admin && !scopedModerator && await isModerator(request, undefined, studioId);
    if (!owner && !admin && !moderator && !scopedModerator) return new NextResponse(null, { status: 401 });
    if (admin && action !== "password" && action !== "mode") return NextResponse.json({ error: "Это действие доступно только владельцу студии" }, { status: 403 });
    if (scopedModerator && action !== "password" && action !== "mode") return NextResponse.json({ error: "Модератору комнаты это действие недоступно" }, { status: 403 });
    if (moderator && !["create", "rename", "password", "mode"].includes(action)) return NextResponse.json({ error: "Модератору это действие недоступно" }, { status: 403 });
    if (typeof name !== "string" || !name.trim() || name.length > 100 || typeof password !== "string" || password.length > 256) throw Error("Некорректные данные комнаты");
    const clean = cleanName;
    if (moderator && action === "rename") {
      if (typeof newName !== "string" || !newName.trim() || newName.length > 100) throw Error("Недопустимое название комнаты");
      const current = await readRooms(studioId);
      if (current.some(r => r.name === newName.trim())) throw Error("Недопустимое название комнаты");
      const state = await readStudioState(mediaRoomName(studioId, clean));
      if (state.primaryClientId && state.leaseUntil > Date.now()) return NextResponse.json({ error: "Переименовать можно только пустую комнату" }, { status: 409 });
      const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      const mediaRoom = mediaRoomName(studioId, clean);
      if ((await lk.listRooms([mediaRoom])).length && (await lk.listParticipants(mediaRoom)).length) return NextResponse.json({ error: "Переименовать можно только пустую комнату" }, { status: 409 });
    }
    const rooms = await updateRooms(current => {
      if (action === "create") {
        if (current.some(r => r.name === clean)) throw Error("Комната уже существует");
        return [...current, {
          name: clean,
          guestInviteVersion: randomUUID(),
          viewerAccessVersion: randomUUID(),
          outputAccessVersion: randomUUID(),
          ...(password ? { passwordHash: hashPassword(password), passwordCiphertext: encryptRoomPassword(password) } : {}),
        }];
      }
      if (!current.some(r => r.name === clean)) throw Error("Комната не найдена");
      if (action === "password") {
        return current.map(r => r.name === clean ? {
          ...r,
          guestInviteVersion: randomUUID(),
          viewerAccessVersion: randomUUID(),
          outputAccessVersion: randomUUID(),
          ...(password ? { passwordHash: hashPassword(password), passwordCiphertext: encryptRoomPassword(password) } : { passwordHash: undefined, passwordCiphertext: undefined }),
        } : r);
      }
      if (action === "mode") {
        if (typeof studioOnly !== "boolean") throw Error("Некорректный режим комнаты");
        return current.map(r => r.name === clean ? { ...r, studioOnly } : r);
      }
      if (action === "rename") {
        if (typeof newName !== "string" || !newName.trim() || newName.length > 100 || current.some(r => r.name === newName.trim())) throw Error("Недопустимое название комнаты");
        return current.map(r => r.name === clean ? { ...r, name: newName.trim() } : r);
      }
      if (action === "delete") {
        if (current.length < 2) throw Error("Нельзя удалить последнюю комнату");
        return current.filter(r => r.name !== clean);
      }
      throw Error("Неизвестное действие");
    }, studioId);
    serverLog("info", "rooms.mutation", { requestId: reqId, action, studioId, room: clean, status: 200, durationMs: Date.now() - started });
    if (admin || moderator && action !== "create" || scopedModerator) return NextResponse.json({ ok: true }, { headers: requestHeaders(reqId) });
    return NextResponse.json({ rooms: rooms.map(r => r.name) }, { headers: requestHeaders(reqId) });
  } catch (e) {
    serverLog("warn", "rooms.mutation_failed", { requestId: reqId, status: 400, durationMs: Date.now() - started, error: e instanceof Error ? e.message : "room_error" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка комнаты" }, { status: 400, headers: requestHeaders(reqId) });
  }
}
