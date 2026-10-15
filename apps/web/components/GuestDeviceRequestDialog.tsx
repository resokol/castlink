"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import type { GuestDeviceRequest } from "@/lib/guest-device-control";

export function GuestDeviceRequestDialog({ request, applying, disabled = false, onRespond }: { request: GuestDeviceRequest; applying: boolean; disabled?: boolean; onRespond: (accepted: boolean) => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  const respond = useRef(onRespond); respond.current = onRespond;
  const busy = useRef(applying); busy.current = applying;
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const current = dialog.current;
    current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!busy.current) respond.current(false); }
      if (event.key === "Tab") {
        const controls = Array.from(current?.querySelectorAll<HTMLElement>("button:not(:disabled)") || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000))), 1000);
    return () => { clearInterval(timer); document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, [request.id, request.expiresAt]);
  const kind = request.target.kind === "audioinput" ? t("Микрофон") : request.target.kind === "videoinput" ? t("Камера") : t("Выход звука");
  return <div className="guest-device-request-overlay"><div ref={dialog} className="guest-device-request-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-device-request-title" aria-describedby="guest-device-request-description" tabIndex={-1}>
    <h2 id="guest-device-request-title">{t("Студия просит сменить устройство")}</h2>
    <p id="guest-device-request-description">{kind}: <strong>{request.target.label === "Системный выход звука" ? t("Системный выход звука") : request.target.label}</strong></p>
    <p>{t("Смена произойдёт только после вашего подтверждения. Выключенные камера и микрофон останутся выключенными.")}</p>
    <p role="status">{applying ? t("Переключаем устройство…") : seconds === 0 ? t("Запрос устройства уже устарел") : t("Осталось {seconds} с", { seconds })}</p>
    <div className="guest-device-request-actions"><button type="button" className="secondary" disabled={applying || seconds === 0} onClick={() => onRespond(false)}>{t("Отклонить")}</button><button type="button" disabled={applying || disabled || seconds === 0} onClick={() => onRespond(true)}>{t("Подтвердить смену")}</button></div>
  </div></div>;
}
