"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  cameraId?: string;
  microphoneId?: string;
  headphonesId?: string;
  onChange: (change: { cameraId?: string; microphoneId?: string; headphonesId?: string }) => void;
  className?: string;
};

export function MediaDevicePicker({ cameraId = "", microphoneId = "", headphonesId = "default", onChange, className = "" }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState("");
  const [outputSupported, setOutputSupported] = useState(false);
  const refresh = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      setDevices(await navigator.mediaDevices.enumerateDevices());
      setPermissionError("");
    } catch (error) {
      try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch {}
      setPermissionError(error instanceof Error ? error.message : "Нет доступа к устройствам");
    }
  };
  useEffect(() => {
    setOutputSupported("setSinkId" in HTMLMediaElement.prototype);
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, []);
  useEffect(() => {
    if (!outputSupported || !headphonesId || headphonesId === "default") return;
    const apply = async () => {
      try { await Promise.all(Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")).map(element => (element as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(headphonesId))); } catch {}
    };
    void apply();
  }, [headphonesId, outputSupported]);
  const cameras = useMemo(() => devices.filter(device => device.kind === "videoinput"), [devices]);
  const microphones = useMemo(() => devices.filter(device => device.kind === "audioinput"), [devices]);
  const headphones = useMemo(() => devices.filter(device => device.kind === "audiooutput" && device.deviceId !== "default"), [devices]);
  const label = (device: MediaDeviceInfo, fallback: string) => device.label || fallback;
  return <div className={`media-device-picker ${className}`}>
    <label>Камера<select aria-label="Камера" value={cameraId} onChange={event => onChange({ cameraId: event.target.value })}><option value="">Системная камера</option>{cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Камера")}</option>)}</select></label>
    <label>Микрофон<select aria-label="Микрофон" value={microphoneId} onChange={event => onChange({ microphoneId: event.target.value })}><option value="">Системный микрофон</option>{microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Микрофон")}</option>)}</select></label>
    <label>Наушники<select aria-label="Наушники" disabled={!outputSupported} value={headphonesId} onChange={event => onChange({ headphonesId: event.target.value })}><option value="default">Системный выход</option>{headphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Наушники / динамики")}</option>)}</select></label>
    {permissionError && <small className="media-device-error">Разрешите доступ к камере и микрофону, чтобы увидеть названия устройств.</small>}
    {!outputSupported && <small className="media-device-error">Выбор наушников не поддерживается этим браузером.</small>}
    <button type="button" className="button-secondary device-refresh-button" onClick={() => void refresh()}>Обновить список устройств</button>
  </div>;
}
