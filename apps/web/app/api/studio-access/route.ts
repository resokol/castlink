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

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

function parseStudioId(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid studioId");
  return validateStudioId(value);
}

export async function GET(request: NextRequest) {
  let studioId: string;
  try { studioId = parseStudioId(request.nextUrl.searchParams.get("studioId")); }
  catch { return NextResponse.json({ allowed: false }, { status: 400, headers: noStore }); }
  try {
    return NextResponse.json({ allowed: await isStudioOwner(request, studioId) }, { headers: noStore });
  } catch {
    return NextResponse.json({ allowed: false }, { status: 404, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) {
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  }
  const raw = await request.text();
  if (raw.length > 8192) return new NextResponse(null, { status: 413, headers: noStore });

  let data: any;
  try { data = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: noStore }); }

  let studioId: string;
  try { studioId = parseStudioId(data?.studioId); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore }); }

  const action = data?.action;

  if (action === "accept") {
    const invite = typeof data.invite === "string" ? await validStudioOwnerInvite(data.invite, studioId) : null;
    if (!invite) return NextResponse.json({ error: "Owner-link недействительна или отозвана" }, { status: 403, headers: noStore });
    const response = NextResponse.json({ allowed: true, studioId }, { headers: noStore });
    await setStudioOwnerCookie(response, request, studioId, invite.exp);
    return response;
  }

  if (action === "logout") {
    const response = NextResponse.json({ ok: true }, { headers: noStore });
    clearStudioOwnerCookie(response, studioId);
    return response;
  }

  if (action === "create-invite") {
    if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
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
    return NextResponse.json({
      path: target.toString(),
      expiresAt,
    }, { headers: noStore });
  }

  if (action === "revoke") {
    if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
    await revokeStudioOwnerAccess(studioId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers: noStore });
}
