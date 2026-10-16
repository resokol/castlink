import { RoomEvent, Track, type LocalVideoTrack, type Room } from 'livekit-client';
import { CameraTransformProcessor } from './camera-transform-processor';
import { DEFAULT_CAMERA_TRANSFORM, identityCameraTransform, type CameraTransform } from './camera-transform';
import { enqueueGuestCameraTask } from './guest-video-codec';
export const cameraTransformSupported = () => typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
export function createGuestCameraTransforms(room: Room, onError: (message: string) => void) {
  let selected = { ...DEFAULT_CAMERA_TRANSFORM }, stopped = false;
  const owned = new Set<LocalVideoTrack>();
  const camera = () => room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  const applyTrack = async (track: LocalVideoTrack, transform: CameraTransform) => {
    const processor = track.getProcessor();
    if (identityCameraTransform(transform)) {
      if (processor instanceof CameraTransformProcessor) { await track.stopProcessor(); owned.delete(track); }
    } else if (processor instanceof CameraTransformProcessor) { processor.transform = { ...transform }; await processor.resume(); }
    else {
      if (processor) throw new Error('Камера уже использует другую обработку');
      await track.setProcessor(new CameraTransformProcessor({ ...transform }), true); owned.add(track);
    }
  };
  const reapply = () => { void enqueueGuestCameraTask(room, async () => {
    const track = camera();
    if (stopped || room.state !== 'connected' || !track || !room.localParticipant.isCameraEnabled || identityCameraTransform(selected)) return;
    await applyTrack(track, selected);
  }).catch(error => { if (!stopped) onError(error instanceof Error ? error.message : 'Не удалось изменить изображение камеры'); }); };
  const suspend = () => { if (!room.localParticipant.isCameraEnabled) { const processor = camera()?.getProcessor(); if (processor instanceof CameraTransformProcessor) processor.suspend(); } };
  room.on(RoomEvent.TrackMuted, suspend);
  room.on(RoomEvent.LocalTrackPublished, reapply).on(RoomEvent.TrackUnmuted, reapply).on(RoomEvent.Reconnected, reapply);
  return {
    state: () => ({ cameraTransformSupported: cameraTransformSupported(), cameraTransform: room.localParticipant.isCameraEnabled ? camera()?.getProcessor() instanceof CameraTransformProcessor ? { ...(camera()!.getProcessor() as CameraTransformProcessor).transform } : { ...DEFAULT_CAMERA_TRANSFORM } : { ...selected } }),
    apply: (transform: CameraTransform, current: () => boolean): Promise<'applied' | 'saved'> => enqueueGuestCameraTask(room, async () => {
      if (stopped || !current() || room.state !== 'connected') throw new Error('Запрос устройства уже устарел');
      if (!cameraTransformSupported()) throw new Error('Браузер не поддерживает обработку камеры');
      const previous = selected, track = camera();
      if (!track || !room.localParticipant.isCameraEnabled) { selected = { ...transform }; return 'saved'; }
      try {
        await applyTrack(track, transform);
        if (stopped || !current() || camera() !== track) throw new Error('Запрос устройства уже устарел');
        selected = { ...transform }; return 'applied';
      } catch (error) { if (camera() === track) await applyTrack(track, previous); throw error; }
    }),
    stop: () => {
      stopped = true;
      room.off(RoomEvent.TrackMuted, suspend);
      room.off(RoomEvent.LocalTrackPublished, reapply).off(RoomEvent.TrackUnmuted, reapply).off(RoomEvent.Reconnected, reapply);
      void enqueueGuestCameraTask(room, async () => { for (const track of owned) { if (track.getProcessor() instanceof CameraTransformProcessor) await track.stopProcessor().catch(() => undefined); } owned.clear(); });
    },
  };
}
