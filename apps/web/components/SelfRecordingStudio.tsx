"use client";

import { useEffect, useRef, useState } from "react";
import { EntryShell } from "./EntryShell";
import { useI18n } from "./I18nProvider";
import { MediaDevicePicker } from "./MediaDevicePicker";
import { AudioMeter } from "./AudioMeter";
import { SelfRecordingPresentation } from "./SelfRecordingPresentation";
import { SelfRecordingTakes } from "./SelfRecordingTakes";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { startLocalRecording } from "@/lib/self-recording";
import { FRAME_WIDTH, FRAME_HEIGHT, previewFrames, type PresentationFrame } from "@/lib/self-recording-frame";
import entry from "./EntryFlow.module.css";
import styles from "./SelfRecording.module.css";

type Phase = "setup" | "starting" | "recording" | "saving";
type Attempt = { stop?: () => void; cancelled: boolean; output: MediaStreamTrack };

function MicrophoneLevel({ track }: { track: MediaStreamTrack }) {
  const [db, setDb] = useState(METER_FLOOR_DB);
  useEffect(() => {
    try { return observePcmTrack(track, setDb); } catch { setDb(METER_FLOOR_DB); }
  }, [track]);
  return <AudioMeter db={db} compact />;
}

export function SelfRecordingStudio() {
  const { t } = useI18n();
  const monitor = useRef<HTMLCanvasElement>(null);
  const camera = useRef<HTMLVideoElement>(null);
  const source = useRef<PresentationFrame | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const interrupted = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [inputs, setInputs] = useState({ cameraId: "", microphoneId: "" });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [slidePending, setSlidePending] = useState(false);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const locked = phase !== "setup";

  function releaseCamera() {
    generation.current++;
    cameraStream.current?.getTracks().forEach(track => track.stop());
    cameraStream.current = null;
    if (camera.current) camera.current.srcObject = null;
    setStream(null); setDeviceBusy(false);
  }

  function stop() {
    const current = attempt.current;
    if (!current) return;
    current.cancelled = true;
    setPhase("saving");
    current.stop?.();
  }

  useEffect(() => {
    mounted.current = true;
    setSupported(!!(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype &&
      window.indexedDB && navigator.locks));
    const unload = (event: BeforeUnloadEvent) => {
      if (attempt.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      mounted.current = false; generation.current += 1;
      if (attempt.current) { attempt.current.cancelled = true; attempt.current.stop?.(); }
      cameraStream.current?.getTracks().forEach(track => track.stop());
      cameraStream.current = null;
    };
  }, []);
  useEffect(() => {
    if (!stream || !monitor.current || !camera.current) return;
    try { return previewFrames(monitor.current, camera.current, () => source.current); }
    catch { releaseCamera(); setError("Не удалось подготовить видеокадр. Попробуйте другой браузер."); }
  }, [stream]);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase, startTime]);

  async function enableCamera() {
    if (attempt.current) return;
    const request = ++generation.current;
    setDeviceBusy(true); setError(""); setMessage("");
    let media: MediaStream | undefined;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: inputs.microphoneId ? { deviceId: { exact: inputs.microphoneId } } : true,
        video: { width: { ideal: FRAME_WIDTH }, height: { ideal: FRAME_HEIGHT }, frameRate: { ideal: 25 },
          ...(inputs.cameraId ? { deviceId: { exact: inputs.cameraId } } : {}) },
      });
      if (request !== generation.current || !camera.current) return;
      const video = camera.current;
      video.srcObject = media; await video.play();
      if (request !== generation.current) return;
      if (!media.getAudioTracks().some(track => track.readyState === "live") ||
          !media.getVideoTracks().some(track => track.readyState === "live")) throw Error("Capture ended");
      cameraStream.current = media;
      for (const track of media.getTracks()) track.addEventListener("ended", () => {
        if (cameraStream.current !== media) return;
        if (attempt.current) { interrupted.current = true; stop(); }
        else { releaseCamera(); setError("Камера или микрофон отключились. Подключите устройства снова."); }
      }, { once: true });
      setStream(media);
    } catch {
      if (generation.current === request) {
        if (camera.current) camera.current.srcObject = null;
        setError("Не удалось включить камеру и микрофон. Проверьте устройства и разрешения браузера.");
      }
    } finally {
      if (media && media !== cameraStream.current) media.getTracks().forEach(track => track.stop());
      if (generation.current === request) setDeviceBusy(false);
    }
  }

  async function record() {
    if (attempt.current || !monitor.current || !cameraStream.current || slidePending) return;
    const mic = cameraStream.current.getAudioTracks()[0];
    if (!mic || mic.readyState !== "live") return;
    let current: Attempt | undefined;
    try {
      const output = monitor.current.captureStream(25).getVideoTracks()[0];
      current = { cancelled: false, output };
      attempt.current = current; interrupted.current = false;
      setError(""); setMessage(""); setPhase("starting"); setElapsed(0);
      const recorder = await startLocalRecording(new MediaStream([output, mic]), (take, failed) => {
        output.stop();
        if (attempt.current !== current) return;
        attempt.current = null;
        if (!mounted.current) return;
        releaseCamera();
        source.current = null; setSourceRevision(value => value + 1); setSlidePending(false);
        setPhase("setup"); setRevision(value => value + 1);
        if (interrupted.current && take?.bytes) setMessage("Устройство отключилось. Запись остановлена и сохранена.");
        else if (failed || !take?.bytes) setError("Запись прервалась. Проверьте свободное место и список сохранённых дублей.");
        else setMessage("Запись готова. Её можно посмотреть и скачать.");
      });
      current.stop = () => recorder.stop();
      if (current.cancelled || !mounted.current) recorder.stop();
      else if (attempt.current === current) { setStartTime(Date.now()); setPhase("recording"); }
    } catch {
      current?.output.stop();
      if (current && attempt.current !== current) return;
      attempt.current = null;
      if (mounted.current) { setPhase("setup"); setError("Не удалось начать запись. Проверьте свободное место и поддержку записи в браузере."); }
    }
  }

  const timer = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60]
    .map(n => String(n).padStart(2, "0")).join(":");
  return <EntryShell wide>
    <h1>{t("Самозапись выступления")}</h1>
    <p>{t("Камера, слайды и звук микрофона сохраняются на этом устройстве в видео Full HD (1920×1080). Приглашение в комнату не требуется.")}</p>
    {supported === false && <p role="alert">{t("Для самозаписи откройте CastLink по HTTPS в современном браузере с доступным локальным хранилищем.")}</p>}
    <div className={styles.studio}>
      <div className={styles.monitor}>
        <canvas ref={monitor} width={FRAME_WIDTH} height={FRAME_HEIGHT} aria-label={t("Кадр записи")} />
        {!stream && <span className={styles.placeholder}>{t("Здесь появится кадр записи")}</span>}
        <video className={styles.capture} ref={camera} muted autoPlay playsInline aria-hidden="true" />
      </div>
      <section className={styles.settings} aria-label={t("Настройка записи")}>
        <MediaDevicePicker {...inputs} kinds={["videoinput", "audioinput"]} autoRequestPermissions={false}
          disabledInputs={locked || deviceBusy || !supported} deviceRefreshKey={stream ? 1 : 0} compactLabels
          onChange={change => { releaseCamera(); setInputs(value => ({ ...value, ...change })); }} />
        {stream ? <><MicrophoneLevel track={stream.getAudioTracks()[0]} />
          <button type="button" disabled={locked} onClick={releaseCamera}>{t("Выключить камеру и микрофон")}</button></> :
          <button type="button" disabled={!supported || deviceBusy || locked} onClick={() => void enableCamera()}>{t(deviceBusy ? "Подключение устройств…" : "Включить камеру и микрофон")}</button>}
      </section>
    </div>
    {supported && <SelfRecordingPresentation key={sourceRevision} locked={locked}
      onSource={value => { source.current = value; }} onPending={setSlidePending} onError={setError} />}
    <div className={styles.transport}>
      {locked ? <button type="button" onClick={stop} disabled={phase !== "recording"} className={styles.stop}>
        {t(phase === "starting" ? "Подготовка записи…" : phase === "saving" ? "Сохранение записи…" : "Остановить запись")}</button> :
        <button className={entry.primary} type="button" onClick={() => void record()} disabled={!supported || !stream || deviceBusy || slidePending}>{t("Начать запись")}</button>}
      {phase === "recording" && <span className={styles.recording}>{t("Идёт запись")} <time>{timer}</time></span>}
    </div>
    {error && <p role="alert" className={entry.error}>{t(error)}</p>}
    {message && <p role="status">{t(message)}</p>}
    {supported !== null && <SelfRecordingTakes revision={revision} />}
  </EntryShell>;
}
