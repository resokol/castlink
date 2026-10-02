"use client";

import { useEffect, useRef, useState } from "react";
import { saveTransferSnapshot, type TransferSnapshot } from "@/lib/client-transfer";

export default function TransferPage() {
  const [message, setMessage] = useState("Проверяем перенос…");
  const [error, setError] = useState("");
  const [returnUrl, setReturnUrl] = useState("");
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
        if ((parsed.role === "studio" || parsed.role === "guest") && typeof parsed.room === "string" && (parsed.studioId === undefined || typeof parsed.studioId === "string")) snapshot = parsed;
      }
    } catch {}
    if (snapshot?.sourceOrigin) {
      try {
        const source = new URL(snapshot.sourceOrigin);
        const approvedSource = ["node1.castlink.ru", "node2.castlink.ru", "castlink.ru", "www.castlink.ru", "79-120-36-254.sslip.io", "caster.em.studio", "new.168.113.157.48.nip.io"].includes(source.hostname);
        const approvedLanSource = source.hostname === "192.168.53.68" && source.port === "";
        if (source.protocol === "https:" && !source.username && !source.password && (approvedSource || approvedLanSource)) {
          const studioQuery = snapshot.studioId ? `studioId=${encodeURIComponent(snapshot.studioId)}&` : "";
          setReturnUrl(`${source.origin}/${snapshot.role === "studio" ? `studio?${studioQuery}room=${encodeURIComponent(snapshot.room)}` : `room?${studioQuery}name=${encodeURIComponent(snapshot.room)}`}`);
        }
      } catch {}
    }
    // The one-time ticket must not remain in browser history or screenshots.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!ticket) { setError("В ссылке переноса нет действительного билета."); return; }

    void (async () => {
      try {
        setMessage("Подключаем комнату на этом сервере…");
        const response = await fetch("/api/server-transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept", ticket, ...(snapshot?.studioId ? { studioId: snapshot.studioId } : {}) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось принять перенос.");
        const role = result.role === "studio" ? "studio" : result.role === "guest" ? "guest" : undefined;
        if (!role || typeof result.room !== "string" || typeof result.studioId !== "string") throw new Error("Сервер вернул неполные данные переноса.");
        const restored: TransferSnapshot = {
          ...(snapshot?.role === role && snapshot.room === result.room ? snapshot : { role, room: result.room }),
          role,
          room: result.room,
          studioId: result.studioId,
          ...(typeof result.name === "string" ? { name: result.name } : {}),
          ...(typeof result.identity === "string" ? { identity: result.identity } : {}),
        };
        saveTransferSnapshot(restored);
        if (role === "guest") {
          if (mounted.current) setMessage("Возвращаем вас в комнату…");
          window.location.replace(`/room?studioId=${encodeURIComponent(result.studioId)}&name=${encodeURIComponent(result.room)}&moved=1`);
        } else {
          if (mounted.current) setMessage("Открываем студию…");
          window.location.replace(`/studio?studioId=${encodeURIComponent(result.studioId)}&room=${encodeURIComponent(result.room)}&transferred=1`);
        }
      } catch (cause) {
        if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось принять перенос.");
      }
    })();
    return () => { mounted.current = false; };
  }, []);

  return <main className="transfer-page"><section className="panel transfer-card">
    <p className="eyebrow">CASTLINK · ПЕРЕНОС СЕССИИ</p>
    <h1>{error ? "Не удалось перенести комнату" : "Перенос комнаты"}</h1>
    {error ? <><p role="alert">{error}</p><p className="muted">Вернитесь на предыдущий сервер и повторите перенос.</p>{returnUrl && <a className="button-secondary" href={returnUrl}>Вернуться к исходной комнате</a>}</> : <p className="muted">{message}</p>}
  </section></main>;
}
