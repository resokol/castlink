"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { availableVersion, updateUrl } from "@/lib/app-update";
import { ThemeToggle } from "@/components/ThemeToggle";

const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "development";

export function AppUpdateNotice() {
  const pathname = usePathname();
  const cleanOutput = pathname.startsWith("/output/") || pathname === "/monitor";
  const [host, setHost] = useState("");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const pending = useRef<AbortController | null>(null);

  const check = useCallback(async (manual = false) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    if (manual) { setChecking(true); setMessage(""); }
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw Error("Проверка обновлений недоступна");
      const version = availableVersion(currentVersion, await response.json());
      if (controller.signal.aborted) return;
      setNewVersion(version);
      if (manual) setMessage(version ? "" : "На этом сервере установлена эта же версия.");
    } catch {
      if (manual && pending.current === controller) setMessage("Не удалось проверить обновления. Проверьте соединение и повторите.");
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setChecking(false); }
    }
  }, []);

  useEffect(() => {
    setHost(window.location.host);
    if (cleanOutput) return;
    void check();
    const onFocus = () => { if (document.visibilityState === "visible") void check(); };
    const timer = setInterval(onFocus, 60000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      const controller = pending.current; pending.current = null; controller?.abort();
    };
  }, [check, cleanOutput]);

  if (cleanOutput) return null;
  return <aside className="app-update-status" aria-label="Версия приложения">
    {newVersion && <div className="app-update-banner" role="status">
      <div><strong>Доступна новая версия StudioLink</strong><p>Обновление перезагрузит страницу и завершит текущее подключение. Обновите её после эфира.</p></div>
      <button className="button-primary" onClick={() => window.location.replace(updateUrl(window.location.href, newVersion))}>Обновить приложение</button>
    </div>}
    <div className="app-version-row"><small>Сервер: {host || "…"} · Версия: <span title={currentVersion}>{currentVersion.slice(0, 12)}</span></small>
      <div className="app-version-actions"><ThemeToggle /><button className="button-secondary" disabled={checking} onClick={() => void check(true)}>{checking ? "Проверка…" : "Проверить обновления"}</button></div>
    </div>
    {message && <p role="status">{message}</p>}
  </aside>;
}
