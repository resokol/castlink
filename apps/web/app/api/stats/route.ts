import { NextRequest, NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { clearDisconnected, readHistory, saveSample } from "@/lib/telemetry-store";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { defaultStudioId, validateStudioId } from "../../../lib/studio-scope";
import type { StreamStat, TelemetrySample } from "@/lib/telemetry-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const periods = [15, 60, 360, 720, 1440];
const text = (value: unknown, length = 160) => typeof value === "string" ? value.slice(0, length) : "";
const metric = (value: unknown, max = 1e12): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : null;
const canViewStudioStats = (identity: string) => identity.startsWith("studio-panel-") || identity.startsWith("studio-moderator-");

type StatsAuth = {
  identity: string;
  mediaRoom: string;
  studioId: string;
  roomDisplayName: string;
  metadata: Record<string, unknown>;
};

async function authenticate(request: NextRequest): Promise<StatsAuth | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!token || !key || !secret) return null;
  try {
    const claims = await new TokenVerifier(key, secret).verify(token);
    if (!claims.sub || !claims.video?.room) return null;
    let metadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(claims.metadata || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;
    } catch {}
    const studioId = validateStudioId(typeof metadata.studioId === "string" ? metadata.studioId : defaultStudioId());
    const roomDisplayName = typeof metadata.roomDisplayName === "string" && metadata.roomDisplayName.length <= 100
      ? metadata.roomDisplayName
      : claims.video.room;
    return { identity: claims.sub, mediaRoom: claims.video.room, studioId, roomDisplayName, metadata };
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "Необходим действующий токен комнаты" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 100_000) return new NextResponse(null, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return new NextResponse(null, { status: 413 });
    const data = JSON.parse(raw);
    if (data.room !== auth.mediaRoom || data.identity !== auth.identity || !/^[a-zA-Z0-9-]{10,80}$/.test(data.session) || !Array.isArray(data.streams) || data.streams.length > 256) {
      return NextResponse.json({ error: "Некорректный замер" }, { status: 400 });
    }
    const streams: StreamStat[] = data.streams.filter((s: any) => s && ["in", "out"].includes(s.direction) && ["audio", "video"].includes(s.kind))
      .map((s: any): StreamStat => ({
        id: text(s.id), participant: text(s.participant), name: text(s.name), direction: s.direction, kind: s.kind,
        source: text(s.source, 40), codec: text(s.codec, 80) || null,
        bitrateKbps: metric(s.bitrateKbps, 1e7), lossPct: metric(s.lossPct, 100), lostPackets: metric(s.lostPackets),
        jitterMs: metric(s.jitterMs), rttMs: metric(s.rttMs), fps: metric(s.fps, 1000),
        width: metric(s.width, 16384), height: metric(s.height, 16384), bytes: metric(s.bytes) ?? 0,
        freezes: metric(s.freezes), protocol: text(s.protocol, 20) || null,
        candidateType: text(s.candidateType, 30) || null, qualityLimitation: text(s.qualityLimitation, 40) || null,
      }));
    const role: TelemetrySample["role"] = auth.identity.startsWith("studio-panel-") ? "studio" :
      auth.identity.startsWith("output-") ? "output" : auth.identity.startsWith("monitor-") ? "monitor" : "guest";
    await saveSample({ at: Date.now(), room: auth.mediaRoom, identity: auth.identity, name: text(data.name), session: data.session,
      role, state: text(data.state, 30), quality: text(data.quality, 30), reconnects: metric(data.reconnects, 100000) ?? 0,
      uptimeSec: metric(data.uptimeSec) ?? 0, streams });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить замер" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "Необходим действующий токен комнаты" }, { status: 401 });
  const owner = await isStudioOwner(request, auth.studioId);
  const roomAdmin = !owner && await isRoomAdmin(request, auth.roomDisplayName, auth.studioId);
  if (!owner && !roomAdmin) return NextResponse.json({ error: "Статистика доступна только владельцу студии и администратору комнаты" }, { status: 403 });
  const accessRole = typeof auth.metadata.accessRole === "string" ? auth.metadata.accessRole : "";
  if (accessRole === "moderator" || accessRole === "room-moderator" || !canViewStudioStats(auth.identity)) {
    return NextResponse.json({ error: "Статистика доступна владельцу студии и администратору комнаты" }, { status: 403 });
  }
  const minutes = Number(request.nextUrl.searchParams.get("minutes") || 15);
  if (!periods.includes(minutes)) return NextResponse.json({ error: "Неизвестный период" }, { status: 400 });
  const requestedRoom = request.nextUrl.searchParams.get("room") || auth.roomDisplayName;
  const requestedStudio = request.nextUrl.searchParams.get("studioId") || auth.studioId;
  let studioId: string;
  try { studioId = validateStudioId(requestedStudio); }
  catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
  if (studioId !== auth.studioId || requestedRoom !== auth.roomDisplayName) {
    return NextResponse.json({ error: "Другая студия или комната" }, { status: 403 });
  }
  try {
    const history = await readHistory(auth.mediaRoom, minutes, request.nextUrl.searchParams.get("session") || undefined, request.nextUrl.searchParams.get("resolution") === "2s");
    return NextResponse.json(history, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать историю статистики" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 401 });
  const auth = await authenticate(request);
  if (!auth || !(await isStudioOwner(request, auth.studioId)) || !auth.identity.startsWith("studio-panel-")) return new NextResponse(null, { status: 403 });
  await clearDisconnected(auth.mediaRoom);
  return NextResponse.json({ ok: true });
}
