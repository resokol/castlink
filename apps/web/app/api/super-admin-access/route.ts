import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "../../../lib/access";
import {
  clearSuperAdminCookie,
  isSuperAdmin,
  newSuperAdminInvite,
  revokeSuperAdminAccess,
  setSuperAdminCookie,
  validSuperAdminInvite,
} from "../../../lib/super-admin-access";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const reqId = requestId(request);
  try {
    const allowed = await isSuperAdmin(request);
    return NextResponse.json({ allowed, bootstrapAllowed: !allowed && isStudio(request) }, { headers: requestHeaders(reqId, noStore) });
  } catch (error) {
    serverLog("error", "super_admin.status_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "access_state_unavailable" });
    return NextResponse.json({ error: "Super Admin access state недоступен" }, { status: 503, headers: requestHeaders(reqId, noStore) });
  }
}

export async function POST(request: NextRequest) {
  const reqId = requestId(request);
  const headers = requestHeaders(reqId, noStore);
  if (!request.headers.get("origin") || !sameOrigin(request)) {
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers });
  }
  const accessLimit = consumeRateLimit(request, { scope: "super-admin-access", limit: 30, windowMs: 60_000 });
  if (!accessLimit.ok) return NextResponse.json({ error: "Слишком много операций доступа" }, { status: 429, headers: { ...headers, ...rateLimitHeaders(accessLimit) } });
  const raw = await request.text();
  if (raw.length > 8192) return new NextResponse(null, { status: 413, headers });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers }); }

  try {
    if (data?.action === "bootstrap") {
      if (!isStudio(request)) return NextResponse.json({ error: "Bootstrap доступен только platform owner" }, { status: 403, headers });
      const response = NextResponse.json({ ok: true, allowed: true }, { headers });
      await setSuperAdminCookie(response, request);
      serverLog("info", "super_admin.bootstrapped", { requestId: reqId, status: 200 });
      return response;
    }

    if (data?.action === "accept") {
      if (typeof data.invite !== "string" || data.invite.length > 4096) return NextResponse.json({ error: "Некорректная ссылка" }, { status: 400, headers });
      const claims = await validSuperAdminInvite(data.invite);
      if (!claims) return NextResponse.json({ error: "Ссылка Super Admin недействительна или отозвана" }, { status: 401, headers });
      const response = NextResponse.json({ ok: true, allowed: true }, { headers });
      await setSuperAdminCookie(response, request, claims.exp);
      serverLog("info", "super_admin.invite_accepted", { requestId: reqId, status: 200 });
      return response;
    }

    if (data?.action === "logout") {
      const response = NextResponse.json({ ok: true }, { headers });
      clearSuperAdminCookie(response);
      return response;
    }

    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });

    if (data?.action === "create-invite") {
      const { invite, expiresAt } = await newSuperAdminInvite();
      const path = `/super-admin#access=${encodeURIComponent(invite)}`;
      serverLog("info", "super_admin.invite_created", { requestId: reqId, status: 200, expiresAt });
      return NextResponse.json({ ok: true, path, expiresAt }, { headers });
    }

    if (data?.action === "revoke") {
      await revokeSuperAdminAccess();
      const response = NextResponse.json({ ok: true }, { headers });
      clearSuperAdminCookie(response);
      serverLog("warn", "super_admin.access_revoked", { requestId: reqId, status: 200 });
      return response;
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers });
  } catch (error) {
    serverLog("error", "super_admin.access_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "access_failed" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Super Admin access недоступен" }, { status: 503, headers });
  }
}
