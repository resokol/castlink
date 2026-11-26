import { Room, RoomEvent, TrackEvent, type RemoteTrackPublication } from "livekit-client";

// The SDK's videoQuality getter defaults to HIGH even when it signals dimensions.
const previewRequests = new WeakMap<RemoteTrackPublication, number>();

export function studioPreviewShortSide(publication: RemoteTrackPublication) {
  return previewRequests.get(publication);
}

export function createStudioPreviewRoom() {
  const room = new Room({
    adaptiveStream: { pixelDensity: "screen", pauseVideoInBackground: false },
    dynacast: false,
  });
  room.on(RoomEvent.TrackSubscribed, (track, publication) => {
    if (track.kind !== "video") return;
    previewRequests.delete(publication);
    const onSettings = (settings: { disabled: boolean; width: number; height: number }) => {
      if (publication.track !== track) return;
      previewRequests.set(publication, settings.disabled ? 0 : Math.min(settings.width, settings.height));
    };
    publication.on(TrackEvent.UpdateSettings, onSettings);
    const detach = (removed: typeof track) => {
      if (removed !== track) return;
      publication.off(TrackEvent.UpdateSettings, onSettings);
      publication.off(TrackEvent.Unsubscribed, detach);
      previewRequests.delete(publication);
    };
    publication.on(TrackEvent.Unsubscribed, detach);
  });
  return room;
}
