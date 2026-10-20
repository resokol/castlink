import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/access";
import { hasHostedAccess } from "@/lib/hosted-access";
import { requestedStudioId, defaultStudioId, validateStudioId, mediaRoomName } from "@/lib/studio-scope";
import { RoomServiceClient } from "livekit-server-sdk";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRooms } from "@/lib/room-store";
import { canHostRoom } from "@/lib/room-studio-access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator } from "@/lib/moderator-access";
import { ensureSlotRoomScope, slotRoomAssociation, roomForSlotScope } from "@/lib/slot-room-scope";
import { resolveSlotActor, requireSlotActor } from "@/lib/guest-admission";
import { createCasterSlot, readCasterSlots, listPersonalCasterInvites, updateCasterSlot, rotateCasterSlotOutput, rotateCasterSlotInvite, deleteCasterSlot, createPersonalCasterInvite, deletePersonalCasterInvite } from "@/lib/caster-slot-store";
import { assignCasterToSlot, releaseCasterSlot, confirmCasterSlot, adoptConnectedCaster } from "@/lib/caster-slot-service";
import { createSlotOutputAccess, personalCasterInviteKey } from "@/lib/caster-slot-access";
import type { CasterSlot, SlotScope } from "@/lib/caster-slot-types";
export const dynamic="force-dynamic";const headers={"Cache-Control":"no-store"};
const bad=(error:string,status=403)=>NextResponse.json({error},{status,headers});
async function context(request:NextRequest,studioId:string,name:string,create=false){
 const room=(await readRooms(studioId)).find(r=>r.name===name);
 if(!room||!hasHostedAccess(request)||!(await canHostRoom(request,room,studioId)||await isRoomAdmin(request,name,studioId)||await isModerator(request,name,studioId)))return null;
 const scope=create?(await ensureSlotRoomScope(studioId,name)).scope:{studioId,roomAssociation:slotRoomAssociation(room)};
 return{scope,actor:scope.roomAssociation?await resolveSlotActor(request,scope):null};
}
async function links(slot:CasterSlot){
 const query=`?studioId=${encodeURIComponent(slot.scope.studioId)}`;
 return{...slot,cameraPath:`/output/slot/${slot.id}${query}&source=camera#access=${await createSlotOutputAccess(slot.scope,slot.id,"camera")}`,screenPath:`/output/slot/${slot.id}${query}&source=screen#access=${await createSlotOutputAccess(slot.scope,slot.id,"screen")}`};
}
async function snapshot(scope:SlotScope){
 const slots=await readCasterSlots(scope),invites=await listPersonalCasterInvites(scope);
 const pending:Array<{id:string;name:string;identity:string;state:string;proposedSlotId?:string;lastSeen:number}>=[];
 let rosterAvailable=true;
 try{const room=await roomForSlotScope(scope);if(room&&process.env.LIVEKIT_API_KEY&&process.env.LIVEKIT_API_SECRET){const client=new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||"http://127.0.0.1:7880",process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);for(const participant of await client.listParticipants(mediaRoomName(scope.studioId,room.name))){let m;try{m=JSON.parse(participant.metadata||"{}");}catch{continue;}if(m.role==="guest"&&m.studioId===scope.studioId&&!pending.some(q=>q.identity===participant.identity))pending.push({id:`live:${participant.sid}:${participant.identity}`,name:participant.name||participant.identity,identity:participant.identity,state:"connected",proposedSlotId:undefined,lastSeen:Date.now()});}}}catch{rosterAvailable=false;}
 return{slots:await Promise.all(slots.map(links)),invites:await Promise.all(invites.map(async invite=>({id:invite.id,path:`/join?studioId=${encodeURIComponent(scope.studioId)}#invite=${encodeURIComponent(await personalCasterInviteKey(invite))}`}))),queue:pending,rosterAvailable};
}
export async function GET(request:NextRequest){try{
 const studioId=requestedStudioId(request),ctx=await context(request,studioId,request.nextUrl.searchParams.get("room")||"");if(!ctx)return bad("Недостаточно прав");
 if(!ctx.scope.roomAssociation)return NextResponse.json({slots:[],invites:[],queue:[]},{headers});
 return NextResponse.json(await snapshot(ctx.scope),{headers});
}catch{return bad("Не удалось загрузить слоты",503);}}
export async function POST(request:NextRequest){
 if(!sameOrigin(request)||!hasHostedAccess(request))return bad("Недопустимый источник запроса");
 if(!consumeRateLimit(request,{scope:"caster-slots",limit:120,windowMs:60000}).ok)return bad("Слишком много запросов",429);
 try{
 const raw=await request.text();if(raw.length>16384)return bad("Слишком большой запрос",413);
 const b=JSON.parse(raw),studioId=validateStudioId(b.studioId||defaultStudioId());
 const ctx=await context(request,studioId,b.room,true);if(!ctx?.actor)return bad("Недостаточно прав");
 const {scope,actor}=ctx,guard=()=>requireSlotActor(actor,scope);await guard();
 switch(b.action){
  case "create":await createCasterSlot(scope,{name:b.name,inviteId:b.inviteId},guard);break;
  case "create-invite":await createPersonalCasterInvite(scope,guard);break;
  case "delete-invite":await deletePersonalCasterInvite(scope,b.id,guard);break;
  case "rotate-invite":await rotateCasterSlotInvite(scope,b.id,b.revision,guard);break;
  case "update":await updateCasterSlot(scope,b.id,b.revision,{name:b.name,inviteId:b.inviteId},guard);break;
  case "rotate":if(!["camera","screen"].includes(b.source))return bad("Недопустимый источник",400);await rotateCasterSlotOutput(scope,b.id,b.revision,b.source,guard);break;
  case "assign":{let id=b.admissionId;if(typeof id!=="string")return bad("Вход кастера устарел",400);if(id.startsWith("live:")){const match=id.match(/^live:([^:]+):(guest-.+)$/);if(!match)return bad("Вход кастера устарел",400);id=(await adoptConnectedCaster(actor,scope,match[2],match[1])).id;}await assignCasterToSlot(actor,scope,b.id,id,b.revision,b.replace===true);break;}
  case "release":await releaseCasterSlot(actor,scope,b.id,b.revision);break;
  case "confirm":await confirmCasterSlot(scope,b.id);break;
  case "delete":await deleteCasterSlot(scope,b.id,b.revision,guard);break;
  default:return bad("Недопустимая операция",400);
 }
 return NextResponse.json(await snapshot(scope),{headers});
 }catch(error){return bad(error instanceof Error?error.message:"Не удалось изменить слот",(error as {status?:number}).status||400);}
}
