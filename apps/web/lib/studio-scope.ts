import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const studioIdPattern = /^[A-Za-z0-9._:-]{6,128}$/;

export function defaultStudioId() {
  const value = process.env.STUDIOLINK_DEFAULT_STUDIO_ID?.trim() || "studio-default";
  return validateStudioId(value);
}

export function validateStudioId(value: string) {
  const clean = value.trim();
  if (!studioIdPattern.test(clean)) throw new Error("Invalid studioId");
  return clean;
}

export function requestedStudioId(request: NextRequest) {
  const value = request.headers.get("x-castlink-studio-id") ||
    request.nextUrl.searchParams.get("studioId") ||
    defaultStudioId();
  return validateStudioId(value);
}

export function mediaRoomName(studioId: string, roomName: string) {
  const scope = validateStudioId(studioId);
  if (scope === defaultStudioId()) return roomName;
  const prefix = createHash("sha256").update(scope).digest("base64url").slice(0, 12);
  return `s-${prefix}-${roomName}`.slice(0, 255);
}
