import { NextRequest, NextResponse } from "next/server";
import { isRoomAdmin } from "../../../lib/room-admin";
import { isStudioOwner } from "../../../lib/studio-owner-access";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";
import { getInstallationIdentity } from "../../../lib/persistent-storage";
import { entitlement } from "../../../lib/entitlement";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room")?.trim() || "";
  let studioId: string;
  try { studioId = validateStudioId(request.nextUrl.searchParams.get("studioId") || defaultStudioId()); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const allowed = await isStudioOwner(request, studioId) || (!!room && await isRoomAdmin(request, room, studioId));
  if (!allowed) {
    return NextResponse.json({ error: "Недостаточно прав" }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const installation = await getInstallationIdentity();
  const decision = await entitlement();

  return NextResponse.json({
    ok: decision.allowed,
    mode: decision.mode,
    state: decision.state,
    installationId: installation.installationId,
    serverId: process.env.CASTLINK_SERVER_ID?.trim() || null,
    features: decision.features,
  }, { headers: { "Cache-Control": "no-store" } });
}
