import type { NextRequest } from "next/server";
import { canHostRoom, verifiedRoomStudioSession } from "./room-studio-access";
import { isStudioOwner } from "./studio-owner-access";
import { isRoomAdmin } from "./room-admin";
import { isModerator } from "./moderator-access";
import { roomForSlotScope } from "./slot-room-scope";
import { verifyGuestAdmissionCapability } from "./guest-admission-store";
import type { SlotScope } from "./caster-slot-types";
export type SlotActor={studioId:string;kind:"owner"|"admin"|"moderator"|"studio"|"guest";roomAssociation?:string;sessionId?:string;authorize:()=>Promise<boolean>};
export async function resolveSlotActor(request:NextRequest,scope:SlotScope):Promise<SlotActor|null>{
 const authorize=async()=>{const room=await roomForSlotScope(scope);return !!room&&(await canHostRoom(request,room,scope.studioId)||await isRoomAdmin(request,room.name,scope.studioId)||await isModerator(request,room.name,scope.studioId));};
 if(!await authorize())return null;
 const owner=await isStudioOwner(request,scope.studioId),room=await roomForSlotScope(scope);
 const kind=owner?"owner":room&&verifiedRoomStudioSession(request,room,scope.studioId)?"studio":room&&await isRoomAdmin(request,room.name,scope.studioId)?"admin":"moderator";
 return{studioId:scope.studioId,kind,roomAssociation:scope.roomAssociation,authorize};
}
export async function requireSlotActor(actor:SlotActor,scope:SlotScope){if(actor.studioId!==scope.studioId||actor.roomAssociation&&actor.roomAssociation!==scope.roomAssociation||!await actor.authorize())throw new Error("Недостаточно прав");}
export const verifiedGuestAdmission=(request:NextRequest,scope:SlotScope)=>verifyGuestAdmissionCapability(request.headers.get("x-castlink-guest-admission")||"",scope);
