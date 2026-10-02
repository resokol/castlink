import { controlPlanePool } from "./control-plane-store";
export type Admission = { nodeId: string; state: string; revision: number; allowed: boolean; blocked: boolean; reason?: string };

export async function readNodeAdmission(nodeId: string, mediaRoom = "", identity = ""): Promise<Admission> {
  const result = await controlPlanePool().query<{ state: string; operational_revision: string; blocked: boolean }>(
    `SELECT n.state,n.operational_revision,EXISTS(SELECT 1 FROM castlink_control.participant_blocks b
       WHERE b.node_id=n.node_id AND b.media_room=$2 AND b.identity=$3 AND b.expires_at>now()) AS blocked
       FROM castlink_control.nodes n WHERE n.node_id=$1`, [nodeId,mediaRoom,identity]);
  const row = result.rows[0];
  if (!row) return { nodeId,state:"unknown",revision:0,allowed:false,blocked:false,reason:"node_not_registered" };
  const allowed = ["active","draining"].includes(row.state) && !row.blocked;
  return { nodeId,state:row.state,revision:Number(row.operational_revision),allowed,blocked:row.blocked,
    ...(!allowed ? {reason:row.blocked ? "participant_removed" : `node_${row.state}`} : {}) };
}

/** A kick revokes this technical identity, not every human sharing a guest invitation. */
export async function blockNodeParticipant(nodeId: string, mediaRoom: string, identity: string) {
  await controlPlanePool().query(
    `INSERT INTO castlink_control.participant_blocks(node_id,media_room,identity,expires_at)
     VALUES ($1,$2,$3,now()+interval '24 hours') ON CONFLICT(node_id,media_room,identity)
     DO UPDATE SET expires_at=EXCLUDED.expires_at`, [nodeId,mediaRoom,identity]);
  await controlPlanePool().query("DELETE FROM castlink_control.participant_blocks WHERE expires_at<now()");
}
export async function acknowledgeNodeOperation(nodeId: string, revision: number) {
  await controlPlanePool().query(`UPDATE castlink_control.nodes SET applied_revision=$2,applied_at=now()
    WHERE node_id=$1 AND operational_revision=$2`, [nodeId,revision]);
}
