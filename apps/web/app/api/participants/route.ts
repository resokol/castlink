import { privateTalkbackForGuest, loadPrivateTalkbackSessions } from "../../../lib/talkback-session";
import { rememberGuestSessionSettings } from "../../../lib/guest-session-settings";
import { NextRequest, NextResponse } from "next/server";
import { rememberLocalKick } from "../../../lib/node-admission";
import { DataPacket_Kind, RoomServiceClient, TrackSource, TokenVerifier } from "livekit-server-sdk";
import { isStudio, sameOrigin } from "@/lib/access";
import { isRoomAdmin } from "@/lib/room-admin";
import { isModerator, revokeRoomModeratorSession } from "@/lib/moderator-access";
import { readRooms } from "@/lib/room-store";
import { defaultStudioId, mediaRoomName, validateStudioId } from "../../../lib/studio-scope";
import { canHostNamedRoom } from "../../../lib/room-studio-access";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/rate-limit";
import { validateImageTransform } from "../../../lib/multiview-image";
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
    const participantSourceLimit = consumeRateLimit(request, { scope: "participant-control-source", limit: 300, windowMs: 60_000 });
    const participantLimit = consumeRateLimit(request, { scope: "participant-control-room", limit: 120, windowMs: 60_000, subject: `${studioId}:${typeof room === "string" ? room : "unknown"}` });
    const deniedParticipantLimit = !participantSourceLimit.ok ? participantSourceLimit : !participantLimit.ok ? participantLimit : null;
    if (deniedParticipantLimit) return NextResponse.json({ error: "Слишком много команд участникам" }, { status: 429, headers: rateLimitHeaders(deniedParticipantLimit) });
    const mediaRoom = typeof room === "string" && room ? mediaRoomName(studioId, room) : "";
    const owner = await canHostNamedRoom(request, room, studioId);
    const admin = !owner && typeof room === "string" && await isRoomAdmin(request, room, studioId);
    const moderator = !owner && !admin && typeof room === "string" && await isModerator(request, room, studioId);
    if (!owner && !admin && !moderator) return new NextResponse(null, { status: 401 });
    if (typeof room !== "string" || typeof identity !== "string" || !room || !identity) return new NextResponse(null, { status: 400 });
    if (!(await readRooms(studioId)).some(item => item.name === room)) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    const lk = client();
    if (identity.startsWith("guest-")) {
      if (process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1") await rememberLocalKick(mediaRoom,identity);
      await lk.removeParticipant(mediaRoom, identity);
      return NextResponse.json({ ok: true });
    }
    if (!(owner || admin) || !identity.startsWith("studio-moderator-")) return NextResponse.json({ error: "Можно отключать только гостей или модераторов" }, { status: 403 });
    const participant = await lk.getParticipant(mediaRoom, identity);
    let metadata: any; try { metadata = JSON.parse(participant.metadata || "{}"); } catch { metadata = null; }
    if (!metadata || !isVerifiedModerator(metadata, room, studioId) || metadata.roomAdmin === true || metadata.accessRole === "admin") return NextResponse.json({ error: "Нельзя отключить администратора студии" }, { status: 403 });
    if (metadata.roomModeratorRoom === room && typeof metadata.roomModeratorSessionId === "string") await revokeRoomModeratorSession(room, metadata.roomModeratorSessionId, studioId);
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
    const { action, room, identity, kind, enabled, name, clientId, bitrateKbps, participantSid, transform, studioId: rawStudioId = "" } = await request.json();
    let studioId: string;
    try { studioId = validateStudioId(typeof rawStudioId === "string" && rawStudioId.trim() ? rawStudioId : defaultStudioId()); }
    catch { return NextResponse.json({ error: "Некорректный studioId" }, { status: 400 }); }
    const participantSourceLimit = consumeRateLimit(request, { scope: "participant-control-source", limit: 300, windowMs: 60_000 });
    const participantLimit = consumeRateLimit(request, { scope: "participant-control-room", limit: 120, windowMs: 60_000, subject: `${studioId}:${typeof room === "string" ? room : "unknown"}` });
    const deniedParticipantLimit = !participantSourceLimit.ok ? participantSourceLimit : !participantLimit.ok ? participantLimit : null;
    if (deniedParticipantLimit) return NextResponse.json({ error: "Слишком много команд участникам" }, { status: 429, headers: rateLimitHeaders(deniedParticipantLimit) });
    const mediaRoom = typeof room === "string" && room ? mediaRoomName(studioId, room) : "";
    if (typeof room !== "string" || typeof identity !== "string" || !room || !identity) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const owner = await canHostNamedRoom(request, room, studioId);
    const admin = !owner && await isRoomAdmin(request, room, studioId);
    const moderator = !owner && !admin && await isModerator(request, room, studioId);
    if (!owner && !admin && !moderator) return new NextResponse(null, { status: 401 });
    const record = (await readRooms(studioId)).find(item => item.name === room);
    if (!record) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    if (action === "image-transform") {
      if (!owner && !admin) return new NextResponse(null, { status: 403 });
      if (!identity.startsWith("guest-")) return new NextResponse(null, { status: 403 });
      if (typeof participantSid !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(participantSid)) return NextResponse.json({ error: "Некорректная сессия кастера" }, { status: 400 });
      let image;
      try { image = validateImageTransform(transform); }
      catch { return NextResponse.json({ error: "Некорректные параметры изображения" }, { status: 400 }); }
      const lk = client();
      let participant;
      try { participant = await lk.getParticipant(mediaRoom, identity); }
      catch { return NextResponse.json({ error: "Кастер больше не подключён" }, { status: 409 }); }
      if (participant.sid !== participantSid) return NextResponse.json({ error: "Кастер переподключился. Обновите изображение." }, { status: 409 });
      let metadata;
      try { metadata = JSON.parse(participant.metadata || "{}"); }
      catch { return new NextResponse(null, { status: 403 }); }
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || metadata.role !== "guest" || metadata.studioId !== studioId) return new NextResponse(null, { status: 403 });
      const updatedMetadata = { ...metadata, studioImageTransform: image };
      await lk.updateParticipant(mediaRoom, identity, { metadata: JSON.stringify(updatedMetadata) });
      rememberGuestSessionSettings(studioId, record, identity, updatedMetadata);
      return NextResponse.json({ ok: true, participantSid, transform: image }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "rename-guest") {
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!cleanName || cleanName.length > 120 || /[\u0000-\u001f\u007f]/.test(cleanName)) return NextResponse.json({error:"Введите имя от 1 до 120 символов"},{status:400});
      if (!identity.startsWith("guest-")) return NextResponse.json({error:"Можно переименовать только гостя своей комнаты"},{status:403});
      const lk=client(), participant=await lk.getParticipant(mediaRoom,identity);
      let metadata:any; try { metadata=JSON.parse(participant.metadata || "{}"); } catch { return new NextResponse(null,{status:403}); }
      if (!studioMetadataMatches(metadata,studioId) || metadata.role && metadata.role!=="guest") return new NextResponse(null,{status:403});
      await lk.updateParticipant(mediaRoom,identity,{name:cleanName});
      return NextResponse.json({ok:true,name:cleanName});
    }
    if (action === "rename-self") {
      const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : "";
      if (!cleanName || typeof clientId !== "string" || !clientId) return NextResponse.json({ error: "Введите имя" }, { status: 400 });
      if (!identity.startsWith("studio-moderator-")) return NextResponse.json({ error: "Переименование доступно только персоналу" }, { status: 403 });
      // clientId is public LiveKit metadata, not proof of ownership.
      try {
        const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
        const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(bearer);
        const proof = JSON.parse(claims.metadata || "{}");
        if (claims.sub !== identity || claims.video?.room !== mediaRoom || proof.role !== "studio-moderator" || proof.clientId !== clientId || !studioMetadataMatches(proof, studioId)) return new NextResponse(null, { status: 403 });
      } catch { return new NextResponse(null, { status: 403 }); }
      const lk = client();
      const participant = await lk.getParticipant(mediaRoom, identity);
      let metadata: any; try { metadata = JSON.parse(participant.metadata || "{}"); } catch { metadata = null; }
      const staffRole = metadata?.accessRole === "admin" || metadata?.roomAdmin === true || metadata?.accessRole === "moderator" || metadata?.accessRole === "room-moderator";
      if (!metadata || metadata.clientId !== clientId || metadata.role !== "studio-moderator" || !studioMetadataMatches(metadata, studioId) || !staffRole) {
        return NextResponse.json({ error: "Нельзя изменить имя другого участника" }, { status: 403 });
      }
      await lk.updateParticipant(mediaRoom, identity, { name: cleanName });
      return NextResponse.json({ ok: true, name: cleanName });
    }
    if (action === "video-bitrate") {
      if (!identity.startsWith("guest-")) return NextResponse.json({ error:"Лимит доступен только для гостевой камеры" }, { status:403 });
      if (!Number.isInteger(bitrateKbps) || bitrateKbps < 500 || bitrateKbps > 12000) return NextResponse.json({ error:"Некорректный лимит камеры" }, { status:400 });
      const lk = client(), participant = await lk.getParticipant(mediaRoom,identity);
      let metadata: Record<string,unknown>;
      try { metadata = JSON.parse(participant.metadata || "{}"); } catch { return new NextResponse(null,{ status:403 }); }
      if (!metadata || metadata.role !== "guest" || !studioMetadataMatches(metadata,studioId)) return new NextResponse(null,{ status:403 });
      const updatedMetadata = { ...metadata, videoMaxBitrateKbps: bitrateKbps };
      await lk.updateParticipant(mediaRoom,identity,{ metadata:JSON.stringify(updatedMetadata) });
      rememberGuestSessionSettings(studioId, record, identity, updatedMetadata);
      return NextResponse.json({ ok:true,requested:true,bitrateKbps });
    }
    if (action === "rotate") {
      if (!identity.startsWith("guest-") && !((owner || admin) && identity.startsWith("studio-moderator-"))) return NextResponse.json({ error: "Нет прав на поворот этого участника" }, { status: 403 });
      const lk = client(), participant = await lk.getParticipant(mediaRoom, identity);
      let metadata: Record<string, unknown> = {}; try { metadata = JSON.parse(participant.metadata || "{}"); } catch {}
      const current = [0, 90, 180, 270].includes(Number(metadata.videoRotation)) ? Number(metadata.videoRotation) : 0;
      const updatedMetadata = { ...metadata, videoRotation: (current + 90) % 360 };
      await lk.updateParticipant(mediaRoom, identity, { metadata: JSON.stringify(updatedMetadata) });
      if (identity.startsWith("guest-")) rememberGuestSessionSettings(studioId, record, identity, updatedMetadata);
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
    if (kind === "audio") await loadPrivateTalkbackSessions();
    if (kind === "audio" && privateTalkbackForGuest(mediaRoom, identity)) return NextResponse.json({ error: "Микрофон эфира выключен на время приватного разговора" }, { status: 409 });
    const bytes = new TextEncoder().encode(JSON.stringify({ kind, enabled: true }));
    await lk.sendData(mediaRoom, bytes, DataPacket_Kind.RELIABLE, { destinationIdentities: [identity], topic: "castlink-media-control" });
    return NextResponse.json({ ok: true, kind, enabled: true, requested: true, tracks: tracks.length });
  } catch { return NextResponse.json({ error: "Не удалось изменить медиа гостя" }, { status: 502 }); }
}
