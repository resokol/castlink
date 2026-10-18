"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { designPreviewExcluded, initialDesignPreview, saveDesignPreview } from "@/lib/design-preview";

const styleId = "castlink-preview-theme";

function sessionStorageIfAvailable() {
  try { return window.sessionStorage; }
  catch { return undefined; }
}

function clearPreviewStyle() {
  delete document.documentElement.dataset.designPreview;
  document.getElementById(styleId)?.remove();
}

/** A sibling of the application: toggling this state never replaces its media tree. */
export function DesignPreview() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const excluded = designPreviewExcluded(pathname || "/");

  useEffect(() => {
    const initial = initialDesignPreview(window.location.href, sessionStorageIfAvailable());
    if (initial.cleanUrl) window.history.replaceState(window.history.state, "", initial.cleanUrl);
    setEnabled(initial.enabled);
    return clearPreviewStyle;
  }, []);

  useEffect(() => {
    if (excluded || enabled === null) { clearPreviewStyle(); return; }
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = "/new/live-theme.css";
      document.head.append(link);
    }
    document.documentElement.dataset.designPreview = enabled ? "on" : "off";
  }, [enabled, excluded]);

  if (excluded || enabled === null) return null;

  return <aside data-design-preview-banner aria-label={t("Тест нового оформления")} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--panel-border)", background: "var(--panel-bg)", color: "var(--text)", fontSize: 12 }}>
    <strong>{t("Тест нового оформления")}</strong>
    <button type="button" data-design-preview-toggle aria-pressed={enabled} onClick={() => {
      const next = !enabled;
      saveDesignPreview(next, sessionStorageIfAvailable());
      setEnabled(next);
    }}>{enabled ? t("Новое оформление включено") : t("Прежнее оформление")}</button>
    <a href="/new/features.html" target="_blank" rel="noopener noreferrer">{t("Все функции")}</a>
    <button type="button" data-design-preview-exit onClick={() => {
      saveDesignPreview(null, sessionStorageIfAvailable());
      clearPreviewStyle();
      setEnabled(null);
    }}>{t("Выйти из теста оформления")}</button>
  </aside>;
}
