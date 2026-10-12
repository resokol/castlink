"use client";
import { useI18n } from "@/components/I18nProvider";

import { useEffect, useRef, useState } from "react";
import { acceptedTransferPath, isTransferRole, saveAcceptedTransfer, type TransferSnapshot } from "@/lib/client-transfer";

export default function TransferPage() {
  const { t, locale } = useI18n();
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

  return <main className="transfer-page graphite-entry status-page"><section className="panel transfer-card status-card">
    <p className="eyebrow">{t("CASTLINK · ПЕРЕНОС СЕССИИ")}</p>
    <h1>{error ? t("Не удалось перенести комнату") : t("Перенос комнаты")}</h1>
    {error ? <><p role="alert">{t(error)}</p><p className="muted">{t("Вернитесь на предыдущий сервер и повторите перенос.")}</p></> : <p className="muted">{t(message)}</p>}
  </section></main>;
}
