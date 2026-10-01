import type { NextRequest, NextResponse } from "next/server";
import { readAccess, signAccess } from "./access";
import { rotateSuperAdminAccessVersion, superAdminAccessVersion } from "./control-plane-store";

const lifetimeSeconds = 30 * 24 * 60 * 60;
const cookieName = "castlink-super-admin";

export async function newSuperAdminInvite() {
  const version = await superAdminAccessVersion();
  const invite = signAccess({ kind: "super-admin-invite", version }, lifetimeSeconds);
  const claims = readAccess(invite);
  if (!claims) throw new Error("Failed to create Super Admin invite");
  return { invite, expiresAt: claims.exp, version };
}

export async function validSuperAdminInvite(value: string) {
  const claims = readAccess(value);
  if (claims?.kind !== "super-admin-invite" || typeof claims.version !== "string") return null;
  const version = await superAdminAccessVersion();
  return claims.version === version ? claims : null;
}

export async function isSuperAdmin(request: NextRequest) {
  const claims = readAccess(request.cookies.get(cookieName)?.value);
  if (claims?.kind !== "super-admin" || typeof claims.version !== "string") return false;
  const version = await superAdminAccessVersion();
  return claims.version === version;
}

export async function setSuperAdminCookie(response: NextResponse, request: NextRequest, expiresAt?: number) {
  const version = await superAdminAccessVersion();
  const maxAge = expiresAt
    ? Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)))
    : lifetimeSeconds;
  response.cookies.set(cookieName, signAccess({ kind: "super-admin", version }, maxAge), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearSuperAdminCookie(response: NextResponse) {
  response.cookies.delete(cookieName);
}

export async function revokeSuperAdminAccess() {
  return rotateSuperAdminAccessVersion();
}

export const superAdminLifetimeSeconds = lifetimeSeconds;
