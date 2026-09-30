import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { selectNode, type NodeCapacity } from "./node-scheduler";

type StudioRow = {
  studio_id: string;
  organization_id: string;
  name: string;
  assignment_mode: "auto" | "pinned";
  assigned_node_id: string | null;
  broadcast_state: "idle" | "starting" | "live" | "stopping";
};

type NodeRow = {
  node_id: string;
  name: string;
  region: string;
  state: "active" | "draining" | "disabled";
  health: "healthy" | "degraded" | "offline" | "unknown";
  last_seen_at: Date | string | null;
  max_active_studios: number;
  max_participants: number;
  max_video_tracks: number;
  active_studios: number;
  active_participants: number;
  active_video_tracks: number;
  cpu_load: number | null;
  memory_load: number | null;
  network_out_mbps: number | null;
};

let pool: Pool | undefined;

function controlPlanePool() {
  if (pool) return pool;
  const connectionString = process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Control plane database is not configured");
  pool = new Pool({
    connectionString,
    max: Number(process.env.CASTLINK_CONTROL_DB_POOL_MAX || 5),
    connectionTimeoutMillis: Number(process.env.CASTLINK_DB_CONNECT_TIMEOUT_MS || 3000),
    idleTimeoutMillis: Number(process.env.CASTLINK_DB_IDLE_TIMEOUT_MS || 30000),
    statement_timeout: Number(process.env.CASTLINK_DB_STATEMENT_TIMEOUT_MS || 5000),
    application_name: "castlink-control-plane",
  });
  return pool;
}

export function defaultOrganizationId() {
  const value = process.env.CASTLINK_DEFAULT_ORGANIZATION_ID?.trim() || "org-default";
  if (!/^[A-Za-z0-9._:-]{6,128}$/.test(value)) throw new Error("Invalid default organization ID");
  return value;
}

function nodeCapacity(row: NodeRow): NodeCapacity {
  return {
    nodeId: row.node_id,
    name: row.name,
    region: row.region,
    state: row.state,
    health: row.health,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0,
    maxActiveStudios: row.max_active_studios,
    maxParticipants: row.max_participants,
    maxVideoTracks: row.max_video_tracks,
    activeStudios: row.active_studios,
    activeParticipants: row.active_participants,
    activeVideoTracks: row.active_video_tracks,
    cpuLoad: row.cpu_load,
    memoryLoad: row.memory_load,
    networkOutMbps: row.network_out_mbps,
  };
}

export async function listControlNodes() {
  const result = await controlPlanePool().query<NodeRow>(
    `SELECT node_id,name,region,state,health,last_seen_at,
            max_active_studios,max_participants,max_video_tracks,
            active_studios,active_participants,active_video_tracks,
            cpu_load,memory_load,network_out_mbps
       FROM castlink_control.nodes
      ORDER BY name,node_id`,
  );
  return result.rows.map(nodeCapacity);
}

export async function listStudios(organizationId = defaultOrganizationId()) {
  const result = await controlPlanePool().query<StudioRow>(
    `SELECT studio_id,organization_id,name,assignment_mode,assigned_node_id,broadcast_state
       FROM castlink_control.studios
      WHERE organization_id=$1
      ORDER BY created_at,studio_id`,
    [organizationId],
  );
  return result.rows.map(row => ({
    studioId: row.studio_id,
    organizationId: row.organization_id,
    name: row.name,
    assignmentMode: row.assignment_mode,
    assignedNodeId: row.assigned_node_id,
    broadcastState: row.broadcast_state,
  }));
}

export async function createStudio(name: string, organizationId = defaultOrganizationId()) {
  const clean = name.trim();
  if (!clean || clean.length > 120) throw new Error("Invalid studio name");
  const studioId = `studio-${randomUUID().replaceAll("-", "")}`;
  const result = await controlPlanePool().query<StudioRow>(
    `INSERT INTO castlink_control.studios(studio_id,organization_id,name)
     SELECT $1,$2,$3
      WHERE EXISTS (SELECT 1 FROM castlink_control.organizations WHERE organization_id=$2)
     RETURNING studio_id,organization_id,name,assignment_mode,assigned_node_id,broadcast_state`,
    [studioId, organizationId, clean],
  );
  if (!result.rowCount) throw new Error("Organization is not initialized");
  return {
    studioId,
    organizationId,
    name: clean,
    assignmentMode: "auto" as const,
    assignedNodeId: null,
    broadcastState: "idle" as const,
  };
}

async function studioRow(studioId: string, organizationId: string) {
  const result = await controlPlanePool().query<StudioRow>(
    `SELECT studio_id,organization_id,name,assignment_mode,assigned_node_id,broadcast_state
       FROM castlink_control.studios
      WHERE studio_id=$1 AND organization_id=$2`,
    [studioId, organizationId],
  );
  if (!result.rowCount) throw new Error("Studio not found");
  return result.rows[0];
}

export async function assignStudioAuto(
  studioId: string,
  options: { preferredRegion?: string; expectedParticipants?: number; expectedVideoTracks?: number } = {},
  organizationId = defaultOrganizationId(),
) {
  const studio = await studioRow(studioId, organizationId);
  if (studio.broadcast_state === "live" || studio.broadcast_state === "stopping") {
    return { ok: false as const, reason: "active_broadcast_locked" as const };
  }

  const placement = selectNode(await listControlNodes(), {
    studioId,
    preferredRegion: options.preferredRegion,
    expectedParticipants: options.expectedParticipants,
    expectedVideoTracks: options.expectedVideoTracks,
  });
  if (!placement.ok) return placement;

  await controlPlanePool().query(
    `UPDATE castlink_control.studios
        SET assignment_mode='auto',assigned_node_id=$1,updated_at=now()
      WHERE studio_id=$2 AND organization_id=$3`,
    [placement.node.nodeId, studioId, organizationId],
  );
  return placement;
}

export async function pinStudio(
  studioId: string,
  nodeId: string,
  organizationId = defaultOrganizationId(),
) {
  const studio = await studioRow(studioId, organizationId);
  if ((studio.broadcast_state === "live" || studio.broadcast_state === "stopping") && studio.assigned_node_id !== nodeId) {
    return { ok: false as const, reason: "active_broadcast_locked" as const };
  }

  const placement = selectNode(await listControlNodes(), {
    studioId,
    pinnedNodeId: nodeId,
    activeBroadcast: false,
    expectedParticipants: 0,
    expectedVideoTracks: 0,
  });
  if (!placement.ok) return placement;

  await controlPlanePool().query(
    `UPDATE castlink_control.studios
        SET assignment_mode='pinned',assigned_node_id=$1,updated_at=now()
      WHERE studio_id=$2 AND organization_id=$3`,
    [nodeId, studioId, organizationId],
  );
  return placement;
}
