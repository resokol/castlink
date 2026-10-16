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

// The studio owns these capture tracks before publication, so its output mute can
// synchronously silence audio while a display picker or publish request is pending.
const studioCaptures = new WeakMap<object, Set<import('livekit-client').LocalTrack>>();
export function setRoomScreenShareOutputMuted(room: import('livekit-client').Room, muted: boolean) {
  const tracks = new Set(studioCaptures.get(room));
  const published = room.localParticipant.getTrackPublication('screen_share_audio' as Track.Source)?.track;
  if (published) tracks.add(published);
  for (const track of tracks) if (track.source === 'screen_share_audio') track.mediaStreamTrack.enabled = !muted;
}
/** Studio path: gate the raw shared audio BEFORE it can reach a sender. */
export async function enableStudioScreenShare(room: import('livekit-client').Room, isCurrent: () => boolean, getOutputMuted: () => boolean): Promise<boolean> {
  const participant = room.localParticipant, sid = participant.sid;
  const current = () => isCurrent() && room.state === 'connected' && participant.sid === sid;
  const tracks = await participant.createScreenTracks({ audio: true });
  const owned = studioCaptures.get(room) || new Set<import('livekit-client').LocalTrack>();
  studioCaptures.set(room, owned);
  for (const old of owned) if (old.mediaStreamTrack.readyState === "ended") owned.delete(old);
  // No await between acquiring audio, registration and gating it.
  for (const track of tracks) owned.add(track);
  setRoomScreenShareOutputMuted(room, !current() || getOutputMuted());
  const cleanup = async () => {
    // Silence and stop immediately; asynchronous unpublication must not keep capture live.
    for (const track of tracks) { track.mediaStreamTrack.enabled = false; track.stop(); owned.delete(track); }
    await Promise.all(tracks.map(async track => { try { await participant.unpublishTrack(track); } catch { /* Disconnect may already have unpublished it. */ } }));
  };
  try {
    if (!current()) { await cleanup(); return false; }
    for (const track of tracks) {
      setRoomScreenShareOutputMuted(room, getOutputMuted());
      if (!current()) { await cleanup(); return false; }
      await participant.publishTrack(track, { source: track.source });
      setRoomScreenShareOutputMuted(room, !current() || getOutputMuted());
      if (!current()) { await cleanup(); return false; }
    }
    const video = participant.getTrackPublication('screen_share' as Track.Source);
    if (!video?.track || video.track.mediaStreamTrack.readyState !== 'live' || video.isMuted) { await cleanup(); return false; }
    return true;
  } catch (error) { await cleanup(); throw error; }
}
export async function stopStudioScreenShare(room: import('livekit-client').Room) {
  const owned = studioCaptures.get(room);
  for (const track of owned || []) { track.mediaStreamTrack.enabled = false; track.stop(); }
  studioCaptures.delete(room);
  await stopLateScreenShare(room);
}
