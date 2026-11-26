import { Room, RoomEvent, TrackEvent, type RemoteTrackPublication, type RoomOptions } from "livekit-client";

// The SDK's videoQuality getter defaults to HIGH even when it signals dimensions.
const previewRequests = new WeakMap<RemoteTrackPublication, number>();

export function previewShortSide(publication: RemoteTrackPublication) {
  return previewRequests.get(publication);
}

export function createAdaptivePreviewRoom(options: Partial<RoomOptions> = {}) {
  const room = new Room({
    dynacast: false,
    ...options,
    adaptiveStream: { pixelDensity: "screen", pauseVideoInBackground: false },
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
