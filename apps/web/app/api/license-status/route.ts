import { NextRequest, NextResponse } from "next/server";
import { isStudio } from "../../../lib/access";
import { isRoomAdmin } from "../../../lib/room-admin";
import { getInstallationIdentity } from "../../../lib/persistent-storage";
import { entitlement } from "../../../lib/entitlement";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room")?.trim() || "";
  const allowed = isStudio(request) || (!!room && await isRoomAdmin(request, room));
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
