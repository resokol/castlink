"use client";
import { useI18n } from "@/components/I18nProvider";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "studiolink-theme";

export function ThemeToggle() {
  const { t, locale } = useI18n();
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next: Theme = stored === "light" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return <button type="button" className="button-secondary theme-toggle" onClick={toggle} aria-label={t("Переключить тему")}>
    {ready && theme === "dark" ? t("☀ Светлая тема") : t("☾ Тёмная тема")}
  </button>;
}
