"use client";
import { guestEntryDevices, type GuestEntrySettings } from "@/lib/guest-entry-settings";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState } from "react";
import { MediaDevicePicker } from "./MediaDevicePicker";
import { AudioMeter } from "./AudioMeter";
import { EntryShell } from "./EntryShell";
import { preflightMessage } from "@/lib/i18n/entry-preflight";
import styles from "./GuestPreflight.module.css";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { startSpeakerTest } from "@/lib/audio-device-test";
import { guestVideoCodec } from "@/lib/guest-video-codec";
import { guestAudioProfile } from "@/lib/guest-audio";
import { guestCaptureConstraints, type GuestChoices } from "@/lib/guest-media";

export function GuestAvCheck({ name, roomName, onJoin, onJoinGesture, preferredLabels, initialChoices, savedSettings, entrySettings, joinLabel, onBack }: { name: string; roomName?: string; onJoin: (choices: GuestChoices, name: string, overrides?: Partial<GuestChoices>) => void; onBack?: () => void; onJoinGesture?: () => void; preferredLabels?: { audio?: string; video?: string; output?: string }; initialChoices?: GuestChoices; savedSettings?: Partial<GuestChoices>; entrySettings?: GuestEntrySettings; joinLabel?:string }) {
  const { t, locale } = useI18n();
  const copy = (source: string) => preflightMessage(locale, source);
  const [displayName, setDisplayName] = useState(name);
  const explicitSettings = useRef<Partial<GuestChoices>>({});
  const [choices, setChoices] = useState<GuestChoices>(() => ({ micGain: initialChoices?.micGain ?? savedSettings?.micGain ?? 100, listenGain: initialChoices?.listenGain ?? savedSettings?.listenGain ?? 100, ...guestEntryDevices(entrySettings, initialChoices), height: 1080, audioProfile: guestAudioProfile(initialChoices?.audioProfile ?? savedSettings?.audioProfile), videoCodec: guestVideoCodec(initialChoices?.videoCodec ?? savedSettings?.videoCodec), connectionRoute: initialChoices?.connectionRoute || savedSettings?.connectionRoute || "auto", audioOutputId: "default" }));
  const currentChoices = useRef(choices);
  currentChoices.current = choices;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputErrors, setInputErrors] = useState({ camera: "", microphone: "" });
  const [captureError, setCaptureError] = useState(false);
  const [notice, setNotice] = useState("");
  const [level, setLevel] = useState(METER_FLOOR_DB);
  const [cameraTesting, setCameraTesting] = useState(false);
  const [microphoneTesting, setMicrophoneTesting] = useState(false);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const cameraStream = useRef<MediaStream | undefined>(undefined);
  const cameraGeneration = useRef(0);
  const cameraPending = useRef(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speakerGeneration = useRef(0);
  const stopMeter = useRef<(() => void) | undefined>(undefined);
  const speaker = useRef<ReturnType<typeof startSpeakerTest> | undefined>(undefined);
  const generation = useRef(0);
  const captureScope = useRef<"all" | "microphone" | null>(null);
  const restoring = useRef(false);
  const stopMicrophone = () => {
    generation.current++;
    captureScope.current = null;
    stream.current?.getAudioTracks().forEach(track => track.stop()); stream.current = undefined;
    stopMeter.current?.(); stopMeter.current = undefined;
    setLevel(METER_FLOOR_DB); setMicrophoneTesting(false);
  };
  const stopCamera = () => {
    cameraGeneration.current++;
    cameraPending.current = false;
    cameraStream.current?.getVideoTracks().forEach(track => track.stop()); cameraStream.current = undefined;
    if (video.current) video.current.srcObject = null;
    setCameraTesting(false);
  };
  const stopSpeaker = () => {
    speakerGeneration.current++;
    speaker.current?.stop(); speaker.current = undefined; setSpeakerTesting(false);
  };
  const stop = () => { clearTimeout(previewTimer.current); stopMicrophone(); stopCamera(); stopSpeaker(); };
  useEffect(() => () => { stop(); }, []);
  const change = (patch: Partial<GuestChoices>) => {
    const changesAudio = patch.audioDeviceId !== undefined || patch.audioEnabled !== undefined;
    if (busy && (captureScope.current === "all" || changesAudio)) { generation.current++; captureScope.current = null; setBusy(false); }
    if (patch.audioDeviceId !== undefined || patch.audioEnabled !== undefined) stopMicrophone();
    if (patch.videoDeviceId !== undefined || patch.videoEnabled !== undefined) stopCamera();
    if (patch.audioOutputId !== undefined) stopSpeaker();
    setInputErrors(value => ({ camera: patch.videoDeviceId !== undefined || patch.videoEnabled !== undefined ? "" : value.camera, microphone: changesAudio ? "" : value.microphone }));
    setError(""); setCaptureError(false);
    currentChoices.current = { ...currentChoices.current, ...patch };
    setChoices(value => ({ ...value, ...patch }));
    if (!initialChoices && (patch.audioEnabled === true || patch.videoEnabled === true || patch.audioDeviceId !== undefined || patch.videoDeviceId !== undefined)) {
      clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(startPreview, 0);
    }
  };
  const testCamera = async () => {
    if (cameraTesting) { stopCamera(); return; }
    const attempt = ++cameraGeneration.current;
    cameraPending.current = true;
    setInputErrors(value => ({ ...value, camera: "" }));
    setError(""); setCaptureError(false);
    let captured: MediaStream | undefined;
    try {
      const constraints = guestCaptureConstraints({ ...currentChoices.current, audioEnabled: false });
      if (!constraints) return;
      captured = await navigator.mediaDevices.getUserMedia(constraints);
      if (attempt !== cameraGeneration.current) { captured.getTracks().forEach(track => track.stop()); return; }
      cameraStream.current = captured;
      setChoices(value => ({ ...value, videoDeviceId: captured?.getVideoTracks()[0]?.getSettings().deviceId || value.videoDeviceId }));
      if (video.current) { video.current.srcObject = captured; void video.current.play().catch(() => undefined); }
      setCameraTesting(true);
    } catch (cause) {
      captured?.getTracks().forEach(track => track.stop());
      if (attempt === cameraGeneration.current) setInputErrors(value => ({ ...value, camera: cause instanceof Error ? cause.message : "Не удалось открыть устройства" }));
    } finally { if (attempt === cameraGeneration.current) cameraPending.current = false; }
  };
  const check = async (join: boolean, restore = false, microphoneOnly = false) => {
    if (join) stop(); else stopMicrophone();
    if (!join && !microphoneOnly) stopCamera();
    const attempt = ++generation.current;
    captureScope.current = microphoneOnly ? "microphone" : "all";
    setBusy(true); setError(""); setCaptureError(false);
    if (microphoneOnly) setInputErrors(value => ({ ...value, microphone: "" }));
    let captured: MediaStream | undefined;
    try {
      let next = { ...currentChoices.current };
      const constraints = guestCaptureConstraints(microphoneOnly ? { ...next, videoEnabled: false } : next);
      if (constraints) {
        if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) throw new Error("Для камеры и микрофона нужен HTTPS и разрешение браузера. Можно войти с отключёнными устройствами.");
        captured = await navigator.mediaDevices.getUserMedia(constraints);
      }
      if (attempt !== generation.current) { captured?.getTracks().forEach(track => track.stop()); return; }
      const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
      if (restore && preferredLabels) {
        const missing: string[] = [];
        for (const [kind, label, enabled, field] of [
          ["audioinput", preferredLabels.audio, next.audioEnabled !== false, "audioDeviceId"],
          ["videoinput", preferredLabels.video, next.videoEnabled !== false, "videoDeviceId"],
          ["audiooutput", preferredLabels.output, true, "audioOutputId"],
        ] as const) {
          if (!enabled || !label) continue;
          const matches = devices.filter(device => device.kind === kind && device.label === label);
          if (matches.length === 1) next[field] = matches[0].deviceId;
          else missing.push(label);
        }
        if (missing.length) { setNotice(`Проверьте устройства вручную: ${missing.join(", ")}.`); join = false; }
        else if (guestCaptureConstraints(next)) {
          captured?.getTracks().forEach(track => track.stop());
          captured = await navigator.mediaDevices.getUserMedia(guestCaptureConstraints(next)!);
        }
      }
      if (attempt !== generation.current) { captured?.getTracks().forEach(track => track.stop()); return; }
      if (!join && !restore) next = { ...currentChoices.current };
      next.audioDeviceId = captured?.getAudioTracks()[0]?.getSettings().deviceId || next.audioDeviceId;
      next.videoDeviceId = captured?.getVideoTracks()[0]?.getSettings().deviceId || next.videoDeviceId;
      if (join || restore) setChoices(next);
      else setChoices(value => ({ ...value,
        audioDeviceId: captured?.getAudioTracks()[0]?.getSettings().deviceId || value.audioDeviceId,
        videoDeviceId: captured?.getVideoTracks()[0]?.getSettings().deviceId || value.videoDeviceId,
      }));
      if (join) { captured?.getTracks().forEach(track => track.stop()); onJoin(next, displayName.trim(), explicitSettings.current); return; }
      stream.current = captured;
      if (captured?.getVideoTracks().length) {
        cameraStream.current = captured; setCameraTesting(true);
        if (video.current) { video.current.srcObject = captured; void video.current.play().catch(() => undefined); }
      }
      if (captured?.getAudioTracks().length) {
        stopMeter.current = observePcmTrack(captured.getAudioTracks()[0], db => { if (attempt === generation.current) setLevel(db); });
        setMicrophoneTesting(true);
      }
    } catch (cause) {
      captured?.getTracks().forEach(track => track.stop());
      if (attempt === generation.current) {
        stopMicrophone(); if (!microphoneOnly) stopCamera(); setBusy(false);
        const message = cause instanceof Error ? cause.message : "Не удалось открыть устройства";
        if (microphoneOnly) setInputErrors(value => ({ ...value, microphone: message }));
        else { setCaptureError(true); setError(message); }
      }
    } finally { if (attempt === generation.current) { captureScope.current = null; setBusy(false); } }
  };
  const startPreview = () => {
    // Keep an available input active even when the other input is denied or missing.
    if (!stream.current?.getAudioTracks().length && captureScope.current === null && currentChoices.current.audioEnabled !== false) void check(false, false, true);
    if (!cameraStream.current?.getVideoTracks().length && !cameraPending.current && currentChoices.current.videoEnabled !== false) void testCamera();
  };
  const testSpeaker = async () => {
    if (speakerTesting) { speaker.current?.stop(); speaker.current = undefined; setSpeakerTesting(false); return; }
    const attempt = ++speakerGeneration.current;
    setError(""); setCaptureError(false); setSpeakerTesting(true);
    let test: ReturnType<typeof startSpeakerTest> | undefined;
    try {
      test = startSpeakerTest(choices.audioOutputId || "default"); speaker.current = test;
      await test.finished;
    } catch (cause) { if (attempt === speakerGeneration.current && (!test || speaker.current === test)) setError(cause instanceof Error ? cause.message : "Не удалось проверить выход звука"); }
    finally { if (attempt === speakerGeneration.current && (!test || speaker.current === test)) { speaker.current = undefined; setSpeakerTesting(false); } }
  };
  useEffect(() => {
    if (restoring.current) return;
    restoring.current = true;
    // Fresh entry previews locally; transfer choices retain their existing join restoration.
    // Defer until after StrictMode's setup/cleanup probe.
    const timer = setTimeout(() => { if (initialChoices) void check(true, true); else startPreview(); }, 0);
    return () => { clearTimeout(timer); restoring.current = false; };
  }, [initialChoices]);
  return <EntryShell wide>
    <div className={`${styles.preflight} av-check`}>
      {onBack && <button type="button" className={styles.back} onClick={onBack}>← {copy("Назад к приглашению")}</button>}
      <header className={styles.preflightHeading}>
        <h1>{copy("Проверьте себя перед входом")}</h1>
        {roomName && <p>{roomName}</p>}
      </header>
      <div className={styles.grid}>
        <section className={styles.previewColumn} aria-label={copy("Предпросмотр · только вы")}>
          <div className={styles.preview}>
            <video ref={video} muted playsInline className="av-preview" style={{ display: cameraTesting && choices.videoEnabled !== false ? "block" : "none" }} />
            <small className={styles.previewCaption}>{copy("Предпросмотр · только вы")}</small>
            {!cameraTesting && <div className={styles.cameraState}>
              <PreflightIcon kind="camera" off={choices.videoEnabled === false} />
              <p>{choices.videoEnabled === false ? copy("Камера выключена") : copy("Ожидаем камеру…")}</p>
            </div>}
          </div>
          <div className={styles.mediaButtons}>
            <button type="button" aria-pressed={choices.videoEnabled !== false} aria-label={copy(choices.videoEnabled === false ? "Включить камеру" : "Выключить камеру")} onClick={() => change({ videoEnabled: choices.videoEnabled === false })}>
              <PreflightIcon kind="camera" off={choices.videoEnabled === false} />
              {copy(choices.videoEnabled === false ? "Включить камеру" : "Выключить камеру")}
            </button>
            <button type="button" aria-pressed={choices.audioEnabled !== false} aria-label={copy(choices.audioEnabled === false ? "Включить микрофон" : "Выключить микрофон")} onClick={() => change({ audioEnabled: choices.audioEnabled === false })}>
              <PreflightIcon kind="microphone" off={choices.audioEnabled === false} />
              {copy(choices.audioEnabled === false ? "Микрофон выключен" : "Микрофон")}
            </button>
          </div>
          <p className={styles.permission}>{copy("До подключения студия не получает ваши видео и звук. При запросе разрешите доступ к устройствам.")}</p>
        </section>
        <section className={styles.devices} aria-labelledby="preflight-devices-title">
          <h2 id="preflight-devices-title">{copy("Ваше имя и устройства")}</h2>
          <label className={styles.nameField}>
            <span id="preflight-name-label">{copy("Как вас представить")}</span>
            <input name="displayName" autoComplete="name" aria-labelledby="preflight-name-label" aria-describedby="preflight-name-help" maxLength={120} disabled={busy} value={displayName} onChange={event => setDisplayName(event.target.value)} />
            <small id="preflight-name-help">{copy("Это имя увидят участники студии.")}</small>
          </label>
          <MediaDevicePicker compactLabels className={styles.picker} autoRequestPermissions={false} deviceRefreshKey={Number(cameraTesting) + Number(microphoneTesting)} permissionInputs={{ audio: choices.audioEnabled !== false, video: choices.videoEnabled !== false }} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId} onChange={value => change({ ...(value.cameraId !== undefined ? { videoDeviceId: value.cameraId } : {}), ...(value.microphoneId !== undefined ? { audioDeviceId: value.microphoneId } : {}), ...(value.headphonesId !== undefined ? { audioOutputId: value.headphonesId } : {}) })} />
          <div className={styles.inputMeter}>
            <AudioMeter db={choices.audioEnabled === false ? METER_FLOOR_DB : level} compact label={copy("Уровень")} />
          </div>
          <button type="button" className={styles.speakerTest} disabled={busy} aria-pressed={speakerTesting} onClick={() => void testSpeaker()}>{copy(speakerTesting ? "Остановить звук" : "Проверить звук")}</button>
          <div className={styles.messages}>
            {notice && <p role="status">{translateWorkspaceMessage(t, notice)}</p>}
            {(error || inputErrors.camera || inputErrors.microphone) && <div className="av-error">
              {inputErrors.camera && <p role="alert">{t("Камера")}: {translateWorkspaceMessage(t, inputErrors.camera)}</p>}
              {inputErrors.microphone && <p role="alert">{t("Микрофон")}: {translateWorkspaceMessage(t, inputErrors.microphone)}</p>}
              {error && <p role="alert">{translateWorkspaceMessage(t, error)}</p>}
              {(captureError || inputErrors.camera || inputErrors.microphone) && <button type="button" className="button-secondary" disabled={busy} onClick={startPreview}>{t("Повторить")}</button>}
            </div>}
          </div>
          <div className={`guest-av-join-actions ${styles.joinActions}`}>
            <button type="button" className="button-primary" disabled={busy || !displayName.trim()} onClick={() => { onJoinGesture?.(); void check(true); }}>{busy ? t("Проверка…") : joinLabel || copy("Подключиться к студии")}</button>
          </div>
          <p className={styles.joinNote}>{copy("Подключение начнётся после нажатия кнопки.")}</p>
          <details className={styles.advanced}>
            <summary>{copy("Дополнительные настройки")}</summary>
            {choices.audioEnabled !== false && <div className="audio-gain-row"><span>{t("Усиление микрофона")}</span><input aria-label={t("Усиление микрофона")} type="range" min="0" max="200" value={choices.micGain} onChange={event => { const micGain = Number(event.target.value); explicitSettings.current.micGain = micGain; setChoices(value => ({ ...value, micGain })); }} /><strong>{choices.micGain}%</strong></div>}
            <p className={styles.diagnosticNote}>{t("Говорите в микрофон: шкала показывает реальный сигнал. Звук микрофона не воспроизводится в динамиках.")}</p>
            <div className="guest-av-check-actions">
              <button type="button" className="button-secondary" disabled={busy || choices.audioEnabled === false} aria-pressed={microphoneTesting} onClick={() => { if (microphoneTesting) stopMicrophone(); else void check(false, false, true); }}>{microphoneTesting ? t("Остановить тест микрофона") : t("Проверить микрофон")}</button>
              <button type="button" className="button-secondary" disabled={busy || choices.videoEnabled === false} aria-pressed={cameraTesting} onClick={() => void testCamera()}>{cameraTesting ? t("Остановить тест камеры") : t("Проверить камеру")}</button>
              <button type="button" className="button-secondary" disabled={busy} aria-pressed={speakerTesting} onClick={() => void testSpeaker()}>{speakerTesting ? t("Остановить тест звука") : t("Проверить наушники / динамики")}</button>
            </div>
          </details>
        </section>
      </div>
    </div>
  </EntryShell>;
}

function PreflightIcon({ kind, off = false }: { kind: "camera" | "microphone"; off?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {kind === "camera" ? <><rect x="3" y="6" width="12" height="12" rx="2" /><path d="m15 10 6-4v12l-6-4" /></> : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>}
    {off && <path d="m3 3 18 18" />}
  </svg>;
}
