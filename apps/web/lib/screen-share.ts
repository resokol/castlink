import type { Track } from "livekit-client";

type ScreenPublication = { isMuted?: boolean; track?: { mediaStreamTrack?: { readyState: string }; stop(): void } };
export type ScreenShareRoom = {
  state: string;
  localParticipant: {
    setScreenShareEnabled(enabled: boolean, options?: { audio?: boolean }): Promise<unknown>;
    getTrackPublication(source: Track.Source): ScreenPublication | undefined;
    unpublishTrack(track: NonNullable<ScreenPublication["track"]>): Promise<unknown>;
  };
};

async function stopLateScreenShare(room: ScreenShareRoom) {
  try { await room.localParticipant.setScreenShareEnabled(false); } catch { /* The room may already be disconnecting. */ }
  for (const source of ["screen_share", "screen_share_audio"] as Track.Source[]) {
    const track = room.localParticipant.getTrackPublication(source)?.track;
    if (!track) continue;
    try { await room.localParticipant.unpublishTrack(track); } catch { /* Disconnect can already have unpublished it. */ }
    try { track.stop(); } catch { /* A browser may already have ended capture. */ }
  }
}

export async function enableRoomScreenShare(room: ScreenShareRoom, isCurrent: () => boolean): Promise<boolean> {
  await room.localParticipant.setScreenShareEnabled(true, { audio: true });
  if (!isCurrent() || room.state !== "connected") {
    await stopLateScreenShare(room);
    return false;
  }
  const track = room.localParticipant.getTrackPublication("screen_share" as Track.Source)?.track;
  const publication = room.localParticipant.getTrackPublication("screen_share" as Track.Source);
  if (!track || publication?.isMuted || track.mediaStreamTrack?.readyState !== "live") {
    await stopLateScreenShare(room);
    return false;
  }
  return true;
}
