"use client";

import { AccessGate } from "@/components/AccessGate";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoomContext, StartAudio, VideoConference } from "@livekit/components-react";
import { Room } from "livekit-client";

function MonitorContent() {
  const params = useSearchParams();
  const roomName = params.get("room") || "demo-room";
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: false }));
  const [status, setStatus] = useState("Подключение…");
  const [token, setToken] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const monitoring = usePersonalMonitoring(room, roomName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const identity = `monitor-${crypto.randomUUID()}`;
        const response = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&name=LAN%20Monitor&role=monitor`);
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        if (!cancelled) setToken(data.token);
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "Ошибка подключения");
      }
    })();
    return () => { cancelled = true; };
  }, [roomName]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    let stopTelemetry: (() => void) | undefined;
    (async () => {
      try {
        await room.connect(getLiveKitUrl(), token);
        if (active) { stopTelemetry = startRoomTelemetry(room, roomName, token); setStatus("Онлайн · контроль конференции"); }
      } catch (e) {
        if (active) setStatus(e instanceof Error ? e.message : "Ошибка подключения");
      }
    })();
    return () => { active = false; stopTelemetry?.(); room.disconnect(); };
  }, [room, token, roomName]);

  return <main className="monitor-page">
    <div className="studio-header">
      <div><p className="muted">StudioLink · LAN Monitor</p><h1>{roomName}</h1></div>
      <div className="monitor-head-actions"><div className="status-pill">{status}</div><button className="settings-gear" title="Настройки звука" aria-label="Настройки звука" onClick={() => setSettingsOpen((v) => !v)}>⚙</button></div>
    </div>
    {settingsOpen && <div className="panel personal-monitor-panel"><h2>Мониторинг у меня</h2>{monitoring.participants.filter((p) => p.trackPublications.size > 0).map((p) => <div className="personal-monitor-row" key={p.identity}>
      <strong>{p.name || p.identity}</strong><MonitoringControls name={p.name || p.identity} value={monitoring.preferences[p.identity]} onChange={(patch) => monitoring.change(p.identity, patch)} />
    </div>)}</div>}
    <div className="monitor-help">Этот клиент только принимает конференцию: камера и микрофон этого устройства не публикуются.</div>
    <RoomContext.Provider value={room}>
      <StartAudio label="Включить звук конференции" className="monitor-audio-button" />
      <VideoConference />
    </RoomContext.Provider>
  </main>;
}

function ProtectedMonitor() {
  const params = useSearchParams(); const name = params.get("room") || "demo-room";
  return <AccessGate kind="guest" room={name} key={name}><MonitorContent /></AccessGate>;
}
export default function MonitorPage() {
  return <Suspense fallback={<main><div className="panel">Загрузка Monitor Client…</div></main>}><ProtectedMonitor /></Suspense>;
}
