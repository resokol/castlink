import { createPublicKey, verify } from "node:crypto";
import { embeddedLicensePublicKeyPem } from "./license-public-key.generated";

export type ServerLeasePayload = {
  schemaVersion: 1;
  leaseId: string;
  licenseId: string;
  organizationId: string;
  serverId: string;
  installationId: string;
  serverType: "cloud" | "dedicated" | "self-hosted" | "temporary";
  issuedAt: string;
  validUntil: string;
  graceUntil: string;
  features: string[];
};

export type ServerLeaseStatus =
  | { ok: true; state: "active" | "grace"; payload: ServerLeasePayload }
  | { ok: false; state: "missing" | "invalid" | "expired" | "wrong_server" | "wrong_installation" | "unconfigured"; reason: string };

function validPayload(value: unknown): value is ServerLeasePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return p.schemaVersion === 1 &&
    typeof p.leaseId === "string" && p.leaseId.length >= 8 && p.leaseId.length <= 128 &&
    typeof p.licenseId === "string" && p.licenseId.length >= 8 && p.licenseId.length <= 128 &&
    typeof p.organizationId === "string" && p.organizationId.length >= 3 && p.organizationId.length <= 128 &&
    typeof p.serverId === "string" && p.serverId.length >= 8 && p.serverId.length <= 128 &&
    typeof p.installationId === "string" && /^[0-9a-f-]{36}$/i.test(p.installationId) &&
    ["cloud", "dedicated", "self-hosted", "temporary"].includes(String(p.serverType)) &&
    typeof p.issuedAt === "string" && typeof p.validUntil === "string" && typeof p.graceUntil === "string" &&
    Array.isArray(p.features) && p.features.length <= 64 && p.features.every(v => typeof v === "string" && v.length <= 100);
}

function parseTime(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function verifyServerLease(
  token: string | undefined,
  expected: { installationId: string; serverId: string },
  now = Date.now(),
  publicKeyPem = embeddedLicensePublicKeyPem,
): ServerLeaseStatus {
  if (publicKeyPem === "UNCONFIGURED") {
    return { ok: false, state: "unconfigured", reason: "Lease public key is not embedded in this build" };
  }
  if (!token?.trim()) return { ok: false, state: "missing", reason: "Server lease is missing" };

  try {
    const [bodyPart, signaturePart, extra] = token.trim().split(".");
    if (!bodyPart || !signaturePart || extra) return { ok: false, state: "invalid", reason: "Malformed server lease" };
    const body = Buffer.from(bodyPart, "base64url");
    const signature = Buffer.from(signaturePart, "base64url");
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519" || !verify(null, body, key, signature)) {
      return { ok: false, state: "invalid", reason: "Invalid server lease signature" };
    }

    const payload = JSON.parse(body.toString("utf8"));
    if (!validPayload(payload)) return { ok: false, state: "invalid", reason: "Invalid server lease payload" };
    if (payload.installationId !== expected.installationId) {
      return { ok: false, state: "wrong_installation", reason: "Lease belongs to another installation" };
    }
    if (payload.serverId !== expected.serverId) {
      return { ok: false, state: "wrong_server", reason: "Lease belongs to another server" };
    }

    const issuedAt = parseTime(payload.issuedAt);
    const validUntil = parseTime(payload.validUntil);
    const graceUntil = parseTime(payload.graceUntil);
    if (issuedAt === null || validUntil === null || graceUntil === null ||
        issuedAt > now + 5 * 60_000 || validUntil < issuedAt || graceUntil < validUntil) {
      return { ok: false, state: "invalid", reason: "Invalid server lease dates" };
    }
    if (now <= validUntil) return { ok: true, state: "active", payload };
    if (now <= graceUntil) return { ok: true, state: "grace", payload };
    return { ok: false, state: "expired", reason: "Server lease and grace period have expired" };
  } catch {
    return { ok: false, state: "invalid", reason: "Server lease verification failed" };
  }
}
