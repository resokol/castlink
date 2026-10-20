import type { AudioCaptureOptions, LocalAudioTrack, Room, Track, TrackPublishOptions } from "livekit-client";

export type GuestAudioProfile = "speech" | "raw";
type AudioChoices = { audioDeviceId?: string; audioProfile?: GuestAudioProfile };
type ProcessingOptions = Pick<AudioCaptureOptions, "autoGainControl" | "echoCancellation" | "noiseSuppression" | "voiceIsolation">;

/** Missing choices use original sound; explicit studio speech choices are retained. */
export function guestAudioProfile(value?: unknown): GuestAudioProfile {
  return value === "speech" ? "speech" : "raw";
}

export function guestAudioProcessingOptions(choices: AudioChoices): ProcessingOptions {
  const speech = guestAudioProfile(choices.audioProfile) === "speech";
  // Voice isolation can override noiseSuppression; automatic gain can amplify
  // the residual noise again. Keep the two modes explicit and gain stable.
  return { autoGainControl: false, echoCancellation: speech, noiseSuppression: speech, voiceIsolation: false };
}

export type GuestNoiseSuppressionState = "on" | "off" | "unavailable" | "pending";
export function guestNoiseSuppressionState(room: Room): GuestNoiseSuppressionState {
  const track = room.localParticipant.getTrackPublication("microphone" as Track.Source)?.track as LocalAudioTrack | undefined;
  if (!track) return "pending";
  const actual = track.getSourceTrackSettings().noiseSuppression;
  return actual === true ? "on" : actual === false ? "off" : "unavailable";
}

function verifyNativeProcessing(track: LocalAudioTrack, expectedNoiseSuppression: boolean) {
  const settings = track.getSourceTrackSettings();
  if (settings.noiseSuppression !== expectedNoiseSuppression) {
    throw new Error(expectedNoiseSuppression ? "Браузер не подтвердил включение шумоподавления для этого микрофона." : "Браузер не подтвердил отключение шумоподавления для оригинального звука.");
  }
  if (settings.autoGainControl === true || (settings as MediaTrackSettings & { voiceIsolation?: boolean }).voiceIsolation === true) throw new Error("Браузер не отключил автоматическое усиление или изоляцию голоса.");
  if (!expectedNoiseSuppression && settings.echoCancellation === true) throw new Error("Браузер не отключил эхоподавление для оригинального звука.");
}

function restartOptions(track: LocalAudioTrack, choices: AudioChoices): AudioCaptureOptions {
  const deviceId = track.getSourceTrackSettings().deviceId;
  // SDK restart() drops audio processing flags if deviceId is absent. Pin the
  // actual current input, including a temporary hotplug fallback, on every restart.
  return { ...track.constraints, ...guestAudioProcessingOptions(choices), deviceId: deviceId ? { exact: deviceId } : track.constraints.deviceId || (choices.audioDeviceId ? { exact: choices.audioDeviceId } : { ideal: "default" }) };
}

/** The preflight capture and the LiveKit microphone use the same explicit constraints. */
export function guestAudioCaptureOptions(choices: AudioChoices): AudioCaptureOptions {
  return { ...guestAudioProcessingOptions(choices), ...(choices.audioDeviceId ? { deviceId: { exact: choices.audioDeviceId } } : {}) };
}

export function guestAudioPublishOptions(choices: AudioChoices, settings?: Pick<MediaTrackSettings, "channelCount">): TrackPublishOptions {
  const raw = guestAudioProfile(choices.audioProfile) === "raw";
  return {
    dtx: !raw,
    red: true,
    // An own `undefined` overrides LiveKit's forceStereo:false default, letting
    // it inspect the captured input. Do not force ordinary mono mics to stereo.
    forceStereo: raw ? (settings?.channelCount === undefined ? undefined : settings.channelCount === 2) : false,
    audioPreset: { maxBitrate: raw ? (settings?.channelCount === 2 ? 128_000 : 96_000) : 48_000 },
  };
}

const microphoneTasks = new WeakMap<Room, Promise<unknown>>();

/** Serialize microphone enable/mute/device/profile changes, including after failures. */
export function enqueueGuestMicrophoneTask<T>(room: Room, task: () => Promise<T>): Promise<T> {
  const prior = microphoneTasks.get(room) || Promise.resolve();
  const pending = prior.catch(() => undefined).then(task);
  microphoneTasks.set(room, pending);
  void pending.then(() => {
    if (microphoneTasks.get(room) === pending) microphoneTasks.delete(room);
  }, () => {
    if (microphoneTasks.get(room) === pending) microphoneTasks.delete(room);
  });
  return pending;
}

/**
 * Change only the published microphone, retaining its SDK track, device and mute.
 * DTX is a publication option, so capture constraints alone cannot switch it.
 * Callers commit the saved profile only on `true`; `false` means stale/disconnected.
 * This function owns its queue entry; do not wrap it in enqueueGuestMicrophoneTask.
 */
export function switchGuestMicrophoneProfile(room: Room, previous: AudioChoices, next: AudioChoices, { isCurrent = () => true }: { isCurrent?: () => boolean } = {}): Promise<boolean> {
  return enqueueGuestMicrophoneTask(room, async () => {
    const source = "microphone" as Track.Source;
    const participant = room.localParticipant;
    const currentPublication = () => participant.getTrackPublication(source);
    const connected = () => room.state === "connected";
    if (!isCurrent() || !connected()) return false;
    const publication = currentPublication();
    const track = publication?.track as LocalAudioTrack | undefined;
    // An absent mic must stay absent: the next explicit enable uses the saved profile.
    if (!track) return true;
    const previousSettings = track.getSourceTrackSettings();
    const previousCapture = restartOptions(track, previous);
    // Restore what capture actually used, even for an old session whose
    // applyConstraints promise resolved while the native settings stayed unchanged.
    for (const key of ["noiseSuppression", "echoCancellation", "autoGainControl", "voiceIsolation"] as const) {
      const actual = (previousSettings as MediaTrackSettings & { voiceIsolation?: boolean })[key];
      if (typeof actual === "boolean") previousCapture[key] = actual;
    }
    const nextCapture = restartOptions(track, next);
    const previousPublish = { ...publication?.options, ...guestAudioPublishOptions(previous, previousSettings) };
    let detached = false;
    const unpublish = async () => {
      try { await participant.unpublishTrack(track, false); }
      finally {
        // An SDK listener can throw after the publication has already gone.
        detached = currentPublication()?.track !== track;
      }
    };

    const rollback = async () => {
      const current = currentPublication();
      if (!connected()) {
        // A restart cannot safely attach a new capture to a muted live sender.
        // Let the normal reconnect handler restore only this missing microphone
        // with the prior saved profile; a muted mic stays absent and muted.
        if (current?.track === track) await unpublish();
        track.stop();
        return;
      }
      if (current?.track && current.track !== track) {
        track.stop();
        return;
      }
      if (!detached && currentPublication()?.track === track) {
        await unpublish();
      }
      if (!connected()) { track.stop(); return; }
      await track.restartTrack(previousCapture);
      if (typeof previousSettings.noiseSuppression === "boolean" && track.getSourceTrackSettings().noiseSuppression !== previousSettings.noiseSuppression) throw new Error("Не удалось восстановить прежнюю обработку микрофона");
      if (!connected()) { track.stop(); return; }
      // A concurrent SDK/device recovery must not be overwritten by the old track.
      const replacement = currentPublication()?.track;
      if (replacement && replacement !== track) { track.stop(); return; }
      await participant.publishTrack(track, previousPublish);
      detached = false;
      if (!connected()) track.stop();
    };

    try {
      if (currentPublication()?.track !== track) { track.stop(); return false; }
      // Chromium can accept applyConstraints while keeping its original audio
      // processing graph. Reopen capture and check actual source settings.
      // Unpublish first: SDK restart replaces the sender before syncing enabled,
      // which must never briefly transmit a newly acquired muted microphone.
      await unpublish();
      if (!isCurrent() || !connected()) { await rollback(); return false; }
      await track.restartTrack(nextCapture);
      verifyNativeProcessing(track, guestAudioProfile(next.audioProfile) === "speech");
      if (!isCurrent() || !connected()) { await rollback(); return false; }
      if (currentPublication()?.track) { track.stop(); return false; }
      const nextPublish = { ...publication?.options, ...guestAudioPublishOptions(next, track.getSourceTrackSettings()) };
      await participant.publishTrack(track, nextPublish);
      detached = false;
      if (!isCurrent() || !connected()) { await rollback(); return false; }
      return true;
    } catch (cause) {
      try { await rollback(); }
      catch (restoreCause) {
        // Never leave a detached microphone capturing after a failed rollback.
        if (detached) track.stop();
        throw new Error(`Не удалось сменить режим микрофона и восстановить прежний звук: ${restoreCause instanceof Error ? restoreCause.message : "ошибка устройства"}`, { cause });
      }
      throw new Error(`Не удалось сменить режим микрофона: ${cause instanceof Error ? cause.message : "ошибка устройства"}`, { cause });
    }
  });
}

/** Read choices when the queued action runs, so a preceding profile switch wins. */
export function setGuestMicrophoneEnabled(room: Room, enabled: boolean, choices: () => AudioChoices, isCurrent: () => boolean = () => true): Promise<boolean> {
  return enqueueGuestMicrophoneTask(room, async () => {
    if (!isCurrent() || room.state !== "connected") return false;
    const current = choices();
    const publication = await room.localParticipant.setMicrophoneEnabled(enabled, enabled ? guestAudioCaptureOptions(current) : undefined, enabled ? guestAudioPublishOptions(current) : undefined);
    if (!isCurrent() || room.state !== "connected") {
      if (String(room.state) === "disconnected") publication?.track?.stop();
      return false;
    }
    if (room.localParticipant.isMicrophoneEnabled !== enabled) throw new Error("Браузер не подтвердил состояние микрофона");
    if (enabled && publication?.track) verifyNativeProcessing(publication.track as LocalAudioTrack, guestAudioProfile(current.audioProfile) === "speech");
    return true;
  });
}
