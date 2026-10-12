"use client";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { LOCALE_STORAGE_KEY, normalizeLocale, translate, type Locale, type Translator } from "@/lib/i18n";

type LocaleStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Locale;
  update: (value: unknown, persist: boolean) => void;
  setLocale: (value: Locale) => void;
};
const serverLocale = (): Locale => "ru";
function createLocaleStore(): LocaleStore {
  let locale: Locale = "ru";
  const listeners = new Set<() => void>();
  const update = (value: unknown, persist: boolean) => {
    const next = normalizeLocale(value);
    if (persist) {
      try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next); }
      catch { /* Language changes still work with unavailable storage. */ }
    }
    if (next === locale) return;
    locale = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => locale,
    update,
    setLocale: value => update(value, true),
  };
}
const fallbackStore: LocaleStore = { subscribe: () => () => {}, getSnapshot: serverLocale, update: () => {}, setLocale: () => {} };
const I18nContext = createContext<LocaleStore>(fallbackStore);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createLocaleStore);
  const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, serverLocale);
  useEffect(() => {
    try { store.update(window.localStorage.getItem(LOCALE_STORAGE_KEY), false); }
    catch { /* Restricted storage retains the Russian default. */ }
    const restore = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null) store.update(event.newValue, false);
    };
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, [store]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  // Stable context and per-consumer server snapshots also protect deferred
  // Suspense hydration. No locale key or navigation can remount a media session.
  return <I18nContext.Provider value={store}>{children}</I18nContext.Provider>;
}
export function useI18n(): { locale: Locale; t: Translator; setLocale: (locale: Locale) => void } {
  const store = useContext(I18nContext);
  const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, serverLocale);
  return useMemo(() => ({ locale, setLocale: store.setLocale, t: ((source, params) => translate(locale, source, params)) as Translator }), [locale, store]);
}
