"use client";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";

import { useEffect, useRef, useState } from "react";

export function AdminInviteButton({ roomName, studioId = "studio-default" }: { roomName: string; studioId?: string }) {
  const { t, locale } = useI18n();
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setOwner(false); setLink(""); setExpiresAt(undefined); setError(""); setMessage("");
    void fetch(`/api/admin-access?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось проверить права администратора комнаты.");
        if (mounted.current) setOwner(data.owner === true);
      })
      .catch(cause => { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось проверить права."); });
    return () => { mounted.current = false; controller.abort(); };
  }, [roomName, studioId]);

  const create = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", studioId, room: roomName }) });
      const data = await response.json();
      if (!response.ok || typeof data.path !== "string" || typeof data.expiresAt !== "number") throw new Error(data.error || "Не удалось создать ссылку администратора.");
      if (!mounted.current) return;
      const url = new URL(data.path, window.location.origin).toString();
      setLink(url); setExpiresAt(data.expiresAt);
      try { await navigator.clipboard.writeText(url); if (mounted.current) setMessage("Ссылка администратора скопирована."); }
      catch { if (mounted.current) setMessage("Ссылка создана. Скопируйте её из поля ниже."); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку."); }
    finally { if (mounted.current) setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm(t("Отозвать все ссылки администратора комнаты? Это прекратит ранее выданный доступ."))) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", studioId, room: roomName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отозвать доступ.");
      if (mounted.current) {
        setLink(""); setExpiresAt(undefined);
        setMessage(data.disconnected === false
          ? "Управление и новые входы отозваны; сервер не подтвердил отключение просмотра в уже подключённых панелях."
          : "Все ссылки администратора и выданный через них доступ отозваны.");
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось отозвать доступ."); }
    finally { if (mounted.current) setBusy(false); }
  };

  if (!owner) return error ? <p className="muted" role="status">{translateManagementMessage(error, t)}</p> : null;
  return <div className="stack admin-invite-controls">
    <button type="button" className="invite-create" disabled={busy} onClick={() => void create()}>{busy ? t("Подготовка…") : link ? t("Создать новую ссылку администратора") : t("Создать ссылку администратора")}</button>
    {link && <><input aria-label={t("Ссылка администратора комнаты")} readOnly value={link} onFocus={event => event.target.select()} /><small>{t("Доступ к эфиру, настройкам этой комнаты и списку гостей. Ссылка действует до")} {new Date(expiresAt || 0).toLocaleString(locale)}.</small></>}
    <button type="button" className="button-secondary invite-revoke" disabled={busy} onClick={() => void revoke()}>{t("Отозвать все ссылки администратора")}</button>
    {message && <small role="status">{translateManagementMessage(message, t)}</small>}
    {error && <small role="alert">{translateManagementMessage(error, t)}</small>}
  </div>;
}
