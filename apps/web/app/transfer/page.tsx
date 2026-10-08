"use client";

import { useEffect, useRef, useState } from "react";
import { acceptedTransferPath, isTransferRole, saveAcceptedTransfer, type TransferSnapshot } from "@/lib/client-transfer";

export default function TransferPage() {
  const [message, setMessage] = useState("Проверяем перенос…");
  const [error, setError] = useState("");
  const started = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (started.current) return () => { mounted.current = false; };
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const ticket = fragment.get("handoff") || "";
    let snapshot: TransferSnapshot | undefined;
    try {
      const raw = fragment.get("state");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isTransferRole(parsed.role) && typeof parsed.room === "string" && (parsed.studioId === undefined || typeof parsed.studioId === "string")) snapshot = parsed;
      }
    } catch {}
    // The one-time ticket must not remain in browser history or screenshots.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!ticket) { setError("В ссылке переноса нет действительного билета."); return; }

    void (async () => {
      try {
        setMessage("Подключаем комнату на этом сервере…");
        const response = await fetch("/api/server-transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept", ticket }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось принять перенос.");
        saveAcceptedTransfer(result, snapshot);
        if (mounted.current) setMessage("Возвращаем вас в комнату…");
        window.location.replace(acceptedTransferPath(result));
      } catch (cause) {
        if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось принять перенос.");
      }
    })();
    return () => { mounted.current = false; };
  }, []);

  return <main className="transfer-page"><section className="panel transfer-card">
    <p className="eyebrow">CASTLINK · ПЕРЕНОС СЕССИИ</p>
    <h1>{error ? "Не удалось перенести комнату" : "Перенос комнаты"}</h1>
    {error ? <><p role="alert">{error}</p><p className="muted">Вернитесь на предыдущий сервер и повторите перенос.</p></> : <p className="muted">{message}</p>}
  </section></main>;
}
