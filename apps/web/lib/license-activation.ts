import { getInstallationIdentity } from "./persistent-storage";
import { verifyLicenseToken } from "./license";
import { verifyServerLease } from "./server-lease";
import { writeRuntimeLicenseState } from "./license-state";

type ActivationResponse = {
  lease?: unknown;
  offlineLicense?: unknown;
  serverId?: unknown;
};

export async function activateInstallation(input: {
  activationCode: string;
  serverName: string;
  mode: "public" | "edge";
}) {
  const url = process.env.CASTLINK_LICENSE_SERVICE_URL?.trim();
  const serverId = process.env.CASTLINK_SERVER_ID?.trim();
  if (!url) throw new Error("License service URL is not configured");
  const serviceUrl = new URL(url);
  const localDev = process.env.NODE_ENV !== "production" && (serviceUrl.hostname === "127.0.0.1" || serviceUrl.hostname === "localhost");
  if (serviceUrl.protocol !== "https:" && !localDev) throw new Error("License service must use HTTPS");
  if (!serverId) throw new Error("Server ID is not configured");
  if (!input.activationCode.trim() || input.activationCode.length > 512) throw new Error("Invalid activation code");
  if (!input.serverName.trim() || input.serverName.length > 120) throw new Error("Invalid server name");

  const installation = await getInstallationIdentity();
  const response = await fetch(new URL("/v1/servers/activate", serviceUrl), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      activationCode: input.activationCode.trim(),
      installationId: installation.installationId,
      serverId,
      serverName: input.serverName.trim(),
      serverType: input.mode === "public" ? "self-hosted" : "self-hosted",
      connectivity: input.mode,
    }),
    signal: AbortSignal.timeout(Number(process.env.CASTLINK_LICENSE_TIMEOUT_MS || 7000)),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({})) as ActivationResponse & { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof data.error === "string" && data.error.length <= 200 ? data.error : `Activation failed (HTTP ${response.status})`);
  }
  if (typeof data.serverId === "string" && data.serverId !== serverId) throw new Error("License service returned a different server ID");
  if (typeof data.lease !== "string") throw new Error("License service did not return a signed lease");

  const lease = verifyServerLease(data.lease, { installationId: installation.installationId, serverId });
  if (!lease.ok) throw new Error(`Rejected server lease: ${lease.state}`);

  let offlineLicense: string | undefined;
  if (data.offlineLicense !== undefined) {
    if (typeof data.offlineLicense !== "string") throw new Error("Invalid offline license response");
    const fallback = verifyLicenseToken(data.offlineLicense, installation.installationId);
    if (!fallback.ok) throw new Error(`Rejected offline license: ${fallback.state}`);
    offlineLicense = data.offlineLicense;
  }

  await writeRuntimeLicenseState({ lease: data.lease, offlineLicense });
  return {
    serverId,
    installationId: installation.installationId,
    organizationId: lease.payload.organizationId,
    licenseId: lease.payload.licenseId,
    state: lease.state,
    features: lease.payload.features,
  };
}
