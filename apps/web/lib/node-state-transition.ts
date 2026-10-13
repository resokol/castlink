import { Client } from "pg";
import { listControlNodes, setNodeOperationalState, type NodeOperationalState } from "./control-plane-store";
import { executePlatformNodeOperation } from "./platform-node-operations";
// Advisory locks use dedicated, bounded connections so callbacks cannot exhaust the normal DB pool.
const lockRuntime=globalThis as typeof globalThis & {__castlinkNodeLocks?:{active:number}};
const lockState=lockRuntime.__castlinkNodeLocks ||= {active:0};
async function nodeLock<T>(nodeId:string, operation:()=>Promise<T>) {
  if(lockState.active>=2) throw new Error("node_operation_busy");
  lockState.active++;
  const client=new Client({connectionString:process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis:3000,statement_timeout:5000,application_name:"castlink-node-operation-lock"});
  let connected=false,locked=false;
  try {
    await client.connect();connected=true;
    const result=await client.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",[`castlink-node-operation:${nodeId}`]);
    locked=result.rows[0]?.locked===true;
    if(!locked) throw new Error("node_operation_busy");
    return await operation();
  } finally {
    if(locked) await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))",[`castlink-node-operation:${nodeId}`]).catch(()=>undefined);
    if(connected) await client.end().catch(()=>undefined);
    lockState.active--;
  }
}
export async function changeNodeState(nodeId:string,state:NodeOperationalState) {
  return nodeLock(nodeId,async()=>{
    const changed=await setNodeOperationalState(nodeId,state);
    if(!changed.ok) return changed;
    try {
      const enforcement=await executePlatformNodeOperation(nodeId,{action:"enforce-state",revision:changed.node.operationalRevision});
      return {...changed,applied:true,enforcement};
    } catch(error) {
      return {...changed,applied:false,enforcementError:error instanceof Error ? error.message : "node_unreachable"};
    }
  });
}
export async function reconcileNodeState(nodeId:string) {
  return nodeLock(nodeId,async()=>{
    const node=(await listControlNodes()).find(n=>n.nodeId===nodeId);
    if(!node) throw new Error("node_not_found");
    if(node.operationalRevision===0) return {ok:false,nodeId,reason:"operator_activation_required"};
    if(node.state!=="force_offline" && node.appliedRevision===node.operationalRevision) return {ok:true,nodeId,revision:node.operationalRevision,unchanged:true};
    return executePlatformNodeOperation(nodeId,{action:"enforce-state",revision:node.operationalRevision});
  });
}
