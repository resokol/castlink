import { NextRequest, NextResponse } from "next/server";
import { isStudio, sameOrigin } from "../../../lib/access";
import { assignStudioAuto, createStudio, listControlNodes, listStudios, pinStudio } from "../../../lib/control-plane-store";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const studioIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(value);
const nodeIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value);

export async function GET(request: NextRequest) {
  if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });
  try {
    const [studios, nodes] = await Promise.all([listStudios(), listControlNodes()]);
    return NextResponse.json({ studios, nodes }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Control plane недоступен" }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers: noStore });
  if (!isStudio(request)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers: noStore });

  const raw = await request.text();
  if (raw.length > 4096) return new NextResponse(null, { status: 413, headers: noStore });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: noStore }); }

  try {
    if (data?.action === "create") {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length > 120) return NextResponse.json({ error: "Некорректное имя студии" }, { status: 400, headers: noStore });
      const studio = await createStudio(name);
      return NextResponse.json({ ok: true, studio }, { headers: noStore });
    }

    if (data?.action === "auto") {
      if (!studioIdOk(data.studioId)) return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers: noStore });
      const preferredRegion = typeof data.preferredRegion === "string" && data.preferredRegion.length <= 80 ? data.preferredRegion : undefined;
      const result = await assignStudioAuto(data.studioId, { preferredRegion });
      return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "no_capacity" ? 409 : 423, headers: noStore });
    }

    if (data?.action === "pin") {
      if (!studioIdOk(data.studioId) || !nodeIdOk(data.nodeId)) return NextResponse.json({ error: "Некорректные studioId/nodeId" }, { status: 400, headers: noStore });
      const result = await pinStudio(data.studioId, data.nodeId);
      return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "pinned_node_unavailable" ? 409 : 423, headers: noStore });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Операция со студией не выполнена" }, { status: 500, headers: noStore });
  }
}
