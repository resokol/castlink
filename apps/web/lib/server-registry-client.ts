import { readRuntimeLicenseState } from "./license-state";

export type RegisteredServer = {
  serverId: string;
  displayName: string;
  serverType: "cloud" | "dedicated" | "self-hosted" | "temporary";
  region?: string;
  endpoint?: string;
  visibility: "platform" | "organization" | "account";
  state: "active" | "disabled" | "expired" | "provisioning";
  expiresAt?: string;
  latencyMs?: number;
  health?: "healthy" | "degraded" | "offline" | "unknown";
};

function licenseServiceUrl() {
  const raw = process.env.CASTLINK_LICENSE_SERVICE_URL?.trim();
  if (!raw) throw new Error("License service URL is not configured");
  const url = new URL(raw);
  const localDev = process.env.NODE_ENV !== "production" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localDev) throw new Error("License service must use HTTPS");
  return url;
}

async function authorization() {
  const state = await readRuntimeLicenseState();
  const lease = state.lease || process.env.CASTLINK_SERVER_LEASE?.trim();
  if (!lease) throw new Error("Server lease is not available");
  return { Authorization: `Bearer ${lease}` };
}

export async function listRegisteredServers(): Promise<RegisteredServer[]> {
  const response = await fetch(new URL("/v1/servers", licenseServiceUrl()), {
    headers: { accept: "application/json", ...(await authorization()) },
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.CASTLINK_LICENSE_TIMEOUT_MS || 7000)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Server registry failed (HTTP ${response.status})`);
  if (!Array.isArray(data.servers)) throw new Error("Invalid server registry response");
  return data.servers.filter((item: unknown): item is RegisteredServer => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const s = item as Record<string, unknown>;
    return typeof s.serverId === "string" && typeof s.displayName === "string" &&
      ["cloud","dedicated","self-hosted","temporary"].includes(String(s.serverType)) &&
      ["platform","organization","account"].includes(String(s.visibility)) &&
      ["active","disabled","expired","provisioning"].includes(String(s.state));
  }).map(server => ({
    serverId: server.serverId.slice(0, 128),
    displayName: server.displayName.slice(0, 120),
    serverType: server.serverType,
    visibility: server.visibility,
    state: server.state,
    ...(server.region ? { region: server.region.slice(0, 80) } : {}),
    ...(server.endpoint ? { endpoint: server.endpoint.slice(0, 300) } : {}),
    ...(server.expiresAt ? { expiresAt: server.expiresAt } : {}),
    ...(typeof server.latencyMs === "number" && Number.isFinite(server.latencyMs) ? { latencyMs: server.latencyMs } : {}),
    ...(server.health ? { health: server.health } : {}),
  }));
}

export async function createTemporaryServer(input: { region: string; durationHours: number; displayName: string }) {
  const durationHours = Math.max(1, Math.min(168, Math.floor(input.durationHours)));
  const response = await fetch(new URL("/v1/servers/temporary", licenseServiceUrl()), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(await authorization()) },
    body: JSON.stringify({
      region: input.region.slice(0, 80),
      durationHours,
      displayName: input.displayName.slice(0, 120),
      visibility: "account",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.CASTLINK_LICENSE_TIMEOUT_MS || 7000)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Temporary server provisioning failed (HTTP ${response.status})`);
  return data;
}

export async function deactivateRegisteredServer(serverId: string) {
  const response = await fetch(new URL(`/v1/servers/${encodeURIComponent(serverId)}/deactivate`, licenseServiceUrl()), {
    method: "POST",
    headers: { accept: "application/json", ...(await authorization()) },
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.CASTLINK_LICENSE_TIMEOUT_MS || 7000)),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : `Server deactivation failed (HTTP ${response.status})`);
  }
}
