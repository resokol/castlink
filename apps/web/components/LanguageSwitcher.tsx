"use client";
import { useI18n } from "./I18nProvider";
import { normalizeLocale } from "@/lib/i18n";

/** A normal-flow control, placed outside all production media surfaces. */
export function InlineLanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <select className="castlink-language-inline" aria-label={t("Язык интерфейса")} value={locale} onChange={event => setLocale(normalizeLocale(event.target.value))}>
    <option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option><option value="zh-CN" lang="zh-CN">简体中文</option>
  </select>;
}
