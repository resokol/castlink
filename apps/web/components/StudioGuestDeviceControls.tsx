"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import type { GuestDeviceKind, GuestDeviceRequest, GuestDeviceResult, GuestDeviceState } from "@/lib/guest-device-control";
type View = { participantSid?: string; offline?: boolean; state?: GuestDeviceState; request?: GuestDeviceRequest; result?: GuestDeviceResult };
export function StudioGuestDeviceControls({ studioId, roomName, identity, name, connected = true }: { studioId: string; roomName: string; identity: string; name: string; connected?: boolean }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scope = useRef(0);
  const revision = useRef(0);
  useEffect(() => {
    scope.current++;
    let active = true, reading = false;
    const refresh = async () => {
      if (reading) return;
      reading = true;
      const sampledRevision = revision.current;
      try {
        const response = await fetch(`/api/guest-device-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("Не удалось получить устройства кастера");
        const data = await response.json();
        if (active && sampledRevision === revision.current) { setView(data); setError(data.result?.error || ""); setNow(Date.now()); }
      } catch (cause) { if (active && sampledRevision === revision.current) { setError(cause instanceof Error ? cause.message : "Не удалось получить устройства кастера"); setView(current => current ? { ...current, offline: true } : current); setNow(Date.now()); } }
      finally { reading = false; }
    };
    setView(undefined); setSending(false); setError(""); void refresh(); const timer = setInterval(() => void refresh(), 2000);
    return () => { active = false; scope.current++; clearInterval(timer); };
  }, [studioId, roomName, identity]);
  const requestDevice = async (kind: GuestDeviceKind, deviceId: string) => {
    const target = view?.state?.devices.find(device => device.kind === kind && device.deviceId === deviceId);
    if (!target || !view?.participantSid || sending) return;
    const requestedScope = scope.current;
    revision.current++;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/guest-device-control", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "request", studioId, room: roomName, identity, participantSid: view.participantSid, target }) });
      const data = await response.json();
      if (requestedScope !== scope.current) return;
      if (!response.ok) throw new Error(data.error || "Не удалось запросить смену устройства кастера");
      setView(current => current ? { ...current, request: data.request, result: undefined } : current); setNow(Date.now());
    } catch (cause) { if (requestedScope === scope.current) setError(cause instanceof Error ? cause.message : "Не удалось запросить смену устройства кастера"); }
    finally { if (requestedScope === scope.current) { revision.current++; setSending(false); } }
  };
  const pending = sending || !!view?.request && view.request.expiresAt > now;
  const disabled = pending || !connected || !!view?.offline || !view?.state;
  const labels: Record<GuestDeviceKind, string> = { audioinput: "Микрофон кастера", videoinput: "Камера кастера", audiooutput: "Выход звука кастера" };
  const status = pending ? t("Ожидаем решения кастера…") : view?.request && view.request.expiresAt <= now ? t("Кастер не ответил на запрос устройства вовремя") : view?.result?.outcome === "declined" ? t("Кастер отклонил смену устройства") : view?.result?.outcome === "saved" ? t("Кастер подтвердил выбор. Устройство применится при включении.") : view?.result?.outcome === "applied" ? t("Кастер подтвердил смену. Устройство проверено.") : !connected || view?.offline ? t("Кастер отключён") : view?.state ? t("Смена устройств требует подтверждения кастера") : t("Ожидаем список устройств кастера…");
  return <div className="studio-guest-device-controls">
    {(["audioinput", "videoinput", "audiooutput"] as GuestDeviceKind[]).map(kind => <label key={kind}>{t(labels[kind])}<select aria-label={t("{device} — {name}", { device: t(labels[kind]), name })} value={view?.state?.selected[kind] || ""} disabled={disabled || kind === "audiooutput" && !view?.state?.outputSupported} onChange={event => void requestDevice(kind, event.target.value)}><option value="" disabled>{t("Выберите устройство")}</option>{view?.state?.devices.filter(device => device.kind === kind).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label === "Системный выход звука" ? t("Системный выход звука") : device.label}</option>)}</select></label>)}
    <small role="status">{status}</small>
    {view?.state && !view.state.outputSupported && <small>{t("Браузер кастера не поддерживает выбор выхода звука")}</small>}
    {error && <small role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
}
