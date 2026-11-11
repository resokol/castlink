import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin-access";
import { serverObservabilityStore, OBSERVABILITY_RETENTION_MS, observabilitySamplerRunning } from "@/lib/server-observability-store";
import type { ServerEventLevel } from "@/lib/server-event-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };
export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });
    const params = request.nextUrl.searchParams;
    const level = params.get("level") ?? "all", rawCursor = params.get("cursor");
    if (!["all", "info", "warn", "error"].includes(level) || [...params.keys()].some(key => !["level", "cursor"].includes(key)) || params.getAll("level").length > 1 || params.getAll("cursor").length > 1 || rawCursor !== null && (!/^[1-9]\d{0,15}$/.test(rawCursor) || !Number.isSafeInteger(Number(rawCursor)))) return NextResponse.json({ error: "Некорректные параметры журнала" }, { status: 400, headers });
    try { return NextResponse.json(serverObservabilityStore().readEvents(level as ServerEventLevel | "all", rawCursor === null ? undefined : Number(rawCursor)), { headers }); }
    catch { return NextResponse.json({ generatedAt: Date.now(), retentionMs: OBSERVABILITY_RETENTION_MS, events: [], nextCursor: null, storage: { state: "unavailable", droppedEvents: 0, samplerRunning: observabilitySamplerRunning() } }, { headers }); }
  } catch { return NextResponse.json({ error: "Журнал сервера временно недоступен" }, { status: 503, headers }); }
}
