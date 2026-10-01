import { isSuperAdmin } from "../../../lib/super-admin-access";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "../../../lib/access";
import { createTemporaryServer, deactivateRegisteredServer, listRegisteredServers } from "../../../lib/server-registry-client";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
  try {
    return NextResponse.json({ servers: await listRegisteredServers() }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось получить серверы" }, { status: 502, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });

  const raw = await request.text();
  if (raw.length > 4096) return new NextResponse(null, { status: 413, headers: noStore });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: noStore }); }

  try {
    if (data?.action === "temporary") {
      const region = typeof data.region === "string" ? data.region.trim() : "";
      const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
      const durationHours = Number(data.durationHours);
      if (!region || region.length > 80 || !displayName || displayName.length > 120 || !Number.isFinite(durationHours)) {
        return NextResponse.json({ error: "Некорректные параметры временного сервера" }, { status: 400, headers: noStore });
      }
      const server = await createTemporaryServer({ region, displayName, durationHours });
      return NextResponse.json({ ok: true, server }, { headers: noStore });
    }

    if (data?.action === "deactivate") {
      const serverId = typeof data.serverId === "string" ? data.serverId.trim() : "";
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(serverId)) return NextResponse.json({ error: "Некорректный serverId" }, { status: 400, headers: noStore });
      await deactivateRegisteredServer(serverId);
      return NextResponse.json({ ok: true }, { headers: noStore });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Операция с сервером не выполнена" }, { status: 502, headers: noStore });
  }
}
