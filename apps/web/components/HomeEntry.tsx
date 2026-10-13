"use client";
import { useI18n } from "@/components/I18nProvider";

import { Suspense } from "react";
import { HomeLobby } from "@/components/HomeLobby";

export default function HomeEntry({ hosted = false }: { hosted?: boolean }) {
  const { t, locale } = useI18n();
  return <Suspense fallback={<main className="graphite-entry status-page"><div className="panel status-card" role="status">{t("Загрузка…")}</div></main>}><HomeLobby hosted={hosted} /></Suspense>;
}
