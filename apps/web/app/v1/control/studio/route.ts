import { NextRequest, NextResponse } from "next/server";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { verifyNodeControlRequest } from "../../../../lib/node-control-auth";
import {
  listControlNodes,
  resolveStudioRoute,
  studioOwnerAccessVersion,
} from "../../../../lib/control-plane-store";
import { validateStudioId } from "../../../../lib/studio-scope";
import { requestHeaders, requestId, serverLog } from "../../../../lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  const nodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const timestamp = request.headers.get("x-castlink-node-time")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret) {
    serverLog("warn", "control.studio_read.denied", { requestId: reqId, nodeId, status: 401, reason: "unknown_node" });
    return NextResponse.json({ error: "Unknown node" }, { status: 401, headers });
  }

  const pathAndQuery = request.nextUrl.pathname + request.nextUrl.search;
  if (!verifyNodeControlRequest(secret, timestamp, "GET", pathAndQuery, signature)) {
    serverLog("warn", "control.studio_read.denied", { requestId: reqId, nodeId, status: 401, reason: "signature" });
    return NextResponse.json({ error: "Invalid node signature" }, { status: 401, headers });
  }

  const node = (await listControlNodes()).find(item => item.nodeId === nodeId);
  if (!node || node.state === "disabled") {
    return NextResponse.json({ error: "Node is disabled or unknown" }, { status: 403, headers });
  }

  let studioId: string;
  try {
    studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || "");
  } catch {
    return NextResponse.json({ error: "Invalid studioId" }, { status: 400, headers });
  }

  try {
    const route = await resolveStudioRoute(studioId);
    const assignedNodeId = "nodeId" in route ? route.nodeId : undefined;
    if (!assignedNodeId || assignedNodeId !== nodeId) {
      return NextResponse.json({ error: "Studio is not assigned to this node" }, { status: 403, headers });
    }
    const ownerAccessVersion = await studioOwnerAccessVersion(studioId);
    serverLog("info", "control.studio_read.allowed", { requestId: reqId, nodeId, studioId, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({
      studioId,
      ownerAccessVersion,
      route,
    }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio not found";
    const status = /not found/i.test(message) ? 404 : 503;
    serverLog(status === 503 ? "error" : "warn", "control.studio_read.failed", { requestId: reqId, nodeId, studioId, status, reason: message, durationMs: Date.now() - started });
    return NextResponse.json({ error: message }, { status, headers });
  }
}
