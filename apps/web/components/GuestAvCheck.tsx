"use client";
import { guestEntryDevices, type GuestEntrySettings } from "@/lib/guest-entry-settings";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState } from "react";
import { MediaDevicePicker } from "./MediaDevicePicker";
import { AudioMeter } from "./AudioMeter";
import { BrandIcon } from "./BrandIcon";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { startSpeakerTest } from "@/lib/audio-device-test";
import { guestVideoCodec } from "@/lib/guest-video-codec";
import { guestAudioProfile } from "@/lib/guest-audio";
import { guestCaptureConstraints, type GuestChoices } from "@/lib/guest-media";

export function GuestAvCheck({ name, roomName, onJoin, onJoinGesture, preferredLabels, initialChoices, savedSettings, entrySettings, joinLabel }: { name: string; roomName?: string; onJoin: (choices: GuestChoices) => void; onJoinGesture?: () => void; preferredLabels?: { audio?: string; video?: string; output?: string }; initialChoices?: GuestChoices; savedSettings?: Partial<GuestChoices>; entrySettings?: GuestEntrySettings; joinLabel?:string }) {
  const { t, locale } = useI18n();
  const [choices, setChoices] = useState<GuestChoices>(() => ({ micGain: initialChoices?.micGain ?? savedSettings?.micGain ?? 100, listenGain: initialChoices?.listenGain ?? savedSettings?.listenGain ?? 100, ...guestEntryDevices(entrySettings, initialChoices), height: 1080, audioProfile: guestAudioProfile(initialChoices?.audioProfile ?? savedSettings?.audioProfile), videoCodec: guestVideoCodec(initialChoices?.videoCodec ?? savedSettings?.videoCodec), connectionRoute: initialChoices?.connectionRoute || savedSettings?.connectionRoute || "auto", audioOutputId: "default" }));
  const currentChoices = useRef(choices);
  currentChoices.current = choices;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    cameraStream.current?.getVideoTracks().forEach(track => track.stop()); cameraStream.current = undefined;
    if (video.current) video.current.srcObject = null;
    setCameraTesting(false);
  };
  const stopSpeaker = () => {
    speakerGeneration.current++;
    speaker.current?.stop(); speaker.current = undefined; setSpeakerTesting(false);
  };
  const stop = () => { stopMicrophone(); stopCamera(); stopSpeaker(); };
  useEffect(() => () => { stop(); }, []);
  const change = (patch: Partial<GuestChoices>) => {
    const changesAudio = patch.audioDeviceId !== undefined || patch.audioEnabled !== undefined;
    if (busy && (captureScope.current === "all" || changesAudio)) { generation.current++; captureScope.current = null; setBusy(false); }
    if (patch.audioDeviceId !== undefined || patch.audioEnabled !== undefined) stopMicrophone();
    if (patch.videoDeviceId !== undefined || patch.videoEnabled !== undefined) stopCamera();
    if (patch.audioOutputId !== undefined) stopSpeaker();
    setError(""); setCaptureError(false); setChoices(value => ({ ...value, ...patch }));
  };
  const testCamera = async () => {
    if (cameraTesting) { stopCamera(); return; }
    const attempt = ++cameraGeneration.current;
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
      if (attempt === cameraGeneration.current) { setCaptureError(true); setError(cause instanceof Error ? cause.message : "Не удалось открыть устройства"); }
    }
  };
  const check = async (join: boolean, restore = false, microphoneOnly = false) => {
    if (join) stop(); else stopMicrophone();
    if (!join && !microphoneOnly) stopCamera();
    const attempt = ++generation.current;
    captureScope.current = microphoneOnly ? "microphone" : "all";
    setBusy(true); setError(""); setCaptureError(false);
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
      if (join) { captured?.getTracks().forEach(track => track.stop()); onJoin(next); return; }
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
      if (attempt === generation.current) { stopMicrophone(); if (!microphoneOnly) stopCamera(); setBusy(false); setCaptureError(true); setError(cause instanceof Error ? cause.message : "Не удалось открыть устройства"); }
    } finally { if (attempt === generation.current) { captureScope.current = null; setBusy(false); } }
  };
  const startPreview = () => {
    // Keep an available input active even when the other input is denied or missing.
    if (!microphoneTesting && currentChoices.current.audioEnabled !== false) void check(false, false, true);
    if (!cameraTesting && currentChoices.current.videoEnabled !== false) void testCamera();
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
  return <main className="media-page guest-av-page graphite-entry">
    <header className="guest-design-only guest-entry-brand" style={{ display: "none" }}><BrandIcon className="studio-brand-mark" /><strong>CASTLINK</strong></header>
    <div className="panel av-check">
    <div className="preflight-current-heading"><p className="muted">{t("CastLink · проверка перед эфиром")}</p><h1>{name}</h1></div>
    <header className="guest-design-only preflight-heading" style={{ display: "none" }}><h1>{t("Готовы к подключению?")}</h1><p className="muted">{roomName && <>{roomName} · </>}{name}</p></header>

    <div className="preflight-input-options" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" aria-pressed={choices.videoEnabled === false} onClick={() => change({ videoEnabled: choices.videoEnabled === false })}>{choices.videoEnabled === false ? t("Камера отключена ✓") : t("Войти без камеры")}</button>
      <button type="button" aria-pressed={choices.audioEnabled === false} onClick={() => change({ audioEnabled: choices.audioEnabled === false })}>{choices.audioEnabled === false ? t("Микрофон отключён ✓") : t("Войти без микрофона")}</button>
    </div>
    <p className="muted preflight-input-note">{t("Можно отключить одно или оба устройства. Отключение микрофона не выключает звук студии и участников.")}</p>
    <div className="preflight-preview-frame" style={{ display: "contents" }}>
      <video ref={video} muted playsInline className="av-preview" style={{ display: choices.videoEnabled === false ? "none" : undefined }} />
      <div className="guest-design-only preflight-preview-caption" style={{ display: "none" }}><span>{cameraTesting ? t("Камера включена") : choices.videoEnabled === false ? t("Камера выключена") : t("Ваше превью")}</span><small>{t("Только вы")}</small></div>
      {!cameraTesting && <div className="guest-design-only preflight-camera-state" style={{ display: "none" }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h12v14H3z M15 9l6-4v14l-6-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg><span>{choices.videoEnabled === false ? t("Камера выключена") : t("Проверить камеру")}</span></div>}
    </div>
    <MediaDevicePicker autoRequestPermissions={false} deviceRefreshKey={Number(cameraTesting) + Number(microphoneTesting)} permissionInputs={{ audio: choices.audioEnabled !== false, video: choices.videoEnabled !== false }} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId} onChange={value => change({ ...(value.cameraId !== undefined ? { videoDeviceId: value.cameraId } : {}), ...(value.microphoneId !== undefined ? { audioDeviceId: value.microphoneId } : {}), ...(value.headphonesId !== undefined ? { audioOutputId: value.headphonesId } : {}) })} />
    {choices.audioEnabled !== false && <div className="preflight-meter" style={{ display: "contents" }}>
      <AudioMeter db={level} label={t("Микрофон")} detail={microphoneTesting ? t("Говорите в микрофон: шкала показывает реальный сигнал. Звук микрофона не воспроизводится в динамиках.") : t("Нажмите «Проверить микрофон», затем говорите.")} />
      <div className="audio-gain-row"><span>{t("Усиление микрофона")}</span><input aria-label={t("Усиление микрофона")} type="range" min="0" max="200" value={choices.micGain} onChange={event => setChoices(value => ({ ...value, micGain: Number(event.target.value) }))} /><strong>{choices.micGain}%</strong></div>
    </div>}
    <p className="guest-design-only preflight-footnote" style={{ display: "none" }}>{t("Проверка устройств не подключает вас к эфиру.")}</p>
    <div className="guest-av-check-actions">
      <button type="button" className="button-secondary" disabled={busy || choices.audioEnabled === false} aria-pressed={microphoneTesting} onClick={() => {
        if (microphoneTesting) stopMicrophone();
        else void check(false, false, true);
      }}>{microphoneTesting ? t("Остановить тест микрофона") : t("Проверить микрофон")}</button>
      <button type="button" className="button-secondary" disabled={busy || choices.videoEnabled === false} aria-pressed={cameraTesting} onClick={() => void testCamera()}>{cameraTesting ? t("Остановить тест камеры") : t("Проверить камеру")}</button>
      <button type="button" className="button-secondary" disabled={busy} aria-pressed={speakerTesting} onClick={() => void testSpeaker()}>{speakerTesting ? t("Остановить тест звука") : t("Проверить наушники / динамики")}</button>
    </div>
    {notice && <p role="status">{translateWorkspaceMessage(t, notice)}</p>}
    {error && <div className="av-error"><p role="alert">{translateWorkspaceMessage(t, error)}</p>{captureError && <button type="button" className="button-secondary" disabled={busy} onClick={startPreview}>{t("Повторить")}</button>}</div>}
    <div className="guest-av-join-actions">
      <button type="button" className="button-primary" disabled={busy} onClick={() => { onJoinGesture?.(); void check(true); }}>{busy ? t("Проверка…") : joinLabel || t("Войти в конференцию")}</button>
    </div>
    <p className="guest-design-only preflight-headphone-note" style={{ display: "none" }}>{t("Используйте наушники, чтобы звук студии не возвращался в ваш микрофон.")}</p>
  </div></main>;
}
