import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { transferStudioAssignment } from "../../../../lib/control-plane-store";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { verifyNodeControlRequest } from "../../../../lib/node-control-auth";
import { validateStudioId } from "../../../../lib/studio-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const nodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const timestamp = request.headers.get("x-castlink-node-time")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret) return NextResponse.json({ error: "Unknown node" }, { status: 401, headers: noStore });

  const raw = await request.text();
  if (!raw || raw.length > 4096) return new NextResponse(null, { status: raw.length > 4096 ? 413 : 400, headers: noStore });
  const bodyDigest = createHash("sha256").update(raw).digest("hex");
  const signedTarget = `${request.nextUrl.pathname}:${bodyDigest}`;
  if (!verifyNodeControlRequest(secret, timestamp, "POST", signedTarget, signature)) {
    return NextResponse.json({ error: "Invalid node signature" }, { status: 401, headers: noStore });
  }

  let data: any;
  try { data = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: noStore }); }

  let studioId: string;
  try { studioId = validateStudioId(typeof data?.studioId === "string" ? data.studioId : ""); }
  catch { return NextResponse.json({ error: "Invalid studioId" }, { status: 400, headers: noStore }); }
  const targetNodeId = typeof data?.targetNodeId === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(data.targetNodeId) ? data.targetNodeId : "";
  if (!targetNodeId) return NextResponse.json({ error: "Invalid targetNodeId" }, { status: 400, headers: noStore });

  try {
    const result = await transferStudioAssignment(studioId, nodeId, targetNodeId);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio transfer rejected";
    const status = /not assigned|not found|unavailable|must differ/i.test(message) ? 409 : 503;
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
