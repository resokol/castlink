"use client";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState } from "react";
import { MediaDevicePicker } from "./MediaDevicePicker";
import { AudioMeter } from "./AudioMeter";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { startSpeakerTest } from "@/lib/audio-device-test";
import { guestVideoCodec } from "@/lib/guest-video-codec";
import { guestAudioProfile } from "@/lib/guest-audio";
import { guestCaptureConstraints, type GuestChoices } from "@/lib/guest-media";

export function GuestAvCheck({ name, onJoin, preferredLabels, initialChoices }: { name: string; onJoin: (choices: GuestChoices) => void; preferredLabels?: { audio?: string; video?: string; output?: string }; initialChoices?: GuestChoices }) {
  const { t, locale } = useI18n();
  const [choices, setChoices] = useState<GuestChoices>(() => ({ height: initialChoices?.height || 720, micGain: initialChoices?.micGain ?? 100, listenGain: initialChoices?.listenGain ?? 100, audioEnabled: initialChoices?.audioEnabled !== false, videoEnabled: initialChoices?.videoEnabled !== false, audioProfile: guestAudioProfile(initialChoices?.audioProfile), videoCodec: guestVideoCodec(initialChoices?.videoCodec), connectionRoute: initialChoices?.connectionRoute || "auto", audioOutputId: "default" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [level, setLevel] = useState(METER_FLOOR_DB);
  const [microphoneTesting, setMicrophoneTesting] = useState(false);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const stopMeter = useRef<(() => void) | undefined>(undefined);
  const speaker = useRef<ReturnType<typeof startSpeakerTest> | undefined>(undefined);
  const generation = useRef(0);
  const restoring = useRef(false);
  const stop = () => {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = undefined;
    stopMeter.current?.(); stopMeter.current = undefined;
    speaker.current?.stop(); speaker.current = undefined;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => () => { generation.current++; stop(); }, []);
  const change = (patch: Partial<GuestChoices>) => { generation.current++; stop(); setLevel(METER_FLOOR_DB); setMicrophoneTesting(false); setSpeakerTesting(false); setBusy(false); setError(""); setChoices(value => ({ ...value, ...patch })); };
  const check = async (join: boolean, restore = false, microphoneOnly = false) => {
    const attempt = ++generation.current;
    setBusy(true); setError(""); setLevel(METER_FLOOR_DB); setMicrophoneTesting(false); setSpeakerTesting(false); stop();
    let captured: MediaStream | undefined;
    try {
      let next = { ...choices };
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
      next.audioDeviceId = captured?.getAudioTracks()[0]?.getSettings().deviceId || next.audioDeviceId;
      next.videoDeviceId = captured?.getVideoTracks()[0]?.getSettings().deviceId || next.videoDeviceId;
      setChoices(next);
      if (join) { captured?.getTracks().forEach(track => track.stop()); onJoin(next); return; }
      stream.current = captured;
      if (video.current && captured?.getVideoTracks().length) { video.current.srcObject = captured; void video.current.play().catch(() => undefined); }
      if (captured?.getAudioTracks().length) {
        stopMeter.current = observePcmTrack(captured.getAudioTracks()[0], db => { if (attempt === generation.current) setLevel(db); });
        setMicrophoneTesting(true);
      }
    } catch (cause) {
      captured?.getTracks().forEach(track => track.stop());
      if (attempt === generation.current) { stop(); setLevel(METER_FLOOR_DB); setMicrophoneTesting(false); setError(cause instanceof Error ? cause.message : "Не удалось открыть устройства"); }
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  const testSpeaker = async () => {
    if (speakerTesting) { speaker.current?.stop(); speaker.current = undefined; setSpeakerTesting(false); return; }
    const attempt = generation.current;
    setError(""); setSpeakerTesting(true);
    let test: ReturnType<typeof startSpeakerTest> | undefined;
    try {
      test = startSpeakerTest(choices.audioOutputId || "default"); speaker.current = test;
      await test.finished;
    } catch (cause) { if (attempt === generation.current && (!test || speaker.current === test)) setError(cause instanceof Error ? cause.message : "Не удалось проверить выход звука"); }
    finally { if (attempt === generation.current && (!test || speaker.current === test)) { speaker.current = undefined; setSpeakerTesting(false); } }
  };
  useEffect(() => {
    if (!initialChoices || restoring.current) return;
    restoring.current = true;
    // Defer until after StrictMode's setup/cleanup probe.
    const timer = setTimeout(() => { void check(true, true); }, 0);
    return () => { clearTimeout(timer); restoring.current = false; };
  }, [initialChoices]);
  return <main className="media-page guest-av-page graphite-entry"><div className="panel av-check">
    <div><p className="muted">{t("CastLink · проверка перед эфиром")}</p><h1>{name}</h1></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" aria-pressed={choices.videoEnabled === false} onClick={() => change({ videoEnabled: choices.videoEnabled === false })}>{choices.videoEnabled === false ? t("Камера отключена ✓") : t("Войти без камеры")}</button>
      <button type="button" aria-pressed={choices.audioEnabled === false} onClick={() => change({ audioEnabled: choices.audioEnabled === false })}>{choices.audioEnabled === false ? t("Микрофон отключён ✓") : t("Войти без микрофона")}</button>
    </div>
    <p className="muted">{t("Можно отключить одно или оба устройства. Отключение микрофона не выключает звук студии и участников.")}</p>
    <video ref={video} muted playsInline className="av-preview" style={{ display: choices.videoEnabled === false ? "none" : undefined }} />
    <MediaDevicePicker autoRequestPermissions={false} permissionInputs={{ audio: choices.audioEnabled !== false, video: choices.videoEnabled !== false }} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId} onChange={value => change({ ...(value.cameraId !== undefined ? { videoDeviceId: value.cameraId } : {}), ...(value.microphoneId !== undefined ? { audioDeviceId: value.microphoneId } : {}), ...(value.headphonesId !== undefined ? { audioOutputId: value.headphonesId } : {}) })} />
    {choices.audioEnabled !== false && <>
      <AudioMeter db={level} label={t("Микрофон")} detail={microphoneTesting ? t("Говорите в микрофон: шкала показывает реальный сигнал. Звук микрофона не воспроизводится в динамиках.") : t("Нажмите «Проверить микрофон», затем говорите.")} />
      <div className="audio-gain-row"><span>{t("Усиление микрофона")}</span><input aria-label={t("Усиление микрофона")} type="range" min="0" max="200" value={choices.micGain} onChange={event => setChoices(value => ({ ...value, micGain: Number(event.target.value) }))} /><strong>{choices.micGain}%</strong></div>
    </>}
    <div className="guest-av-check-actions">
      <button type="button" className="button-secondary" disabled={busy || choices.audioEnabled === false} aria-pressed={microphoneTesting} onClick={() => {
        if (microphoneTesting) { generation.current++; stop(); setLevel(METER_FLOOR_DB); setMicrophoneTesting(false); setSpeakerTesting(false); }
        else void check(false, false, true);
      }}>{microphoneTesting ? t("Остановить тест микрофона") : t("Проверить микрофон")}</button>
      <button type="button" className="button-secondary" disabled={busy} aria-pressed={speakerTesting} onClick={() => void testSpeaker()}>{speakerTesting ? t("Остановить тест звука") : t("Проверить наушники / динамики")}</button>
    </div>
    {notice && <p role="status">{translateWorkspaceMessage(t, notice)}</p>}
    {error && <p className="av-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
    <div className="guest-av-check-actions">
      <button type="button" className="button-secondary" disabled={busy} onClick={() => void check(false)}>{t("Проверить устройства")}</button>
      <button type="button" className="button-primary" disabled={busy} onClick={() => void check(true)}>{busy ? t("Проверка…") : t("Войти в конференцию")}</button>
    </div>
  </div></main>;
}
