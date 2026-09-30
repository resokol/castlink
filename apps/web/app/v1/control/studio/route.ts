import { NextRequest, NextResponse } from "next/server";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { verifyNodeControlRequest } from "../../../../lib/node-control-auth";
import {
  listControlNodes,
  resolveStudioRoute,
  studioOwnerAccessVersion,
} from "../../../../lib/control-plane-store";
import { validateStudioId } from "../../../../lib/studio-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const nodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const timestamp = request.headers.get("x-castlink-node-time")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret) return NextResponse.json({ error: "Unknown node" }, { status: 401, headers: noStore });

  const pathAndQuery = request.nextUrl.pathname + request.nextUrl.search;
  if (!verifyNodeControlRequest(secret, timestamp, "GET", pathAndQuery, signature)) {
    return NextResponse.json({ error: "Invalid node signature" }, { status: 401, headers: noStore });
  }

  const node = (await listControlNodes()).find(item => item.nodeId === nodeId);
  if (!node || node.state === "disabled") {
    return NextResponse.json({ error: "Node is disabled or unknown" }, { status: 403, headers: noStore });
  }

  let studioId: string;
  try {
    studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || "");
  } catch {
    return NextResponse.json({ error: "Invalid studioId" }, { status: 400, headers: noStore });
  }

  try {
    const route = await resolveStudioRoute(studioId);
    const assignedNodeId = route.ok ? route.nodeId : route.nodeId;
    if (!assignedNodeId || assignedNodeId !== nodeId) {
      return NextResponse.json({ error: "Studio is not assigned to this node" }, { status: 403, headers: noStore });
    }
    const ownerAccessVersion = await studioOwnerAccessVersion(studioId);
    return NextResponse.json({
      studioId,
      ownerAccessVersion,
      route,
    }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio not found";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 503, headers: noStore });
  }
}
