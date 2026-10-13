import { readNodeAdmission, blockNodeParticipant, acknowledgeNodeOperation, type Admission } from "./node-admission-store";
import { ownNodeId, signedNodeFetch } from "./node-request";
export const admissionConfigured = () => process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1";
export async function localNodeAdmission(mediaRoom = "", identity = ""): Promise<Admission> {
  const nodeId = ownNodeId();
  if (!nodeId) throw new Error("node_identity_missing");
  const control = process.env.CASTLINK_CONTROL_PLANE_URL?.trim();
  if (!control) return readNodeAdmission(nodeId,mediaRoom,identity);
  const params = new URLSearchParams({room:mediaRoom,identity});
  const data = await signedNodeFetch(control,nodeId,`/v1/control/node-admission?${params}`,undefined,process.env.CASTLINK_NODE_SECRET);
  if (data.nodeId !== nodeId || typeof data.allowed !== "boolean" || !Number.isSafeInteger(data.revision)) throw new Error("invalid_admission_response");
  return data;
}
export async function rememberLocalKick(mediaRoom: string, identity: string) {
  if (!admissionConfigured()) return;
  const control = process.env.CASTLINK_CONTROL_PLANE_URL?.trim(), nodeId=ownNodeId();
  if (control) await signedNodeFetch(control,nodeId,"/v1/control/node-admission",{action:"block",room:mediaRoom,identity},process.env.CASTLINK_NODE_SECRET);
  else await blockNodeParticipant(nodeId,mediaRoom,identity);
}
export async function acknowledgeLocalOperation(revision: number) {
  const control = process.env.CASTLINK_CONTROL_PLANE_URL?.trim(), nodeId=ownNodeId();
  if (control) await signedNodeFetch(control,nodeId,"/v1/control/node-admission",{action:"ack",revision},process.env.CASTLINK_NODE_SECRET);
  else await acknowledgeNodeOperation(nodeId,revision);
}
