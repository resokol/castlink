"use client";
import { useState } from "react";
import { readControlResponse } from "@/lib/control-response";
export function StudioStreamInviteButton({ roomName }: { roomName: string }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const create = async () => {
    setBusy(true); setMessage("");
    try {
      const data = await readControlResponse(await fetch("/api/studio-viewer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", room: roomName }) }), "Не удалось создать ссылку потока");
      const value = new URL(data.path, window.location.origin).toString(); setLink(value);
      try { await navigator.clipboard.writeText(value); setMessage("Ссылка потока скопирована. Звук и видео зрители включают у себя отдельно."); }
      catch { setMessage("Скопируйте ссылку из поля ниже. Звук и видео каждый зритель включает у себя."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка создания ссылки"); }
    finally { setBusy(false); }
  };
  return <div className="stack"><button disabled={busy} onClick={() => void create()}>{busy ? "Подготовка…" : "Ссылка на поток студии"}</button>{link && <><input readOnly aria-label="Ссылка на поток студии" value={link} onFocus={event => event.target.select()} /><small>Только просмотр. Студия отправляет один дополнительный общий поток для всех зрителей; он расходует исходящий трафик, как ещё один поток. Срок ссылки — 30 дней; смена пароля комнаты отменяет ссылку.</small></>}{message && <small role="status">{message}</small>}</div>;
}
