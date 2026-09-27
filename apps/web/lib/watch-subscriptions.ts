export type WatchTrackKind = "audio" | "video" | string;

/** Viewer choices are local: they only decide which remote publications this browser subscribes to. */
export function shouldSubscribeToWatchTrack(kind: WatchTrackKind, soundEnabled: boolean, videoEnabled: boolean): boolean {
  if (kind === "audio") return soundEnabled;
  if (kind === "video") return videoEnabled;
  return false;
}

export type PlaybackIntent = { generation: number; enabled: boolean };
export function togglePlaybackIntent(current: PlaybackIntent): PlaybackIntent {
  return { generation: current.generation + 1, enabled: !current.enabled };
}
export function isPlaybackIntentCurrent(current: PlaybackIntent, generation: number, enabled: boolean): boolean {
  return current.generation === generation && current.enabled === enabled;
}
