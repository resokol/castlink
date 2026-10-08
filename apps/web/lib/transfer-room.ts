import {randomUUID} from 'node:crypto';
import {RoomServiceClient} from 'livekit-server-sdk';
import {readRooms,updateRooms,type RoomRecord} from './room-store';
import {readStudioState,resetStudioForTransfer,releaseStudio} from './studio-control';
import {mediaRoomName} from './studio-scope';
import {encryptRoomPassword,checkPassword} from './access';
export async function transferLiveKitReady(){let timeout:ReturnType<typeof setTimeout>|undefined;try{if(!process.env.LIVEKIT_API_KEY||!process.env.LIVEKIT_API_SECRET)return false;await Promise.race([new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||'http://127.0.0.1:7880',process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET).listRooms(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('LiveKit timeout')),3000);})]);return true;}catch{return false;}finally{if(timeout)clearTimeout(timeout);}}
/** Reserve the primary before installing credentials; retries for the same durable operation preserve generations. */
export async function installTransferredRoom(studioId:string,record:RoomRecord,primaryClientId?:string,guestPassword?:string){
 const collision=(r:RoomRecord|undefined)=>!!r&&(r.transferRoomId!==record.transferRoomId||r.creatorAccessId!==record.creatorAccessId);
 const existing=(await readRooms(studioId)).find(r=>r.name===record.name);if(collision(existing))throw new Error('На целевом сервере уже есть другая комната с таким именем');
 const stateRoom=mediaRoomName(studioId,record.name),before=await readStudioState(stateRoom);
 if(primaryClientId&&existing?.adminAccessVersion===primaryClientId&&existing.transferRoomId===record.transferRoomId&&existing.creatorAccessId===record.creatorAccessId&&existing.studioPasswordHash===record.studioPasswordHash&&existing.passwordHash===record.passwordHash)return existing;
 if(!await transferLiveKitReady())throw new Error('LiveKit целевого сервера недоступен');
 // An occupied media room is never reset by preparation or activation.
 const participants=await new RoomServiceClient(process.env.LIVEKIT_SERVER_URL||'http://127.0.0.1:7880',process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!).listParticipants(stateRoom).catch((error:any)=>{if(error?.status===404||error?.code==='not_found')return [];throw error;});
 if(participants.length)throw new Error('На целевом сервере уже работают участники этой комнаты');
 const reserved=await resetStudioForTransfer(stateRoom,primaryClientId);
 try{const fresh=await updateRooms(list=>{const current=list.find(r=>r.name===record.name);if(collision(current))throw new Error('На целевом сервере уже есть другая комната с таким именем');const next:RoomRecord={name:record.name,transferRoomId:record.transferRoomId,...(record.creatorAccessId?{creatorAccessId:record.creatorAccessId,studioPasswordHash:record.studioPasswordHash}:{}),adminAccessVersion:primaryClientId || randomUUID(),guestInviteVersion:randomUUID(),viewerAccessVersion:randomUUID(),outputAccessVersion:randomUUID(),...(record.passwordHash?{passwordHash:record.passwordHash,...(guestPassword&&checkPassword(guestPassword,record.passwordHash)?{passwordCiphertext:encryptRoomPassword(guestPassword)}:current?.passwordHash===record.passwordHash&&current.passwordCiphertext?{passwordCiphertext:current.passwordCiphertext}:{})}:{}),...(record.studioOnly?{studioOnly:true}:{})};return current?list.map(r=>r===current?next:r):[...list,next];},studioId);return fresh.find(r=>r.name===record.name)!;
 }catch(error){if(primaryClientId)await releaseStudio(stateRoom,primaryClientId,reserved.epoch);throw error;}
}

export async function releaseTransferredReservation(studioId:string,room:string,clientId?:string){if(!clientId)return;const mediaRoom=mediaRoomName(studioId,room),current=await readStudioState(mediaRoom);if(current.primaryClientId===clientId)await releaseStudio(mediaRoom,clientId,current.epoch);}

export async function transferredRoomStageReady(studioId:string,record:RoomRecord){if(!await transferLiveKitReady())throw new Error("LiveKit резерва недоступен");const existing=(await readRooms(studioId)).find(r=>r.name===record.name);if(existing&&(existing.transferRoomId!==record.transferRoomId||existing.creatorAccessId!==record.creatorAccessId))throw new Error("На резерве уже есть другая комната с таким именем");const state=await readStudioState(mediaRoomName(studioId,record.name));if(state.primaryClientId&&state.leaseUntil>Date.now())throw new Error("На резерве уже работает студия этой комнаты");}
