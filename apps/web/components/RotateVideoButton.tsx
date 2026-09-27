"use client";
import { useState } from "react";
export function RotateVideoButton({ roomName, identity }: { roomName: string; identity: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <><button type="button" disabled={busy} title="Повернуть видео для всех участников и выхода vMix" onClick={async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/participants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotate", room: roomName, identity }) });
      if (!response.ok) throw Error("Не удалось повернуть видео");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка поворота"); } finally { setBusy(false); }
  }}>↻ Повернуть на 90°</button>{error && <small role="alert">{error}</small>}</>;
}
