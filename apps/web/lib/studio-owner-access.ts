import type { NextRequest, NextResponse } from "next/server";
import { isStudio, readAccess, roomVersion, signAccess, accessStudioMatches } from "./access";
import { studioOwnerAccessVersion, rotateStudioOwnerAccessVersion } from "./control-plane-store";
import { currentStudioOwnerAccessVersion } from "./control-plane-client";
import { validateStudioId } from "./studio-scope";

const lifetimeSeconds = 30 * 24 * 60 * 60;
const cookieName = (studioId: string) => `castlink-studio-owner-${roomVersion(validateStudioId(studioId)).slice(0, 24)}`;

export async function newStudioOwnerInvite(studioId: string) {
  const scope = validateStudioId(studioId);
  const version = await studioOwnerAccessVersion(scope);
  const invite = signAccess({ kind: "studio-owner-invite", studio: scope, version }, lifetimeSeconds);
  const claims = readAccess(invite);
  if (!claims) throw new Error("Failed to create studio owner invite");
  return { invite, expiresAt: claims.exp, version };
}

export async function validStudioOwnerInvite(value: string, studioId: string) {
  const scope = validateStudioId(studioId);
  const claims = readAccess(value);
  if (claims?.kind !== "studio-owner-invite" || !accessStudioMatches(claims, scope)) return null;
  const version = await currentStudioOwnerAccessVersion(scope);
  return claims.version === version ? claims : null;
}

export async function isStudioOwner(request: NextRequest, studioId: string) {
  if (isStudio(request)) return true; // platform owner/super-admin
  const scope = validateStudioId(studioId);
  const claims = readAccess(request.cookies.get(cookieName(scope))?.value);
  if (claims?.kind !== "studio-owner" || !accessStudioMatches(claims, scope)) return false;
  const version = await currentStudioOwnerAccessVersion(scope);
  return claims.version === version;
}

export async function setStudioOwnerCookie(
  response: NextResponse,
  request: NextRequest,
  studioId: string,
  expiresAt: number,
) {
  const scope = validateStudioId(studioId);
  const version = await currentStudioOwnerAccessVersion(scope);
  const maxAge = Math.max(0, Math.min(lifetimeSeconds, Math.floor((expiresAt - Date.now()) / 1000)));
  response.cookies.set(cookieName(scope), signAccess({ kind: "studio-owner", studio: scope, version }, maxAge), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearStudioOwnerCookie(response: NextResponse, studioId: string) {
  response.cookies.delete(cookieName(validateStudioId(studioId)));
}

export async function revokeStudioOwnerAccess(studioId: string) {
  return rotateStudioOwnerAccessVersion(validateStudioId(studioId));
}

export const studioOwnerLifetimeSeconds = lifetimeSeconds;
