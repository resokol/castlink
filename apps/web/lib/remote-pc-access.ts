import type {NextRequest} from 'next/server';
import {RoomServiceClient,TokenVerifier,TrackSource} from 'livekit-server-sdk';
import {sameOrigin} from './access';
import {livePresentationGuest,presentationAssociation,presentationGuest} from './co-presentation-access';
import {ownTransferSession,storedAuthorityCurrent} from './transfer-sessions';
import {hostedAccessEnabled,hostedSession,hostedCookieName} from './hosted-access';
import {validStudioClient,readStudioState} from './studio-control';
import {sourceSessionMoved} from './reserve-source';
import {admissionConfigured,localNodeAdmission} from './node-admission';
import {readRooms} from './room-store';
import {mediaRoomName} from './studio-scope';
import type {RemotePcScope,RemotePcPrincipal} from './remote-pc-state';
export const reservedRemotePcIdentity=(identity:string)=>identity.startsWith('remote-pc-');
export const remotePcRoomClient=()=>new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||'http://127.0.0.1:7880',process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
// Never projected to browser/native metadata. Exact live SID prevents reconnect inheritance.
const hostedBindings=new Map<string,{cookie:string;id:string;expiresAt:number}>();
const bindingKey=(scope:RemotePcScope,identity:string,sid:string)=>JSON.stringify([scope.studioId,scope.room,identity,sid]);
const cookieRequest=(cookie:string)=>({cookies:{get:(name:string)=>name===hostedCookieName?{name,value:cookie}:undefined}}) as Pick<NextRequest,'cookies'>;
function hostedStaffCurrent(scope:RemotePcScope,identity:string,sid:string){
 if(!hostedAccessEnabled())return true;const key=bindingKey(scope,identity,sid),binding=hostedBindings.get(key);if(!binding)return false;
 const active=hostedSession(cookieRequest(binding.cookie));if(binding.expiresAt<=Date.now()||!active||active.id!==binding.id){hostedBindings.delete(key);return false;}return true;
}
/** Human media actors only. Staff authority is rechecked from the current room record on every lease. */
export async function liveRemotePcHuman(scope:RemotePcScope,identity:string):Promise<RemotePcPrincipal|null>{
 try{
  if(admissionConfigured()&&!(await localNodeAdmission(mediaRoomName(scope.studioId,scope.room),identity)).allowed)return null;
  const participant=await remotePcRoomClient().getParticipant(mediaRoomName(scope.studioId,scope.room),identity),metadata=JSON.parse(participant.metadata||'{}');
  if(participant.identity!==identity||!participant.sid||participant.permission?.canPublishData===false||metadata.roomChatOnly)return null;
  if(metadata.role==='guest'){
   const guest=await livePresentationGuest(scope.studioId,scope.room,identity);if(!guest||guest.sid!==participant.sid)return null;
   // Hosted admission alone is not proof that the original credential still owns this room.
   if(admissionConfigured()){const room=(await readRooms(scope.studioId)).find(room=>room.name===scope.room);if(!room||!metadata.transferAuthorization||metadata.transferAuthorization.kind!=='guest'||!await storedAuthorityCurrent(room,scope.studioId,metadata.transferAuthorization))return null;}
   return guest;
  }
  if(!['studio-panel','studio-moderator'].includes(metadata.role)||metadata.studioId!==scope.studioId||metadata.roomDisplayName!==scope.room||!validStudioClient(metadata.clientId))return null;
  const association=await presentationAssociation(scope.studioId,scope.room),room=(await readRooms(scope.studioId)).find(room=>room.name===scope.room),authority=metadata.transferAuthorization;
  if(!association||metadata.roomChatAssociation!==association||!room||!authority||!['creator','owner','admin','moderator'].includes(authority.kind)||!await storedAuthorityCurrent(room,scope.studioId,authority))return null;
  if(metadata.role==='studio-panel'){const state=await readStudioState(mediaRoomName(scope.studioId,scope.room));if(state.primaryClientId!==metadata.clientId||state.leaseUntil<=Date.now())return null;}
  if(!hostedStaffCurrent(scope,identity,participant.sid))return null;
  if(await presentationAssociation(scope.studioId,scope.room)!==association)return null;
  return{identity,sid:participant.sid,association};
 }catch{return null;}
}
export async function liveRemotePcOwner(scope:RemotePcScope,identity:string):Promise<RemotePcPrincipal|null>{
 try{const owner=await liveRemotePcHuman(scope,identity);if(!owner)return null;
  const participant=await remotePcRoomClient().getParticipant(mediaRoomName(scope.studioId,scope.room),identity),sources=participant.permission?.canPublishSources;
  if(participant.sid!==owner.sid||participant.permission?.canPublish===false||sources?.length&&!sources.includes(TrackSource.SCREEN_SHARE))return null;
  const metadata=JSON.parse(participant.metadata||'{}');if(metadata.screenShareEnabled===false)return null;
  const record=(await readRooms(scope.studioId)).find(room=>room.name===scope.room);if(!record||await sourceSessionMoved(scope.studioId,scope.room,identity,metadata.clientId,record.creatorAccessId||record.transferRoomId||''))return null;
  return owner;
 }catch{return null;}
}
/** Bearer and live participant must designate the same human connection and transfer session. */
export async function remotePcPrincipal(request:NextRequest,scope:RemotePcScope):Promise<RemotePcPrincipal|null>{
 try{
  if(!sameOrigin(request))return null;
  const guest=await presentationGuest(request,scope.studioId,scope.room);if(guest){const actual=await liveRemotePcHuman(scope,guest.identity);return actual&&actual.sid===guest.sid&&actual.association===guest.association?actual:null;}
  const own=await ownTransferSession(request,scope.studioId,scope.room);if(!['studio-panel','studio-moderator'].includes(own.metadata.role))return null;
  const identity=own.claims.sub!;const participant=await remotePcRoomClient().getParticipant(mediaRoomName(scope.studioId,scope.room),identity),metadata=JSON.parse(participant.metadata||'{}');
  if(metadata.role!==own.metadata.role||metadata.clientId!==own.metadata.clientId||metadata.transferAuthorization?.kind!==own.authority.kind||metadata.transferAuthorization?.credentialVersion!==own.authority.credentialVersion)return null;
  if(hostedAccessEnabled()){
   const active=hostedSession(request),cookie=request.cookies.get(hostedCookieName)?.value;if(!active||!cookie||cookie.length>512)return null;
   for(const [key,binding]of hostedBindings)if(binding.expiresAt<=Date.now())hostedBindings.delete(key);
   const key=bindingKey(scope,identity,participant.sid);if(!hostedBindings.has(key)&&hostedBindings.size>=512)return null;
   hostedBindings.set(key,{cookie,id:active.id,expiresAt:active.expiresAt});
  }
  return liveRemotePcHuman(scope,identity);
 }catch{return null;}
}
/** Read-only viewers receive source aliases only, never native/controller capabilities. */
export async function remotePcReader(request:NextRequest,scope:RemotePcScope):Promise<{principal:RemotePcPrincipal;target?:string}|null>{
 const principal=await remotePcPrincipal(request,scope);if(principal)return{principal};
 try{
  if(!sameOrigin(request))return null;
  const bearer=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!bearer)return null;
  const claims=await new TokenVerifier(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!).verify(bearer),metadata=JSON.parse(claims.metadata||'{}');
  const association=await presentationAssociation(scope.studioId,scope.room);
  if(!association||!claims.sub||claims.video?.room!==mediaRoomName(scope.studioId,scope.room)||metadata.studioId!==scope.studioId||metadata.roomDisplayName!==scope.room||metadata.roomChatAssociation!==association||!['output','monitor'].includes(metadata.role))return null;
  if(metadata.role==='output'&&(typeof metadata.outputTarget!=='string'||!metadata.outputTarget.startsWith('guest-')))return null;
  return{principal:{identity:claims.sub,sid:'readonly',association},...(metadata.role==='output'?{target:metadata.outputTarget}:{})};
 }catch{return null;}
}
