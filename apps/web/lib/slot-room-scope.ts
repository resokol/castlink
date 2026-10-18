import { randomUUID } from "node:crypto";
import { readRooms, updateRooms, type RoomRecord } from "./room-store";
import { roomVersion } from "./access";
import type { SlotScope } from "./caster-slot-types";
export const slotRoomAssociation=(room:RoomRecord)=>room.creatorAccessId||room.slotAssociationId||"";
export const slotRoomVersion=(room:RoomRecord)=>`${room.guestInviteVersion||roomVersion(room.passwordHash)}:${roomVersion(room.passwordHash)}`;
export async function ensureSlotRoomScope(studioId:string,roomName:string):Promise<{scope:SlotScope;room:RoomRecord}>{
 let room=(await readRooms(studioId)).find(r=>r.name===roomName);if(!room)throw new Error("Комната не найдена");
 if(!slotRoomAssociation(room)){
  const expected=room;
  const next=await updateRooms(rooms=>rooms.map(current=>{
   if(current.name!==roomName)return current;
   if(current.creatorAccessId!==expected.creatorAccessId||current.passwordHash!==expected.passwordHash||current.studioPasswordHash!==expected.studioPasswordHash)throw new Error("Комната уже изменена");
   return {...current,slotAssociationId:current.slotAssociationId||randomUUID()};
  }),studioId);room=next.find(r=>r.name===roomName);if(!room)throw new Error("Комната не найдена");
 }return{room,scope:{studioId,roomAssociation:slotRoomAssociation(room)}};
}
export async function roomForSlotScope(scope:SlotScope){return(await readRooms(scope.studioId)).find(room=>slotRoomAssociation(room)===scope.roomAssociation)||null;}
