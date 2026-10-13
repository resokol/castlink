import { createPublicKey, verify } from "node:crypto";
import { embeddedLicensePublicKeyPem } from "./license-public-key.generated";

export type LicensePayload = {
  schemaVersion: 1;
  licenseId: string;
  customer: string;
  installationId: string;
  issuedAt: string;
  expiresAt: string;
  offlineGraceUntil: string;
  maxServers: number;
  features: string[];
};

export type LicenseStatus =
  | { ok: true; state: "active" | "grace"; payload: LicensePayload }
  | { ok: false; state: "missing" | "invalid" | "expired" | "wrong_installation" | "unconfigured"; reason: string };

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function validPayload(value: unknown): value is LicensePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === 1 &&
    typeof item.licenseId === "string" && item.licenseId.length >= 8 && item.licenseId.length <= 128 &&
    typeof item.customer === "string" && item.customer.length >= 1 && item.customer.length <= 200 &&
    typeof item.installationId === "string" && /^[0-9a-f-]{36}$/i.test(item.installationId) &&
    typeof item.issuedAt === "string" &&
    typeof item.expiresAt === "string" &&
    typeof item.offlineGraceUntil === "string" &&
    Number.isSafeInteger(item.maxServers) && Number(item.maxServers) >= 1 && Number(item.maxServers) <= 1000 &&
    Array.isArray(item.features) && item.features.length <= 64 && item.features.every(v => typeof v === "string" && v.length <= 100);
}

function isoMs(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function verifyLicenseToken(
  token: string | undefined,
  installationId: string,
  now = Date.now(),
  publicKeyPem = embeddedLicensePublicKeyPem,
): LicenseStatus {
  if (publicKeyPem === "UNCONFIGURED") {
    return { ok: false, state: "unconfigured", reason: "License public key is not embedded in this build" };
  }
  if (!token?.trim()) return { ok: false, state: "missing", reason: "License token is missing" };

  try {
    const [bodyPart, signaturePart, extra] = token.trim().split(".");
    if (!bodyPart || !signaturePart || extra) return { ok: false, state: "invalid", reason: "Malformed license token" };

    const body = decodeBase64Url(bodyPart);
    const signature = decodeBase64Url(signaturePart);
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return { ok: false, state: "invalid", reason: "License key is not Ed25519" };
    if (!verify(null, body, key, signature)) return { ok: false, state: "invalid", reason: "Invalid license signature" };

    const payload = JSON.parse(body.toString("utf8"));
    if (!validPayload(payload)) return { ok: false, state: "invalid", reason: "Invalid license payload" };
    if (payload.installationId !== installationId) {
      return { ok: false, state: "wrong_installation", reason: "License belongs to another installation" };
    }

    const issuedAt = isoMs(payload.issuedAt);
    const expiresAt = isoMs(payload.expiresAt);
    const graceUntil = isoMs(payload.offlineGraceUntil);
    if (issuedAt === null || expiresAt === null || graceUntil === null || issuedAt > now + 5 * 60_000 || expiresAt < issuedAt || graceUntil < expiresAt) {
      return { ok: false, state: "invalid", reason: "Invalid license dates" };
    }
    if (now <= expiresAt) return { ok: true, state: "active", payload };
    if (now <= graceUntil) return { ok: true, state: "grace", payload };
    return { ok: false, state: "expired", reason: "License and offline grace period have expired" };
  } catch {
    return { ok: false, state: "invalid", reason: "License verification failed" };
  }
}

export function licenseEnforced() {
  return process.env.CASTLINK_LICENSE_ENFORCE === "1";
}

export function licenseToken() {
  return process.env.CASTLINK_LICENSE_TOKEN?.trim();
}
