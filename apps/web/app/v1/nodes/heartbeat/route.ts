import { NextRequest, NextResponse } from "next/server";
import { applyNodeHeartbeat } from "../../../../lib/control-plane-store";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { validateHeartbeat, verifyHeartbeatSignature } from "../../../../lib/node-heartbeat";
import { requestHeaders, requestId, serverLog } from "../../../../lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  const nodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret) {
    serverLog("warn", "control.node.heartbeat_denied", { requestId: reqId, nodeId, status: 401, reason: "unknown_node" });
    return NextResponse.json({ error: "Unknown node" }, { status: 401, headers });
  }

  const raw = await request.text();
  if (!raw || raw.length > 8192) return new NextResponse(null, { status: raw.length > 8192 ? 413 : 400, headers });
  if (!verifyHeartbeatSignature(raw, signature, secret)) {
    serverLog("warn", "control.node.heartbeat_denied", { requestId: reqId, nodeId, status: 401, reason: "signature" });
    return NextResponse.json({ error: "Invalid heartbeat signature" }, { status: 401, headers });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid heartbeat JSON" }, { status: 400, headers }); }

  try {
    const heartbeat = validateHeartbeat(payload);
    if (heartbeat.nodeId !== nodeId) {
      return NextResponse.json({ error: "Node identity mismatch" }, { status: 403, headers });
    }
    await applyNodeHeartbeat(heartbeat);
    serverLog("info", "control.node.heartbeat", { requestId: reqId, nodeId, activeStudios: heartbeat.activeStudios, activeParticipants: heartbeat.activeParticipants, activeVideoTracks: heartbeat.activeVideoTracks, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Heartbeat rejected";
    const status = /unknown|mismatch|disabled/i.test(message) ? 403 : 400;
    serverLog("warn", "control.node.heartbeat_rejected", { requestId: reqId, nodeId, status, reason: message, durationMs: Date.now() - started });
    return NextResponse.json({ error: message }, { status, headers });
  }
}
