import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "../../../lib/access";
import {
  clearStudioOwnerCookie,
  isStudioOwner,
  newStudioOwnerInvite,
  revokeStudioOwnerAccess,
  setStudioOwnerCookie,
  validStudioOwnerInvite,
} from "../../../lib/studio-owner-access";
import { validateStudioId } from "../../../lib/studio-scope";
import { resolveStudioRoute } from "../../../lib/control-plane-store";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

function parseStudioId(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid studioId");
  return validateStudioId(value);
}

export async function GET(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  let studioId: string;
  try { studioId = parseStudioId(request.nextUrl.searchParams.get("studioId")); }
  catch { return NextResponse.json({ allowed: false }, { status: 400, headers }); }
  try {
    const allowed = await isStudioOwner(request, studioId);
    serverLog("info", "control.studio_owner.checked", { requestId: reqId, studioId, allowed, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({ allowed }, { headers });
  } catch {
    return NextResponse.json({ allowed: false }, { status: 404, headers });
  }
}

export async function POST(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  if (!request.headers.get("origin") || !sameOrigin(request)) {
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers });
  }
  const raw = await request.text();
  if (raw.length > 8192) return new NextResponse(null, { status: 413, headers });

  let data: any;
  try { data = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers }); }

  let studioId: string;
  try { studioId = parseStudioId(data?.studioId); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers }); }

  const action = data?.action;

  if (action === "accept") {
    const invite = typeof data.invite === "string" ? await validStudioOwnerInvite(data.invite, studioId) : null;
    if (!invite) return NextResponse.json({ error: "Owner-link недействительна или отозвана" }, { status: 403, headers });
    const response = NextResponse.json({ allowed: true, studioId }, { headers });
    await setStudioOwnerCookie(response, request, studioId, invite.exp);
    serverLog("info", "control.studio_owner.accepted", { requestId: reqId, studioId, status: 200, durationMs: Date.now() - started });
    response.headers.set("x-request-id", reqId);
    return response;
  }

  if (action === "logout") {
    const response = NextResponse.json({ ok: true }, { headers });
    clearStudioOwnerCookie(response, studioId);
    return response;
  }

  if (action === "create-invite") {
    if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers });
    const { invite, expiresAt } = await newStudioOwnerInvite(studioId);
    let targetOrigin = request.nextUrl.origin;
    try {
      const route = await resolveStudioRoute(studioId);
      if (route.ok) targetOrigin = route.endpoint;
    } catch {
      // An unassigned/unhealthy Studio can still receive an owner-link on the current control-plane origin.
    }
    const target = new URL("/studio", targetOrigin);
    target.searchParams.set("studioId", studioId);
    target.hash = `owner=${encodeURIComponent(invite)}`;
    serverLog("info", "control.studio_owner.invite_created", { requestId: reqId, studioId, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({
      path: target.toString(),
      expiresAt,
    }, { headers });
  }

  if (action === "revoke") {
    if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers });
    await revokeStudioOwnerAccess(studioId);
    serverLog("info", "control.studio_owner.revoked", { requestId: reqId, studioId, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({ ok: true }, { headers });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers });
}
