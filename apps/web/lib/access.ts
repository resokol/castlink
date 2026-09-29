import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

type Session = { kind: string; room?: string; version?: string; exp: number };
const studioCookie = "studiolink-studio";
export const roomVersion = (hash = "") => createHash("sha256").update(hash).digest("hex");
const roomCookie = (room: string) => `studiolink-room-${roomVersion(room).slice(0, 20)}`;
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
function distinctSecrets(...values: Array<string | undefined>) {
  return Array.from(new Set(values.map(value => value?.trim()).filter((value): value is string => !!value)));
}
function sessionSigningSecrets() {
  const secrets = distinctSecrets(process.env.CASTLINK_SESSION_SECRET, process.env.LIVEKIT_API_SECRET);
  if (!secrets.length) throw new Error("Session signing is not configured");
  return secrets;
}
function roomPasswordEncryptionKeys() {
  const secrets = distinctSecrets(process.env.CASTLINK_DATA_ENCRYPTION_KEY, process.env.LIVEKIT_API_SECRET);
  if (!secrets.length) throw new Error("Room password encryption is not configured");
  return secrets.map(secret => createHash("sha256").update("studiolink-room-password-v1:").update(secret).digest());
}
export function encryptRoomPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", roomPasswordEncryptionKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptRoomPassword(value?: string) {
  if (!value) return "";
  try {
    const [version, iv, tag, body, extra] = value.split(".");
    if (version !== "v1" || !iv || !tag || !body || extra) return "";
    const ivBuffer = Buffer.from(iv, "base64url");
    const tagBuffer = Buffer.from(tag, "base64url");
    const bodyBuffer = Buffer.from(body, "base64url");
    for (const key of roomPasswordEncryptionKeys()) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
        decipher.setAuthTag(tagBuffer);
        return Buffer.concat([decipher.update(bodyBuffer), decipher.final()]).toString("utf8");
      } catch {}
    }
    return "";
  } catch { return ""; }
}
export function checkPassword(password: string, hash: string) {
  try {
    const [salt, expected] = hash.split(":");
    const actual = scryptSync(password, salt, 32), target = Buffer.from(expected, "hex");
    return actual.length === target.length && timingSafeEqual(actual, target);
  } catch { return false; }
}
function signature(value: string, secret = sessionSigningSecrets()[0]) {
  return createHmac("sha256", secret).update(`studiolink-session-v1:${value}`).digest("base64url");
}
export function signAccess(session: Omit<Session, "exp">, lifetime = 7 * 86400) {
  const value = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + lifetime * 1000 })).toString("base64url");
  return `${value}.${signature(value)}`;
}
export function readAccess(value?: string): Session | null {
  if (!value || value.length > 4096) return null;
  try {
    const [body, sig, extra] = value.split(".");
    if (extra || !sig) return null;
    const expected = Buffer.from(sig);
    const valid = sessionSigningSecrets().some(secret => {
      const actual = Buffer.from(signature(body, secret));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
    if (!valid) return null;
    const session = JSON.parse(Buffer.from(body, "base64url").toString());
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}
export function isStudio(request: NextRequest) {
  const session = readAccess(request.cookies.get(studioCookie)?.value);
  const hash = process.env.STUDIOLINK_STUDIO_PASSWORD_HASH;
  return !!hash && session?.kind === "studio" && session.version === roomVersion(hash);
}
export function canJoin(request: NextRequest, room: string, hash?: string) {
  if (!hash) return true;
  const session = readAccess(request.cookies.get(roomCookie(room))?.value);
  return session?.kind === "guest" && session.room === room && session.version === roomVersion(hash);
}
export function canView(request: NextRequest, room: string, hash?: string) {
  if (isStudio(request) || canJoin(request, room, hash)) return true;
  const session = readAccess(request.headers.get("x-castlink-view-access") || request.nextUrl.searchParams.get("access") || undefined);
  return session?.kind === "viewer" && session.room === room && session.version === roomVersion(hash);
}
export function validGuestInvite(value: string, room: string, expectedVersion: string) {
  const session = readAccess(value);
  return session?.kind === "invite" && session.room === room && session.version === expectedVersion;
}
export function clearGuestAccess(response: NextResponse, room: string) {
  response.cookies.delete(roomCookie(room));
}
export function setAccessCookie(response: NextResponse, request: NextRequest, kind: "studio" | "guest", room = "", hash = "") {
  response.cookies.set(kind === "studio" ? studioCookie : roomCookie(room), signAccess({ kind, room, version: roomVersion(hash) }), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax", path: "/",
  });
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}
