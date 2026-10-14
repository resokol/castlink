import { removeRoomServerPeer, type ServerPeer } from './server-profiles';
import { reserveTransaction } from './server-reserve';
import { updateTransferState } from './server-transfer';

export const connectionInUse = 'Сначала сними подготовленный резерв или дождись истечения всех его полномочий. Дождись завершения переноса и изменения автоматики. Подключение сохранено.';

/** Keep the reserve and transfer queues held through the atomic profile write. */
export async function removeUnusedRoomServerPeer(peer:ServerPeer,roomId:string,assertAuthorized:()=>Promise<void>){
 return reserveTransaction(async reserve=>updateTransferState(async transfer=>{
  const now=Date.now();
  const expired=(snapshot:{readyUntil:number})=>Number.isSafeInteger(snapshot.readyUntil)&&snapshot.readyUntil<=now;
  const sources=Object.values(reserve.sources).filter(source=>source.roomId===roomId&&source.peerId===peer.id&&!source.retiredBy&&source.status!=='disarmed');
  const sourceInUse=sources.some(source=>!expired(source)||source.pending&&!expired(source.pending)||source.status==='committed'||source.operationId);
  const cohortInUse=Object.values(reserve.cohorts).some(cohort=>cohort.roomId===roomId&&cohort.peerId===peer.id&&!cohort.supersededBy&&cohort.status!=='disarmed'&&(cohort.status==='activating'||cohort.status==='armed'&&cohort.operationId||!expired(cohort)));
  const transferInUse=[...Object.values(transfer.active),...Object.values(transfer.transfers)].some(value=>value.roomId===roomId&&(value.targetId===peer.id||('peerId' in value&&value.peerId===peer.id))&&value.exp>now);
  if(sourceInUse||cohortInUse||transferInUse)throw Object.assign(new Error(connectionInUse),{status:409});
  const result=await removeRoomServerPeer({peerId:peer.id,roomId,assertAuthorized});
  // A reset/offline peer cannot acknowledge disarm. Once both durable snapshots
  // have expired and no operation is pending, its grants can no longer activate.
  for(const source of sources){source.status='disarmed';source.autoEnabled=false;source.grants={};source.pending=undefined;source.pendingAuto=undefined;}
  return result;
 }));
}
