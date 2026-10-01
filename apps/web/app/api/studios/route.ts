import { isSuperAdmin } from "../../../lib/super-admin-access";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "../../../lib/access";
import { assignStudioAuto, createStudio, listControlNodes, listAllStudios, pinStudio } from "../../../lib/control-plane-store";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const studioIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(value);
const nodeIdOk = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value);

export async function GET(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  if (!(await isSuperAdmin(request))) {
    serverLog("warn", "control.studios.denied", { requestId: reqId, method: "GET", status: 403 });
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers });
  }
  try {
    const [studios, nodes] = await Promise.all([listAllStudios(), listControlNodes()]);
    serverLog("info", "control.studios.listed", { requestId: reqId, studios: studios.length, nodes: nodes.length, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({ studios, nodes }, { headers });
  } catch (error) {
    serverLog("error", "control.studios.failed", { requestId: reqId, method: "GET", status: 503, reason: error instanceof Error ? error.message : "control_plane_unavailable", durationMs: Date.now() - started });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Control plane недоступен" }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  if (!request.headers.get("origin") || !sameOrigin(request)) {
    serverLog("warn", "control.studios.denied", { requestId: reqId, method: "POST", status: 403, reason: "origin" });
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403, headers });
  }
  if (!(await isSuperAdmin(request))) {
    serverLog("warn", "control.studios.denied", { requestId: reqId, method: "POST", status: 403, reason: "authorization" });
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403, headers });
  }

  const raw = await request.text();
  if (raw.length > 4096) return new NextResponse(null, { status: 413, headers });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers }); }

  try {
    if (data?.action === "create") {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length > 120) return NextResponse.json({ error: "Некорректное имя студии" }, { status: 400, headers });
      const studio = await createStudio(name);
      serverLog("info", "control.studio.created", { requestId: reqId, studioId: studio.studioId, status: 200, durationMs: Date.now() - started });
      return NextResponse.json({ ok: true, studio }, { headers });
    }

    if (data?.action === "auto") {
      if (!studioIdOk(data.studioId)) return NextResponse.json({ error: "Некорректный studioId" }, { status: 400, headers });
      const preferredRegion = typeof data.preferredRegion === "string" && data.preferredRegion.length <= 80 ? data.preferredRegion : undefined;
      const result = await assignStudioAuto(data.studioId, { preferredRegion });
      const status = result.ok ? 200 : result.reason === "no_capacity" ? 409 : 423;
      serverLog(result.ok ? "info" : "warn", "control.studio.assignment_auto", { requestId: reqId, studioId: data.studioId, status, reason: result.ok ? "assigned" : result.reason, nodeId: result.ok ? result.node.nodeId : undefined, durationMs: Date.now() - started });
      return NextResponse.json(result, { status, headers });
    }

    if (data?.action === "pin") {
      if (!studioIdOk(data.studioId) || !nodeIdOk(data.nodeId)) return NextResponse.json({ error: "Некорректные studioId/nodeId" }, { status: 400, headers });
      const result = await pinStudio(data.studioId, data.nodeId);
      const status = result.ok ? 200 : result.reason === "pinned_node_unavailable" ? 409 : 423;
      serverLog(result.ok ? "info" : "warn", "control.studio.assignment_pin", { requestId: reqId, studioId: data.studioId, nodeId: data.nodeId, status, reason: result.ok ? "assigned" : result.reason, durationMs: Date.now() - started });
      return NextResponse.json(result, { status, headers });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400, headers });
  } catch (error) {
    serverLog("error", "control.studios.failed", { requestId: reqId, method: "POST", status: 500, reason: error instanceof Error ? error.message : "operation_failed", durationMs: Date.now() - started });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Операция со студией не выполнена" }, { status: 500, headers });
  }
}
