import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { heartbeatSecretForNode } from "./node-heartbeat-auth";
import { signNodeControlRequest, verifyNodeControlRequest } from "./node-control-auth";
export const ownNodeId = () => process.env.CASTLINK_NODE_ID?.trim() || process.env.STUDIOLINK_TRANSFER_SERVER_ID?.trim() || "";
const signedPath = (path: string, body?: string) => body === undefined ? path : `${path}:${createHash("sha256").update(body).digest("hex")}`;
export function verifiedNodeRequest(request: NextRequest, body?: string, localOnly = true) {
  const nodeId = request.headers.get("x-castlink-node-id") || "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nodeId) || (localOnly && nodeId !== ownNodeId())) return null;
  const secret = heartbeatSecretForNode(nodeId);
  if (!secret || !verifyNodeControlRequest(secret,request.headers.get("x-castlink-node-time") || "",
    request.method || (body === undefined ? "GET" : "POST"),signedPath(request.nextUrl.pathname+request.nextUrl.search,body),request.headers.get("x-castlink-node-signature") || "")) return null;
  return nodeId;
}
async function signedNodeResponse(base: string, nodeId: string, pathname: string, body: Record<string, unknown> | undefined,
  secret: string | null | undefined, signal: AbortSignal, accept: string) {
  if (!secret) throw new Error("node_secret_missing");
  const origin = new URL(base);
  const localDev = process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !localDev) throw new Error("insecure_node_endpoint");
  const target = new URL(pathname,origin);
  if (target.origin !== origin.origin) throw new Error("invalid_node_path");
  const text = body === undefined ? undefined : JSON.stringify(body), method = text === undefined ? "GET" : "POST", timestamp=String(Date.now());
  return fetch(target,{method,body:text,cache:"no-store",redirect:"error",signal,headers:{
    accept,...(text === undefined ? {} : {"content-type":"application/json"}),
    "x-castlink-node-id":nodeId,"x-castlink-node-time":timestamp,
    "x-castlink-node-signature":signNodeControlRequest(secret,timestamp,method,signedPath(target.pathname+target.search,text)) }});
}

export async function signedNodeFetch(base: string, nodeId: string, pathname: string, body?: Record<string,unknown>, secret = heartbeatSecretForNode(nodeId)) {
  const response = await signedNodeResponse(base, nodeId, pathname, body, secret, AbortSignal.timeout(8000), "application/json");
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Node HTTP ${response.status}`);
  return data;
}

/** Forward only the versioned room diagnostics stream from the requested, signed HTTPS node. */
export async function remoteRoomDiagnostics(base: string, nodeId: string, params: URLSearchParams, signal?: AbortSignal) {
  const full = params.get("diagnostics") === "full";
  const expectedType = full ? "application/x-ndjson" : "application/json";
  const deadline = new AbortController();
  // Bound the header wait. A slow browser can continue receiving an active full download.
  const timer = setTimeout(() => deadline.abort(), full ? 15_000 : 15 * 60_000);
  let upstream: Response;
  try {
    upstream = await signedNodeResponse(base, nodeId, `/v1/node/history?${params}`, undefined, heartbeatSecretForNode(nodeId),
      signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal, expectedType);
  } finally { clearTimeout(timer); }
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no" });
  const protocol = upstream.headers.get("x-castlink-diagnostics");
  const expectedRange = params.has("from") ? `${params.get("from")}-${params.get("to")}` : null;
  if (!upstream.ok || !upstream.body || upstream.headers.get("x-castlink-node-id") !== nodeId ||
    params.has("minute") && upstream.headers.get("x-castlink-incident-minute") !== params.get("minute") ||
    expectedRange !== null && upstream.headers.get("x-castlink-diagnostics-range") !== expectedRange ||
    protocol !== "castlink-room-diagnostics-v1" || upstream.headers.get("content-type")?.split(";")[0] !== expectedType) {
    await upstream.body?.cancel();
    const status = upstream.status === 400 || upstream.status === 429 ? upstream.status : 503;
    if (status === 429) headers.set("Retry-After", "5");
    return Response.json({ error: status === 429 ? "diagnostics_busy" : status === 400 ? "invalid_history_query" : "node_history_unavailable" }, { status, headers });
  }
  headers.set("Content-Type", expectedType + "; charset=utf-8");
  headers.set("X-Castlink-Diagnostics", protocol);
  if (expectedRange !== null) headers.set("X-Castlink-Diagnostics-Range", expectedRange);
  if (full) {
    const disposition = upstream.headers.get("content-disposition") || "";
    headers.set("Content-Disposition", /^attachment; filename="castlink-diagnostics-[a-zA-Z0-9_-]+\.ndjson"(?:; filename\*=UTF-8''[A-Za-z0-9_%.-]+)?$/.test(disposition)
      ? disposition : 'attachment; filename="castlink-diagnostics.ndjson"');
  }
  return new Response(upstream.body, { headers });
}
