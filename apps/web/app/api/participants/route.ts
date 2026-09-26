import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { isStudio, sameOrigin } from "@/lib/access";
export async function DELETE(request: NextRequest) {
  if (!isStudio(request) || !sameOrigin(request)) return new NextResponse(null, { status: 401 });
  try {
    const { room, identity } = await request.json();
    if (typeof room !== "string" || typeof identity !== "string" || !room || !identity) return new NextResponse(null, { status: 400 });
    const client = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    await client.removeParticipant(room, identity);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Не удалось отключить участника. Возможно, он уже вышел." }, { status: 502 }); }
}
