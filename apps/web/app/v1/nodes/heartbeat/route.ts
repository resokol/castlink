import { NextRequest, NextResponse } from "next/server";
import { applyNodeHeartbeat } from "../../../../lib/control-plane-store";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { validateHeartbeat, verifyHeartbeatSignature } from "../../../../lib/node-heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const nodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret) return NextResponse.json({ error: "Unknown node" }, { status: 401, headers: noStore });

  const raw = await request.text();
  if (!raw || raw.length > 8192) return new NextResponse(null, { status: raw.length > 8192 ? 413 : 400, headers: noStore });
  if (!verifyHeartbeatSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid heartbeat signature" }, { status: 401, headers: noStore });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid heartbeat JSON" }, { status: 400, headers: noStore }); }

  try {
    const heartbeat = validateHeartbeat(payload);
    if (heartbeat.nodeId !== nodeId) {
      return NextResponse.json({ error: "Node identity mismatch" }, { status: 403, headers: noStore });
    }
    await applyNodeHeartbeat(heartbeat);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Heartbeat rejected";
    const status = /unknown|mismatch|disabled/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
