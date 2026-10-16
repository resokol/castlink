import { NextRequest, NextResponse } from "next/server";
import { accessStudioMatches, readAccess, roomVersion, sameOrigin } from "../../../lib/access";
import { isRoomAdmin } from "../../../lib/room-admin";
import { canHostRoom } from "../../../lib/room-studio-access";
import { readRooms, type RoomRecord } from "../../../lib/room-store";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";
import { MultiviewError, validateMultiviewScene, validMultiviewId } from "../../../lib/multiview";
import { applyMultiviewScene, readMultiviewScenes } from "../../../lib/multiview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const answer = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const canEdit = async (request: NextRequest, room: RoomRecord, studioId: string) => await canHostRoom(request, room, studioId) || await isRoomAdmin(request, room.name, studioId);

function scope(studioId: unknown, room: unknown) {
  if (typeof room !== "string" || !room || room.length > 100) throw new MultiviewError("Не указана комната");
  try { return { studioId: validateStudioId(typeof studioId === "string" && studioId ? studioId : defaultStudioId()), room }; }
  catch { throw new MultiviewError("Некорректный studioId"); }
}

function viewerAllowed(request: NextRequest, room: RoomRecord, studioId: string) {
  // This is the existing room-wide media capability, not a scene-only grant.
  const grant = readAccess(request.headers.get("x-castlink-view-access") || undefined);
  return grant?.kind === "viewer" && grant.room === room.name && accessStudioMatches(grant, studioId) && grant.version === (room.outputAccessVersion || roomVersion(room.passwordHash));
}

function failure(error: unknown) {
  return error instanceof MultiviewError ? answer({ error: error.message }, error.status) : answer({ error: "Не удалось загрузить или сохранить сцену" }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const selected = scope(request.nextUrl.searchParams.get("studioId"), request.nextUrl.searchParams.get("room"));
    const room = (await readRooms(selected.studioId)).find(record => record.name === selected.room);
    if (!room) return answer({ error: "Комната не найдена" }, 404);
    const sceneId = request.nextUrl.searchParams.get("sceneId");
    if (sceneId !== null && !validMultiviewId(sceneId)) throw new MultiviewError("Некорректная сцена");
    if (!await canEdit(request, room, selected.studioId) && !(sceneId && viewerAllowed(request, room, selected.studioId))) return answer({ error: "Нет доступа к сценам комнаты" }, 403);
    const scenes = await readMultiviewScenes(selected.studioId, room);
    if (sceneId === null) return answer({ scenes });
    const scene = scenes.find(item => item.id === sceneId);
    return scene ? answer({ scene }) : answer({ error: "Сцена не найдена" }, 404);
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return answer({ error: "Недопустимый источник запроса" }, 403);
  try {
    // Bound the stream before buffering: an untrusted uploader cannot allocate an arbitrary request body.
    const reader = request.body?.getReader();
    let raw = "", bytes = 0;
    const decoder = new TextDecoder();
    if(reader)try { while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>131072){await reader.cancel();return answer({error:"Запрос слишком большой"},413);}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();} finally {reader.releaseLock();}
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); }
    catch { throw new MultiviewError("Некорректный JSON"); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new MultiviewError("Некорректный запрос");
    const selected = scope(data.studioId, data.room);
    const room = (await readRooms(selected.studioId)).find(record => record.name === selected.room);
    if (!room) return answer({ error: "Комната не найдена" }, 404);
    if (!await canEdit(request, room, selected.studioId)) return answer({ error: "Требуется доступ студии или администратора комнаты" }, 403);
    if (!Number.isSafeInteger(data.expectedRevision) || Number(data.expectedRevision) < 0) throw new MultiviewError("Некорректная версия сцены");
    const scene = validateMultiviewScene(data.scene);
    return answer({ scene: await applyMultiviewScene(selected.studioId, room, scene, Number(data.expectedRevision), current => canEdit(request, current, selected.studioId)) });
  } catch (error) { return failure(error); }
}
