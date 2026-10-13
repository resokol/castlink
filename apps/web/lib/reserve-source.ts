import {OUTBOUND_RESERVE_PROTOCOL} from './reserve-heartbeat';
import {reserveTransaction,readReserveStateSnapshot,reserveStatePath,recoverReturnedSource,returnedInstallation} from './server-reserve';
import {roomTransferTargets,sendPeerBridge} from './transfer-peer';
import {transferRoomKey} from './server-transfer';
/** No timeout can permit a second reserve: an explicit durable disarm acknowledgement is required. */
export async function disarmSourceReserve(studioId:string,room:string,expected?:{cohortId:string;armGeneration:number;roomId:string}){return reserveTransaction(async state=>{if(expected){const current=state.sources[transferRoomKey(studioId,room)];if(!current||current.cohortId!==expected.cohortId||current.armGeneration!==expected.armGeneration||current.roomId!==expected.roomId||!await returnedInstallation(state,studioId,room))return;}await recoverReturnedSource(state,studioId,room);const source=state.sources[transferRoomKey(studioId,room)];if(!source||source.status==='disarmed')return;const target=(await roomTransferTargets(source.roomId)).find(t=>t.id===source.targetId);if(!target)throw new Error('Восстановите связь со старым резервом, чтобы снять его');const ack=await sendPeerBridge(target,{action:'disarm',roomId:source.roomId,cohortId:source.cohortId,armGeneration:source.armGeneration},'/api/server-reserve');if(ack.status==='committed'){source.status='committed';source.operationId=ack.operationId;if(await recoverReturnedSource(state,studioId,room))return;throw new Error('Аварийный перенос уже запущен на выбранный резерв');}if(ack.status!=='disarmed')throw new Error('Резерв занят операцией переноса');source.status='disarmed';});}
export async function reconcileSourceReserve(studioId:string,room:string){const source=await reserveTransaction(async s=>{await recoverReturnedSource(s,studioId,room);return s.sources[transferRoomKey(studioId,room)];});if(!source||source.status==='disarmed')return source;try{const target=(await roomTransferTargets(source.roomId)).find(t=>t.id===source.targetId);if(!target)return source;const receipt=await sendPeerBridge(target,{action:'receipt',roomId:source.roomId,cohortId:source.cohortId},'/api/server-reserve');if(receipt.status==='committed'&&receipt.cohortId===source.cohortId&&receipt.armGeneration===source.armGeneration&&Array.isArray(receipt.sessions))return reserveTransaction(async s=>{const current=s.sources[transferRoomKey(studioId,room)];if(current?.cohortId===source.cohortId&&current.armGeneration===source.armGeneration&&current.roomId===source.roomId&&current.status!=='disarmed'){current.status='committed';current.operationId=receipt.operationId;current.movedSessions=receipt.sessions.filter((s:any)=>typeof s.sessionId==='string'&&typeof s.identity==='string');await recoverReturnedSource(s,studioId,room);}return current;});}catch{/* A reserve outage does not prevent the primary from serving. */}return source;}
export async function sourceSessionMoved(studioId:string,room:string,identity?:string,clientId?:string,roomId?:string){
 const snapshot=await readReserveStateSnapshot(),source=snapshot.sources[transferRoomKey(studioId,room)];if(!source||source.status==='disarmed'||roomId!==undefined&&source.roomId!==roomId)return false;
 if(await recoverReturnedSource(snapshot,studioId,room)){void reserveTransaction(s=>recoverReturnedSource(s,studioId,room)).catch(()=>undefined);return false;}
 const key=reserveStatePath()+':'+transferRoomKey(studioId,room),symbol=Symbol.for('castlink.reserve-reconciliation');
 const shared=globalThis as typeof globalThis & {[key:symbol]:Map<string,number>|undefined};const attempts=shared[symbol] ||= new Map<string,number>();
 if((attempts.get(key)||0)<Date.now()){attempts.set(key,Date.now()+15000);void reconcileSourceReserve(studioId,room).catch(()=>undefined);}
 return source.status==='committed'&&(source.movedSessions||[]).some(s=>clientId?s.clientId===clientId:identity?s.identity===identity:false);
}
/** Local mutations succeed independently; remote revocation is acknowledged only by the target transition. */
export async function revokePreparedSessions(studioId:string,room:string,select?:{kind?:string;credentialVersion?:string}){
 // Source staging and revocation serialize: a delayed stage cannot restore sessions after a revoke acknowledgement.
 return reserveTransaction(async state=>{
  const source=state.sources[transferRoomKey(studioId,room)];if(!source||source.status!=='armed')return;
  const knownSessions=[...source.sessions,...(source.pending?.sessions||[])];
  const sessionIds=select?[...new Set(knownSessions.filter(s=>(!select.kind||s.authorization.kind===select.kind)&&(!select.credentialVersion||s.authorization.credentialVersion===select.credentialVersion)).map(s=>s.sessionId))]:undefined;
  if(select&&!sessionIds?.length)return;
  try{const target=(await roomTransferTargets(source.roomId)).find(t=>t.id===source.targetId);if(!target)return;const ack=await sendPeerBridge(target,{action:select?'revoke':'disarm',roomId:source.roomId,cohortId:source.cohortId,armGeneration:source.armGeneration,...(sessionIds?{sessionIds}:{})},'/api/server-reserve');
   if(ack.status==='disarmed')source.status='disarmed';
   if(select&&ack.status==='armed'){source.sessions=source.sessions.filter(session=>!sessionIds!.includes(session.sessionId));if(source.pending)source.pending.sessions=source.pending.sessions.filter(session=>!sessionIds!.includes(session.sessionId));for(const id of sessionIds!)delete source.grants[id];}
  }catch{/* Unacknowledged remote revocation remains bounded by the existing five-minute grant expiry. */}
 });
}
export function schedulePreparedRevocation(studioId:string,room:string,select?:{kind?:string;credentialVersion?:string}){void revokePreparedSessions(studioId,room,select).catch(()=>undefined);}

/** Persist intent before sending it; an acknowledgement lost in transit is retried at the same epoch. */
export async function applySourceAutomatic(source:import('./server-reserve').SourceReserve,target:import('./transfer-peer').RoomTransferTarget,save:()=>Promise<void>,enabled?:boolean){
 if(enabled!==undefined){
  if(enabled&&(source.autoSupported!==true||source.autoProtocol!==OUTBOUND_RESERVE_PROTOCOL))throw Object.assign(new Error('Этот резерв не подтвердил поддержку автоматики'),{status:409});
  if(!source.pendingAuto&&enabled===(source.autoEnabled===true))return;
  if(!source.pendingAuto||source.pendingAuto.enabled!==enabled){source.pendingAuto={enabled,epoch:Math.max(source.autoEpoch||0,source.pendingAuto?.epoch||0)+1};await save();}
 }
 if(!source.pendingAuto)return;
 const policy=source.pendingAuto;
 const ack=await sendPeerBridge(target,{action:'set-auto',roomId:source.roomId,cohortId:source.cohortId,armGeneration:source.armGeneration,autoEpoch:policy.epoch,enabled:policy.enabled,autoProtocol:OUTBOUND_RESERVE_PROTOCOL},'/api/server-reserve');
 if(ack.status==='committed'){source.status='committed';source.operationId=ack.operationId;source.pendingAuto=undefined;await save();throw Object.assign(new Error('Перенос уже запущен на резерве'),{status:409});}
 if(ack.status!=='armed'||ack.autoSupported!==true||policy.enabled&&ack.autoProtocol!==OUTBOUND_RESERVE_PROTOCOL||ack.autoEpoch!==policy.epoch||ack.autoEnabled!==policy.enabled)throw new Error('Резерв не подтвердил политику автоматики');
 source.autoEnabled=policy.enabled;source.autoEpoch=policy.epoch;source.autoSupported=ack.autoSupported===true&&ack.autoProtocol===OUTBOUND_RESERVE_PROTOCOL;source.autoProtocol=ack.autoProtocol===OUTBOUND_RESERVE_PROTOCOL?OUTBOUND_RESERVE_PROTOCOL:undefined;source.pendingAuto=undefined;await save();
}
