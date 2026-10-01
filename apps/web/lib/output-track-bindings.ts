import type { RemoteTrack } from "livekit-client";

type Binding = { track: RemoteTrack; element: HTMLMediaElement; container: HTMLElement };

/** Own only this output's elements. Repeated SDK events must not restart its decoder. */
export function createOutputTrackBindings(video: () => HTMLElement | null, audio: () => HTMLElement | null) {
  const bindings = new Map<string, Binding>();
  const release = (kind: string) => {
    const binding = bindings.get(kind);
    if (!binding) return;
    bindings.delete(kind);
    try { binding.track.detach(binding.element); } catch { /* Still remove our element. */ }
    binding.element.srcObject = null;
    binding.element.remove();
  };
  return {
    attach(track: RemoteTrack) {
      const container = track.kind === "video" ? video() : track.kind === "audio" ? audio() : null;
      if (!container) return false;
      const current = bindings.get(track.kind);
      if (current?.track === track && current.container === container && current.element.parentElement === container && current.element.srcObject) return false;
      release(track.kind);
      const element = track.attach();
      element.autoplay = true;
      if (track.kind === "video") { element.muted = true; (element as HTMLVideoElement).playsInline = true; }
      container.replaceChildren(element);
      bindings.set(track.kind, { track, element, container });
      return true;
    },
    detach(track: RemoteTrack) {
      // An old unsubscribe can arrive after replacement: never remove the new feed.
      if (bindings.get(track.kind)?.track === track) release(track.kind);
    },
    clear() { for (const kind of [...bindings.keys()]) release(kind); },
  };
}
