import { randomUUID } from "node:crypto";
import { readAccess, signAccess } from "./access";
import { readServerFeatureState, updateServerFeatureState } from "./server-feature-store";
import { sameSlotScope, type SlotScope } from "./caster-slot-types";
export type AdmissionSession = { id:string; scope:SlotScope; identity:string; clientSessionId:string; name:string; version:string; generation?:number; roomVersion:string; inviteId?:string; inviteVersion?:string; proposedSlotId?:string; state:"waiting"|"admitted"|"closed"; expiresAt:number; lastSeen:number; legacyParticipantSid?:string; mediaSessionId?:string };
type State={schemaVersion:1;sessions:Record<string,AdmissionSession>;legacyIdentities?:Record<string,AdmissionSession>};
const initial=():State=>({schemaVersion:1,sessions:{}});
const waitingLifetime=15*60000,activeLifetime=30*86400000;
function pruneSessions(data:State){
 const now=Date.now();
 // Retain revoked identities for the maximum room JWT lifetime.
 for(const [id,item]of Object.entries(data.sessions))if((item.state==="closed"||item.expiresAt<now)&&item.lastSeen+2*3600000<now)delete data.sessions[id];
 for(const [id,item]of Object.entries(data.legacyIdentities||{}))if(item.expiresAt<now)delete data.legacyIdentities![id];
}
function checked(value:State){if(value?.schemaVersion!==1||!value.sessions||Array.isArray(value.sessions))throw new Error("Invalid admission storage");return value;}
export async function readGuestAdmission(studioId:string,id:string):Promise<AdmissionSession|null>{const data=checked(await readServerFeatureState("guest_admissions",studioId,initial));return Object.hasOwn(data.sessions,id)?data.sessions[id]:null;}
export async function listGuestAdmissions(scope:SlotScope){const data=checked(await readServerFeatureState("guest_admissions",scope.studioId,initial));return Object.values(data.sessions).filter(s=>sameSlotScope(s.scope,scope)&&s.state!=="closed"&&s.expiresAt>Date.now());}
// Keep adopted identities for at least the maximum lifetime of a legacy JWT.
// Otherwise a replay could be mistaken for an untouched pre-upgrade session.
export async function managedGuestIdentity(scope:SlotScope,identity:string){const data=checked(await readServerFeatureState("guest_admissions",scope.studioId,initial));return Object.values(data.sessions).find(s=>sameSlotScope(s.scope,scope)&&s.identity===identity)||Object.values(data.legacyIdentities||{}).find(s=>sameSlotScope(s.scope,scope)&&s.identity===identity&&s.expiresAt>Date.now())||null;}
const capability=(session:AdmissionSession)=>signAccess({kind:"guest-admission",studio:session.scope.studioId,room:session.scope.roomAssociation,id:session.id,version:session.version},activeLifetime/1000);
export async function verifyGuestAdmissionCapability(value:string,scope:SlotScope):Promise<AdmissionSession|null>{
 const claims=readAccess(value);if(claims?.kind!=="guest-admission"||claims.studio!==scope.studioId||claims.room!==scope.roomAssociation||!claims.id)return null;
 const session=await readGuestAdmission(scope.studioId,claims.id);
 return session&&session.version===claims.version&&sameSlotScope(session.scope,scope)&&session.state!=="closed"&&session.expiresAt>Date.now()?session:null;
}
export async function startGuestAdmission(scope:SlotScope,input:{clientId:string;name:string;roomVersion:string;capability?:string;inviteId?:string;inviteVersion?:string;proposedSlotId?:string}){
 if(typeof input.clientId!=="string"||!input.clientId||input.clientId.length>128||typeof input.name!=="string"||!input.name.trim()||input.name.length>120)throw new Error("Некорректный вход кастера");
 const prior=input.capability?await verifyGuestAdmissionCapability(input.capability,scope):null;
 if(prior&&prior.clientSessionId===input.clientId&&prior.roomVersion===input.roomVersion&&prior.inviteId===input.inviteId&&prior.inviteVersion===input.inviteVersion)return{session:prior,capability:capability(prior)};
 const session:AdmissionSession={id:randomUUID(),scope:{...scope},identity:`guest-${randomUUID()}`,clientSessionId:input.clientId,name:input.name.trim(),version:randomUUID(),roomVersion:input.roomVersion,state:"waiting",expiresAt:Date.now()+waitingLifetime,lastSeen:Date.now(),...(input.inviteId?{inviteId:input.inviteId,inviteVersion:input.inviteVersion,proposedSlotId:input.proposedSlotId}:{})};
 await updateServerFeatureState("guest_admissions",scope.studioId,initial,value=>{
  const data=checked(value);pruneSessions(data);
  if(Object.keys(data.sessions).length>=512)throw new Error("Очередь ожидания заполнена");data.sessions[session.id]=session;return data;
 });return{session,capability:capability(session)};
}
export async function touchGuestAdmission(scope:SlotScope,id:string){
 const session=await readGuestAdmission(scope.studioId,id);if(!session||session.state!=="waiting"||Date.now()-session.lastSeen<20000)return session;
 let result:AdmissionSession|null=null;
 await updateServerFeatureState("guest_admissions",scope.studioId,initial,value=>{const data=checked(value),current=data.sessions[id];if(current&&sameSlotScope(current.scope,scope)&&current.state==="waiting"&&current.expiresAt>Date.now()){current.lastSeen=Date.now();current.expiresAt=Date.now()+waitingLifetime;result=current;}return data;});return result;
}
export async function changeGuestAdmission(scope:SlotScope,id:string,expected:AdmissionSession["state"],next:AdmissionSession["state"]){
 let result:AdmissionSession|null=null;
 await updateServerFeatureState("guest_admissions",scope.studioId,initial,value=>{const data=checked(value),session=data.sessions[id];if(!session||!sameSlotScope(session.scope,scope)||session.state!==expected||session.expiresAt<=Date.now())throw new Error("Состояние допуска уже изменено");session.state=next;if(next==="admitted"){session.generation=(session.generation||0)+1;if(session.generation>1){session.identity=`guest-${randomUUID()}`;delete session.legacyParticipantSid;}}session.expiresAt=Date.now()+(next==="admitted"?activeLifetime:waitingLifetime);session.lastSeen=Date.now();result=session;return data;});return result!;
}
export async function admissionInviteCurrent(session:AdmissionSession){
 if(!session.inviteId)return true;
 const {readPersonalCasterInvite}=await import("./caster-slot-store");const invite=await readPersonalCasterInvite(session.scope.studioId,session.inviteId);
 return !!invite?.enabled&&sameSlotScope(invite.scope,session.scope)&&invite.version===session.inviteVersion;
}
export async function closeGuestAdmissionIdentity(scope:SlotScope,id:string,identity:string,generation?:number){
 await updateServerFeatureState("guest_admissions",scope.studioId,initial,value=>{const data=checked(value),s=data.sessions[id];if(s&&sameSlotScope(s.scope,scope)&&s.identity===identity&&s.generation===generation){s.state="closed";s.lastSeen=Date.now();s.expiresAt=Date.now()+waitingLifetime;}return data;});
}
export async function admissionForPublication(id:string,scope:SlotScope,roomVersion:string){const session=await readGuestAdmission(scope.studioId,id);return session&&sameSlotScope(session.scope,scope)&&session.state==="admitted"&&session.roomVersion===roomVersion&&session.expiresAt>Date.now()&&await admissionInviteCurrent(session)?session:null;}
export async function adoptGuestAdmission(scope:SlotScope,input:{identity:string;sid:string;name:string;roomVersion:string;mediaSessionId?:string}){
 let result:AdmissionSession|undefined;
 await updateServerFeatureState("guest_admissions",scope.studioId,initial,value=>{const data=checked(value);pruneSessions(data);
  const existing=Object.values(data.sessions).find(s=>sameSlotScope(s.scope,scope)&&s.identity===input.identity&&(input.mediaSessionId?s.mediaSessionId===input.mediaSessionId:s.legacyParticipantSid===input.sid)&&s.roomVersion===input.roomVersion&&s.state==="admitted");if(existing){result=existing;return data;}
  if(Object.keys(data.sessions).length>=512)throw new Error("Очередь ожидания заполнена");
  result={id:randomUUID(),scope:{...scope},identity:input.identity,clientSessionId:randomUUID(),name:input.name,version:randomUUID(),generation:1,roomVersion:input.roomVersion,state:"admitted",expiresAt:Date.now()+activeLifetime,lastSeen:Date.now(),legacyParticipantSid:input.sid,...(input.mediaSessionId?{mediaSessionId:input.mediaSessionId}:{})};data.sessions[result.id]=result;
  data.legacyIdentities??={};data.legacyIdentities[result.id]={...structuredClone(result),state:"closed",expiresAt:Date.now()+2*3600000};return data;
 });return result!;
}
