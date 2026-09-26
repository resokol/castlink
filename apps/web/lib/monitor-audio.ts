import { TrackEvent, type RemoteAudioTrack } from "livekit-client";

/** Reapply local volume whenever the SDK attaches a replacement audio element. */
export function bindMonitorAudio(track: RemoteAudioTrack, volume: () => number) {
  let active = true;
  const apply = () => { if (active) track.setVolume(volume()); };
  const attached = () => {
    apply();
    // RemoteAudioTrack creates its WebAudio gain after ElementAttached is emitted.
    // Its zero-volume truthiness check also skips restoring a saved mute.
    queueMicrotask(apply);
  };
  track.on(TrackEvent.ElementAttached, attached);
  track.on(TrackEvent.AudioPlaybackStarted, apply);
  apply();
  return () => {
    active = false;
    track.off(TrackEvent.ElementAttached, attached);
    track.off(TrackEvent.AudioPlaybackStarted, apply);
  };
}
