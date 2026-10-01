import { NextRequest, NextResponse } from "next/server";
import { listAllStudios, listControlNodes, listControlRooms } from "../../../lib/control-plane-store";
import { requestHeaders, requestId, serverLog } from "../../../lib/server-log";
import { isSuperAdmin } from "../../../lib/super-admin-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const reqId = requestId(request);
  const headers = requestHeaders(reqId, noStore);
  try {
    if (!(await isSuperAdmin(request))) return NextResponse.json({ error: "Недостаточно прав Super Admin" }, { status: 403, headers });
    const [nodes, studios, rooms] = await Promise.all([listControlNodes(), listAllStudios(), listControlRooms()]);
    const summary = {
      nodes: nodes.length,
      healthyNodes: nodes.filter(node => node.health === "healthy").length,
      studios: studios.length,
      liveStudios: studios.filter(studio => studio.broadcastState === "live").length,
      rooms: rooms.length,
      participants: nodes.reduce((sum, node) => sum + node.activeParticipants, 0),
      videoTracks: nodes.reduce((sum, node) => sum + node.activeVideoTracks, 0),
    };
    serverLog("info", "super_admin.overview", { requestId: reqId, status: 200, nodes: summary.nodes, studios: summary.studios, rooms: summary.rooms });
    return NextResponse.json({ generatedAt: Date.now(), summary, nodes, studios, rooms }, { headers });
  } catch (error) {
    serverLog("error", "super_admin.overview_failed", { requestId: reqId, status: 503, reason: error instanceof Error ? error.message : "control_plane_unavailable" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Control plane недоступен" }, { status: 503, headers });
  }
}
