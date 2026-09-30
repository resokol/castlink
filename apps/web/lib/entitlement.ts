import { getInstallationIdentity } from "./persistent-storage";
import { licenseEnforced, licenseToken, verifyLicenseToken } from "./license";
import { verifyServerLease } from "./server-lease";

export type EntitlementDecision = {
  allowed: boolean;
  mode: "development" | "lease" | "offline-license" | "denied";
  state: string;
  features: string[];
};

function configuredServerId() {
  return process.env.CASTLINK_SERVER_ID?.trim() || "";
}

export async function entitlement(feature?: string): Promise<EntitlementDecision> {
  if (!licenseEnforced()) {
    return { allowed: true, mode: "development", state: "unenforced", features: ["*"] };
  }

  const installation = await getInstallationIdentity();
  const serverId = configuredServerId();
  const lease = verifyServerLease(process.env.CASTLINK_SERVER_LEASE?.trim(), {
    installationId: installation.installationId,
    serverId,
  });
  if (lease.ok) {
    const allowed = !feature || lease.payload.features.includes("*") || lease.payload.features.includes(feature);
    return { allowed, mode: "lease", state: lease.state, features: lease.payload.features };
  }

  const fallback = verifyLicenseToken(licenseToken(), installation.installationId);
  if (fallback.ok) {
    const allowed = !feature || fallback.payload.features.includes("*") || fallback.payload.features.includes(feature);
    return { allowed, mode: "offline-license", state: fallback.state, features: fallback.payload.features };
  }

  return { allowed: false, mode: "denied", state: lease.state, features: [] };
}

export async function requireEntitlement(feature?: string) {
  const decision = await entitlement(feature);
  if (!decision.allowed) {
    const error = new Error(feature ? `License does not permit feature: ${feature}` : "License is not active");
    (error as Error & { code?: string }).code = "LICENSE_REQUIRED";
    throw error;
  }
  return decision;
}
