import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "../../../lib/access";
import { listAllStudios, listControlNodes, listControlRooms, setNodeOperationalState, type NodeOperationalState } from "../../../lib/control-plane-store";
import { heartbeatSecretForNode } from "../../../lib/node-heartbeat-auth";
import { signNodeControlRequest } from "../../../lib/node-control-auth";
import { mediaRoomName } from "../../../lib/studio-scope";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";
import { isSuperAdmin } from "../../../lib/super-admin-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const nodeIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
const nodeStates: NodeOperationalState[] = ["active", "draining", "disabled", "force_offline"];

async function fetchNodeTopology(node: { nodeId: string; endpoint?: string }) {
  const started = Date.now();
  if (!node.endpoint) return { nodeId: node.nodeId, ok: false as const, latencyMs: null, error: "endpoint_missing", rooms: [] as any[] };
  const secret = heartbeatSecretForNode(node.nodeId);
  if (!secret) return { nodeId: node.nodeId, ok: false as const, latencyMs: null, error: "node_secret_missing", rooms: [] as any[] };
  try {
    const base = new URL(node.endpoint);
    const localDev = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(base.hostname);
    if (base.protocol !== "https:" && !localDev) throw new Error("insecure_endpoint");
    const target = new URL("/v1/node/topology", base);
    const pathAndQuery = target.pathname + target.search;
    const timestamp = String(Date.now());
    const signature = signNodeControlRequest(secret, timestamp, "GET", pathAndQuery);
    const response = await fetch(target, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-castlink-node-id": node.nodeId,
        "x-castlink-node-time": timestamp,
        "x-castlink-node-signature": signature,
      },
      signal: AbortSignal.timeout(Number(process.env.CASTLINK_SUPER_ADMIN_NODE_TIMEOUT_MS || 2500)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.nodeId !== node.nodeId || !Array.isArray(data.rooms)) throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
    return { nodeId: node.nodeId, ok: true as const, latencyMs: Date.now() - started, generatedAt: data.generatedAt, rooms: data.rooms };
  } catch (error) {
    return { nodeId: node.nodeId, ok: false as const, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "topology_failed", rooms: [] as any[] };
  }
}

export async function GET(request: NextRequest) {
  const reqId = requestId(request);
  const headers = requestHeaders(reqId, noStore);
  try {
    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });
    const [nodes, studios, rooms] = await Promise.all([listControlNodes(), listAllStudios(), listControlRooms()]);
    const nodeTopologies = await Promise.all(nodes.map(node => fetchNodeTopology(node)));
    const topologyByNode = new Map(nodeTopologies.map(item => [item.nodeId, item]));
    const studioById = new Map(studios.map(studio => [studio.studioId, studio]));
    const enrichedRooms = rooms.map(room => {
      const studio = studioById.get(room.studioId);
      const topology = studio?.assignedNodeId ? topologyByNode.get(studio.assignedNodeId) : undefined;
      const expectedMediaRoom = mediaRoomName(room.studioId, room.name);
      const liveRoom = topology?.rooms.find((candidate: any) => candidate.mediaRoom === expectedMediaRoom);
      return {
        ...room,
        nodeId: studio?.assignedNodeId || null,
        mediaRoom: expectedMediaRoom,
        participantCount: liveRoom?.participantCount ?? 0,
        participants: Array.isArray(liveRoom?.participants) ? liveRoom.participants : [],
        topologyAvailable: topology?.ok === true,
        nodeLatencyMs: topology?.latencyMs ?? null,
      };
    });
    const summary = {
      nodes: nodes.length,
      healthyNodes: nodes.filter(node => node.health === "healthy").length,
      studios: studios.length,
      liveStudios: studios.filter(studio => studio.broadcastState === "live").length,
      rooms: rooms.length,
      participants: nodes.reduce((sum, node) => sum + node.activeParticipants, 0),
      videoTracks: nodes.reduce((sum, node) => sum + node.activeVideoTracks, 0),
    };
    serverLog("info", "super_admin.overview", { requestId: reqId, status: 200, nodes: summary.nodes, studios: summary.studios, rooms: summary.rooms });
    return NextResponse.json({ generatedAt: Date.now(), summary, nodes, studios, rooms: enrichedRooms, nodeTopologies }, { headers });
  } catch (error) {
    serverLog("error", "super_admin.overview_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "control_plane_unavailable" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Control plane недоступен" }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const reqId = requestId(request);
  const headers = requestHeaders(reqId, noStore);
  if (!request.headers.get("origin") || !sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers });
  const mutationLimit = consumeRateLimit(request, { scope: "super-admin-mutation", limit: 30, windowMs: 60_000 });
  if (!mutationLimit.ok) return NextResponse.json({ error: "Слишком много Super Admin операций" }, { status: 429, headers: { ...headers, ...rateLimitHeaders(mutationLimit) } });
  try {
    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });
    const raw = await request.text();
    if (raw.length > 4096) return new NextResponse(null, { status: 413, headers });
    let data: any;
    try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers }); }
    if (data?.action !== "node-state" || !nodeIdOk(data.nodeId) || !nodeStates.includes(data.state)) {
      return NextResponse.json({ error: "Некорректное состояние ноды" }, { status: 400, headers });
    }
    const result = await setNodeOperationalState(data.nodeId, data.state);
    if (!result.ok) {
      const status = result.reason === "node_not_found" ? 404 : 409;
      serverLog("warn", "super_admin.node_state_rejected", { requestId: reqId, status, nodeId: data.nodeId, state: data.state, reason: result.reason });
      return NextResponse.json(result, { status, headers });
    }
    serverLog(data.state === "force_offline" ? "warn" : "info", "super_admin.node_state_changed", {
      requestId: reqId, status: 200, nodeId: data.nodeId, state: data.state,
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    serverLog("error", "super_admin.node_state_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "node_state_failed" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось изменить состояние ноды" }, { status: 503, headers });
  }
}
