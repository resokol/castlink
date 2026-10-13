import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import type { NextRequest } from "next/server";

export const hostedCookieName = "castlink-hosted-access";
export type HostedToken = { id: string; tokenHash: string; expiresAt: number; revokedAt?: number };
const maxBytes = 512 * 1024;
export function hostedAccessEnabled() { return process.env.CASTLINK_HOSTED_ACCESS === "1"; }

/** Single atomic writer (the hosted bot); no cache: revocation applies to the next request. */
function registry(): HostedToken[] {
  const pathname = process.env.CASTLINK_HOSTED_TOKEN_FILE;
  if (!pathname) throw new Error("Hosted access registry is not configured");
  const fd = openSync(pathname, "r");
  let raw: Buffer;
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0, count = 0;
    do { count = readSync(fd, buffer, size, buffer.length - size, null); size += count; } while (count && size < buffer.length);
    if (size > maxBytes) throw new Error("Hosted access registry is too large");
    raw = buffer.subarray(0, size);
  } finally { closeSync(fd); }
  const value = JSON.parse(raw.toString("utf8"));
  if (value?.schemaVersion !== 1 || !Array.isArray(value.tokens) || value.tokens.length > 1000) throw new Error("Invalid hosted registry");
  const ids = new Set<string>(), hashes = new Set<string>();
  for (const token of value.tokens) {
    if (!token || !/^[a-f0-9]{32}$/.test(token.id) || !/^[a-f0-9]{64}$/.test(token.tokenHash)
      || !Number.isSafeInteger(token.expiresAt) || token.expiresAt <= 0
      || (token.revokedAt !== undefined && (!Number.isSafeInteger(token.revokedAt) || token.revokedAt <= 0))
      || ids.has(token.id) || hashes.has(token.tokenHash)) throw new Error("Invalid hosted token record");
    ids.add(token.id); hashes.add(token.tokenHash);
  }
  return value.tokens;
}
function secrets() {
  const result = [process.env.CASTLINK_SESSION_SECRET, process.env.LIVEKIT_API_SECRET].filter((s): s is string => !!s?.trim());
  if (!result.length) throw new Error("Hosted session signing is not configured");
  return result;
}
function signature(body: string, secret: string) { return createHmac("sha256", secret).update("castlink-hosted-access-v1:" + body).digest("base64url"); }
function active(record: HostedToken) { return record.revokedAt === undefined && record.expiresAt > Date.now(); }
export function verifyHostedToken(token: unknown): HostedToken | null {
  if (typeof token !== "string" || !/^clt_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    return registry().find(record => record.tokenHash === hash && active(record)) || null;
  } catch { return null; }
}
export function signHostedSession(token: HostedToken) {
  const body = Buffer.from(JSON.stringify({ id: token.id, exp: token.expiresAt })).toString("base64url");
  return body + "." + signature(body, secrets()[0]);
}
export function hostedSession(request: Pick<NextRequest, "cookies">): HostedToken | null {
  try {
    const value = request.cookies.get(hostedCookieName)?.value;
    if (!value || value.length > 512) return null;
    const [body, sig, extra] = value.split(".");
    if (!body || !sig || extra) return null;
    const actual = Buffer.from(sig);
    if (!secrets().some(secret => { const expected = Buffer.from(signature(body, secret)); return actual.length === expected.length && timingSafeEqual(actual, expected); })) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= Date.now()) return null;
    return registry().find(record => record.id === claims.id && active(record) && claims.exp <= record.expiresAt) || null;
  } catch { return null; }
}
export function hasHostedAccess(request: Pick<NextRequest, "cookies">) {
  return !hostedAccessEnabled() || !!hostedSession(request);
}
