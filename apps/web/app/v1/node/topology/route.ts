import { NextRequest, NextResponse } from "next/server";
import { collectLocalNodeTopology } from "../../../../lib/node-topology";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { verifyNodeControlRequest } from "../../../../lib/node-control-auth";
import { requestHeaders, requestId, serverLog } from "../../../../lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  const requestedNodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const ownNodeId = process.env.CASTLINK_NODE_ID?.trim() || process.env.STUDIOLINK_TRANSFER_SERVER_ID?.trim() || "";
  if (!ownNodeId || requestedNodeId !== ownNodeId) {
    return NextResponse.json({ error: "Wrong node identity" }, { status: 401, headers });
  }
  const timestamp = request.headers.get("x-castlink-node-time")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(ownNodeId);
  const pathAndQuery = request.nextUrl.pathname + request.nextUrl.search;
  if (!secret || !verifyNodeControlRequest(secret, timestamp, "GET", pathAndQuery, signature)) {
    serverLog("warn", "node.topology.denied", { requestId: reqId, nodeId: ownNodeId, status: 401 });
    return NextResponse.json({ error: "Invalid node signature" }, { status: 401, headers });
  }

  try {
    const rooms = await collectLocalNodeTopology();
    serverLog("info", "node.topology.allowed", { requestId: reqId, nodeId: ownNodeId, rooms: rooms.length, status: 200, durationMs: Date.now()-started });
    return NextResponse.json({ nodeId: ownNodeId, generatedAt: Date.now(), rooms }, { headers });
  } catch {
    serverLog("error", "node.topology.failed", { requestId: reqId, nodeId: ownNodeId, status: 503 });
    return NextResponse.json({ error: "Node topology unavailable" }, { status: 503, headers });
  }
}
