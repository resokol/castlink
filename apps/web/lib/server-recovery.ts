import {createHash,createHmac,randomUUID} from 'node:crypto';
import {readRooms,type RoomRecord} from './room-store';
import {defaultStudioId,validateStudioId} from './studio-scope';
import {requestServerPeer} from './server-peer-request';
import {withUnusedServerPeer} from './server-profile-removal';
import {readServerProfileState} from '../../../scripts/server-profile-store.mjs';
import {prepareServerRecovery,commitServerRecovery} from '../../../scripts/server-recovery-store.mjs';
import type {RecoveryAuthority,RecoveryContext,RecoveryCandidate} from '../../../scripts/server-recovery-store.mjs';
export {issueServerRecovery,revokeServerRecovery} from '../../../scripts/server-recovery-store.mjs';
export type {RecoveryAuthority} from '../../../scripts/server-recovery-store.mjs';

export const recoveryRoomVersion=(room:RoomRecord,studioId:string)=>createHash('sha256').update(JSON.stringify([studioId,room.creatorAccessId,room.studioPasswordHash||''])).digest('hex');
export const publicRecoveryProfile=(peer:RecoveryContext['peer'])=>({id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId,scope:peer.scope.kind});
export async function listRecoveryProfiles(){return (await readServerProfileState()).peers;}

/** A room capability expires when the room or its creator credential changes. */
export async function assertRecoveryAuthority(authority:RecoveryAuthority){
 if(authority.kind==='installation')return;
 const studioId=validateStudioId(authority.studioId),room=(await readRooms(studioId)).find(value=>value.creatorAccessId===authority.roomId);
 if(!room||!room.studioPasswordHash||recoveryRoomVersion(room,studioId)!==authority.version)throw Error('Recovery creator authorization changed');
}

export async function readRecoveryInput(request:Request):Promise<Record<string,unknown>>{
 const reader=request.body?.getReader();if(!reader)throw Error('Missing recovery input');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const value=await reader.read();if(value.done)break;size+=value.value.length;if(size>65536){await reader.cancel();throw Error('Recovery input too large');}chunks.push(value.value);}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid recovery input');return value;
}

async function verifyRecoveryTarget(context:RecoveryContext,signed:boolean){
 const {peer,source,authority}=context;
 const response=await requestServerPeer(peer,'/api/server-transfer?action=health',{timeoutMs:7000});
 const health=await response.json();
 if(!response.ok||health.installationId!==peer.installationId||health.origin!==peer.origin||health.enabled!==true||health.liveKitReady!==true||health.nodeAdmissionReady===false)throw Error('Recovery target health failed');
 if(!signed)return;
 const roomId=peer.scope.kind==='room'?peer.scope.roomId:randomUUID(),studioId=authority.kind==='room'?authority.studioId:defaultStudioId(),challenge=randomUUID();
 const body=JSON.stringify({action:'health',peerId:peer.id,sourceOrigin:source.origin,sourceInstallationId:source.installationId,roomId,studioId,challenge});
 const stamp=String(Date.now()),nonce=randomUUID().replaceAll('-','');
 const proof=await requestServerPeer(peer,'/api/server-reserve?action=bridge',{method:'POST',body,timeoutMs:7000,headers:{'content-type':'application/json','x-studiolink-transfer-time':stamp,'x-studiolink-transfer-nonce':nonce,'x-studiolink-transfer-signature':createHmac('sha256',peer.secret).update(stamp+'.'+nonce+'.'+body).digest('hex')}});
 const value=await proof.json();
 // The health branch verifies the pair before checking the room; no room is created.
 if(proof.status===404&&value.error==='Комната проверки изменилась')return;
 if(!proof.ok||value.installationId!==peer.installationId||value.roomId!==roomId||value.studioId!==studioId||value.challenge!==challenge||value.liveKitReady!==true)throw Error('Recovery reverse pairing was not confirmed');
}

export async function prepareRecovery(input:RecoveryCandidate){
 const context=await prepareServerRecovery(input);await assertRecoveryAuthority(context.authority);
 await verifyRecoveryTarget(context,false);
 return {ok:true,source:context.source,peerId:context.peer.id,scope:context.peer.scope};
}

export async function completeRecovery(input:RecoveryCandidate){
 const context=await prepareServerRecovery(input);await assertRecoveryAuthority(context.authority);
 await verifyRecoveryTarget(context,true);
 const commit=()=>commitServerRecovery({...input,assertAuthorized:async(authority)=>assertRecoveryAuthority(authority)});
 // A lost completion response may be retried after the new peer is already in use.
 const result=context.committed?await commit():await withUnusedServerPeer(context.previous,commit);
 return {ok:true,profile:publicRecoveryProfile(result.peer)};
}
