import { createHmac, timingSafeEqual } from "node:crypto";
import { getInstallationIdentity } from "./persistent-storage";
import { readCasterSlot, readPersonalCasterInvite } from "./caster-slot-store";
import { sameSlotScope, type PersonalCasterInvite, type SlotScope } from "./caster-slot-types";
async function signature(parts: string[]) {
  const secret=process.env.CASTLINK_SESSION_SECRET?.trim()||process.env.LIVEKIT_API_SECRET?.trim();if(!secret)throw new Error("Slot signing is not configured");
  return createHmac("sha256",secret).update(JSON.stringify(["castlink-slot-v1",(await getInstallationIdentity()).installationId,...parts])).digest("base64url");
}
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export async function createSlotOutputAccess(scope:SlotScope,id:string,source:"camera"|"screen") {
  const slot=await readCasterSlot(scope.studioId,id);if(!slot||!sameSlotScope(slot.scope,scope)||!slot.outputVersions[source])throw new Error("Слот не найден");
  return signature(["output",scope.studioId,scope.roomAssociation,id,source,slot.outputVersions[source]]);
}
export async function verifySlotOutputAccess(value:string,scope:SlotScope,id:string,source:"camera"|"screen") {
  try{return typeof value==="string"&&value.length<256&&equal(value,await createSlotOutputAccess(scope,id,source));}catch{return false;}
}
export async function personalCasterInviteKey(invite:PersonalCasterInvite) {return `slot_${invite.id}.${await signature(["invite",invite.scope.studioId,invite.scope.roomAssociation,invite.id,invite.version])}`;}
export async function resolvePersonalCasterInvite(value:string,studioId:string) {
  if(typeof value!=="string"||value.length>256)return null;
  const match=value.match(/^slot_([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/);if(!match)return null;
  const invite=await readPersonalCasterInvite(studioId,match[1]);
  return invite?.enabled&&equal(value,await personalCasterInviteKey(invite)) ? invite : null;
}
