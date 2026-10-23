import { guestCameraSource } from "./guest-camera-source";
import { RoomEvent, Track, type LocalVideoTrack, type Room, type TrackPublishOptions, type VideoCaptureOptions } from "livekit-client";
import { applyGuestCaptureConstraints, guestCameraConstraints, parseActualCameraCapture, staffGuestCameraCapture, type GuestCameraCapture } from "./guest-capture-settings";
import type { GuestChoices } from "./guest-media";
import { defaultGuestVideoCodec, guestVideoBitrate, isStudioVideoCodec, STUDIO_VIDEO_CODECS, type StudioVideoCodec } from "./video-quality";

const tasks = new WeakMap<Room, Promise<unknown>>();
export function enqueueGuestCameraTask<T>(room: Room, task: () => Promise<T>): Promise<T> {
  const next = (tasks.get(room) || Promise.resolve()).catch(() => undefined).then(task);
  tasks.set(room, next); return next;
}
export const guestVideoCodec = (value: unknown): StudioVideoCodec => isStudioVideoCodec(value) ? value : defaultGuestVideoCodec();
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
    videoEncoding: { ...prior.videoEncoding, maxBitrate: guestVideoBitrate(room.localParticipant.metadata) * 1000, maxFramerate: prior.videoEncoding?.maxFramerate || 30 } };
}

async function applyGuestCameraHeightNow(room: Room, participantSid: string, isCurrent: () => boolean): Promise<boolean> {
  const participant = room.localParticipant;
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const track = publication?.track as LocalVideoTrack | undefined;
  const intent = JSON.stringify(staffGuestCameraCapture(participant.metadata));
  const valid = () => isCurrent() && room.state === "connected" && participant.sid === participantSid && participant.getTrackPublication(Track.Source.Camera)?.track === track && JSON.stringify(staffGuestCameraCapture(participant.metadata)) === intent;
  if (!valid() || !participant.isCameraEnabled || !track) return false;
  await applyGuestCaptureConstraints(guestCameraSource(track), staffGuestCameraCapture(participant.metadata), valid);
  return valid();
}

/** Apply inside an existing guest-camera task. */
export function applyGuestCameraHeightInTask(room: Room, isCurrent: () => boolean): Promise<boolean> {
  return applyGuestCameraHeightNow(room, room.localParticipant.sid, isCurrent);
}

/** Apply the current staff-selected capture height without changing camera or audio enable state. */
export function applyGuestCameraHeight(room: Room, isCurrent: () => boolean): Promise<boolean> {
  const participantSid = room.localParticipant.sid;
  return enqueueGuestCameraTask(room, () => applyGuestCameraHeightNow(room, participantSid, isCurrent));
}

/** Follow staff metadata through reconnects and reconfigure only an active local camera. */
export function watchGuestCameraHeight(room: Room, isCurrent: () => boolean, onError: (error: unknown) => void): () => void {
  let active = true;
  const apply = () => {
    const participantSid = room.localParticipant.sid;
    void enqueueGuestCameraTask(room, () => applyGuestCameraHeightNow(room, participantSid, () => active && isCurrent()))
      .catch(error => { if (active && isCurrent()) onError(error); });
  };
  const metadataChanged = (_metadata: string | undefined, participant: unknown) => {
    if (participant === room.localParticipant) apply();
  };
  room.on(RoomEvent.ParticipantMetadataChanged, metadataChanged);
  room.on(RoomEvent.Reconnected, apply);
  apply();
  return () => { active = false; room.off(RoomEvent.ParticipantMetadataChanged, metadataChanged); room.off(RoomEvent.Reconnected, apply); };
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
    const base = guestCameraConstraints(staffGuestCameraCapture(room.localParticipant.metadata));
    // LiveKit forwards the flattened resolution to getUserMedia. Supplying a
    // height-only object also overrides its default 16:9 capture preset.
    const capture = { ...(current.videoDeviceId ? { deviceId: current.videoDeviceId } : {}), resolution: base } as unknown as VideoCaptureOptions;
    const publication = await room.localParticipant.setCameraEnabled(enabled, enabled ? capture : undefined, enabled ? guestCameraPublishOptions(room, codec) : undefined);
    const track = publication?.track as LocalVideoTrack | undefined;
    if (!valid()) {
      if (track && room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track) track.stop();
      return false;
    }
    if (enabled) {
      try {
        if (track) {
          await applyGuestCaptureConstraints(guestCameraSource(track), staffGuestCameraCapture(room.localParticipant.metadata), valid);
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

/** Only capture constraints change; camera publication, microphone and screen stay intact. */
export function switchGuestCameraCapture(room: Room, cameraCapture: GuestCameraCapture, isCurrent: () => boolean): Promise<boolean> {
  const sid = room.localParticipant.sid;
  return enqueueGuestCameraTask(room, async () => {
    const selected = staffGuestCameraCapture(room.localParticipant.metadata).cameraCapture;
    if (!selected || JSON.stringify(selected) !== JSON.stringify(cameraCapture)) return false;
    const publicationTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    const track = publicationTrack ? guestCameraSource(publicationTrack) : undefined;
    const valid = () => isCurrent() && room.state === "connected" && room.localParticipant.sid === sid && JSON.stringify(staffGuestCameraCapture(room.localParticipant.metadata).cameraCapture) === JSON.stringify(selected) && (room.localParticipant.getTrackPublication(Track.Source.Camera)?.track === publicationTrack && (!publicationTrack || guestCameraSource(publicationTrack) === track));
    if (!valid()) return false;
    if (!room.localParticipant.isCameraEnabled || !track) return true;
    if (typeof track.applyConstraints !== "function") throw new Error("Браузер гостя не поддерживает настройки захвата камеры");
    const prior = track.getConstraints();
    try {
      await applyGuestCaptureConstraints(track, { cameraCapture }, valid);
      if (!valid()) return false;
      if (!parseActualCameraCapture(track.getSettings())) throw new Error("Браузер не подтвердил фактические параметры камеры");
      return true;
    } catch (cause) {
      if (valid()) await track.applyConstraints(prior).catch(() => undefined);
      throw cause;
    }
  });
}
export function guestCameraCaptureState(room: Room, _choices?: Pick<GuestChoices, "cameraCapture">) {
  const choices = staffGuestCameraCapture(room.localParticipant.metadata);
  const publicationTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  const track = publicationTrack ? guestCameraSource(publicationTrack) : undefined;
  const actual = room.localParticipant.isCameraEnabled && room.state === "connected" && track ? parseActualCameraCapture(track.getSettings()) : undefined;
  const supported = typeof MediaStreamTrack !== "undefined" && typeof MediaStreamTrack.prototype.applyConstraints === "function";
  return { ...(choices?.cameraCapture ? { cameraCapture: choices.cameraCapture } : {}), cameraCaptureSupported: supported, ...(actual ? { actualCameraCapture: actual } : {}) };
}
