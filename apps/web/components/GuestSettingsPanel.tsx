"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";

/** Native light dismiss keeps devices/monitoring mounted while the panel closes. */
export function GuestSettingsPanel({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchor = `--guest-settings-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <div className="guest-settings-control">
    <button type="button" className="button-secondary guest-settings-toggle" popoverTarget={id} aria-controls={id} aria-expanded={open} aria-haspopup="dialog" style={{ anchorName: anchor } as CSSProperties}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 3-.6 2.3-2 .9-2.1-.7-2.3 4 1.6 1.6v2l-1.6 1.6 2.3 4 2.1-.7 2 .9.6 2.3h5l.6-2.3 2-.9 2.1.7 2.3-4-1.6-1.6v-2l1.6-1.6-2.3-4-2.1.7-2-.9-.6-2.3z" /><circle cx="12" cy="12" r="3" /></svg>
      {t("Системные настройки")}
    </button>
    <div id={id} className="guest-settings-popover" popover="auto" role="dialog" aria-labelledby={`${id}-title`} style={{ positionAnchor: anchor } as CSSProperties} onToggle={event => setOpen(event.newState === "open")}>
      <header className="guest-settings-popover-heading"><h2 id={`${id}-title`}>{t("Устройства и мониторинг")}</h2><button type="button" className="button-secondary" popoverTarget={id} popoverTargetAction="hide" aria-label={t("Закрыть настройки")} autoFocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      <div className="guest-settings-content">{children}</div>
    </div>
  </div>;
}
