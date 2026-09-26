"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

export function AudioOutputSelect({ room }: { room?: Room }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState("default");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setSupported("setSinkId" in HTMLMediaElement.prototype);
    let active = true;
    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(list.filter(d => d.kind === "audiooutput" && d.deviceId !== "default"));
      } catch { if (active) setError("Не удалось получить список устройств вывода"); }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    room?.on(RoomEvent.LocalTrackPublished, refresh);
    return () => { active = false; navigator.mediaDevices?.removeEventListener("devicechange", refresh); room?.off(RoomEvent.LocalTrackPublished, refresh); };
  }, [room]);
  useEffect(() => {
    if (!supported) return;
    let active = true;
    const apply = async () => {
      try {
        if (room && selected !== "default") await room.switchActiveDevice("audiooutput", selected);
        // Local self-monitor elements are not managed by RoomAudioRenderer.
        if (selected !== "default") await Promise.all(Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video")).map(el =>
          (el as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(selected)));
        if (active) setError("");
      } catch { if (active) setError("Не удалось выбрать выход звука. Проверьте подключение устройства и разрешения браузера."); }
    };
    void apply();
    const observer = new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches("audio, video") || node.querySelector("audio, video"))))) void apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    room?.on(RoomEvent.Connected, apply);
    return () => { active = false; observer.disconnect(); room?.off(RoomEvent.Connected, apply); };
  }, [room, selected, supported]);
  return <label>Вывод звука<select aria-label="Вывод звука" disabled={!supported} value={selected} onChange={e => setSelected(e.target.value)}>
    <option value="default">Системное устройство</option>
    {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Динамики / наушники"}</option>)}
  </select>{!supported && <small>В этом браузере выход выбирается в настройках системы.</small>}{error && <small role="alert">{error}</small>}</label>;
}
