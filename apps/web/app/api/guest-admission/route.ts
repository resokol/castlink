import { NextRequest, NextResponse } from "next/server";
import { canJoin, sameOrigin } from "@/lib/access";
import { hasHostedAccess } from "@/lib/hosted-access";
import { requestedStudioId, defaultStudioId, validateStudioId } from "@/lib/studio-scope";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRooms } from "@/lib/room-store";
import { ensureSlotRoomScope, roomForSlotScope, slotRoomAssociation, slotRoomVersion } from "@/lib/slot-room-scope";
import { startGuestAdmission, touchGuestAdmission, changeGuestAdmission, type AdmissionSession } from "@/lib/guest-admission-store";
import { verifiedGuestAdmission } from "@/lib/guest-admission";
import { resolvePersonalCasterInvite, personalCasterInviteKey } from "@/lib/caster-slot-access";
import { readCasterSlots, readPersonalCasterInvite } from "@/lib/caster-slot-store";
import { confirmCasterSlot, releaseCasterSlot } from "@/lib/caster-slot-service";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const bad=(error:string,status=403)=>NextResponse.json({error},{status,headers});
async function status(s:AdmissionSession){
 const slot=s.state==="admitted"?(await readCasterSlots(s.scope)).find(slot=>slot.assignment?.sessionId===s.id&&slot.assignment.generation===s.generation&&!slot.transition):undefined;
 const invite=slot?await readPersonalCasterInvite(s.scope.studioId,slot.inviteId):null;
 return{id:s.id,name:s.name,state:s.state,proposedSlotId:s.proposedSlotId,...(slot&&invite?.enabled?{slot:{id:slot.id,name:slot.name,personalPath:`/join?studioId=${encodeURIComponent(s.scope.studioId)}#invite=${encodeURIComponent(await personalCasterInviteKey(invite))}`}}:{})};
}
export async function GET(request:NextRequest){try{
 if(!hasHostedAccess(request))return bad("Недостаточно прав");
 const studioId=requestedStudioId(request),room=(await readRooms(studioId)).find(r=>r.name===request.nextUrl.searchParams.get("room"));
 if(!room||!slotRoomAssociation(room))return bad("Вход недействителен");
 const scope={studioId,roomAssociation:slotRoomAssociation(room)},session=await verifiedGuestAdmission(request,scope);
 if(!session||session.roomVersion!==slotRoomVersion(room))return bad("Вход устарел");
 const current=session.state==="waiting"?await changeGuestAdmission(scope,session.id,"waiting","admitted"):session;
 return NextResponse.json(await status(current),{headers});
}catch{return bad("Не удалось проверить допуск",503);}}
export async function POST(request:NextRequest){
 if(!sameOrigin(request)||!hasHostedAccess(request))return bad("Недопустимый источник запроса");
 if(!consumeRateLimit(request,{scope:"guest-admission",limit:90,windowMs:60000}).ok)return bad("Слишком много запросов",429);
 try{
 const raw=await request.text();if(raw.length>16384)return bad("Слишком большой запрос",413);
 const body=JSON.parse(raw),studioId=validateStudioId(body.studioId||defaultStudioId());
 const invite=body.invite?await resolvePersonalCasterInvite(body.invite,studioId):null;
 if(body.invite&&!invite)return bad("Приглашение недействительно");
 const room=invite?await roomForSlotScope(invite.scope):(await readRooms(studioId)).find(r=>r.name===body.room);
 if(!room)return bad("Комната не найдена",404);
 if(body.action==="resolve"&&invite)return NextResponse.json({studioId,room:room.name},{headers});
 if(body.action==="leave"){
  const scope={studioId,roomAssociation:slotRoomAssociation(room)},session=await verifiedGuestAdmission(request,scope);if(!session)return bad("Вход недействителен");
  const slot=(await readCasterSlots(scope)).find(s=>s.assignment?.sessionId===session.id);
  if(slot){const actor={studioId,kind:"guest" as const,sessionId:session.id,roomAssociation:scope.roomAssociation,authorize:async()=>{const proof=await verifiedGuestAdmission(request,scope);return !!proof&&proof.id===session.id;}};await releaseCasterSlot(actor,scope,slot.id,slot.revision);}
  const current=await verifiedGuestAdmission(request,scope);if(current)await changeGuestAdmission(scope,current.id,current.state,"closed");
  return NextResponse.json({state:"closed"},{headers});
 }
 if(body.action!=="start"&&body.action!=="confirm")return bad("Недопустимая операция",400);
 if(body.action==="confirm"){
  const scope={studioId,roomAssociation:slotRoomAssociation(room)},session=await verifiedGuestAdmission(request,scope);
  if(!session||session.state!=="admitted"||session.roomVersion!==slotRoomVersion(room))return bad("Допуск отозван");
  const slot=(await readCasterSlots(scope)).find(s=>s.assignment?.sessionId===session.id);if(!slot)return NextResponse.json({ready:false},{headers});
  const confirmed=await confirmCasterSlot(scope,slot.id);return NextResponse.json({ready:confirmed?.phase==="assigned"},{headers});
 }
 if(!invite&&!canJoin(request,room.name,room.passwordHash,studioId))return bad("Вход запрещён");
 const {scope}=await ensureSlotRoomScope(studioId,room.name);
 const proposed=invite?(await readCasterSlots(scope)).find(s=>s.inviteId===invite.id):undefined;
 const result=await startGuestAdmission(scope,{clientId:body.clientId,name:body.name,roomVersion:slotRoomVersion(room),capability:request.headers.get("x-castlink-guest-admission")||undefined,...(invite?{inviteId:invite.id,inviteVersion:invite.version,proposedSlotId:proposed?.id}:{})});
 const current=result.session.state==="waiting"?await changeGuestAdmission(scope,result.session.id,"waiting","admitted"):result.session;
 return NextResponse.json({...await status(current),capability:result.capability},{headers});
 }catch{return bad("Не удалось запросить допуск",400);}
}
