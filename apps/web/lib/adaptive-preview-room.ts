import { Room, RoomEvent, TrackEvent, type RemoteTrackPublication, type RoomOptions, type TrackPublication } from "livekit-client";

// The SDK's videoQuality getter defaults to HIGH even when it signals dimensions.
const previewRequests = new WeakMap<RemoteTrackPublication, number>();

export function previewShortSide(publication: RemoteTrackPublication) {
  return previewRequests.get(publication);
}

/** Supply a size hint for the main tile. Only actual video elements determine visibility. */
export function preferSourceResolution(publication: TrackPublication) {
  let release: (() => void) | undefined;
  const remove = () => { release?.(); release = undefined; };
  const sync = () => {
    remove();
    const track = publication.videoTrack;
    if (!track || !("isAdaptiveStream" in track) || !track.isAdaptiveStream) return;
    // LiveKit multiplies element measurements by the screen pixel density.
    const density = () => window.devicePixelRatio || 1;
    const hint = {
      element: {}, visible: false, pictureInPicture: false, visibilityChangedAt: undefined,
      width: () => (publication.dimensions?.width || 1920) / density(),
      height: () => (publication.dimensions?.height || 1080) / density(),
      observe() {}, stopObserving() {},
    };
    track.observeElementInfo(hint);
    release = () => track.stopObservingElementInfo(hint);
  };
  sync();
  publication.on(TrackEvent.Subscribed, sync);
  publication.on(TrackEvent.Unsubscribed, remove);
  return () => {
    publication.off(TrackEvent.Subscribed, sync);
    publication.off(TrackEvent.Unsubscribed, remove);
    remove();
  };
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
