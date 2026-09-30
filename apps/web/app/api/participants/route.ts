import { NextRequest, NextResponse } from "next/server";
import { DataPacket_Kind, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator, revokeRoomModeratorSession } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { isStudioOwner } from "../../../lib/studio-owner-access";
const client = () => new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const studioMetadataMatches = (metadata: any, studioId: string) => metadata?.studioId === studioId || (studioId === defaultStudioId() && metadata?.studioId === undefined);
const isVerifiedModerator = (metadata: any, room: string, studioId: string) =>
  studioMetadataMatches(metadata, studioId) &&
  (metadata?.accessRole === "moderator" && typeof metadata.moderatorAccessVersion === "string" ||
   metadata?.roomModeratorRoom === room && typeof metadata.roomModeratorSessionId === "string");
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const { room, identity, studioId: rawStudioId = "" } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return new NextResponse(null, { status: 400 }); }
    const mediaRoom = typeof room === "string" && room ? mediaRoomName(studioId, room) : "";
    const owner = await isStudioOwner(request, studioId);
    const admin = !owner && typeof room === "string" && await isRoomAdmin(request, room, studioId);
    const moderator = !owner && !admin && typeof room === "string" && await isModerator(request, room, studioId);
    if (!owner && !admin && !moderator) return new NextResponse(null, { status: 401 });
    if (typeof room !== "string" || typeof identity !== "string" || !room || !identity) return new NextResponse(null, { status: 400 });
    if (!(await readRooms(studioId)).some(item => item.name === room)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    const lk = client();
    if (identity.startsWith("guest-")) {
      await lk.removeParticipant(mediaRoom, identity);
      return NextResponse.json({ ok: true });
    }
    if (!(owner || admin) || !identity.startsWith("studio-moderator-")) return NextResponse.json({ error: "Можно отключать только гостей или модераторов" }, { status: 403 });
    const participant = await lk.getParticipant(mediaRoom, identity);
    let metadata: any; try { metadata = JSON.parse(participant.metadata || "{}"); } catch { metadata = null; }
    if (!metadata || !isVerifiedModerator(metadata, room, studioId) || metadata.roomAdmin === true || metadata.accessRole === "admin") return NextResponse.json({ error: "Нельзя отключить администратора студии" }, { status: 403 });
    if (metadata.roomModeratorRoom === room && typeof metadata.roomModeratorSessionId === "string") await revokeRoomModeratorSession(room, metadata.roomModeratorSessionId);
    await lk.removeParticipant(mediaRoom, identity);
    const sameModeratorSession = (candidate: any) => {
      try {
        const other = JSON.parse(candidate.metadata || "{}");
        if (metadata.roomModeratorRoom === room && metadata.roomModeratorSessionId) return other.roomModeratorRoom === room && other.roomModeratorSessionId === metadata.roomModeratorSessionId;
        return metadata.accessRole === "moderator" && other.accessRole === "moderator" && other.moderatorAccessVersion === metadata.moderatorAccessVersion && other.talkbackForClientId === metadata.clientId;
      } catch { return false; }
    };
    for (const other of await lk.listParticipants(mediaRoom)) if (other.identity.startsWith("talkback-") && sameModeratorSession(other)) await lk.removeParticipant(mediaRoom, other.identity);
    return NextResponse.json({ ok: true, scopeRevoked: metadata.roomModeratorRoom === room });
  } catch { return NextResponse.json({ error: "Не удалось отключить участника. Возможно, он уже вышел." }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const { action, room, identity, kind, enabled, studioId: rawStudioId = "" } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
    const mediaRoom = typeof room === "string" && room ? mediaRoomName(studioId, room) : "";
    if (typeof room !== "string" || typeof identity !== "string" || !room || !identity) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const owner = await isStudioOwner(request, studioId);
    const admin = !owner && await isRoomAdmin(request, room, studioId);
    const moderator = !owner && !admin && await isModerator(request, room, studioId);
    if (!owner && !admin && !moderator) return new NextResponse(null, { status: 401 });
    if (!(await readRooms(studioId)).some(item => item.name === room)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    if (action === "rotate") {
      if (!identity.startsWith("guest-") && !((owner || admin) && identity.startsWith("studio-moderator-"))) return NextResponse.json({ error: "Нет прав на поворот этого участника" }, { status: 403 });
      const lk = client(), participant = await lk.getParticipant(mediaRoom, identity);
      let metadata: Record<string, unknown> = {}; try { metadata = JSON.parse(participant.metadata || "{}"); } catch {}
      const current = [0, 90, 180, 270].includes(Number(metadata.videoRotation)) ? Number(metadata.videoRotation) : 0;
      await lk.updateParticipant(mediaRoom, identity, { metadata: JSON.stringify({ ...metadata, videoRotation: (current + 90) % 360 }) });
      return NextResponse.json({ ok: true, rotation: (current + 90) % 360 });
    }
    if (!identity.startsWith("guest-")) return NextResponse.json({ error: "Можно управлять медиа только гостей" }, { status: 403 });
    if (action !== "mute" && (action !== "media" || !["audio", "video"].includes(kind) || typeof enabled !== "boolean")) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const lk = client();
    const participant = await lk.getParticipant(mediaRoom, identity);
    if (action === "mute") {
      const microphones = participant.tracks.filter(track => track.source === TrackSource.MICROPHONE);
      for (const track of microphones) await lk.mutePublishedTrack(mediaRoom, identity, track.sid, true);
      return NextResponse.json({ ok: true, muted: microphones.length > 0, tracks: microphones.length });
    }
    const source = kind === "audio" ? TrackSource.MICROPHONE : TrackSource.CAMERA;
    const tracks = participant.tracks.filter(track => track.source === source);
    if (!enabled) {
      for (const track of tracks) await lk.mutePublishedTrack(mediaRoom, identity, track.sid, true);
      return NextResponse.json({ ok: true, kind, enabled: false, tracks: tracks.length, muted: tracks.length > 0 });
    }
    const bytes = new TextEncoder().encode(JSON.stringify({ kind, enabled: true }));
    await lk.sendData(mediaRoom, bytes, DataPacket_Kind.RELIABLE, { destinationIdentities: [identity], topic: "castlink-media-control" });
    return NextResponse.json({ ok: true, kind, enabled: true, requested: true, tracks: tracks.length });
  } catch { return NextResponse.json({ error: "Не удалось изменить медиа гостя" }, { status: 502 }); }
}
