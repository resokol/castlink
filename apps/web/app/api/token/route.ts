import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { canJoin, canView, isStudio } from "@/lib/access";
import { readRooms } from "@/lib/room-store";

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room") || "demo-room";
  const identity = request.nextUrl.searchParams.get("identity") || `guest-${Date.now()}`;
  const name = request.nextUrl.searchParams.get("name") || identity;
  const role = request.nextUrl.searchParams.get("role") || "guest";
  const record = (await readRooms()).find(r => r.name === room);
  if (!record) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  const prefix = role === "studio-panel" ? "studio-panel-" : role === "output" ? "output-" : role === "monitor" ? "monitor-" : "guest-";
  if (!["studio-panel", "guest", "output", "monitor"].includes(role) || !identity.startsWith(prefix)) return NextResponse.json({ error: "Недопустимая роль" }, { status: 403 });
  const allowed = role === "studio-panel" ? isStudio(request) : role === "guest" ? canJoin(request, room, record.passwordHash) : canView(request, room, record.passwordHash);
  if (!allowed) return NextResponse.json({ error: "Требуется пароль" }, { status: 401 });
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit credentials are not configured" }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, name, ttl: "2h", metadata: JSON.stringify({ role }) });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: role !== "output" && role !== "monitor",
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt() }, { headers: { "Cache-Control": "no-store" } });
}
