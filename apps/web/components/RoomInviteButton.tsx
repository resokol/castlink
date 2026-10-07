"use client";
import { roomEntryInviteUrl } from "./room-entry-url";
import { useEffect, useRef, useState } from "react";

export function RoomInviteButton({ roomName, studioId = "studio-default", entryPath }: { roomName: string; studioId?: string; entryPath?: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="stack">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setCopied(false); setError(""); setStatus("");
      try {
        const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName }) });
        const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось создать приглашение");
        if (!mounted.current) return;
        const url = roomEntryInviteUrl(data.path, window.location.origin, entryPath); setLink(url);
        try { await navigator.clipboard.writeText(url); if (mounted.current) setCopied(true); }
        catch { if (mounted.current) setError("Скопируйте ссылку из поля ниже."); }
      } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Ошибка приглашения"); }
      finally { if (mounted.current) setBusy(false); }
    }}>{busy ? "Создание инвайта…" : copied ? "Инвайт скопирован" : "Скопировать инвайт для гостя"}</button>
    <button type="button" className="button-secondary" disabled={busy} onClick={async () => {
      setBusy(true); setCopied(false); setError(""); setStatus("");
      try {
        const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", studioId, room: roomName }) });
        const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось отозвать приглашения");
        if (mounted.current) { setLink(""); setStatus("Все ранее выданные гостевые приглашения этой комнаты отозваны."); }
      } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Ошибка отзыва приглашений"); }
      finally { if (mounted.current) setBusy(false); }
    }}>Отозвать гостевые ссылки</button>
    {link && <><input aria-label="Ссылка-приглашение для гостя" readOnly value={link} onFocus={e => e.target.select()} /><small>По этой ссылке гость входит без пароля. Ссылка действует 30 дней.</small></>}
    {status && <small role="status">{status}</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
