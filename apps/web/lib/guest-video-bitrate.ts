import { Room, RoomEvent, Track, type LocalVideoTrack } from "livekit-client";
import { applyStudioSenderQuality, guestVideoBitrate, studioVideoEncodingsMatch } from "./video-quality";

/** Keep a camera encoder budget across metadata changes, republish and SDK layer updates. */
export function watchGuestVideoBitrate(room: Room, onError: (message: string) => void, capture?: () => boolean) {
  let stopped = false, busy = false;
  const reconcile = async () => {
    if (stopped || busy || room.state !== "connected") return;
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    if (!track?.sender) return;
    busy = true;
    try {
      const bitrate = guestVideoBitrate(room.localParticipant.metadata);
      const actualFps = track.mediaStreamTrack.getSettings().frameRate;
      const fps = capture?.() && typeof actualFps === "number" && actualFps > 0 ? actualFps : 30;
      if (track.publishOptions) track.publishOptions.videoEncoding = { ...track.publishOptions.videoEncoding, maxBitrate:bitrate*1000, maxFramerate:fps };
      const encodings = track.sender.getParameters().encodings || [];
      if (!studioVideoEncodingsMatch(encodings,bitrate,fps)) await applyStudioSenderQuality(track.sender,bitrate,fps,!!capture?.());
    } catch { if (!stopped) onError("Не удалось применить лимит камеры: браузер не подтвердил параметры кодировщика."); }
    finally { busy=false; }
  };
  const update = () => { void reconcile(); };
  const events = [RoomEvent.Connected,RoomEvent.Reconnected,RoomEvent.LocalTrackPublished,RoomEvent.ParticipantMetadataChanged];
  events.forEach(event => room.on(event,update));
  const timer = setInterval(update,2000); update();
  return () => { stopped=true; clearInterval(timer); events.forEach(event => room.off(event,update)); };
}
