import { NextRequest, NextResponse } from "next/server";
import { isStudio } from "../../../lib/access";
import { isRoomAdmin } from "../../../lib/room-admin";
import { getInstallationIdentity } from "../../../lib/persistent-storage";
import { licenseEnforced, licenseToken, verifyLicenseToken } from "../../../lib/license";

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
  const status = verifyLicenseToken(licenseToken(), installation.installationId);
  const payload = status.ok ? status.payload : undefined;

  return NextResponse.json({
    enforced: licenseEnforced(),
    state: status.state,
    ok: status.ok,
    installationId: installation.installationId,
    ...(payload ? {
      licenseId: payload.licenseId,
      customer: payload.customer,
      expiresAt: payload.expiresAt,
      offlineGraceUntil: payload.offlineGraceUntil,
      maxServers: payload.maxServers,
      features: payload.features,
    } : {}),
    ...(!status.ok ? { reason: status.reason } : {}),
  }, { headers: { "Cache-Control": "no-store" } });
}
