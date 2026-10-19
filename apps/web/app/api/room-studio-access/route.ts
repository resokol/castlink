import { hasHostedAccess } from "../../../lib/hosted-access";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, encryptRoomPassword, hashPassword, sameOrigin } from "@/lib/access";
import { deploymentModel } from "@/lib/deployment-model";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { readRooms, updateRooms, type RoomRecord } from "@/lib/room-store";
import { canHostNamedRoom, clearRoomStudioCookie, setRoomStudioCookie, verifiedRoomStudioSession } from "@/lib/room-studio-access";
import { validPublicRoomName } from "@/lib/public-room-name";
import { defaultStudioId } from "@/lib/studio-scope";
import { changeRoomCreationPassword, roomCreationEnabled, validRoomCreationPassword } from "@/lib/room-creation-access";
const reply = (value: unknown,status=200,headers={})=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store",...headers}});
function scope(value: unknown) { if (value !== undefined && value !== "" && value !== defaultStudioId()) throw new Error("scope"); return defaultStudioId(); }
function name(value: unknown) { if (typeof value!=="string" || !value.trim() || value.trim().length>100) throw new Error("name"); return value.trim(); }
export async function GET(request: NextRequest) {
  try { const studioId=scope(request.nextUrl.searchParams.get("studioId")||undefined), roomName=name(request.nextUrl.searchParams.get("name"));
    if(request.nextUrl.searchParams.get("setting")==="creation-password") {
      if(deploymentModel()!=="self-hosted" || !(await canHostNamedRoom(request,roomName,studioId)))return reply({error:"Нужен вход студии"},401);
      try {return reply({allowed:true,configured:await roomCreationEnabled()});}
      catch {return reply({error:"Настройка пароля недоступна. Обратитесь к владельцу сервера."},503);}
    }
    const room=(await readRooms(studioId)).find(r=>r.name===roomName);
    return reply({exists:!!room,allowed:!!room && !!verifiedRoomStudioSession(request,room,studioId)});
  } catch { return reply({error:"Некорректная комната"},400); }
}
export async function POST(request: NextRequest) {
  if (!hasHostedAccess(request)) return reply({error:"Нужен действующий токен доступа"},401);
  if (!request.headers.get("origin") || !sameOrigin(request)) return reply({error:"Недопустимый источник"},403);
  if (deploymentModel()!=="self-hosted") return reply({error:"Публичное создание недоступно"},403);
  let body: {action?:unknown;name?:unknown;studioId?:unknown;studioPassword?:unknown;password?:unknown;creationPassword?:unknown;currentPassword?:unknown;newPassword?:unknown;confirmation?:unknown};
  try {const raw=await request.text(); if(Buffer.byteLength(raw)>4096)return reply({error:"Слишком большой запрос"},413);body=JSON.parse(raw);if(!body || typeof body!=="object" || Array.isArray(body))throw new Error();}catch{return reply({error:"Некорректный запрос"},400);}
  try {
    const studioId=scope(body.studioId), roomName=name(body.name);
    if(body.action==="change-creation-password") {
      if(!(await canHostNamedRoom(request,roomName,studioId)))return reply({error:"Нужен вход студии"},401);
      const limit=consumeRateLimit(request,{scope:"room-creation-password-change",limit:10,windowMs:300_000});
      if(!limit.ok)return reply({error:"Слишком много попыток. Повторите через 5 минут."},429,rateLimitHeaders(limit));
      if(body.newPassword!==body.confirmation)return reply({error:"Новые пароли не совпадают"},400);
      try {
        const result=await changeRoomCreationPassword(body.currentPassword,body.newPassword,()=>canHostNamedRoom(request,roomName,studioId));
        if(result==="invalid-password")return reply({error:"Новый пароль: от 8 до 256 символов, без переводов строк и пустого значения."},400);
        if(result==="unauthorized")return reply({error:"Нужен вход студии"},401);
        if(result==="denied")return reply({error:"Неверный текущий пароль создания комнат"},403);
        return reply({ok:true});
      } catch {return reply({error:"Не удалось сохранить пароль. Попробуйте ещё раз или обратитесь к владельцу сервера."},503);}
    }
    if(body.action!=="create" && body.action!=="login")return reply({error:"Некорректное действие"},400);
    const studioPassword=body.studioPassword, password=body.password ?? "";
    if(typeof studioPassword!=="string" || studioPassword.length<8 || studioPassword.length>256 || typeof password!=="string" || password.length>256)return reply({error:"Пароль студии: от 8 до 256 символов"},400);
    const limit=consumeRateLimit(request,{scope:`room-studio-${body.action}`,limit:body.action==="create"?20:20,windowMs:60_000});
    if(!limit.ok)return reply({error:"Слишком много попыток"},429,rateLimitHeaders(limit));
    let room: RoomRecord | undefined;
    if(body.action==="create") {
      try {
        if(!(await roomCreationEnabled()))return reply({error:"Создание комнат пока недоступно. Обратитесь к владельцу сервера."},503);
      } catch {return reply({error:"Создание комнат пока недоступно. Обратитесь к владельцу сервера."},503);}
      if(!(await validRoomCreationPassword(body.creationPassword)))return reply({error:"Неверный пароль создания комнат"},403);
      if(!validPublicRoomName(roomName))return reply({error:"Это имя зарезервировано системой"},400);
      const candidate: RoomRecord={name:roomName,creatorAccessId:randomUUID(),studioPasswordHash:hashPassword(studioPassword),guestInviteVersion:randomUUID(),viewerAccessVersion:randomUUID(),outputAccessVersion:randomUUID(),...(password?{passwordHash:hashPassword(password),passwordCiphertext:encryptRoomPassword(password)}:{})};
      try { await updateRooms(rooms=>{if(rooms.some(r=>r.name===roomName))throw new Error("duplicate");room=candidate;return [...rooms,candidate];},studioId); }
      catch(error){if(error instanceof Error && error.message==="duplicate")return reply({error:"Комната уже существует"},409);throw error;}
    } else {
      room=(await readRooms(studioId)).find(r=>r.name===roomName);
      if(!room?.creatorAccessId || !room.studioPasswordHash || !checkPassword(studioPassword,room.studioPasswordHash))return reply({error:"Неверное имя комнаты или пароль студии"},401);
    }
    const response=reply({allowed:true,name:roomName,studioId});setRoomStudioCookie(response,request,room!,studioId);return response;
  } catch {return reply({error:"Некорректная комната или операция недоступна"},400);}
}
export async function DELETE(request: NextRequest) {
  if(!request.headers.get("origin") || !sameOrigin(request))return reply({error:"Недопустимый источник"},403);
  try {const studioId=scope(request.nextUrl.searchParams.get("studioId")||undefined),roomName=name(request.nextUrl.searchParams.get("name"));const room=(await readRooms(studioId)).find(r=>r.name===roomName);const response=reply({allowed:false});if(room)clearRoomStudioCookie(response,room);return response;}catch{return reply({error:"Некорректная комната"},400);}
}
