"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { applyAudioOutput } from "@/lib/audio-output";

type Props = {
  cameraId?: string;
  microphoneId?: string;
  headphonesId?: string;
  onChange: (change: { cameraId?: string; microphoneId?: string; headphonesId?: string }) => void;
  className?: string;
  room?: Room;
  disabledInputs?: boolean;
  disabledMicrophoneInput?: boolean;
  disabledOutput?: boolean;
  autoRequestPermissions?: boolean;
  permissionInputs?: { audio: boolean; video: boolean };
  onDevicesChanged?: (devices: MediaDeviceInfo[]) => void;
  onOutputStatus?: (deviceId: string, error: string) => void;
  outputRequestKey?: number;
};

export function MediaDevicePicker({ cameraId = "", microphoneId = "", headphonesId = "default", onChange, className = "", room, disabledInputs = false, disabledMicrophoneInput = false, disabledOutput = false, autoRequestPermissions = true, permissionInputs = { audio: true, video: true }, onDevicesChanged, onOutputStatus, outputRequestKey = 0 }: Props) {
  const { t, locale } = useI18n();
  const callbacks = useRef({ onDevicesChanged, onOutputStatus });
  callbacks.current = { onDevicesChanged, onOutputStatus };
  const permissionGeneration = useRef(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState("");
  const [outputSupported, setOutputSupported] = useState(false);
  const [outputError, setOutputError] = useState("");
  useEffect(() => { callbacks.current.onDevicesChanged?.(devices); }, [devices]);
  const refresh = async (requestPermissions = false) => {
    const generation = ++permissionGeneration.current;
    const current = () => generation === permissionGeneration.current;
    try {
      // Populate immediately from existing grants before opening permission prompts.
      const available = await navigator.mediaDevices.enumerateDevices();
      if (!current()) return;
      setDevices(available);
      if (requestPermissions && (permissionInputs.audio || permissionInputs.video)) {
        let denied: unknown;
        // A denied/missing camera must not hide an allowed microphone (or vice versa).
        for (const kind of ["audio", "video"] as const) {
          if (!current()) return;
          if (!permissionInputs[kind]) continue;
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: kind === "audio", video: kind === "video" });
            stream.getTracks().forEach(track => track.stop());
          } catch (error) { denied = error; }
        }
        if (denied) throw denied;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (current()) { setDevices(devices); setPermissionError(""); }
    } catch (error) {
      if (!current()) return;
      try { const devices = await navigator.mediaDevices.enumerateDevices(); if (current()) setDevices(devices); } catch {}
      if (current()) setPermissionError(error instanceof Error ? error.message : "Нет доступа к устройствам");
    }
  };
  useEffect(() => {
    setOutputSupported("setSinkId" in HTMLMediaElement.prototype);
    void refresh(autoRequestPermissions);
    const changed = () => { void refresh(false); };
    navigator.mediaDevices?.addEventListener("devicechange", changed);
    return () => { permissionGeneration.current++; navigator.mediaDevices?.removeEventListener("devicechange", changed); };
  }, [autoRequestPermissions, permissionInputs.audio, permissionInputs.video]);
  useEffect(() => {
    // A confirmed remote switch owns the output until its result is committed.
    if (!outputSupported || disabledOutput) return;
    let active = true;
    const apply = async (newChoice = false) => {
      try {
        const applied = await applyAudioOutput(room, headphonesId || "default", Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")), newChoice);
        if (active && applied) { setOutputError(""); callbacks.current.onOutputStatus?.(headphonesId || "default", ""); }
      } catch (cause) {
        if (active) {
          const error = cause instanceof Error ? cause.message : "Не удалось переключить вывод звука";
          setOutputError(error); callbacks.current.onOutputStatus?.(headphonesId || "default", error);
        }
      }
    };
    void apply(true);
    const observer = new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node => node instanceof Element &&
        (node.matches("audio,video") || node.querySelector("audio,video"))))) void apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    room?.on(RoomEvent.Connected, apply);
    room?.on(RoomEvent.Reconnected, apply);
    return () => { active = false; observer.disconnect(); room?.off(RoomEvent.Connected, apply); room?.off(RoomEvent.Reconnected, apply); };
  }, [headphonesId, outputSupported, room, outputRequestKey, disabledOutput]);
  const cameras = useMemo(() => devices.filter(device => device.kind === "videoinput"), [devices]);
  const microphones = useMemo(() => devices.filter(device => device.kind === "audioinput"), [devices]);
  const headphones = useMemo(() => devices.filter(device => device.kind === "audiooutput" && device.deviceId !== "default"), [devices]);
  const label = (device: MediaDeviceInfo, fallback: string) => device.label || fallback;
  return <div className={`media-device-picker ${className}`}>
    <label>{t("Камера · захват изображения")}<select aria-label={t("Камера")} disabled={disabledInputs} value={cameraId} onChange={event => onChange({ cameraId: event.target.value })}><option value="">{t("Системная камера")}</option>{cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, t("Камера"))}</option>)}</select></label>
    <label>{t("Микрофон · захват звука")}<select aria-label={t("Микрофон")} disabled={disabledInputs || disabledMicrophoneInput} value={microphoneId} onChange={event => onChange({ microphoneId: event.target.value })}><option value="">{t("Системный микрофон")}</option>{microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, t("Микрофон"))}</option>)}</select></label>
    <label>{t("Наушники / динамики · вывод звука")}<select aria-label={t("Наушники / динамики")} disabled={!outputSupported || disabledOutput} value={headphonesId} onChange={event => onChange({ headphonesId: event.target.value })}><option value="default">{t("Системный выход")}</option>{headphones.map(device => <option key={device.deviceId} value={device.deviceId}>{label(device, t("Наушники / динамики"))}</option>)}</select></label>
    {permissionError && <small className="media-device-error">{t("Разрешите доступ к камере и микрофону, чтобы увидеть названия устройств.")}</small>}
    {outputError && <small className="media-device-error" role="alert">{t("Не удалось переключить вывод:")} {translateWorkspaceMessage(t, outputError)}</small>}
    {!outputSupported && <small className="media-device-error">{t("Выбор наушников не поддерживается этим браузером.")}</small>}
    <button type="button" className="button-secondary device-refresh-button" disabled={disabledInputs || disabledMicrophoneInput || disabledOutput} onClick={() => void refresh(true)}>{t("Обновить список устройств")}</button>
  </div>;
}
