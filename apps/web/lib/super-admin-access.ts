import type { NextRequest, NextResponse } from "next/server";
import { rotateSuperAdminAccessVersion } from "./control-plane-store";
import { issuePlatformInvite, readPlatformSession, redeemPlatformInvite, revokePlatformSession, PLATFORM_SESSION_SECONDS } from "./platform-credentials";

const cookieName = "castlink-super-admin-v2";
export async function isSuperAdmin(request: NextRequest) {
  return !!(await readPlatformSession(request.cookies.get(cookieName)?.value));
}
export async function newSuperAdminInvite(request: NextRequest) {
  const session = await readPlatformSession(request.cookies.get(cookieName)?.value);
  if (!session) throw new Error("Platform authorization required");
  return issuePlatformInvite(session.principalId);
}
export const acceptSuperAdminInvite = redeemPlatformInvite;
export function setSuperAdminCookie(response: NextResponse, request: NextRequest, session: { token: string; expiresAt: number }) {
  response.cookies.set(cookieName, session.token, {
    httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "strict", path: "/", maxAge: Math.max(0, Math.min(PLATFORM_SESSION_SECONDS, Math.floor((session.expiresAt - Date.now()) / 1000))),
  });
  response.cookies.delete("castlink-super-admin");
}
export function clearSuperAdminCookie(response: NextResponse) {
  response.cookies.delete(cookieName); response.cookies.delete("castlink-super-admin");
}
export async function logoutSuperAdmin(request: NextRequest) {
  await revokePlatformSession(request.cookies.get(cookieName)?.value);
}
export async function revokeSuperAdminAccess() { return rotateSuperAdminAccessVersion(); }
export const superAdminLifetimeSeconds = PLATFORM_SESSION_SECONDS;
