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
export async function signedNodeFetch(base: string, nodeId: string, pathname: string, body?: Record<string,unknown>, secret = heartbeatSecretForNode(nodeId)) {
  if (!secret) throw new Error("node_secret_missing");
  const origin = new URL(base);
  const localDev = process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !localDev) throw new Error("insecure_node_endpoint");
  const target = new URL(pathname,origin);
  if (target.origin !== origin.origin) throw new Error("invalid_node_path");
  const text = body === undefined ? undefined : JSON.stringify(body), method = text === undefined ? "GET" : "POST", timestamp=String(Date.now());
  const response = await fetch(target,{method,body:text,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000),headers:{
    accept:"application/json",...(text === undefined ? {} : {"content-type":"application/json"}),
    "x-castlink-node-id":nodeId,"x-castlink-node-time":timestamp,
    "x-castlink-node-signature":signNodeControlRequest(secret,timestamp,method,signedPath(target.pathname+target.search,text)) }});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Node HTTP ${response.status}`);
  return data;
}
