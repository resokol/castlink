import { RoomServiceClient } from "livekit-server-sdk";
import { readCasterSlot, transactCasterSlots } from "./caster-slot-store";
import { CasterSlotConflict, sameSlotScope, type CasterSession, type CasterSlot, type SlotScope } from "./caster-slot-types";
import { requireSlotActor, type SlotActor } from "./guest-admission";
import { readGuestAdmission, adoptGuestAdmission, type AdmissionSession } from "./guest-admission-store";
import { roomForSlotScope, slotRoomVersion } from "./slot-room-scope";
import { mediaRoomName } from "./studio-scope";

type Participant={identity:string;sid:string;metadata?:string;name?:string};
export type SlotMedia={getParticipant:(room:string,identity:string)=>Promise<Participant>;removeParticipant:(room:string,identity:string)=>Promise<unknown>};
const provider=():SlotMedia=>new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||"http://127.0.0.1:7880",process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
function metadata(participant:Participant){try{return JSON.parse(participant.metadata||"{}");}catch{return {};}}
function matches(participant:Participant,session:AdmissionSession,binding?:CasterSession){
 const m=metadata(participant);
 return participant.identity===session.identity&&(!binding?.participantSid||binding.participantSid===participant.sid)&&m.role==="guest"&&m.studioId===session.scope.studioId&&
  (session.mediaSessionId ? m.transferSessionId===session.mediaSessionId :
   m.admissionId===session.id&&m.admissionGeneration===session.generation||!!session.legacyParticipantSid&&participant.sid===session.legacyParticipantSid);
}
async function participantOrNull(media:SlotMedia,room:string,identity:string){try{return await media.getParticipant(room,identity);}catch(error){if((error as {status?:number;code?:string}).status===404||(error as {code?:string}).code==="not_found")return null;throw error;}}
function slotAt(slots:Record<string,CasterSlot>,scope:SlotScope,id:string,revision?:number){const slot=Object.hasOwn(slots,id)?slots[id]:null;if(!slot||!sameSlotScope(slot.scope,scope)||revision!==undefined&&slot.revision!==revision)throw new CasterSlotConflict("Слот уже изменён. Обновите список.");return slot;}
/** Outputs map an existing room session; they never grant entry or stop publication. */
export async function assignCasterToSlot(actor:SlotActor,scope:SlotScope,slotId:string,admissionId:string,expectedRevision:number,replace:boolean,media:SlotMedia=provider()){
 if(actor.kind==="guest")throw new Error("Недостаточно прав");
 await requireSlotActor(actor,scope);const room=await roomForSlotScope(scope);if(!room)throw new Error("Комната не найдена");
 const session=await readGuestAdmission(scope.studioId,admissionId);
 if(!session||!sameSlotScope(session.scope,scope)||session.state!=="admitted"||session.expiresAt<=Date.now()||session.roomVersion!==slotRoomVersion(room))throw new Error("Вход кастера устарел");
 const live=await participantOrNull(media,mediaRoomName(scope.studioId,room.name),session.identity);
 if(!live||!matches(live,session))throw new CasterSlotConflict("Кастер не подключён к комнате");
 return transactCasterSlots(scope.studioId,async data=>{
  await requireSlotActor(actor,scope);const slot=slotAt(data.slots,scope,slotId,expectedRevision);
  if(slot.assignment&&slot.assignment.sessionId!==session.id&&!replace)throw new CasterSlotConflict("Слот занят. Подтвердите замену.");
  // One transaction moves the mapping, preserving every participant connection.
  for(const other of Object.values(data.slots))if(other.id!==slotId&&other.assignment?.sessionId===session.id){
   if(!sameSlotScope(other.scope,scope))throw new CasterSlotConflict("Кастер уже участвует в другом назначении");
   other.assignment=null;other.phase="empty";delete other.transition;delete other.previousAssignment;other.revision++;
  }
  slot.assignment={sessionId:session.id,identity:session.identity,generation:session.generation,participantSid:live.sid,...(session.legacyParticipantSid?{legacy:true}:{})};
  slot.phase="assigned";delete slot.transition;delete slot.previousAssignment;slot.revision++;return structuredClone(slot);
 });
}
export async function releaseCasterSlot(actor:SlotActor,scope:SlotScope,slotId:string,expectedRevision:number,_media:SlotMedia=provider()){
 await requireSlotActor(actor,scope);
 return transactCasterSlots(scope.studioId,async data=>{
  await requireSlotActor(actor,scope);const slot=slotAt(data.slots,scope,slotId,expectedRevision);
  if(actor.kind==="guest"&&slot.assignment?.sessionId!==actor.sessionId)throw new CasterSlotConflict("Назначение изменилось");
  slot.assignment=null;slot.phase="empty";delete slot.transition;delete slot.previousAssignment;slot.revision++;return structuredClone(slot);
 });
}
export async function confirmCasterSlot(scope:SlotScope,slotId:string,media:SlotMedia=provider()){
 const room=await roomForSlotScope(scope),before=await readCasterSlot(scope.studioId,slotId);if(!room||!before||!sameSlotScope(before.scope,scope)||!before.assignment||before.transition)return before;
 const session=await readGuestAdmission(scope.studioId,before.assignment.sessionId);if(!session||session.state!=="admitted"||session.roomVersion!==slotRoomVersion(room))return null;
 const live=await participantOrNull(media,mediaRoomName(scope.studioId,room.name),session.identity);
 if(live&&matches(live,session)&&before.phase==="assigned"&&before.assignment.participantSid===live.sid)return before;
 if(!live&&before.phase!=="assigned")return before;
 return transactCasterSlots(scope.studioId,data=>{
  const slot=slotAt(data.slots,scope,slotId);if(slot.revision!==before.revision||slot.transition||slot.assignment?.sessionId!==session.id)return structuredClone(slot);
  if(live&&matches(live,session)){
   if(slot.phase!=="assigned"||slot.assignment.participantSid!==live.sid){slot.phase="assigned";slot.assignment.participantSid=live.sid;slot.revision++;}
  }else if(slot.phase==="assigned"){slot.phase="disconnected";slot.revision++;}
  return structuredClone(slot);
 });
}
export async function admissionHasSlot(session:AdmissionSession){
 const {readCasterSlots}=await import("./caster-slot-store");
 return(await readCasterSlots(session.scope)).some(s=>s.assignment?.sessionId===session.id&&s.assignment.generation===session.generation&&!s.transition);
}
export async function adoptConnectedCaster(actor:SlotActor,scope:SlotScope,identity:string,sid:string,media:SlotMedia=provider()){
 if(actor.kind==="guest")throw new Error("Недостаточно прав");
 await requireSlotActor(actor,scope);const room=await roomForSlotScope(scope);if(!room)throw new Error("Комната не найдена");
 const participant=await media.getParticipant(mediaRoomName(scope.studioId,room.name),identity),m=metadata(participant);
 if(participant.sid!==sid||m.role!=="guest"||m.studioId!==scope.studioId||!identity.startsWith("guest-"))throw new CasterSlotConflict("Медиасессия изменилась; обновите список");
 if(typeof m.admissionId==="string"){const existing=await readGuestAdmission(scope.studioId,m.admissionId);if(existing?.state==="admitted"&&existing.identity===identity&&sameSlotScope(existing.scope,scope)&&existing.generation===m.admissionGeneration)return existing;throw new Error("Допуск отозван");}
 return adoptGuestAdmission(scope,{identity,sid,name:participant.name||identity,roomVersion:slotRoomVersion(room),...(typeof m.transferSessionId==="string"&&m.transferSessionId?{mediaSessionId:m.transferSessionId}:{})});
}
