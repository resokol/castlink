import { guestCameraSource } from "./guest-camera-source";
import { guestCameraConstraints, applyPreferredGuestCameraCapture, effectiveGuestCameraCapture } from "./guest-capture-settings";
import { Track, type LocalAudioTrack, type LocalVideoTrack, type Room, type VideoCaptureOptions } from "livekit-client";
import { enqueueGuestMicrophoneTask, guestAudioCaptureOptions, guestAudioProfile, guestAudioPublishOptions } from "./guest-audio";
import { applyAudioOutput } from "./audio-output";
import type { GuestChoices } from "./guest-media";
import type { GuestDeviceState } from "./guest-device-control";
import { enqueueGuestCameraTask, guestVideoCodec } from "./guest-video-codec";

export function guestOutputSupported() { return typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype.setSinkId === "function"; }
/** enumerateDevices never requests capture permission; unnamed/opaque devices stay private. */
export async function guestDeviceState(room: Room, choices: GuestChoices): Promise<GuestDeviceState> {
  const enumerated = await navigator.mediaDevices?.enumerateDevices() || [];
  const outputSupported = guestOutputSupported();
  const devices = enumerated.filter(device => device.deviceId && device.label && ["audioinput", "videoinput", "audiooutput"].includes(device.kind)).slice(0, 63).map(device => ({ kind: device.kind, deviceId: device.deviceId, label: device.label.slice(0, 256) }));
  if (outputSupported && !devices.some(device => device.kind === "audiooutput" && device.deviceId === "default")) devices.push({ kind: "audiooutput", deviceId: "default", label: "Системный выход звука" });
  const microphone = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  const camera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  return { devices, outputSupported, selected: { audioinput: choices.audioDeviceId || "", videoinput: choices.videoDeviceId || "", audiooutput: choices.audioOutputId || "default" }, actual: { audioinput: microphone?.getSourceTrackSettings().deviceId || "", videoinput: camera?.getSourceTrackSettings().deviceId || "", audiooutput: room.getActiveDevice("audiooutput") || "default" }, microphoneEnabled: room.localParticipant.isMicrophoneEnabled, cameraEnabled: room.localParticipant.isCameraEnabled };
}

/** Detach active capture before replacement; muted/off inputs only save the next device. */
export function switchGuestMicrophoneDevice(room: Room, choices: () => GuestChoices, deviceId: string, isCurrent: () => boolean): Promise<"applied" | "saved"> {
  return enqueueGuestMicrophoneTask(room, async () => {
    const participant = room.localParticipant, currentPublication = () => participant.getTrackPublication(Track.Source.Microphone);
    const participantSid = participant.sid;
    const usable = () => isCurrent() && room.state === "connected" && participant.sid === participantSid;
    if (!usable()) throw new Error("Запрос устройства уже устарел");
    const previous = choices(), publication = currentPublication(), track = publication?.track as LocalAudioTrack | undefined;
    const enabled = participant.isMicrophoneEnabled;
    const oldActive = room.getActiveDevice("audioinput") || previous.audioDeviceId || "default";
    if (!track || !enabled) {
      try {
        if (await room.switchActiveDevice("audioinput", deviceId, true) === false) throw new Error("Браузер не подтвердил выбранный микрофон");
        if (!usable()) throw new Error("Запрос устройства уже устарел");
        // SDK setDeviceId defers muted tracks; absent/muted inputs never acquire capture.
        // Screen-share audio can keep the SDK active map stale until the next enable.
        return "saved";
      } catch (cause) {
        if (participant.sid === participantSid && room.state === "connected") {
          if (await room.switchActiveDevice("audioinput", previous.audioDeviceId || oldActive, true) === false) throw new Error("Не удалось восстановить прежний микрофон: Браузер не подтвердил выбранный микрофон", { cause });
        }
        throw cause;
      }
    }
    const source = track.getSourceTrackSettings(), muted = track.isMuted;
    const previousCapture = { ...track.constraints, ...guestAudioCaptureOptions(previous), deviceId: { exact: source.deviceId || oldActive } };
    for (const key of ["noiseSuppression", "echoCancellation", "autoGainControl", "voiceIsolation"] as const) {
      const actual = (source as MediaTrackSettings & { voiceIsolation?: boolean })[key];
      if (typeof actual === "boolean") previousCapture[key] = actual;
    }
    let detached = false;
    const unpublish = async () => { try { await participant.unpublishTrack(track, false); } finally { detached = currentPublication()?.track !== track; } };
    const rollbackSession = () => { if (participant.sid === participantSid) return true; if (currentPublication()?.track !== track) track.stop(); return false; };
    const rollback = async () => {
      if (!rollbackSession()) return;
      if (room.state !== "connected") { if (currentPublication()?.track === track) await unpublish(); if (rollbackSession()) track.stop(); return; }
      if (currentPublication()?.track && currentPublication()?.track !== track) { track.stop(); return; }
      if (currentPublication()?.track === track) await unpublish();
      if (!rollbackSession()) return;
      await room.switchActiveDevice("audioinput", oldActive, true);
      if (!rollbackSession()) return;
      await track.restartTrack(previousCapture);
      if (!rollbackSession()) return;
      if (room.state !== "connected") { track.stop(); return; }
      if (currentPublication()?.track) { track.stop(); return; }
      await participant.publishTrack(track, publication?.options);
      detached = false;
      if (!rollbackSession()) return;
      if (room.state !== "connected") track.stop();
    };
    try {
      await unpublish();
      if (!usable()) throw new Error("Запрос устройства уже устарел");
      if (await room.switchActiveDevice("audioinput", deviceId, true) === false) throw new Error("Браузер не подтвердил выбранный микрофон");
      if (!usable()) throw new Error("Запрос устройства уже устарел");
      await track.restartTrack({ ...track.constraints, ...guestAudioCaptureOptions({ ...previous, audioDeviceId: deviceId }) });
      const actual = track.getSourceTrackSettings();
      if (actual.deviceId !== deviceId || actual.noiseSuppression !== (guestAudioProfile(previous.audioProfile) === "speech") || actual.autoGainControl === true || (actual as MediaTrackSettings & { voiceIsolation?: boolean }).voiceIsolation === true || previous.audioProfile === "raw" && actual.echoCancellation === true) throw new Error("Браузер не подтвердил устройство и обработку микрофона");
      if (track.isMuted !== muted || !enabled && track.mediaStreamTrack.enabled) throw new Error("Браузер изменил состояние выключенного микрофона");
      if (!usable() || currentPublication()?.track) throw new Error("Запрос устройства уже устарел");
      await participant.publishTrack(track, { ...publication?.options, ...guestAudioPublishOptions(previous, actual) });
      detached = false;
      if (!usable() || participant.isMicrophoneEnabled !== enabled) throw new Error("Браузер не подтвердил выбранный микрофон");
      return enabled ? "applied" : "saved";
    } catch (cause) {
      try { await rollback(); } catch (restoreCause) { if (detached) track.stop(); throw new Error(`Не удалось восстановить прежний микрофон: ${restoreCause instanceof Error ? restoreCause.message : "ошибка устройства"}`, { cause }); }
      throw cause;
    }
  });
}

export async function switchGuestOutputDevice(room: Room, deviceId: string, isCurrent: () => boolean): Promise<"applied"> {
  if (!guestOutputSupported()) throw new Error("Браузер кастера не поддерживает выбор выхода звука");
  if (!isCurrent() || room.state !== "connected") throw new Error("Запрос устройства уже устарел");
  const previous = room.getActiveDevice("audiooutput") || "default";
  const participantSid = room.localParticipant.sid;
  try {
    if (!await applyAudioOutput(room, deviceId, Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")), true)) throw new Error("Браузер не подтвердил выбранный выход звука.");
    if (!isCurrent() || room.state !== "connected") throw new Error("Запрос устройства уже устарел");
    return "applied";
  } catch (cause) {
    if (room.state === "connected" && room.localParticipant.sid === participantSid) {
      try {
        if (!await applyAudioOutput(room, previous, Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")), true)) throw new Error("Браузер не подтвердил выбранный выход звука.");
      } catch (restoreCause) { throw new Error(`Не удалось восстановить прежний выход звука: ${restoreCause instanceof Error ? restoreCause.message : "ошибка устройства"}`, { cause }); }
    }
    throw cause;
  }
}

/** Camera device replacement shares the codec/mute queue and retains publication options. */
export function switchGuestCameraDevice(room: Room, choices: () => GuestChoices, deviceId: string, isCurrent: () => boolean): Promise<"applied" | "saved"> {
  return enqueueGuestCameraTask(room, async () => {
    const participant = room.localParticipant, publication = participant.getTrackPublication(Track.Source.Camera);
    const participantSid = participant.sid;
    const currentPublication = () => participant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track as LocalVideoTrack | undefined;
    const usable = () => isCurrent() && room.state === "connected" && participant.sid === participantSid;
    if (!usable()) throw new Error("Запрос устройства уже устарел");
    const previous = choices(), enabled = participant.isCameraEnabled, oldActive = room.getActiveDevice("videoinput") || previous.videoDeviceId || "default";
    if (!track || !enabled) {
      try {
        if (await room.switchActiveDevice("videoinput", deviceId, true) === false) throw new Error("Браузер не подтвердил выбранную камеру");
        if (!usable()) throw new Error("Запрос устройства уже устарел");
        // SDK setDeviceId defers a muted camera without restarting its stopped capture.
        // Screen sharing can keep the active map stale until the next explicit enable.
        return "saved";
      } catch (cause) {
        if (participant.sid === participantSid && room.state === "connected") {
          if (await room.switchActiveDevice("videoinput", previous.videoDeviceId || oldActive, true) === false) throw new Error("Не удалось восстановить прежнюю камеру: Браузер не подтвердил выбранную камеру", { cause });
        }
        throw cause;
      }
    }
    const muted = track.isMuted, source = track.getSourceTrackSettings();
    const codec = guestVideoCodec(track.codec || publication?.options?.videoCodec);
    const publishOptions = { ...publication?.options, videoCodec: codec };
    const resolution = { width: source.width || Math.round((source.height || previous.height) * 16 / 9), height: source.height || previous.height, frameRate: source.frameRate || 30 };
    const previousCapture: VideoCaptureOptions = { deviceId: { exact: source.deviceId || oldActive }, resolution };
    const base = guestCameraConstraints(effectiveGuestCameraCapture(participant.metadata, previous));
    // The SDK forwards raw constraint keys. Height-only keeps a new camera's
    // native aspect ratio; the old device's width belongs only in rollback.
    const nextCapture = { ...base, deviceId: { exact: deviceId }, resizeMode: { ideal: "none" } } as unknown as VideoCaptureOptions;
    let detached = false;
    const unpublish = async () => { try { await participant.unpublishTrack(track, false); } finally { detached = currentPublication()?.track !== track; } };
    const rollbackSession = () => { if (participant.sid === participantSid) return true; if (currentPublication()?.track !== track) track.stop(); return false; };
    const rollback = async () => {
      if (!rollbackSession()) return;
      if (room.state !== "connected") { if (currentPublication()?.track === track) await unpublish(); if (rollbackSession()) track.stop(); return; }
      if (currentPublication()?.track && currentPublication()?.track !== track) { track.stop(); return; }
      if (currentPublication()?.track === track) await unpublish();
      if (!rollbackSession()) return;
      await room.switchActiveDevice("videoinput", oldActive, true);
      if (!rollbackSession()) return;
      await track.restartTrack(previousCapture);
      if (!rollbackSession()) return;
      if (room.state !== "connected" || currentPublication()?.track) { track.stop(); return; }
      await participant.publishTrack(track, publishOptions);
      detached = false;
      if (!rollbackSession()) return;
      if (room.state !== "connected") track.stop();
    };
    try {
      await unpublish();
      if (!usable()) throw new Error("Запрос устройства уже устарел");
      if (await room.switchActiveDevice("videoinput", deviceId, true) === false) throw new Error("Браузер не подтвердил выбранную камеру");
      if (!usable()) throw new Error("Запрос устройства уже устарел");
      await track.restartTrack(nextCapture);
      if (!usable()) throw new Error("Запрос устройства уже устарел");
      await applyPreferredGuestCameraCapture(guestCameraSource(track), participant.metadata, previous, usable);
      if (track.getSourceTrackSettings().deviceId !== deviceId || track.isMuted !== muted || !enabled && guestCameraSource(track).enabled) throw new Error("Браузер не подтвердил устройство и состояние камеры");
      if (!usable() || currentPublication()?.track) throw new Error("Запрос устройства уже устарел");
      await participant.publishTrack(track, publishOptions);
      detached = false;
      if (!usable() || participant.isCameraEnabled !== enabled || track.codec !== codec) throw new Error("Браузер не подтвердил выбранную камеру");
      return enabled ? "applied" : "saved";
    } catch (cause) {
      try { await rollback(); } catch (restoreCause) { if (detached) track.stop(); throw new Error(`Не удалось восстановить прежнюю камеру: ${restoreCause instanceof Error ? restoreCause.message : "ошибка устройства"}`, { cause }); }
      throw cause;
    }
  });
}
