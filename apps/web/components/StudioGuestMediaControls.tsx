"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GuestMediaSettingsCommand, GuestMediaSettingsPatch, GuestMediaSettingsState } from "@/lib/guest-media-control";
import type { GuestConnectionRoutes } from "@/lib/connection-route";

type View = { participantSid?: string; offline?: boolean; state?: GuestMediaSettingsState; command?: GuestMediaSettingsCommand; result?: { id: string; ok: boolean; error?: string }; connectionRoutes?: GuestConnectionRoutes };
export type GuestControlActivity = { pending: boolean; error?: string };
export function StudioGuestMediaControls({ studioId, roomName, identity, name, connected = true, onActivity, render }: { studioId: string; roomName: string; identity: string; name: string; connected?: boolean; onActivity?: (activity: GuestControlActivity) => void; render?: (controls: ReactNode) => ReactNode }) {
  const { t, locale } = useI18n();
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
    <label>{t("Звук гостя")} <select aria-label={t("Режим микрофона {name}", { name: name })} value={view?.state?.audioProfile || "speech"} disabled={disabled} onChange={event => void change({ audioProfile: event.target.value as "speech" | "raw" })}><option value="speech">{t("Шумоподавление")}</option><option value="raw">{t("Оригинальный звук")}</option></select></label>
    <label>{t("Маршрут гостя")} <select aria-label={t("Маршрут подключения {name}", { name: name })} value={view?.state?.connectionRoute || "auto"} disabled={disabled} onChange={event => void change({ connectionRoute: event.target.value as "auto" | "normal" | "relay" })}><option value="auto">{t("Автоматически")}</option><option value="normal">{t("Обычный")}</option><option value="relay" disabled={!view?.connectionRoutes?.relay.configured}>{t("Запасной TURN")}</option></select></label>
    <small role="status">{pending ? connected ? t("Ожидаем подтверждение гостя…") : t("Переподключение…") : !connected || view?.offline ? t("Гость отключён. Показаны последние подтверждённые настройки.") : view?.state ? t("Настройки подтверждены гостем.") : t("Ожидаем состояние гостя…")}</small>
    {view?.state && <small>{view.state.noiseSuppressionState === "on" ? t("Шумоподавление включено на микрофоне гостя.") : view.state.noiseSuppressionState === "off" ? t("Шумоподавление выключено.") : view.state.noiseSuppressionState === "pending" ? t("Обработка применится при включении микрофона.") : t("Браузер гостя не подтвердил состояние шумоподавления.")}</small>}
    {view?.state?.audioProfile === "raw" && <small>{t("Для оригинального звука гостю нужны наушники.")}</small>}
    {view?.connectionRoutes?.relay.configured && <small>{view.connectionRoutes.relay.transport === "tls443" ? t("TURN через TLS:443.") : t("TURN через UDP; сеть должна пропускать UDP.")} {t("Смена маршрута переподключает гостя.")}</small>}
    {error && <small role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
  return render ? render(controls) : controls;
}
