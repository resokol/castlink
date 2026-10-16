import {guestEntrySettings} from "./guest-entry-settings";
import {RoomServiceClient,TokenVerifier} from 'livekit-server-sdk';
import type {NextRequest} from 'next/server';
import {readRooms,type RoomRecord} from './room-store';
import {mediaRoomName} from './studio-scope';
import {readStudioState,validStudioClient} from './studio-control';
import {verifiedTransferAuthority,roomTransferId} from './transfer-authority';
import {studioOwnerTransferVersionCurrent} from './studio-owner-access';
import {roomVersion} from './access';
import {listRoomModeratorSessions,moderatorTransferVersion,globalModeratorAccessVersion} from './moderator-access';
import type {ReserveSession} from './server-reserve';
import type {TransferAuthorization} from './server-transfer';
import {studioViewingRoom,studioViewerVersion} from './studio-viewer-access';
export const transferSessionKey=(identity:string,metadata:any)=>['guest','studio-viewer'].includes(metadata?.role)?`${identity}:${metadata.transferSessionId||''}`:metadata?.clientId;
export async function storedAuthorityCurrent(room:RoomRecord,studioId:string,a:TransferAuthorization){if(a.expiresAt<=Date.now()||a.roomId!==roomTransferId(room)||a.creatorAccessId!==room.creatorAccessId)return false;
 if(a.kind==='creator')return a.credentialVersion===roomVersion(room.studioPasswordHash);
 if(a.kind==='studio-viewer')return a.credentialVersion===studioViewerVersion(room);
 if(a.kind==='guest')return a.credentialVersion===roomVersion(room.passwordHash);
 if(a.kind==='admin')return a.credentialVersion===room.adminAccessVersion;
 if(a.kind==='moderator')return (await listRoomModeratorSessions(room.name,studioId)).some(s=>s.id===a.credentialVersion)||(await globalModeratorAccessVersion(studioId))===a.credentialVersion;
 return a.kind==='owner'&&await studioOwnerTransferVersionCurrent(a.credentialVersion,studioId);}
export async function ownTransferSession(request:NextRequest,studioId:string,roomName:string){
 const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!bearer)throw Object.assign(new Error('Требуется текущий токен участника'),{status:401});
 const claims=await new TokenVerifier(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!).verify(bearer);const metadata=JSON.parse(claims.metadata||'{}'),room=(await readRooms(studioId)).find(r=>r.name===roomName);
 if(!room||metadata.studioId!==studioId||!['guest','studio-panel','studio-moderator','studio-viewer'].includes(metadata.role)||!claims.sub)throw Object.assign(new Error('Сессия относится к другой комнате'),{status:403});
 const viewer=metadata.role==='studio-viewer';
 if(claims.video?.room!==(viewer?studioViewingRoom(studioId,room):mediaRoomName(studioId,roomName))||viewer&&(!claims.sub.startsWith('stream-viewer-')||claims.video.canPublish!==false||claims.video.canPublishData!==false))throw Object.assign(new Error('Сессия относится к другой комнате'),{status:403});
 const signed=metadata.transferAuthorization as TransferAuthorization;if(!signed)throw Object.assign(new Error('Переподключитесь для подготовки резерва'),{status:403});
 if(viewer&&signed.kind!=='studio-viewer'||!viewer&&signed.kind==='studio-viewer')throw Object.assign(new Error('Полномочия не соответствуют роли'),{status:403});
 const cap=Math.min(signed.expiresAt,typeof claims.exp==='number'?claims.exp*1000:Infinity);
 const authority=viewer?{...signed}:await verifiedTransferAuthority(request,room,studioId,signed.kind,cap);
 if(!authority||!await storedAuthorityCurrent(room,studioId,signed)||authority.credentialVersion!==signed.credentialVersion)throw Object.assign(new Error('Полномочия участника изменились'),{status:403});
 const sessionId=transferSessionKey(claims.sub,metadata);
 if(!sessionId||!['guest','studio-viewer'].includes(metadata.role)&&!validStudioClient(metadata.clientId)||viewer&&(typeof metadata.transferSessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(metadata.transferSessionId)))throw new Error('Некорректная сессия');
 if (authority.kind === "guest") authority.entrySettings = guestEntrySettings(metadata.entrySettings ?? signed.entrySettings);
 return {claims,metadata,room,authority,sessionId};
}
export async function captureReserveSessions(room:RoomRecord,studioId:string):Promise<ReserveSession[]>{const mediaRoom=mediaRoomName(studioId,room.name);const client=new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||'http://127.0.0.1:7880',process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!);const participants=await client.listParticipants(mediaRoom);const primary=await readStudioState(mediaRoom);const sessions:ReserveSession[]=[];for(const participant of participants){let m:any;try{m=JSON.parse(participant.metadata||'{}');}catch{continue;}const a=m.transferAuthorization as TransferAuthorization;if(!a||m.studioId!==studioId||!['guest','studio-panel','studio-moderator'].includes(m.role)||!await storedAuthorityCurrent(room,studioId,a))continue;const identity=participant.identity,sessionId=transferSessionKey(identity,m);if(!sessionId||m.role==='guest'&&!identity.startsWith('guest-')||m.role!=='guest'&&!validStudioClient(m.clientId))continue;const role=a.kind==='creator'||a.kind==='owner'&&!m.panelMode?'studio':a.kind==='moderator'?'moderator':a.kind==='guest'?'guest':'admin';sessions.push({sessionId,identity,role,...(m.clientId?{clientId:m.clientId}:{}),name:participant.name,canActivate:m.role==='studio-panel'&&primary.primaryClientId===m.clientId&&primary.leaseUntil>Date.now()&&['creator','owner'].includes(a.kind),authorization:role==='admin'?{...a,kind:'admin'}:a});}
 const viewers=await client.listParticipants(studioViewingRoom(studioId,room)).catch((error:any)=>{if(error?.status===404||error?.code==='not_found')return [];throw error;});
 for(const participant of viewers){let m:any;try{m=JSON.parse(participant.metadata||'{}');}catch{continue;}const a=m.transferAuthorization as TransferAuthorization;if(m.role!=='studio-viewer'||m.studioId!==studioId||!participant.identity.startsWith('stream-viewer-')||typeof m.transferSessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(m.transferSessionId)||a?.kind!=='studio-viewer'||!await storedAuthorityCurrent(room,studioId,a))continue;sessions.push({sessionId:transferSessionKey(participant.identity,m),identity:participant.identity,name:participant.name,role:'studio-viewer',canActivate:false,authorization:a});}
 return sessions;}
