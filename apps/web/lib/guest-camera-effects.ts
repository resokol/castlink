import { RoomEvent, Track, type LocalVideoTrack, type Room } from "livekit-client";
import type { BackgroundProcessorWrapper } from "@livekit/track-processors";
import { enqueueGuestCameraTask } from "./guest-video-codec";
import { forgetGuestCameraSource, guestCameraSource, rememberGuestCameraSource } from "./guest-camera-source";

export type CameraEffect = { mode: "none" } | { mode: "blur"; blurRadius?: number } | { mode: "image"; url: string };

export function cameraBlurRadius(value?: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value!))) : 10;
}

const unsupported = "Этот браузер не поддерживает эффекты фона камеры.";
const failed = "Не удалось применить эффект фона камеры. Попробуйте отключить эффект или выбрать другое изображение.";
const pacedSegmenters = new WeakSet<object>();

/** Pinned track-processors 0.8.2 retains its WebGL mask when a result has no mask.
 * Budget only synchronous inference, keeping every frame on the compositor path.
 * maxFps in the upstream wrapper bounds only its canvas fallback, not inference.
 */
function paceSegmentation(processor: BackgroundProcessorWrapper) {
  const segmenter = processor.transformer.imageSegmenter;
  if (!segmenter || pacedSegmenters.has(segmenter)) return;
  pacedSegmenters.add(segmenter);
  const segmentForVideo = segmenter.segmentForVideo.bind(segmenter);
  let nextDue = 0;
  segmenter.segmentForVideo = ((...args: unknown[]) => {
    const callback = args.find(value => typeof value === "function");
    // Preserve the other public overloads; our pinned transformer uses a callback.
    if (typeof callback !== "function") return Reflect.apply(segmentForVideo, segmenter, args);
    const started = performance.now();
    if (started < nextDue) {
      callback({ close() {} });
      return;
    }
    try { return Reflect.apply(segmentForVideo, segmenter, args); }
    finally {
      const finished = performance.now();
      // Refresh at most 24 times/s. Slow inference gets an equal idle budget so
      // remote decoding and controls can run; contour freshness yields to load.
      nextDue = Math.max(started + 1000 / 24, finished + (finished - started));
    }
  }) as typeof segmenter.segmentForVideo;
}

/** Camera-only effects. Never starts capture; selection survives mute and republish within this watcher. */
export function watchGuestCameraEffects(room: Room, onError: (message: string) => void): {
  setEffect(effect: CameraEffect): Promise<void>;
  stop(): void;
} {
  let stopped = false;
  let generation = 0;
  let selected: CameraEffect = { mode: "none" };
  const owned = new Map<LocalVideoTrack, BackgroundProcessorWrapper>();
  const applied = new Map<LocalVideoTrack, CameraEffect>();
  const camera = () => room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;

  async function preserveCapture(track: LocalVideoTrack, processors: BackgroundProcessorWrapper[], update: () => Promise<void>) {
    const source = guestCameraSource(track);
    const constraints = source.getConstraints();
    const sid = room.localParticipant.sid;
    try { await update(); } finally {
      const processor = track.getProcessor();
      // LiveKit teardown restores its startup constraints, which can predate staff
      // capture changes. Restore only this same live source while we still own it.
      if (room.localParticipant.sid === sid && guestCameraSource(track) === source && source.readyState !== "ended" &&
          (processor ? processors.some(ownedProcessor => ownedProcessor === processor) : track.mediaStreamTrack === source) &&
          JSON.stringify(source.getConstraints()) !== JSON.stringify(constraints)) {
        await source.applyConstraints(constraints);
      }
    }
  }

  async function release(track: LocalVideoTrack) {
    const processor = owned.get(track);
    if (!processor) return;
    // A later owner may have replaced our processor. Never stop their processor or capture.
    if (track.getProcessor() === processor) {
      try { await preserveCapture(track, [processor], () => track.stopProcessor()); } finally {
        // SDK teardown can clear the processor before restoring capture constraints throws.
        if (!track.getProcessor()) {
          forgetGuestCameraSource(track);
          owned.delete(track);
          applied.delete(track);
        }
      }
    }
    else await processor.destroy();
    owned.delete(track);
    applied.delete(track);
  }

  async function apply(effect: CameraEffect, revision: number, rollback = true) {
    const sid = room.localParticipant.sid;
    const track = camera();
    const current = () => !stopped && generation === revision && room.localParticipant.sid === sid;
    const usable = () => current() && room.state === "connected" && camera() === track && room.localParticipant.isCameraEnabled && !track?.isMuted;
    if (!current()) return;
    for (const old of owned.keys()) {
      if (old !== track || effect.mode === "none" || !usable()) await release(old);
    }
    if (!current() || effect.mode === "none") return;
    if (track && owned.get(track) === track.getProcessor() && applied.has(track) && JSON.stringify(applied.get(track)) === JSON.stringify(effect) && usable()) return;
    const { BackgroundProcessor, supportsBackgroundProcessors } = await import("@livekit/track-processors");
    if (!current()) return;
    if (!supportsBackgroundProcessors()) throw new Error(unsupported);
    // Image loading failures are swallowed by the upstream initializer. Validate first.
    if (effect.mode === "image") {
      if (!effect.url) throw new Error(failed);
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = effect.url;
      await image.decode();
    }
    if (!usable() || !track) return;
    const existing = track.getProcessor();
    if (existing && existing !== owned.get(track)) throw new Error("Камера уже использует другой обработчик видео.");
    // A strength adjustment changes only the shader uniform. Keep the expensive
    // segmenter, processed sender track and preview attached throughout a drag.
    if (existing && effect.mode === "blur" && applied.get(track)?.mode === "blur") {
      await (existing as BackgroundProcessorWrapper).switchTo({ mode: "background-blur", blurRadius: cameraBlurRadius(effect.blurRadius) });
      applied.set(track, effect);
      return;
    }
    const source = guestCameraSource(track);
    const sourceFps = Math.max(source.getSettings?.().frameRate || 0, source.getCapabilities?.().frameRate?.max || 0);
    // A capability ceiling also accommodates later staff FPS changes on this
    // same source. The fallback samples new videoTime only; inference is separate.
    const fallbackMaxFps = Number.isFinite(sourceFps) && sourceFps <= 1000 ? Math.max(60, sourceFps) : 60;
    const processor = BackgroundProcessor({
      ...(effect.mode === "blur" ? { mode: "background-blur" as const, blurRadius: cameraBlurRadius(effect.blurRadius) } : { mode: "virtual-background" as const, imagePath: effect.url }),
      assetPaths: { tasksVisionFileSet: "/camera-effects/wasm", modelAssetPath: "/camera-effects/selfie_segmenter.tflite" },
      segmenterOptions: { delegate: "GPU" }, maxFps: fallbackMaxFps,
    });
    const previous = owned.get(track);
    const previousEffect = applied.get(track);
    const init = processor.init.bind(processor);
    const restart = processor.restart.bind(processor);
    processor.init = async options => {
      await init(options);
      paceSegmentation(processor);
      rememberGuestCameraSource(track, options.track);
    };
    processor.restart = async options => {
      await restart(options);
      paceSegmentation(processor);
      rememberGuestCameraSource(track, options.track);
    };
    try {
      // LiveKit replaces the sender track AND attached preview elements.
      await preserveCapture(track, previous ? [previous, processor] : [processor], () => track.setProcessor(processor, true));
      owned.set(track, processor);
      applied.set(track, effect);
      if (!usable()) await release(track);
    } catch (error) {
      if (track.getProcessor() === processor) {
        owned.set(track, processor);
        await release(track);
      } else {
        await processor.destroy();
        if (previous && track.getProcessor() !== previous) {
          owned.delete(track);
          applied.delete(track);
        }
        if (!track.getProcessor()) forgetGuestCameraSource(track);
      }
      if (rollback && previousEffect && usable() && !track.getProcessor()) {
        try { await apply(previousEffect, revision, false); } catch {
          // Report the original failure; a failed restore leaves the original capture intact.
        }
      }
      throw error;
    }
  }

  function schedule() {
    if (stopped) return;
    const revision = generation;
    void enqueueGuestCameraTask(room, () => apply(selected, revision)).catch(() => {
      if (!stopped && revision === generation) onError(failed);
    });
  }
  const cameraEvent = (publication: { source: Track.Source }, participant?: unknown) => {
    if (publication.source === Track.Source.Camera && (!participant || participant === room.localParticipant)) schedule();
  };
  room.on(RoomEvent.LocalTrackPublished, cameraEvent);
  room.on(RoomEvent.LocalTrackUnpublished, cameraEvent);
  room.on(RoomEvent.TrackMuted, cameraEvent);
  room.on(RoomEvent.TrackUnmuted, cameraEvent);
  room.on(RoomEvent.Reconnected, schedule);
  room.on(RoomEvent.Disconnected, schedule);

  return {
    async setEffect(effect) {
      if (stopped) return;
      const revision = ++generation;
      const next = { ...effect };
      try {
        await enqueueGuestCameraTask(room, () => apply(next, revision));
        if (!stopped && revision === generation) selected = next;
      } catch (error) {
        if (!stopped && revision === generation) {
          throw new Error(error instanceof Error && [unsupported, "Камера уже использует другой обработчик видео."].includes(error.message) ? error.message : failed);
        }
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      ++generation;
      room.off(RoomEvent.LocalTrackPublished, cameraEvent);
      room.off(RoomEvent.LocalTrackUnpublished, cameraEvent);
      room.off(RoomEvent.TrackMuted, cameraEvent);
      room.off(RoomEvent.TrackUnmuted, cameraEvent);
      room.off(RoomEvent.Reconnected, schedule);
      room.off(RoomEvent.Disconnected, schedule);
      void enqueueGuestCameraTask(room, async () => {
        for (const track of owned.keys()) await release(track);
      }).catch(() => undefined);
    },
  };
}
