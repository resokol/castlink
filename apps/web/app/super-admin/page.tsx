"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import styles from "../../components/StudioEntry.module.css";

type AccessResult = { allowed: boolean; error?: string };

// Original owner invitations keep their authentication entry. Diagnostics remain in the native window.
export default function SuperAdminPage() {
  const { t } = useI18n();
  const [state, setState] = useState<AccessResult | null>(null);
  const initialAccess = useRef<Promise<AccessResult> | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    let active = true;
    // A one-use acceptance must finish across StrictMode effect cleanup/replay.
    // Reuse its promise; only the currently mounted effect may update the page or navigate.
    if (!initialAccess.current) initialAccess.current = (async (): Promise<AccessResult> => {
      let failure = "Не удалось проверить доступ Super Admin";
      try {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        if (url.hash) window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        if (fragment.has("access")) {
          const invite = fragment.get("access");
          if (!invite || invite.length > 4096 || fragment.getAll("access").length !== 1) return { allowed: false };
          failure = "Не удалось принять ссылку Super Admin";
          const response = await fetch("/api/super-admin-access", {
            method: "POST", credentials: "same-origin", cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "accept", invite }), signal: AbortSignal.timeout(10000),
          });
          if ([400, 401, 403].includes(response.status)) return { allowed: false };
          if (!response.ok || (await response.json()).allowed !== true) return { allowed: false, error: failure };
        }
        // Confirm the browser cookie separately; native credentials do not authorize this browser.
        failure = "Не удалось проверить доступ Super Admin";
        const response = await fetch("/api/super-admin-access", {
          credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return { allowed: false, error: failure };
        return { allowed: (await response.json()).allowed === true };
      } catch {
        return { allowed: false, error: failure };
      }
    })();
    void initialAccess.current.then(result => {
      if (!active) return;
      if (result.allowed) {
        if (!redirected.current) { redirected.current = true; window.location.replace("/servers"); }
      } else setState(result);
    });
    return () => { active = false; };
  }, []);

  return <main className={`${styles.entryPage} ops-entry graphite-entry`}>
    <section className={`${styles.entryCard} ops-card ops-access-state`}>
      <h1>{t("Управление платформой")}</h1>
      {!state ? <p role="status">{t("Проверяем доступ…")}</p> : <>
        <p>{t("Первый доступ выдаёт владелец сервера. Используйте личную одноразовую ссылку Super Admin. Роли студии, администратора комнаты, модератора и гостя не дают доступа к этой странице.")}</p>
        {state.error && <p role="alert">{t(state.error)}</p>}
      </>}
    </section>
  </main>;
}
