import { NextRequest, NextResponse } from "next/server";
import { changeNodeState } from "../../../lib/node-state-transition";
import { executePlatformNodeOperation } from "../../../lib/platform-node-operations";
import { validNodeOperation } from "../../../lib/node-operations";
import { sameOrigin } from "../../../lib/access";
import { listAllStudios, listControlNodes, listControlRooms, type NodeOperationalState } from "../../../lib/control-plane-store";
import { heartbeatSecretForNode } from "../../../lib/node-heartbeat-auth";
import { signNodeControlRequest } from "../../../lib/node-control-auth";
import { collectLocalNodeTopology } from "../../../lib/node-topology";
import { mergePlatformTopology } from "../../../lib/platform-topology";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";
import { isSuperAdmin } from "../../../lib/super-admin-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const nodeIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
const nodeStates: NodeOperationalState[] = ["active", "draining", "disabled", "force_offline"];

async function fetchNodeTopology(node: { nodeId: string; endpoint?: string }) {
  const started = Date.now();
  const ownNodeId = process.env.CASTLINK_NODE_ID?.trim() || process.env.STUDIOLINK_TRANSFER_SERVER_ID?.trim();
  if (ownNodeId && node.nodeId === ownNodeId) {
    try { const rooms = await collectLocalNodeTopology(); return { nodeId: node.nodeId, ok: true as const, latencyMs: Date.now()-started, generatedAt: Date.now(), rooms }; }
    catch { return { nodeId: node.nodeId, ok: false as const, latencyMs: Date.now()-started, error: "local_topology_failed", rooms: [] as any[] }; }
  }
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
      cache: "no-store", redirect: "error",
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
    if (!Number.isFinite(data.generatedAt) || Math.abs(Date.now()-data.generatedAt) > 45000) throw new Error("stale_topology");
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
    const merged = mergePlatformTopology(studios, rooms, nodeTopologies);
    const topologyComplete=nodeTopologies.every(node=>node.ok) && merged.rooms.every(room=>room.topologyAvailable);
    const observedParticipants=merged.rooms.reduce((sum,room)=>sum+(room.participantCount ?? 0),0);
    const observedVideoTracks=merged.rooms.reduce((sum,room)=>sum+room.participants.reduce((n:number,p:any)=>n+Number(p.videoTrackCount || 0),0),0);
    const summary = {
      nodes: nodes.length,
      healthyNodes: nodes.filter(node => node.state === "active" && node.health === "healthy" && Date.now()-node.lastSeenAt <= 45000).length,
      studios: merged.studios.length,
      liveStudios: merged.studios.filter(studio => studio.observedLive).length,
      rooms: merged.rooms.length,
      participants: topologyComplete ? observedParticipants : null, observedParticipants,
      videoTracks: topologyComplete ? observedVideoTracks : null, observedVideoTracks,
      topologyComplete,
    };
    serverLog("info", "super_admin.overview", { requestId: reqId, status: 200, nodes: summary.nodes, studios: summary.studios, rooms: summary.rooms });
    return NextResponse.json({ generatedAt: Date.now(), summary, nodes, studios: merged.studios, rooms: merged.rooms, nodeTopologies }, { headers });
  } catch (error) {
    serverLog("error", "super_admin.overview_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "control_plane_unavailable" });
    return NextResponse.json({ error: "Не удалось обновить данные платформы" }, { status: 503, headers });
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
    if (data?.action === "participant") {
      if (!nodeIdOk(data.nodeId) || !validNodeOperation(data.operation) || data.operation.action === "enforce-state") return new NextResponse(null,{status:400,headers});
      if (data.operation.action === "kick" && data.confirmIdentity !== data.operation.identity) return NextResponse.json({error:"Подтвердите отключение участника"},{status:400,headers});
      const result = await executePlatformNodeOperation(data.nodeId,data.operation);
      serverLog("warn","super_admin.participant_changed",{requestId:reqId,nodeId:data.nodeId,room:data.operation.room,identity:data.operation.identity,action:data.operation.action,status:200});
      return NextResponse.json(result,{headers});
    }
    if (data?.action !== "node-state" || !nodeIdOk(data.nodeId) || !nodeStates.includes(data.state)) {
      return NextResponse.json({ error: "Некорректное состояние ноды" }, { status: 400, headers });
    }
    if (data.state === "force_offline" && data.confirmForceOffline !== true) return NextResponse.json({error:"Требуется явное подтверждение Force Offline"},{status:400,headers});
    const result = await changeNodeState(data.nodeId, data.state);
    if (!result.ok) {
      const status = result.reason === "node_not_found" ? 404 : 409;
      serverLog("warn", "super_admin.node_state_rejected", { requestId: reqId, status, nodeId: data.nodeId, state: data.state, reason: result.reason });
      return NextResponse.json(result, { status, headers });
    }
    serverLog(data.state === "force_offline" ? "warn" : "info", "super_admin.node_state_changed", {
      requestId: reqId, status: result.applied ? 200 : 202, nodeId: data.nodeId, state: data.state,
    });
    return NextResponse.json(result, { status: result.applied ? 200 : 202, headers });
  } catch (error) {
    serverLog("error", "super_admin.node_state_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "node_state_failed" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось изменить состояние ноды" }, { status: 503, headers });
  }
}
