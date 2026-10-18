"use client";

import { useI18n } from "@/components/I18nProvider";

export type SourceRosterItem = { key: string; identity: string; name: string; kind: "camera" | "screen"; role?: string; self?: boolean };

/** Selection is layout state; media and command controllers belong to the persistent deck. */
export function SourceRoster({ sources, selected, onSelect }: { sources: SourceRosterItem[]; selected: string; onSelect: (key: string) => void }) {
  const { t } = useI18n();
  return <nav className="source-roster" aria-label={t("Участники")}>
    <div className="source-roster-heading"><strong>{t("Источники")}</strong><span>{sources.length}</span></div>
    {sources.map(source => <button type="button" key={source.key} data-source-key={source.key} aria-pressed={selected === source.key} onClick={() => onSelect(source.key)}>
      <span className="source-roster-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{source.kind === "screen" ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></> : <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>}</svg></span>
      <span><strong>{source.name}</strong><small>{source.kind === "screen" ? t("Экран / приложение") : t("Камера")}{source.role ? ` · ${source.role}` : ""}{source.self ? ` · ${t("Вы")}` : ""}</small></span>
    </button>)}
    {!sources.length && <p className="muted">{t("Подключённых гостей пока нет.")}</p>}
  </nav>;
}
