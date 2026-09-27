"use client";
import { useEffect, useRef, useState } from "react";
import { MediaDevicePicker } from "./MediaDevicePicker";
import { guestCaptureConstraints, type GuestChoices } from "@/lib/guest-media";

export function GuestAvCheck({ name, onJoin, preferredLabels, initialChoices }: { name: string; onJoin: (choices: GuestChoices) => void; preferredLabels?: { audio?: string; video?: string; output?: string }; initialChoices?: GuestChoices }) {
  const [choices, setChoices] = useState<GuestChoices>(() => ({ height: initialChoices?.height || 720, micGain: initialChoices?.micGain ?? 100, listenGain: initialChoices?.listenGain ?? 100, audioEnabled: initialChoices?.audioEnabled !== false, videoEnabled: initialChoices?.videoEnabled !== false, audioOutputId: "default" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [level, setLevel] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const context = useRef<AudioContext | undefined>(undefined);
  const raf = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const restoring = useRef(false);
  const stop = () => {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = undefined;
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    void context.current?.close().catch(() => undefined); context.current = undefined;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => () => { generation.current++; stop(); }, []);
  const change = (patch: Partial<GuestChoices>) => { generation.current++; stop(); setLevel(0); setBusy(false); setError(""); setChoices(value => ({ ...value, ...patch })); };
  const check = async (join: boolean, restore = false) => {
    const attempt = ++generation.current;
    setBusy(true); setError(""); stop();
    let captured: MediaStream | undefined;
    try {
      let next = { ...choices };
      const constraints = guestCaptureConstraints(next);
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
      if (video.current && captured) { video.current.srcObject = captured; void video.current.play().catch(() => undefined); }
      if (captured?.getAudioTracks().length) {
        const ctx = new AudioContext(); context.current = ctx;
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
        ctx.createMediaStreamSource(new MediaStream(captured.getAudioTracks())).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => { if (attempt !== generation.current) return; analyser.getByteFrequencyData(samples); setLevel(Math.min(100, samples.reduce((a, b) => a + b, 0) / samples.length * 1.4)); raf.current = requestAnimationFrame(tick); };
        tick();
      }
    } catch (cause) {
      captured?.getTracks().forEach(track => track.stop());
      if (attempt === generation.current) setError(cause instanceof Error ? cause.message : "Не удалось открыть устройства");
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  useEffect(() => {
    if (!initialChoices || restoring.current) return;
    restoring.current = true;
    // Defer until after StrictMode's setup/cleanup probe.
    const timer = setTimeout(() => { void check(true, true); }, 0);
    return () => { clearTimeout(timer); restoring.current = false; };
  }, [initialChoices]);
  return <main className="media-page guest-av-page"><div className="panel av-check">
    <div><p className="muted">CastLink · проверка перед эфиром</p><h1>{name}</h1></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" aria-pressed={choices.videoEnabled === false} onClick={() => change({ videoEnabled: choices.videoEnabled === false })}>{choices.videoEnabled === false ? "Камера отключена ✓" : "Войти без камеры"}</button>
      <button type="button" aria-pressed={choices.audioEnabled === false} onClick={() => change({ audioEnabled: choices.audioEnabled === false })}>{choices.audioEnabled === false ? "Микрофон отключён ✓" : "Войти без микрофона"}</button>
    </div>
    <p className="muted">Можно отключить одно или оба устройства. Отключение микрофона не выключает звук студии и участников.</p>
    <video ref={video} muted playsInline className="av-preview" style={{ display: choices.videoEnabled === false ? "none" : undefined }} />
    <MediaDevicePicker autoRequestPermissions={false} permissionInputs={{ audio: choices.audioEnabled !== false, video: choices.videoEnabled !== false }} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId} onChange={value => change({ ...(value.cameraId !== undefined ? { videoDeviceId: value.cameraId } : {}), ...(value.microphoneId !== undefined ? { audioDeviceId: value.microphoneId } : {}), ...(value.headphonesId !== undefined ? { audioOutputId: value.headphonesId } : {}) })} />
    {choices.audioEnabled !== false && <div className="audio-gain-row"><span>Микрофон</span><div className="gain-meter"><div className="gain-signal" style={{ width: `${Math.min(100, level * choices.micGain / 100)}%` }} /><input aria-label="Уровень микрофона" type="range" min="0" max="200" value={choices.micGain} onChange={event => setChoices(value => ({ ...value, micGain: Number(event.target.value) }))} /></div><strong>{choices.micGain}%</strong></div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="av-error" role="alert">{error}</p>}
    <button type="button" className="button-secondary" disabled={busy} onClick={() => void check(false)}>Проверить устройства</button>
    <button type="button" className="button-primary" disabled={busy} onClick={() => void check(true)}>{busy ? "Проверка…" : "Войти в конференцию"}</button>
  </div></main>;
}
