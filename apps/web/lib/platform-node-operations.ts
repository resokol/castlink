import { listControlNodes } from "./control-plane-store";
import { ownNodeId, signedNodeFetch } from "./node-request";
import { executeLocalNodeOperation, type NodeOperation } from "./node-operations";
export async function executePlatformNodeOperation(nodeId: string, command: NodeOperation) {
  const node=(await listControlNodes()).find(item=>item.nodeId===nodeId);
  if(!node) throw new Error("node_not_found");
  if(nodeId===ownNodeId()) return executeLocalNodeOperation(command);
  if(!node.endpoint) throw new Error("node_endpoint_missing");
  const result=await signedNodeFetch(node.endpoint,nodeId,"/v1/node/operations",command);
  if(result.nodeId!==nodeId || result.ok!==true) throw new Error("invalid_node_operation_response");
  return result;
}
