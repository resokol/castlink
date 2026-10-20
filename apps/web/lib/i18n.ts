import { pagesMessages } from "./i18n/pages";
import { slotsMessages } from "./i18n/slots";
import { managementMessages } from "./i18n/management";
import { workspacesMessages } from "./i18n/workspaces";

import { entryMessages } from "./i18n/entry";

export const LOCALE_STORAGE_KEY = "castlink-language";
export type Locale = "ru" | "en" | "zh-CN";
export type TranslationParams = Record<string, string | number>;
export type Translator = (source: string, params?: TranslationParams) => string;
export const messages: Record<string, readonly [string, string, string?]> = {
  ...pagesMessages, ...managementMessages, ...workspacesMessages, ...slotsMessages, ...entryMessages,
};
export function normalizeLocale(value: unknown): Locale {
  return value === "en" || value === "zh-CN" ? value : "ru";
}
/** Only explicit product messages are translated; unknown text remains verbatim. */
export function translate(locale: Locale, source: string, params?: TranslationParams): string {
  const entry = messages[source];
  const translated = locale === "ru" ? entry?.[2] ?? source : !entry ? source : entry[locale === "en" ? 0 : 1];
  if (!params) return translated;
  return translated.replace(/\{([\w]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
}
