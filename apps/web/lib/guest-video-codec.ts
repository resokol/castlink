import { Track, type LocalVideoTrack, type Room, type TrackPublishOptions, type VideoCaptureOptions } from "livekit-client";
import type { GuestChoices } from "./guest-media";
import { guestVideoBitrate, isStudioVideoCodec, STUDIO_VIDEO_CODECS, type StudioVideoCodec } from "./video-quality";

const tasks = new WeakMap<Room, Promise<unknown>>();
export function enqueueGuestCameraTask<T>(room: Room, task: () => Promise<T>): Promise<T> {
  const next = (tasks.get(room) || Promise.resolve()).catch(() => undefined).then(task);
  tasks.set(room, next); return next;
}
export const guestVideoCodec = (value: unknown): StudioVideoCodec => isStudioVideoCodec(value) ? value : "vp8";
export function supportedGuestVideoCodecs(): StudioVideoCodec[] {
  const capabilities = typeof RTCRtpSender !== "undefined" ? RTCRtpSender.getCapabilities?.("video") : undefined;
  return STUDIO_VIDEO_CODECS.filter(codec => capabilities?.codecs.some(value => value.mimeType.toLowerCase() === `video/${codec}`));
}
function assertSupported(codec: StudioVideoCodec) {
  if (!supportedGuestVideoCodecs().includes(codec)) throw new Error(`Кодек ${codec.toUpperCase()} не поддерживается браузером гостя.`);
}
function assertPublished(track: LocalVideoTrack | undefined, codec: StudioVideoCodec) {
  if (track?.codec !== codec) throw new Error(`Не удалось согласовать кодек ${codec.toUpperCase()} с сервером для камеры гостя.`);
}
export function guestCameraPublishOptions(room: Room, codec: StudioVideoCodec, prior: TrackPublishOptions = {}): TrackPublishOptions {
  return { ...prior, source: Track.Source.Camera, videoCodec: codec, simulcast: codec !== "av1",
    // Clear former AV1 options when returning to an ordinary simulcast codec.
    scalabilityMode: codec === "av1" ? "L3T3_KEY" : undefined, backupCodec: codec === "av1" ? false : undefined,
    videoEncoding: { ...prior.videoEncoding, maxBitrate: guestVideoBitrate(room.localParticipant.metadata) * 1000, maxFramerate: 30 } };
}

/** Change only publication encoding; keep the exact camera capture and mute state. */
export function switchGuestCameraCodec(room: Room, codec: StudioVideoCodec, isCurrent: () => boolean): Promise<boolean> {
  return enqueueGuestCameraTask(room, async () => {
    if (!isCurrent() || room.state !== "connected") return false;
    assertSupported(codec);
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const participantSid = room.localParticipant.sid;
    const track = publication?.track as LocalVideoTrack | undefined;
    if (!track || track.codec === codec) return true;
    const prior = { ...publication!.options, videoCodec: guestVideoCodec(track.codec) };
    const currentTrack = () => room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    const valid = () => isCurrent() && room.state === "connected" && room.localParticipant.sid === participantSid;
    const cleanup = async () => {
      if (room.localParticipant.sid === participantSid && currentTrack() === track) await room.localParticipant.unpublishTrack(track, false).catch(() => undefined);
      if (currentTrack() !== track) track.stop();
    };
    try {
      await room.localParticipant.unpublishTrack(track, false);
      if (!valid()) { if (currentTrack() !== track) track.stop(); return false; }
      await room.localParticipant.publishTrack(track, guestCameraPublishOptions(room, codec, prior));
      if (!valid()) throw new Error("Смена кодека отменена из-за переподключения");
      assertPublished(track, codec);
      return true;
    } catch (cause) {
      // Full reconnect may restore this same SDK track under a new SID. The old
      // command owns only the original publication, never that restored camera.
      if (room.localParticipant.sid !== participantSid) { if (currentTrack() !== track) track.stop(); throw cause; }
      if (room.localParticipant.getTrackPublication(Track.Source.Camera)?.track === track) await room.localParticipant.unpublishTrack(track, false).catch(() => undefined);
      if (valid()) {
        try { await room.localParticipant.publishTrack(track, prior); if (!valid()) await cleanup(); else assertPublished(track, guestVideoCodec(prior.videoCodec)); }
        catch { await cleanup(); }
      } else if (currentTrack() !== track) track.stop();
      throw cause;
    }
  });
}

/** Toolbar, studio enable and reconnect use the same serialized selected codec. */
export function setGuestCameraEnabled(room: Room, enabled: boolean, choices: () => GuestChoices, isCurrent: () => boolean): Promise<boolean> {
  return enqueueGuestCameraTask(room, async () => {
    if (!isCurrent() || room.state !== "connected") return false;
    const current = choices(), codec = guestVideoCodec(current.videoCodec);
    const participantSid = room.localParticipant.sid;
    const valid = () => isCurrent() && room.state === "connected" && room.localParticipant.sid === participantSid;
    if (enabled && codec !== "vp8") assertSupported(codec);
    const base: MediaTrackConstraints = { height: { ideal: current.height }, frameRate: { ideal: 30 } };
    // LiveKit forwards the flattened resolution to getUserMedia. Supplying a
    // height-only object also overrides its default 16:9 capture preset.
    const capture = { ...(current.videoDeviceId ? { deviceId: current.videoDeviceId } : {}), resolution: { ...base, resizeMode: { ideal: "none" } } } as unknown as VideoCaptureOptions;
    const publication = await room.localParticipant.setCameraEnabled(enabled, enabled ? capture : undefined, enabled ? guestCameraPublishOptions(room, codec) : undefined);
    const track = publication?.track as LocalVideoTrack | undefined;
    if (!valid()) {
      if (track && room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track) track.stop();
      return false;
    }
    if (enabled) {
      try {
        if (track) {
          try { await track.mediaStreamTrack.applyConstraints({ ...base, resizeMode: { ideal: "none" } } as MediaTrackConstraints); }
          catch { await track.mediaStreamTrack.applyConstraints(base); }
        }
        if (!valid()) return false;
        assertPublished(track, codec);
      }
      catch (cause) {
        if (track) {
          if (room.localParticipant.sid === participantSid && room.localParticipant.getTrackPublication(Track.Source.Camera)?.track === track) await room.localParticipant.unpublishTrack(track, false).catch(() => undefined);
          if (room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track) track.stop();
        }
        throw cause;
      }
    }
    return true;
  });
}

export function guestCameraCodecState(room: Room, choices: GuestChoices | undefined) {
  const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  const videoEnabled = room.state === "connected" && room.localParticipant.isCameraEnabled;
  return { videoCodec: guestVideoCodec(choices?.videoCodec), videoEnabled, supportedVideoCodecs: supportedGuestVideoCodecs(),
    ...(videoEnabled && isStudioVideoCodec(track?.codec) ? { actualVideoCodec: track.codec } : {}) };
}
