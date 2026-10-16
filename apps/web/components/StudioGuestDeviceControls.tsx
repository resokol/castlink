"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { DEFAULT_CAMERA_TRANSFORM, type CameraTransform } from "@/lib/camera-transform";
import type { GuestDeviceKind, GuestDeviceRequest, GuestDeviceResult, GuestDeviceState } from "@/lib/guest-device-control";
type View = { participantSid?: string; offline?: boolean; state?: GuestDeviceState; request?: GuestDeviceRequest; result?: GuestDeviceResult };
export function StudioGuestDeviceControls({ studioId, roomName, identity, name, connected = true }: { studioId: string; roomName: string; identity: string; name: string; connected?: boolean }) {
  const { t } = useI18n();
  const [transform, setTransform] = useState<CameraTransform>({ ...DEFAULT_CAMERA_TRANSFORM });
  const [view, setView] = useState<View>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const initializedTransform = useRef(false);
  const scope = useRef(0);
  const revision = useRef(0);
  useEffect(() => {
    scope.current++; initializedTransform.current = false; setTransform({ ...DEFAULT_CAMERA_TRANSFORM });
    let active = true, reading = false;
    const refresh = async () => {
      if (reading) return;
      reading = true;
      const sampledRevision = revision.current;
      try {
        const response = await fetch(`/api/guest-device-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("Не удалось получить устройства кастера");
        const data = await response.json();
        if (active && sampledRevision === revision.current) { setView(data); if (!initializedTransform.current && data.state?.cameraTransform) { setTransform(data.state.cameraTransform); initializedTransform.current = true; } setError(data.result?.error || ""); setNow(Date.now()); }
      } catch (cause) { if (active && sampledRevision === revision.current) { setError(cause instanceof Error ? cause.message : "Не удалось получить устройства кастера"); setView(current => current ? { ...current, offline: true } : current); setNow(Date.now()); } }
      finally { reading = false; }
    };
    setView(undefined); setSending(false); setError(""); void refresh(); const timer = setInterval(() => void refresh(), 2000);
    return () => { active = false; scope.current++; clearInterval(timer); };
  }, [studioId, roomName, identity]);
  const requestTarget = async (target: GuestDeviceRequest["target"] | undefined) => {
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
  const status = pending ? t("Ожидаем решения кастера…") : view?.request && view.request.expiresAt <= now ? t("Кастер не ответил на запрос устройства вовремя") : view?.result?.outcome === "declined" ? t("Кастер отклонил запрос") : view?.result?.outcome === "saved" ? t("Кастер подтвердил настройки. Они применятся при включении.") : view?.result?.outcome === "applied" ? t("Кастер подтвердил настройки. Изменения применены.") : !connected || view?.offline ? t("Кастер отключён") : view?.state ? t("Смена устройств требует подтверждения кастера") : t("Ожидаем список устройств кастера…");
  return <div className="studio-guest-device-controls">
    {(["audioinput", "videoinput", "audiooutput"] as GuestDeviceKind[]).map(kind => <label key={kind}>{t(labels[kind])}<select aria-label={t("{device} — {name}", { device: t(labels[kind]), name })} value={view?.state?.selected[kind] || ""} disabled={disabled || kind === "audiooutput" && !view?.state?.outputSupported} onChange={event => void requestTarget(view?.state?.devices.find(device => device.kind === kind && device.deviceId === event.target.value))}><option value="" disabled>{t("Выберите устройство")}</option>{view?.state?.devices.filter(device => device.kind === kind).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label === "Системный выход звука" ? t("Системный выход звука") : device.label}</option>)}</select></label>)}
    <details style={{ gridColumn: "1 / -1" }}><summary>{t("Изображение камеры кастера")}</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
        {([['zoom', 'Масштаб камеры', 1, 5, .05], ['panX', 'Смещение по горизонтали', -1, 1, .01], ['panY', 'Смещение по вертикали', -1, 1, .01], ['rotation', 'Поворот камеры', -180, 180, 1]] as const).map(([key, label, min, max, step]) => <label key={key}>{t(label)}<input type="number" min={min} max={max} step={step} value={transform[key]} disabled={disabled || !view?.state?.cameraTransformSupported} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) setTransform(previous => ({ ...previous, [key]: Math.min(max, Math.max(min, value)) })); }} /></label>)}
        <label><input type="checkbox" checked={transform.flipX} disabled={disabled || !view?.state?.cameraTransformSupported} onChange={event => setTransform(previous => ({ ...previous, flipX: event.target.checked }))} />{t("Отразить по горизонтали")}</label>
        <label><input type="checkbox" checked={transform.flipY} disabled={disabled || !view?.state?.cameraTransformSupported} onChange={event => setTransform(previous => ({ ...previous, flipY: event.target.checked }))} />{t("Отразить по вертикали")}</label>
        <button type="button" className="secondary" disabled={disabled || !view?.state?.cameraTransformSupported} onClick={() => { setTransform({ ...DEFAULT_CAMERA_TRANSFORM }); void requestTarget({ kind: "camera-transform", transform: { ...DEFAULT_CAMERA_TRANSFORM } }); }}>{t("Сбросить изображение")}</button>
        <button type="button" disabled={disabled || !view?.state?.cameraTransformSupported} onClick={() => void requestTarget({ kind: "camera-transform", transform })}>{t("Запросить изменение изображения")}</button>
      </div>
      {view?.state && !view.state.cameraTransformSupported && <small>{t("Браузер не поддерживает обработку камеры")}</small>}
    </details>
    <small role="status">{view?.request?.target.kind === "camera-transform" && pending ? t("Ожидаем подтверждения изображения кастером…") : status}</small>
    {view?.state && !view.state.outputSupported && <small>{t("Браузер кастера не поддерживает выбор выхода звука")}</small>}
    {error && <small role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
}
