import type { RemoteTrack } from "livekit-client";
import type { AudioPlaybackDiagnostic } from "./telemetry-types";

export type OutputAudioPlaybackState = "idle" | "playing" | "blocked" | "failed";
type Binding = { track: RemoteTrack; element: HTMLMediaElement; container: HTMLElement; attempts: number; failure?: OutputAudioPlaybackState; playback?: Promise<OutputAudioPlaybackState>; cancelPlayback?: () => void };

/** Own only this output's elements. Repeated SDK events must not restart its decoder. */
export function createOutputTrackBindings(video: () => HTMLElement | null, audio: () => HTMLElement | null) {
  const bindings = new Map<string, Binding>();
  // Session counters outlive track replacement/reconnection. Retry budgets do not.
  let recoveryAttempts = 0;
  let lastRecoveryAt: number | null = null;
  let lastRecoveryReason: string | null = null;
  const release = (kind: string) => {
    const binding = bindings.get(kind);
    if (!binding) return;
    bindings.delete(kind);
    binding.cancelPlayback?.();
    try { binding.track.detach(binding.element); } catch { /* Still remove our element. */ }
    binding.element.srcObject = null;
    binding.element.remove();
  };
  return {
    inspectAudio(): AudioPlaybackDiagnostic {
      const binding = bindings.get("audio");
      const element = binding?.element;
      const state = binding?.track.mediaStreamTrack?.readyState;
      return {
        enabled: true,
        subscribed: !!(binding && element?.srcObject),
        trackState: state === "live" || state === "ended" ? state : null,
        paused: element?.paused ?? null,
        muted: element?.muted ?? null,
        readyState: element?.readyState ?? null,
        currentTime: element && Number.isFinite(element.currentTime) ? element.currentTime : null,
        errorCode: element?.error?.code ?? null,
        recoveryAttempts, lastRecoveryAt, lastRecoveryReason,
      };
    },
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
      bindings.set(track.kind, { track, element, container, attempts: 0 });
      return true;
    },
    resumeAudio(reset = false, reason: "paused" | "manual" | "room-reconnected" = "paused"): Promise<OutputAudioPlaybackState> {
      const binding = bindings.get("audio");
      if (!binding || !binding.element.srcObject) return Promise.resolve("idle");
      if (!binding.element.paused) {
        binding.attempts = 0;
        binding.failure = undefined;
        return Promise.resolve("playing");
      }
      if (binding.playback) return binding.playback;
      if (reset) binding.attempts = 0;
      if (binding.attempts >= 3) return Promise.resolve(binding.failure || "failed");
      binding.attempts++;
      const current = () => bindings.get("audio") === binding && binding.element.parentElement === binding.container;
      binding.playback = Promise.resolve().then(async (): Promise<OutputAudioPlaybackState> => {
        if (!current()) return "idle";
        recoveryAttempts++;
        lastRecoveryAt = Date.now();
        lastRecoveryReason = reason;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        try {
          await Promise.race([
            binding.element.play(),
            new Promise<void>((resolve, reject) => {
              binding.cancelPlayback = resolve;
              deadline = setTimeout(() => { timedOut = true; reject(new Error("Audio playback timed out")); }, 1500);
            }),
          ]);
          if (!current()) return "idle";
          if (binding.element.paused) { lastRecoveryReason = "play-error"; return binding.failure = "failed"; }
          binding.attempts = 0;
          binding.failure = undefined;
          return "playing";
        } catch (error) {
          if (!current()) return "idle";
          const blocked = error instanceof Error && error.name === "NotAllowedError";
          lastRecoveryReason = blocked ? "autoplay-blocked" : timedOut ? "play-timeout" : "play-error";
          return binding.failure = blocked ? "blocked" : "failed";
        } finally {
          if (deadline !== undefined) clearTimeout(deadline);
          binding.cancelPlayback = undefined;
        }
      }).finally(() => { binding.playback = undefined; });
      return binding.playback;
    },
    detach(track: RemoteTrack) {
      // An old unsubscribe can arrive after replacement: never remove the new feed.
      if (bindings.get(track.kind)?.track === track) release(track.kind);
    },
    clear() { for (const kind of [...bindings.keys()]) release(kind); },
  };
}
