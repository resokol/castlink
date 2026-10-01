export type NodeCapacity = {
  nodeId: string;
  name: string;
  region: string;
  endpoint?: string;
  state: "active" | "draining" | "disabled" | "force_offline";
  health: "healthy" | "degraded" | "offline" | "unknown";
  lastSeenAt: number;
  maxActiveStudios: number;
  maxParticipants: number;
  maxVideoTracks: number;
  activeStudios: number;
  activeParticipants: number;
  activeVideoTracks: number;
  cpuLoad?: number | null;
  memoryLoad?: number | null;
  networkOutMbps?: number | null;
};

export type StudioPlacementRequest = {
  studioId: string;
  preferredRegion?: string;
  pinnedNodeId?: string;
  activeBroadcast?: boolean;
  expectedParticipants?: number;
  expectedVideoTracks?: number;
  now?: number;
};

export type PlacementResult =
  | { ok: true; node: NodeCapacity; reason: "pinned" | "auto"; score: number }
  | { ok: false; reason: "active_broadcast_locked" | "pinned_node_unavailable" | "no_capacity" };

const heartbeatFreshMs = 45_000;

function ratio(current: number, max: number) {
  return max > 0 ? current / max : 1;
}

export function nodeEligible(node: NodeCapacity, request: StudioPlacementRequest) {
  const now = request.now ?? Date.now();
  const expectedParticipants = Math.max(0, request.expectedParticipants ?? 4);
  const expectedVideoTracks = Math.max(0, request.expectedVideoTracks ?? expectedParticipants);

  if (node.state !== "active" || node.health !== "healthy") return false;
  if (now - node.lastSeenAt > heartbeatFreshMs) return false;
  if (node.activeStudios + 1 > node.maxActiveStudios) return false;
  if (node.activeParticipants + expectedParticipants > node.maxParticipants) return false;
  if (node.activeVideoTracks + expectedVideoTracks > node.maxVideoTracks) return false;
  return true;
}

export function nodeScore(node: NodeCapacity, request: StudioPlacementRequest) {
  const studio = ratio(node.activeStudios, node.maxActiveStudios);
  const participants = ratio(node.activeParticipants, node.maxParticipants);
  const video = ratio(node.activeVideoTracks, node.maxVideoTracks);
  const cpu = typeof node.cpuLoad === "number" ? Math.max(0, Math.min(1, node.cpuLoad)) : 0.25;
  const memory = typeof node.memoryLoad === "number" ? Math.max(0, Math.min(1, node.memoryLoad)) : 0.25;
  const regionPenalty = request.preferredRegion && request.preferredRegion !== node.region ? 0.15 : 0;

  return studio * 0.28 + participants * 0.22 + video * 0.28 + cpu * 0.12 + memory * 0.10 + regionPenalty;
}

export function selectNode(nodes: NodeCapacity[], request: StudioPlacementRequest): PlacementResult {
  if (request.activeBroadcast && !request.pinnedNodeId) {
    return { ok: false, reason: "active_broadcast_locked" };
  }

  if (request.pinnedNodeId) {
    const pinned = nodes.find(node => node.nodeId === request.pinnedNodeId);
    if (!pinned || !nodeEligible(pinned, request)) return { ok: false, reason: "pinned_node_unavailable" };
    return { ok: true, node: pinned, reason: "pinned", score: nodeScore(pinned, request) };
  }

  const eligible = nodes.filter(node => nodeEligible(node, request));
  if (!eligible.length) return { ok: false, reason: "no_capacity" };

  eligible.sort((a, b) => {
    const scoreDiff = nodeScore(a, request) - nodeScore(b, request);
    return scoreDiff || a.nodeId.localeCompare(b.nodeId);
  });

  const node = eligible[0];
  return { ok: true, node, reason: "auto", score: nodeScore(node, request) };
}
