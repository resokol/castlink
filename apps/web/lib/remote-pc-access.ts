import type {NextRequest} from 'next/server';
import {RoomServiceClient,TokenVerifier,TrackSource} from 'livekit-server-sdk';
import {sameOrigin} from './access';
import {livePresentationGuest,presentationAssociation,presentationGuest} from './co-presentation-access';
import {sourceSessionMoved} from './reserve-source';
import {admissionConfigured,localNodeAdmission} from './node-admission';
import {readRooms} from './room-store';
import {mediaRoomName} from './studio-scope';
import type {RemotePcScope,RemotePcPrincipal} from './remote-pc-state';
export const reservedRemotePcIdentity=(identity:string)=>identity.startsWith('remote-pc-');
export const remotePcRoomClient=()=>new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||'http://127.0.0.1:7880',process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
export async function liveRemotePcOwner(scope:RemotePcScope,identity:string):Promise<RemotePcPrincipal|null>{
 if(admissionConfigured()&&!(await localNodeAdmission(mediaRoomName(scope.studioId,scope.room),identity)).allowed)return null;
 const owner=await livePresentationGuest(scope.studioId,scope.room,identity);if(!owner)return null;
 try{const participant=await remotePcRoomClient().getParticipant(mediaRoomName(scope.studioId,scope.room),identity),sources=participant.permission?.canPublishSources;
  if(participant.sid!==owner.sid||participant.permission?.canPublish===false||sources?.length&&!sources.includes(TrackSource.SCREEN_SHARE))return null;
  const metadata=JSON.parse(participant.metadata||'{}');if(metadata.screenShareEnabled===false)return null;
  const record=(await readRooms(scope.studioId)).find(room=>room.name===scope.room);if(!record||await sourceSessionMoved(scope.studioId,scope.room,identity,undefined,record.creatorAccessId||record.transferRoomId||''))return null;
  return owner;
 }catch{return null;}
}
/** Read-only viewers receive source aliases only, never native/controller capabilities. */
export async function remotePcReader(request:NextRequest,scope:RemotePcScope):Promise<{principal:RemotePcPrincipal;target?:string}|null>{
 const guest=await presentationGuest(request,scope.studioId,scope.room);if(guest)return{principal:guest};
 try{
  if(!sameOrigin(request))return null;
  const bearer=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!bearer)return null;
  const claims=await new TokenVerifier(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!).verify(bearer),metadata=JSON.parse(claims.metadata||'{}');
  const association=await presentationAssociation(scope.studioId,scope.room);
  if(!association||!claims.sub||claims.video?.room!==mediaRoomName(scope.studioId,scope.room)||metadata.studioId!==scope.studioId||metadata.roomDisplayName!==scope.room||metadata.roomChatAssociation!==association||!['output','monitor','studio-panel','studio-moderator'].includes(metadata.role))return null;
  if(metadata.role==='output'&&(typeof metadata.outputTarget!=='string'||!metadata.outputTarget.startsWith('guest-')))return null;
  return{principal:{identity:claims.sub,sid:'readonly',association},...(metadata.role==='output'?{target:metadata.outputTarget}:{})};
 }catch{return null;}
}
