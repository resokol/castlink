import {readReserveStateSnapshot} from './server-reserve';
import {roomTransferTargets,sendPeerBridge} from './transfer-peer';
import {transferLiveKitReady} from './transfer-room';
import {OUTBOUND_RESERVE_PROTOCOL,HEARTBEAT_INTERVAL_MS} from './reserve-heartbeat';
/** This runs in the server, independently of the studio browser and inbound reachability. */
export async function sendReserveHeartbeats(){
 const sources=Object.values((await readReserveStateSnapshot()).sources).filter(s=>s.status==='armed'&&s.autoEnabled===true&&!s.pendingAuto&&s.autoProtocol===OUTBOUND_RESERVE_PROTOCOL&&s.readyUntil>Date.now());
 if(!sources.length)return;
 const liveKitReady=await transferLiveKitReady();
 await Promise.allSettled(sources.map(async source=>{
  const target=(await roomTransferTargets(source.roomId)).find(t=>t.id===source.targetId&&t.peer&&t.origin===source.targetUrl);
  if(!target)return;
  // Re-read after asynchronous health/profile calls: OFF/rearm cannot keep renewing an old binding.
  const current=Object.values((await readReserveStateSnapshot()).sources).find(s=>s.cohortId===source.cohortId);
  if(!current||current.status!=='armed'||!current.autoEnabled||current.pendingAuto||current.autoEpoch!==source.autoEpoch||current.armGeneration!==source.armGeneration||current.readyUntil<=Date.now())return;
  await sendPeerBridge(target,{action:'heartbeat',roomId:source.roomId,studioId:source.studioId,cohortId:source.cohortId,armGeneration:source.armGeneration,autoEpoch:source.autoEpoch,liveKitReady,sentAt:Date.now()},'/api/server-reserve');
 }));
}
export function startReserveHeartbeatWorker(){
 const key=Symbol.for('castlink.reserve-heartbeat-worker');const shared=globalThis as typeof globalThis&{[key:symbol]:ReturnType<typeof setInterval>|undefined};if(shared[key])return;
 let running=false;const tick=async()=>{if(running)return;running=true;try{await sendReserveHeartbeats();}catch{/* Availability errors do not crash serving; the target observes the missing pulse. */}finally{running=false;}};
 shared[key]=setInterval(()=>void tick(),HEARTBEAT_INTERVAL_MS);shared[key]!.unref();void tick();
}
