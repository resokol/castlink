import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { selectNode, type NodeCapacity } from "./node-scheduler";
import type { NodeHeartbeat } from "./node-heartbeat";

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
  endpoint: string | null;
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
    endpoint: row.endpoint || undefined,
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
    `SELECT node_id,name,region,endpoint,state,health,last_seen_at,
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
    `INSERT INTO castlink_control.studios(studio_id,organization_id,name,owner_access_version)
     SELECT $1,$2,$3,$4
      WHERE EXISTS (SELECT 1 FROM castlink_control.organizations WHERE organization_id=$2)
     RETURNING studio_id,organization_id,name,assignment_mode,assigned_node_id,broadcast_state`,
    [studioId, organizationId, clean, randomUUID()],
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


export async function closeControlPlanePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}


export async function resolveStudioRoute(studioId: string, organizationId = defaultOrganizationId()) {
  const result = await controlPlanePool().query<{
    studio_id: string;
    organization_id: string;
    assigned_node_id: string | null;
    broadcast_state: "idle" | "starting" | "live" | "stopping";
    node_id: string | null;
    node_name: string | null;
    region: string | null;
    endpoint: string | null;
    state: "active" | "draining" | "disabled" | null;
    health: "healthy" | "degraded" | "offline" | "unknown" | null;
    last_seen_at: Date | string | null;
  }>(
    `SELECT s.studio_id,s.organization_id,s.assigned_node_id,s.broadcast_state,
            n.node_id,n.name AS node_name,n.region,n.endpoint,n.state,n.health,n.last_seen_at
       FROM castlink_control.studios s
       LEFT JOIN castlink_control.nodes n ON n.node_id=s.assigned_node_id
      WHERE s.studio_id=$1 AND s.organization_id=$2`,
    [studioId, organizationId],
  );
  if (!result.rowCount) throw new Error("Studio not found");
  const row = result.rows[0];
  if (!row.assigned_node_id || !row.node_id || !row.endpoint) {
    return { ok: false as const, reason: "unassigned" as const, studioId, broadcastState: row.broadcast_state };
  }
  const lastSeenAt = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const healthy = row.state === "active" && row.health === "healthy" && Date.now() - lastSeenAt <= 45_000;
  if (!healthy) {
    return {
      ok: false as const,
      reason: "assigned_node_unavailable" as const,
      studioId,
      nodeId: row.node_id,
      broadcastState: row.broadcast_state,
    };
  }
  let endpoint: string;
  try {
    const url = new URL(row.endpoint);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["http:", "https:"].includes(url.protocol))) {
      throw new Error("Node endpoint must use HTTPS");
    }
    endpoint = url.origin;
  } catch {
    throw new Error("Assigned node endpoint is invalid");
  }
  return {
    ok: true as const,
    studioId,
    nodeId: row.node_id,
    nodeName: row.node_name || row.node_id,
    region: row.region || "",
    endpoint,
    broadcastState: row.broadcast_state,
  };
}


export async function transferStudioAssignment(
  studioId: string,
  sourceNodeId: string,
  targetNodeId: string,
  organizationId = defaultOrganizationId(),
) {
  const client = await controlPlanePool().connect();
  try {
    await client.query("BEGIN");
    const studioResult = await client.query<{
      assigned_node_id: string | null;
      broadcast_state: "idle" | "starting" | "live" | "stopping";
    }>(
      `SELECT assigned_node_id,broadcast_state
         FROM castlink_control.studios
        WHERE studio_id=$1 AND organization_id=$2
        FOR UPDATE`,
      [studioId, organizationId],
    );
    if (!studioResult.rowCount) throw new Error("Studio not found");
    const studio = studioResult.rows[0];
    if (studio.assigned_node_id !== sourceNodeId) throw new Error("Studio is not assigned to source node");
    if (sourceNodeId === targetNodeId) throw new Error("Target node must differ from source node");

    const targetResult = await client.query<NodeRow>(
      `SELECT node_id,name,region,endpoint,state,health,last_seen_at,
              max_active_studios,max_participants,max_video_tracks,
              active_studios,active_participants,active_video_tracks,
              cpu_load,memory_load,network_out_mbps
         FROM castlink_control.nodes
        WHERE node_id=$1
        FOR UPDATE`,
      [targetNodeId],
    );
    if (!targetResult.rowCount) throw new Error("Target node not found");
    const target = nodeCapacity(targetResult.rows[0]);
    const placement = selectNode([target], {
      studioId,
      pinnedNodeId: targetNodeId,
      activeBroadcast: true,
    });
    if (!placement.ok) throw new Error("Target node is unavailable");

    await client.query(
      `UPDATE castlink_control.studios
          SET assigned_node_id=$1,updated_at=now()
        WHERE studio_id=$2 AND organization_id=$3`,
      [targetNodeId, studioId, organizationId],
    );
    await client.query("COMMIT");
    return {
      ok: true as const,
      studioId,
      sourceNodeId,
      targetNodeId,
      broadcastState: studio.broadcast_state,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function applyNodeHeartbeat(heartbeat: NodeHeartbeat) {
  const result = await controlPlanePool().query<{
    node_id: string;
    region: string;
    node_type: "cloud" | "self-hosted" | "edge";
    state: "active" | "draining" | "disabled";
    last_seen_at: Date | string | null;
  }>(
    `SELECT node_id,region,node_type,state,last_seen_at
       FROM castlink_control.nodes
      WHERE node_id=$1`,
    [heartbeat.nodeId],
  );
  if (!result.rowCount) throw new Error("Unknown node");
  const node = result.rows[0];
  if (node.state === "disabled") throw new Error("Node is disabled");
  if (node.region !== heartbeat.region) throw new Error("Node region mismatch");
  if (node.node_type !== heartbeat.nodeType) throw new Error("Node type mismatch");
  const previousSeen = node.last_seen_at ? new Date(node.last_seen_at).getTime() : 0;
  if (previousSeen && heartbeat.sentAt <= previousSeen) throw new Error("Heartbeat replay or stale timestamp");

  await controlPlanePool().query(
    `UPDATE castlink_control.nodes
        SET health='healthy',
            last_seen_at=to_timestamp($2::double precision / 1000.0),
            active_studios=$3,
            active_participants=$4,
            active_video_tracks=$5,
            cpu_load=$6,
            memory_load=$7,
            network_out_mbps=$8,
            updated_at=now()
      WHERE node_id=$1`,
    [
      heartbeat.nodeId,
      heartbeat.sentAt,
      heartbeat.activeStudios,
      heartbeat.activeParticipants,
      heartbeat.activeVideoTracks,
      heartbeat.cpuLoad ?? null,
      heartbeat.memoryLoad ?? null,
      heartbeat.networkOutMbps ?? null,
    ],
  );

  return {
    nodeId: heartbeat.nodeId,
    lastSeenAt: heartbeat.sentAt,
    activeStudios: heartbeat.activeStudios,
    activeParticipants: heartbeat.activeParticipants,
    activeVideoTracks: heartbeat.activeVideoTracks,
  };
}


export async function studioOwnerAccessVersion(
  studioId: string,
  organizationId = defaultOrganizationId(),
) {
  const candidate = randomUUID();
  const result = await controlPlanePool().query<{ owner_access_version: string }>(
    `UPDATE castlink_control.studios
        SET owner_access_version=CASE
          WHEN owner_access_version='' THEN $3
          ELSE owner_access_version
        END,
        updated_at=now()
      WHERE studio_id=$1 AND organization_id=$2
      RETURNING owner_access_version`,
    [studioId, organizationId, candidate],
  );
  if (!result.rowCount) throw new Error("Studio not found");
  return result.rows[0].owner_access_version;
}

export async function rotateStudioOwnerAccessVersion(
  studioId: string,
  organizationId = defaultOrganizationId(),
) {
  const version = randomUUID();
  const result = await controlPlanePool().query(
    `UPDATE castlink_control.studios
        SET owner_access_version=$3,updated_at=now()
      WHERE studio_id=$1 AND organization_id=$2`,
    [studioId, organizationId, version],
  );
  if (!result.rowCount) throw new Error("Studio not found");
  return version;
}
