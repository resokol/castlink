import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { heartbeatSecretForNode } from "../../../../lib/node-heartbeat-auth";
import { verifyNodeControlRequest } from "../../../../lib/node-control-auth";
import { readHistory } from "../../../../lib/telemetry-store";
import { mean, sumRates } from "../../../../lib/telemetry-types";
import { requestHeaders, requestId, serverLog } from "../../../../lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

function roleFor(identity: string, metadataRaw?: string) {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(metadataRaw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;
  } catch {}
  if (identity.startsWith("studio-panel-")) return "studio";
  if (identity.startsWith("studio-moderator-")) return metadata.accessRole === "admin" || metadata.roomAdmin === true ? "admin" : "moderator";
  if (identity.startsWith("guest-")) return "guest";
  if (identity.startsWith("output-")) return "output";
  if (identity.startsWith("monitor-")) return "monitor";
  if (identity.startsWith("talkback-")) return "talkback";
  if (identity.startsWith("stream-viewer-")) return "viewer";
  return "other";
}

export async function GET(request: NextRequest) {
  const reqId = requestId(request), started = Date.now(), headers = requestHeaders(reqId, noStore);
  const requestedNodeId = request.headers.get("x-castlink-node-id")?.trim() || "";
  const ownNodeId = process.env.CASTLINK_NODE_ID?.trim() || process.env.STUDIOLINK_TRANSFER_SERVER_ID?.trim() || "";
  if (!ownNodeId || requestedNodeId !== ownNodeId) {
    return NextResponse.json({ error: "Wrong node identity" }, { status: 401, headers });
  }
  const timestamp = request.headers.get("x-castlink-node-time")?.trim() || "";
  const signature = request.headers.get("x-castlink-node-signature")?.trim() || "";
  const secret = heartbeatSecretForNode(ownNodeId);
  const pathAndQuery = request.nextUrl.pathname + request.nextUrl.search;
  if (!secret || !verifyNodeControlRequest(secret, timestamp, "GET", pathAndQuery, signature)) {
    serverLog("warn", "node.topology.denied", { requestId: reqId, nodeId: ownNodeId, status: 401 });
    return NextResponse.json({ error: "Invalid node signature" }, { status: 401, headers });
  }

  const key = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!key || !apiSecret) return NextResponse.json({ error: "LiveKit credentials unavailable" }, { status: 503, headers });

  try {
    const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, apiSecret);
    const rooms = await lk.listRooms();
    const topology = await Promise.all(rooms.map(async room => {
      const [participants, history] = await Promise.all([
        lk.listParticipants(room.name),
        readHistory(room.name, 15).catch(() => null),
      ]);
      return {
        mediaRoom: room.name,
        participantCount: participants.length,
        participants: participants.map(participant => {
          const latest = history?.connections
            .filter(connection => connection.identity === participant.identity)
            .sort((a, b) => b.lastSeen - a.lastSeen)[0];
          const streams = latest?.latest.streams || [];
          return {
            identity: participant.identity,
            name: participant.name || participant.identity,
            role: roleFor(participant.identity, participant.metadata),
            trackCount: participant.tracks?.length || 0,
            sources: Array.from(new Set((participant.tracks || []).map(track => String(track.source)))),
            state: latest?.latest.state || "connected",
            lastSampleAt: latest?.lastSeen || null,
            bitrateInKbps: sumRates(streams, "in"),
            bitrateOutKbps: sumRates(streams, "out"),
            rttMs: mean(streams.map(stream => stream.rttMs)),
            jitterMs: mean(streams.map(stream => stream.jitterMs)),
            lossPct: mean(streams.map(stream => stream.lossPct)),
            reconnects: latest?.latest.reconnects ?? null,
          };
        }),
      };
    }));
    serverLog("info", "node.topology.allowed", { requestId: reqId, nodeId: ownNodeId, rooms: topology.length, status: 200, durationMs: Date.now() - started });
    return NextResponse.json({ nodeId: ownNodeId, generatedAt: Date.now(), rooms: topology }, { headers });
  } catch (error) {
    serverLog("error", "node.topology.failed", { requestId: reqId, nodeId: ownNodeId, status: 503, reason: error instanceof Error ? error.message : "topology_failed" });
    return NextResponse.json({ error: "Node topology unavailable" }, { status: 503, headers });
  }
}
