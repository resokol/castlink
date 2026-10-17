import { RoomEvent, Track, type RemoteAudioTrack, type RemoteTrack, type Room } from "livekit-client";
import { bindMonitorAudio } from "./monitor-audio";

/** Playback stays in this isolated room and never enters the program audio graph. */
export function bindPrivateTalkbackAudio(room: Room, outputRoom?: Room, volume: () => number = () => 1) {
  const elements = new Map<RemoteTrack, HTMLMediaElement>();
  const volumeBindings = new Map<RemoteTrack, () => void>();
  const remove = (track: RemoteTrack) => {
    const element = elements.get(track);
    if (!element) return;
    track.detach(element);
    volumeBindings.get(track)?.();
    volumeBindings.delete(track);
    element.remove();
    elements.delete(track);
  };
  const attach = (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio || elements.has(track)) return;
    volumeBindings.set(track, bindMonitorAudio(track as RemoteAudioTrack, volume));
    const element = track.attach();
    element.hidden = true;
    elements.set(track, element);
    document.body.appendChild(element);
    void room.startAudio().catch(() => undefined);
  };
  room.on(RoomEvent.TrackSubscribed, attach);
  room.on(RoomEvent.TrackUnsubscribed, remove);
  const outputChanged = (kind: MediaDeviceKind, deviceId: string) => {
    if (kind === "audiooutput") void room.switchActiveDevice(kind, deviceId).catch(() => undefined);
  };
  outputRoom?.on(RoomEvent.ActiveDeviceChanged, outputChanged);
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) if (publication.track) attach(publication.track);
  }
  return () => {
    room.off(RoomEvent.TrackSubscribed, attach);
    room.off(RoomEvent.TrackUnsubscribed, remove);
    outputRoom?.off(RoomEvent.ActiveDeviceChanged, outputChanged);
    for (const track of elements.keys()) remove(track);
  };
}
