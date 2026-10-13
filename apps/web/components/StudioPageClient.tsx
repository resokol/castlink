"use client";
import { useI18n } from "@/components/I18nProvider";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StudioOwnerGate } from "@/components/StudioOwnerGate";
import { StudioRoomPicker } from "@/components/StudioRoomPicker";
import { StudioWorkspace as StudioContent } from "@/components/StudioWorkspace";
import { clearTransferSnapshot, readTransferSnapshot, type TransferSnapshot } from "@/lib/client-transfer";

export default function StudioPage() {
  const { t, locale } = useI18n();
  return <Suspense fallback={<main className="graphite-entry status-page"><div className="panel status-card" role="status">{t("Загрузка Studio Panel…")}</div></main>}><StudioOwnerGate><StudioEntry /></StudioOwnerGate></Suspense>;
}

function StudioEntry() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const studioId = params.get("studioId") || "studio-default";
  const [routeReady, setRouteReady] = useState(studioId === "studio-default");
  const [routeError, setRouteError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [transferSnapshot, setTransferSnapshot] = useState<TransferSnapshot>();
  const transferHandled = useRef(false);
  useEffect(() => {
    if (studioId === "studio-default") { setRouteReady(true); setRouteError(""); return; }
    const controller = new AbortController();
    setRouteReady(false); setRouteError("");
    void fetch(`/api/studio-route?studioId=${encodeURIComponent(studioId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true || typeof data.endpoint !== "string") {
          throw new Error(data.error || data.reason || "Не удалось определить назначенный сервер студии");
        }
        const target = new URL(data.endpoint);
        if (target.origin !== window.location.origin) {
          const destination = new URL("/studio", target.origin);
          destination.searchParams.set("studioId", studioId);
          const room = params.get("room");
          if (room) destination.searchParams.set("room", room);
          window.location.replace(destination.toString());
          return;
        }
        setRouteReady(true);
      })
      .catch(error => {
        if (!controller.signal.aborted) setRouteError(error instanceof Error ? error.message : "Не удалось определить назначенный сервер студии");
      });
    return () => controller.abort();
  }, [studioId, params]);
  useEffect(() => {
    if (transferHandled.current || params.get("transferred") !== "1") return;
    transferHandled.current = true;
    const snapshot = readTransferSnapshot();
    if (snapshot?.role === "studio" && snapshot.room === params.get("room")) {
      setTransferSnapshot(snapshot);
      setSelected(snapshot.room);
      window.history.replaceState(null, "", `/studio?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(snapshot.room)}`);
      queueMicrotask(clearTransferSnapshot);
    }
  }, [params]);
  if (routeError) return <main className="graphite-entry status-page"><div className="panel stack status-card"><h1>{t("Сервер студии недоступен")}</h1><p>{t(routeError)}</p><a className="button-link button-secondary" href="/studios">{t("Вернуться к списку студий")}</a></div></main>;
  if (!routeReady) return <main className="graphite-entry status-page"><div className="panel status-card" role="status">{t("Переход на назначенный сервер Studio…")}</div></main>;
  return selected ? <StudioContent studioId={studioId} initialRoom={selected} transferSnapshot={transferSnapshot} /> : <StudioRoomPicker studioId={studioId} initialRoom={params.get("room") || ""} onJoin={name => { window.history.replaceState(null, "", `/studio?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(name)}`); setSelected(name); }} />;
}
