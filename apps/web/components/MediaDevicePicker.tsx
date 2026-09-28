"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

type Props = {
  cameraId?: string;
  microphoneId?: string;
  headphonesId?: string;
  onChange: (change: { cameraId?: string; microphoneId?: string; headphonesId?: string }) => void;
  className?: string;
  room?: Room;
  disabledInputs?: boolean;
  autoRequestPermissions?: boolean;
  permissionInputs?: { audio: boolean; video: boolean };
  onDevicesChanged?: (devices: MediaDeviceInfo[]) => void;
  onOutputStatus?: (deviceId: string, error: string) => void;
  outputRequestKey?: number;
};

export function MediaDevicePicker({ cameraId = "", microphoneId = "", headphonesId = "default", onChange, className = "", room, disabledInputs = false, autoRequestPermissions = true, permissionInputs = { audio: true, video: true }, onDevicesChanged, onOutputStatus, outputRequestKey = 0 }: Props) {
  const callbacks = useRef({ onDevicesChanged, onOutputStatus });
  callbacks.current = { onDevicesChanged, onOutputStatus };
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState("");
  const [outputSupported, setOutputSupported] = useState(false);
  const [outputError, setOutputError] = useState("");
  useEffect(() => { callbacks.current.onDevicesChanged?.(devices); }, [devices]);
  const refresh = async (requestPermissions = false) => {
    try {
      if (requestPermissions && (permissionInputs.audio || permissionInputs.video)) {
        const stream = await navigator.mediaDevices.getUserMedia(permissionInputs);
        stream.getTracks().forEach(track => track.stop());
      }
      setDevices(await navigator.mediaDevices.enumerateDevices());
      setPermissionError("");
    } catch (error) {
      try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch {}
      setPermissionError(error instanceof Error ? error.message : "Нет доступа к устройствам");
    }
  };
  useEffect(() => {
    setOutputSupported("setSinkId" in HTMLMediaElement.prototype);
    void refresh(autoRequestPermissions);
    const changed = () => { void refresh(false); };
    navigator.mediaDevices?.addEventListener("devicechange", changed);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", changed);
  }, [autoRequestPermissions, permissionInputs.audio, permissionInputs.video]);
  useEffect(() => {
    if (!outputSupported) return;
    let active = true;
    const applyElement = async (element: HTMLMediaElement): Promise<string> => {
      try {
        await (element as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(headphonesId || "default");
        return "";
      } catch (error) {
        return error instanceof Error ? error.message : "Не удалось переключить вывод звука";
      }
    };
    const apply = async () => {
      let roomError: unknown;
      try {
        if (room?.state === "connected") await room.switchActiveDevice("audiooutput", headphonesId || "default");
      } catch (error) { roomError = error; }
      const results = await Promise.all(Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")).map(applyElement));
      if (active) {
        const error = results.find(Boolean) || (roomError ? roomError instanceof Error ? roomError.message : "Не удалось выбрать устройство вывода звука" : "");
        setOutputError(error);
        callbacks.current.onOutputStatus?.(headphonesId || "default", error);
      }
    };
    void apply();
    const observer = new MutationObserver(records => {
      for (const node of records.flatMap(record => Array.from(record.addedNodes))) {
        if (!(node instanceof Element)) continue;
        if (node.matches("audio,video")) void applyElement(node as HTMLMediaElement).then(error => { if (active && error) setOutputError(error); });
        node.querySelectorAll<HTMLMediaElement>("audio,video").forEach(element => void applyElement(element).then(error => { if (active && error) setOutputError(error); }));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    room?.on(RoomEvent.Connected, apply);
    return () => { active = false; observer.disconnect(); room?.off(RoomEvent.Connected, apply); };
  }, [headphonesId, outputSupported, room, outputRequestKey]);
  const cameras = useMemo(() => devices.filter(device => device.kind === "videoinput"), [devices]);
  const microphones = useMemo(() => devices.filter(device => device.kind === "audioinput"), [devices]);
  const headphones = useMemo(() => devices.filter(device => device.kind === "audiooutput" && device.deviceId !== "default"), [devices]);
  const label = (device: MediaDeviceInfo, fallback: string) => device.label || fallback;
  return <div className={`media-device-picker ${className}`}>
    <label>Камера · захват изображения<select aria-label="Камера" disabled={disabledInputs} value={cameraId} onChange={event => onChange({ cameraId: event.target.value })}><option value="">Системная камера</option>{cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Камера")}</option>)}</select></label>
    <label>Микрофон · захват звука<select aria-label="Микрофон" disabled={disabledInputs} value={microphoneId} onChange={event => onChange({ microphoneId: event.target.value })}><option value="">Системный микрофон</option>{microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Микрофон")}</option>)}</select></label>
    <label>Наушники / динамики · вывод звука<select aria-label="Наушники / динамики" disabled={!outputSupported} value={headphonesId} onChange={event => onChange({ headphonesId: event.target.value })}><option value="default">Системный выход</option>{headphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, "Наушники / динамики")}</option>)}</select></label>
    {permissionError && <small className="media-device-error">Разрешите доступ к камере и микрофону, чтобы увидеть названия устройств.</small>}
    {outputError && <small className="media-device-error" role="alert">Не удалось переключить вывод: {outputError}</small>}
    {!outputSupported && <small className="media-device-error">Выбор наушников не поддерживается этим браузером.</small>}
    <button type="button" className="button-secondary device-refresh-button" onClick={() => void refresh(true)}>Обновить список устройств</button>
  </div>;
}
