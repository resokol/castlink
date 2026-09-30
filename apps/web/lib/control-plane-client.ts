import { signNodeControlRequest } from "./node-control-auth";
import { resolveStudioRoute, studioOwnerAccessVersion } from "./control-plane-store";

type RemoteStudioInfo = {
  studioId: string;
  ownerAccessVersion: string;
  route:
    | { ok: true; studioId: string; nodeId: string; nodeName: string; region: string; endpoint: string; broadcastState: string }
    | { ok: false; reason: string; studioId: string; nodeId?: string; broadcastState?: string };
};

function remoteConfig() {
  const raw = process.env.CASTLINK_CONTROL_PLANE_URL?.trim();
  const nodeId = process.env.CASTLINK_NODE_ID?.trim();
  const secret = process.env.CASTLINK_NODE_SECRET?.trim();
  if (!raw && !nodeId && !secret) return null;
  if (!raw || !nodeId || !secret) throw new Error("Control plane node configuration is incomplete");
  const url = new URL(raw);
  const localDev = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localDev) throw new Error("Control plane must use HTTPS");
  return { url, nodeId, secret };
}

async function remoteStudioInfo(studioId: string): Promise<RemoteStudioInfo | null> {
  const config = remoteConfig();
  if (!config) return null;
  const target = new URL("/v1/control/studio", config.url);
  target.searchParams.set("studioId", studioId);
  const pathAndQuery = target.pathname + target.search;
  const timestamp = String(Date.now());
  const signature = signNodeControlRequest(config.secret, timestamp, "GET", pathAndQuery);

  const response = await fetch(target, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "x-castlink-node-id": config.nodeId,
      "x-castlink-node-time": timestamp,
      "x-castlink-node-signature": signature,
    },
    signal: AbortSignal.timeout(Number(process.env.CASTLINK_CONTROL_PLANE_TIMEOUT_MS || 5000)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Control plane request failed (HTTP ${response.status})`);
  if (!data || typeof data !== "object" || data.studioId !== studioId || typeof data.ownerAccessVersion !== "string" || !data.route) {
    throw new Error("Invalid control plane studio response");
  }
  return data as RemoteStudioInfo;
}

export async function currentStudioOwnerAccessVersion(studioId: string) {
  const remote = await remoteStudioInfo(studioId);
  return remote ? remote.ownerAccessVersion : studioOwnerAccessVersion(studioId);
}

export async function currentStudioRoute(studioId: string) {
  const remote = await remoteStudioInfo(studioId);
  return remote ? remote.route : resolveStudioRoute(studioId);
}
