"use client";

import { useEffect, useRef, useState } from "react";

export function AdminInviteButton({ roomName }: { roomName: string }) {
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
    void fetch(`/api/admin-access?room=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось проверить права администратора комнаты.");
        if (mounted.current) setOwner(data.owner === true);
      })
      .catch(cause => { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось проверить права."); });
    return () => { mounted.current = false; controller.abort(); };
  }, [roomName]);

  const create = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", room: roomName }) });
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
    if (!window.confirm("Отозвать все ссылки администратора комнаты? Это прекратит ранее выданный доступ.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", room: roomName }) });
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

  if (!owner) return error ? <p className="muted" role="status">{error}</p> : null;
  return <div className="stack admin-invite-controls">
    <button type="button" className="invite-create" disabled={busy} onClick={() => void create()}>{busy ? "Подготовка…" : link ? "Создать новую ссылку администратора" : "Создать ссылку администратора"}</button>
    {link && <><input aria-label="Ссылка администратора комнаты" readOnly value={link} onFocus={event => event.target.select()} /><small>Доступ к эфиру, настройкам этой комнаты и списку гостей. Ссылка действует до {new Date(expiresAt || 0).toLocaleString("ru-RU")}.</small></>}
    <button type="button" className="button-secondary invite-revoke" disabled={busy} onClick={() => void revoke()}>Отозвать все ссылки администратора</button>
    {message && <small role="status">{message}</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
