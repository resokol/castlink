"use client";
import { useEffect } from "react";
import { reportBrowserError } from "../lib/browser-errors";
import { useI18n } from "@/components/I18nProvider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportBrowserError("boundary", error); }, [error]);
  const { t, locale } = useI18n();
  return <main className="graphite-entry status-page">
    <section className="panel stack status-card" role="alert">
      <p className="eyebrow">CASTLINK</p>
      <h1>{t("Не удалось открыть страницу")}</h1>
      <p className="muted">{t("Попробуйте ещё раз. Если ошибка повторяется, вернитесь на главную страницу.")}</p>
      <div className="actions">
        <button type="button" className="button-primary" onClick={reset}>{t("Попробовать снова")}</button>
        <a className="button-link" href="/">{t("На главную")}</a>
      </div>
    </section>
  </main>;
}
