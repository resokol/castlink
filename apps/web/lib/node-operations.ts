import { RoomServiceClient } from "livekit-server-sdk";
import { admissionConfigured, localNodeAdmission, rememberLocalKick, acknowledgeLocalOperation } from "./node-admission";
import { ownNodeId } from "./node-request";
export type NodeOperation = { action:"enforce-state"; revision:number } | { action:"kick"|"rename"; room:string; identity:string; sid:string; name?:string };
export function validNodeOperation(value: unknown): value is NodeOperation {
  if(!value || typeof value!=="object") return false;
  const v=value as Record<string,unknown>;
  if(v.action==="enforce-state") return Number.isSafeInteger(v.revision) && Number(v.revision)>=0;
  return ["kick","rename"].includes(String(v.action)) &&
    [v.room,v.identity,v.sid].every(s=>typeof s==="string" && s.length>0 && s.length<=512) &&
    (v.action!=="rename" || typeof v.name==="string" && v.name.trim().length>0 && v.name.length<=120 && !/[\u0000-\u001f\u007f]/.test(v.name));
}
/** These APIs control participants but never create a camera, microphone or publication. */
const operationRuntime=globalThis as typeof globalThis & {__castlinkNodeOperationQueue?:{tail:Promise<unknown>;pending:number}};
const queue=operationRuntime.__castlinkNodeOperationQueue ||= {tail:Promise.resolve(),pending:0};
export async function executeLocalNodeOperation(command: NodeOperation) {
  if(command.action!=="enforce-state") return execute(command);
  if(queue.pending>=16) throw new Error("node_operation_busy");
  queue.pending++;
  const task=queue.tail.catch(()=>undefined).then(()=>execute(command));
  queue.tail=task;
  try {return await task;} finally {queue.pending--;}
}
async function execute(command: NodeOperation) {
  const lk=new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880",process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
  if(command.action==="enforce-state") {
    if(!admissionConfigured()) throw new Error("node_admission_not_configured");
    const policy=await localNodeAdmission();
    if(policy.revision!==command.revision) throw new Error("stale_node_operation");
    const rooms=await lk.listRooms(); let disconnected=0;
    for(const room of rooms) {
      const participants=await lk.listParticipants(room.name);
      if(policy.state==="disabled" && participants.length) throw new Error("node_not_drained");
      if(policy.state==="force_offline") {
        const current=await localNodeAdmission();
        if(current.revision!==command.revision || current.state!=="force_offline") throw new Error("stale_node_operation");
        await lk.deleteRoom(room.name); disconnected+=participants.length;
      }
    }
    if(policy.state==="force_offline") {
      for(const room of await lk.listRooms()) if((await lk.listParticipants(room.name)).length) throw new Error("node_eviction_incomplete");
    }
    await acknowledgeLocalOperation(policy.revision);
    return {ok:true,nodeId:ownNodeId(),revision:policy.revision,state:policy.state,disconnected,admissionEnforced:true};
  }
  const participant=await lk.getParticipant(command.room,command.identity);
  if(participant.sid!==command.sid) throw new Error("participant_session_changed");
  if(command.action==="rename") {
    const name=command.name!.trim();
    await lk.updateParticipant(command.room,command.identity,{name});
    return {ok:true,nodeId:ownNodeId(),identity:command.identity,name};
  }
  await rememberLocalKick(command.room,command.identity);
  await lk.removeParticipant(command.room,command.identity);
  return {ok:true,nodeId:ownNodeId(),identity:command.identity,removed:true,identityBlocked:admissionConfigured()};
}
