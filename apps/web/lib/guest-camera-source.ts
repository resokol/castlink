import type { LocalVideoTrack } from "livekit-client";

const sources = new WeakMap<LocalVideoTrack, MediaStreamTrack>();

/** Processors remember their physical input because mediaStreamTrack exposes processed output. */
export function rememberGuestCameraSource(track: LocalVideoTrack, source: MediaStreamTrack) {
  sources.set(track, source);
}

export function forgetGuestCameraSource(track: LocalVideoTrack) {
  sources.delete(track);
}

export function guestCameraSource(track: LocalVideoTrack): MediaStreamTrack {
  return sources.get(track) ?? track.mediaStreamTrack;
}
