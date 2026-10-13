import { hasHostedAccess } from "./hosted-access";
import type { NextRequest, NextResponse } from "next/server";
import { isStudio, readAccess, roomVersion, signAccess, accessStudioMatches } from "./access";
import { studioOwnerAccessVersion, rotateStudioOwnerAccessVersion } from "./control-plane-store";
import { currentStudioOwnerAccessVersion } from "./control-plane-client";
import { defaultStudioId, validateStudioId } from "./studio-scope";

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
  if (!hasHostedAccess(request)) return false;
  const scope = validateStudioId(studioId);
  if (scope === defaultStudioId() && isStudio(request)) return true; // Legacy default-studio access is not platform access.
  const claims = readAccess(request.cookies.get(cookieName(scope))?.value);
  if (claims?.kind !== "studio-owner" || !accessStudioMatches(claims, scope)) return false;
  const version = await currentStudioOwnerAccessVersion(scope);
  return claims.version === version;
}

/** Preserve the verified source login lifetime across a short-lived transfer ticket. */
export async function studioOwnerSessionExpiresAt(request: NextRequest, studioId: string) {
  const scope = validateStudioId(studioId);
  if (!(await isStudioOwner(request, scope))) return null;
  const cookie = scope === defaultStudioId() && isStudio(request)
    ? "studiolink-studio" : cookieName(scope);
  const claims = readAccess(request.cookies.get(cookie)?.value);
  return claims && Number.isSafeInteger(claims.exp) && claims.exp > Date.now()
    ? Math.min(claims.exp, Date.now() + lifetimeSeconds * 1000) : null;
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
  response.cookies.set(cookieName(scope), signAccess({ kind: "studio-owner", studio: scope, version }, maxAge,expiresAt), {
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

export async function studioOwnerTransferVersion(request:NextRequest,studioId:string){const scope=validateStudioId(studioId);return scope===defaultStudioId()&&isStudio(request)?"legacy:"+roomVersion(process.env.STUDIOLINK_STUDIO_PASSWORD_HASH):"scoped:"+await currentStudioOwnerAccessVersion(scope);}
export async function studioOwnerTransferVersionCurrent(version:string|undefined,studioId:string){if(version?.startsWith("legacy:"))return studioId===defaultStudioId()&&version==="legacy:"+roomVersion(process.env.STUDIOLINK_STUDIO_PASSWORD_HASH);return version==="scoped:"+await currentStudioOwnerAccessVersion(studioId);}
