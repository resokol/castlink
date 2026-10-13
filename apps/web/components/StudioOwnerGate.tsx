"use client";
import { BrandIcon } from "./BrandIcon";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AccessGate } from "./AccessGate";
import styles from "./StudioEntry.module.css";

export function StudioOwnerGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const studioId = params.get("studioId") || "studio-default";
  const [allowed, setAllowed] = useState(studioId === "studio-default");
  const [loading, setLoading] = useState(studioId !== "studio-default");
  const [error, setError] = useState("");
  const handledStudio = useRef("");

  useEffect(() => {
    if (studioId === "studio-default") {
      handledStudio.current = "";
      setAllowed(true);
      setLoading(false);
      setError("");
      return;
    }
    if (handledStudio.current === studioId) return;
    handledStudio.current = studioId;
    setAllowed(false);

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
        const invite = fragment.get("owner") || "";

        if (url.hash) window.history.replaceState(null, "", `${url.pathname}${url.search}`);

        if (invite) {
          const accepted = await fetch("/api/studio-access", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "accept", studioId, invite }),
            signal: controller.signal,
          });
          const data = await accepted.json().catch(() => ({}));
          if (!accepted.ok || data.allowed !== true) throw new Error(data.error || "Owner-link недействительна или отозвана");
        }

        const response = await fetch(`/api/studio-access?studioId=${encodeURIComponent(studioId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.allowed !== true) throw new Error("Нет доступа к этой Studio");
        if (!controller.signal.aborted) setAllowed(true);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAllowed(false);
          setError(cause instanceof Error ? cause.message : "Не удалось проверить доступ к Studio");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [studioId]);

  if (studioId === "studio-default") return <AccessGate kind="studio" ownerStudioId={studioId}>{children}</AccessGate>;

  if (loading) {
    return <main className={styles.entryPage}><section className={styles.entryCard}><p className={styles.muted}>{t("Проверка доступа к Studio…")}</p></section></main>;
  }

  if (!allowed) {
    return <main className={styles.entryPage}><section className={styles.entryCard}><div className={styles.brand}><BrandIcon className={styles.brandMark} /><span>CASTLINK</span></div><div className={styles.stack}><p className={styles.kicker}>{t("ДОСТУП К СТУДИИ")}</p><h1>{t("Нет доступа")}</h1><p className={styles.error}>{translateManagementMessage(error, t) || t("Нужна приватная ссылка владельца этой Studio.")}</p><a className={styles.secondaryButton} href="/" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>{t("На главную")}</a></div></section></main>;
  }

  return <>{children}</>;
}
