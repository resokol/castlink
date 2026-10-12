"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GuestMediaSettingsCommand, GuestMediaSettingsPatch, GuestMediaSettingsState } from "@/lib/guest-media-control";
import type { GuestConnectionRoutes } from "@/lib/connection-route";

type View = { participantSid?: string; offline?: boolean; state?: GuestMediaSettingsState; command?: GuestMediaSettingsCommand; result?: { id: string; ok: boolean; error?: string }; connectionRoutes?: GuestConnectionRoutes };
export type GuestControlActivity = { pending: boolean; error?: string };
export function StudioGuestMediaControls({ studioId, roomName, identity, name, connected = true, onActivity, render }: { studioId: string; roomName: string; identity: string; name: string; connected?: boolean; onActivity?: (activity: GuestControlActivity) => void; render?: (controls: ReactNode) => ReactNode }) {
  const [view, setView] = useState<View>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const callback = useRef(onActivity); callback.current = onActivity;
  const latestView = useRef(view); latestView.current = view;
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/guest-media-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось получить настройки гостя");
        if (active) {
          const pending = !!data.command && data.command.expiresAt > Date.now();
          const error = data.result?.error || (data.command?.expiresAt < Date.now() ? "Гость не подтвердил команду. Можно повторить." : undefined);
          setView(data); setError(error || ""); callback.current?.({ pending, ...(error ? { error } : {}) });
        }
      } catch (cause) { if (active) {
        const error = cause instanceof Error ? cause.message : "Не удалось получить настройки";
        setError(error);
        if (latestView.current?.command && latestView.current.command.expiresAt <= Date.now()) callback.current?.({ pending: false, error });
      } }
    };
    void refresh(); const timer = setInterval(() => { void refresh(); }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [studioId, roomName, identity]);
  const change = async (patch: GuestMediaSettingsPatch) => {
    if (!view?.participantSid || sending) return;
    setSending(true); setError(""); callback.current?.({ pending: true });
    try {
      const response = await fetch("/api/guest-media-control", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "command", studioId, room: roomName, identity, participantSid: view.participantSid, patch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить команду");
      setView(current => current ? { ...current, command: data.command, result: undefined } : current);
    } catch (cause) { const error = cause instanceof Error ? cause.message : "Не удалось отправить команду"; setError(error); callback.current?.({ pending: false, error }); }
    finally { setSending(false); }
  };
  const pending = sending || !!view?.command && view.command.expiresAt > Date.now();
  const disabled = pending || !view?.state || !connected || !!view?.offline;
  const controls = <div className="studio-guest-media-controls">
    <label>Звук гостя <select aria-label={`Режим микрофона ${name}`} value={view?.state?.audioProfile || "speech"} disabled={disabled} onChange={event => void change({ audioProfile: event.target.value as "speech" | "raw" })}><option value="speech">Шумоподавление</option><option value="raw">Оригинальный звук</option></select></label>
    <label>Маршрут гостя <select aria-label={`Маршрут подключения ${name}`} value={view?.state?.connectionRoute || "auto"} disabled={disabled} onChange={event => void change({ connectionRoute: event.target.value as "auto" | "normal" | "relay" })}><option value="auto">Автоматически</option><option value="normal">Обычный</option><option value="relay" disabled={!view?.connectionRoutes?.relay.configured}>Запасной TURN</option></select></label>
    <small role="status">{pending ? connected ? "Ожидаем подтверждение гостя…" : "Переподключение…" : !connected || view?.offline ? "Гость отключён. Показаны последние подтверждённые настройки." : view?.state ? "Настройки подтверждены гостем." : "Ожидаем состояние гостя…"}</small>
    {view?.state && <small>{view.state.noiseSuppressionState === "on" ? "Шумоподавление включено на микрофоне гостя." : view.state.noiseSuppressionState === "off" ? "Шумоподавление выключено." : view.state.noiseSuppressionState === "pending" ? "Обработка применится при включении микрофона." : "Браузер гостя не подтвердил состояние шумоподавления."}</small>}
    {view?.state?.audioProfile === "raw" && <small>Для оригинального звука гостю нужны наушники.</small>}
    {view?.connectionRoutes?.relay.configured && <small>{view.connectionRoutes.relay.transport === "tls443" ? "TURN через TLS:443." : "TURN через UDP; сеть должна пропускать UDP."} Смена маршрута переподключает гостя.</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
  return render ? render(controls) : controls;
}
