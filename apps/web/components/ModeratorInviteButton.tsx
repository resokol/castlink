"use client";

import { useEffect, useRef, useState } from "react";

export function ModeratorInviteButton({ roomName, studioId = "studio-default" }: { roomName: string; studioId?: string }) {
  const [scope, setScope] = useState<"server" | "room">("server");
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
    void fetch(`/api/moderator-access?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось проверить права модератора комнаты.");
        if (mounted.current) { setOwner(data.owner === true || data.canInvite === true); setScope(data.scope === "room" ? "room" : "server"); }
      })
      .catch(cause => { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось проверить права."); });
    return () => { mounted.current = false; controller.abort(); };
  }, [roomName, studioId]);

  const create = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/moderator-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", studioId, room: roomName }) });
      const data = await response.json();
      if (!response.ok || typeof data.path !== "string" || typeof data.expiresAt !== "number") throw new Error(data.error || "Не удалось создать ссылку модератора.");
      if (!mounted.current) return;
      const url = new URL(data.path, window.location.origin).toString();
      setLink(url); setExpiresAt(data.expiresAt);
      try { await navigator.clipboard.writeText(url); if (mounted.current) setMessage("Ссылка модератора скопирована."); }
      catch { if (mounted.current) setMessage("Ссылка создана. Скопируйте её из поля ниже."); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку."); }
    finally { if (mounted.current) setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm(scope === "room" ? "Отозвать приглашения модераторов этой комнаты?" : "Отозвать все ссылки модератора на этом сервере? Это прекратит ранее выданный доступ.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/moderator-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: scope === "room" ? "revoke-room" : "revoke", studioId, room: roomName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отозвать доступ.");
      if (mounted.current) {
        setLink(""); setExpiresAt(undefined);
        setMessage(data.disconnected === false
          ? "Управление и новые входы отозваны; сервер не подтвердил отключение просмотра в уже подключённых панелях."
          : "Все ссылки модератора и выданный через них доступ отозваны.");
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось отозвать доступ."); }
    finally { if (mounted.current) setBusy(false); }
  };

  if (studioId !== "studio-default") return null;
  if (!owner) return error ? <p className="muted" role="status">{error}</p> : null;
  return <div className="stack admin-invite-controls">
    <button type="button" className="invite-create" disabled={busy} onClick={() => void create()}>{busy ? "Подготовка…" : link ? "Создать новую ссылку модератора" : "Создать ссылку модератора"}</button>
    {link && <><input aria-label="Ссылка модератора сервера" readOnly value={link} onFocus={event => event.target.select()} /><small>{scope === "room" ? "Управление гостями этой комнаты" : "Управление гостями и комнатами на этом сервере"}, без управления эфиром. Ссылка действует до {new Date(expiresAt || 0).toLocaleString("ru-RU")}.</small></>}
    <button type="button" className="button-secondary invite-revoke" disabled={busy} onClick={() => void revoke()}>{scope === "room" ? "Отозвать ссылки модераторов комнаты" : "Отозвать все ссылки модератора"}</button>
    {message && <small role="status">{message}</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
