import { RoomEvent, Track, type LocalVideoTrack, type Room } from "livekit-client";
import type { BackgroundProcessorWrapper } from "@livekit/track-processors";
import { enqueueGuestCameraTask } from "./guest-video-codec";
import { forgetGuestCameraSource, rememberGuestCameraSource } from "./guest-camera-source";

export type CameraEffect = { mode: "none" } | { mode: "blur" } | { mode: "image"; url: string };

const unsupported = "Этот браузер не поддерживает эффекты фона камеры.";
const failed = "Не удалось применить эффект фона камеры. Попробуйте отключить эффект или выбрать другое изображение.";

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

  async function release(track: LocalVideoTrack) {
    const processor = owned.get(track);
    if (!processor) return;
    // A later owner may have replaced our processor. Never stop their processor or capture.
    if (track.getProcessor() === processor) {
      try { await track.stopProcessor(); } finally {
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
    const processor = BackgroundProcessor({
      ...(effect.mode === "blur" ? { mode: "background-blur" as const, blurRadius: 10 } : { mode: "virtual-background" as const, imagePath: effect.url }),
      assetPaths: { tasksVisionFileSet: "/camera-effects/wasm", modelAssetPath: "/camera-effects/selfie_segmenter.tflite" },
      // GPU segmentation; maxFps bounds the canvas fallback without changing camera constraints.
      segmenterOptions: { delegate: "GPU" }, maxFps: 24,
    });
    const previous = owned.get(track);
    const previousEffect = applied.get(track);
    const init = processor.init.bind(processor);
    const restart = processor.restart.bind(processor);
    processor.init = async options => {
      await init(options);
      rememberGuestCameraSource(track, options.track);
    };
    processor.restart = async options => {
      await restart(options);
      rememberGuestCameraSource(track, options.track);
    };
    try {
      // LiveKit replaces the sender track AND attached preview elements.
      await track.setProcessor(processor, true);
      owned.set(track, processor);
      applied.set(track, effect);
      if (!usable()) await release(track);
    } catch (error) {
      if (track.getProcessor() === processor) {
        owned.set(track, processor);
        await release(track);
      } else {
        await processor.destroy();
        if (previous && track.getProcessor() !== previous) owned.delete(track);
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
