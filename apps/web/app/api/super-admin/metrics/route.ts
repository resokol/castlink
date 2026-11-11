import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin-access";
import { readServerMonitor } from "@/lib/server-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });
    const params = request.nextUrl.searchParams;
    const range = params.get("range") ?? "1h";
    const windows: Record<string, number> = { "1h": 3600000, "6h": 21600000, "24h": 86400000 };
    if (!Object.hasOwn(windows, range) || [...params.keys()].some(key => key !== "range") || params.getAll("range").length > 1) return NextResponse.json({ error: "Некорректный период" }, { status: 400, headers });
    return NextResponse.json(await readServerMonitor(windows[range]), { headers });
  } catch {
    return NextResponse.json({ error: "Показатели сервера временно недоступны" }, { status: 503, headers });
  }
}
