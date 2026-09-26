"use client";
import { useEffect, useRef, useState } from "react";

export function RoomInviteButton({ roomName }: { roomName: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="stack">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setCopied(false); setError("");
      try {
        const response = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: roomName }) });
        const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось создать приглашение");
        if (!mounted.current) return;
        const url = new URL(data.path, window.location.origin).toString(); setLink(url);
        try { await navigator.clipboard.writeText(url); if (mounted.current) setCopied(true); }
        catch { if (mounted.current) setError("Скопируйте ссылку из поля ниже."); }
      } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Ошибка приглашения"); }
      finally { if (mounted.current) setBusy(false); }
    }}>{busy ? "Создание инвайта…" : copied ? "Инвайт скопирован" : "Скопировать инвайт для гостя"}</button>
    {link && <><input aria-label="Ссылка-приглашение для гостя" readOnly value={link} onFocus={e => e.target.select()} /><small>По этой ссылке гость входит без пароля. Ссылка действует 30 дней.</small></>}
    {error && <small role="status">{error}</small>}
  </div>;
}
