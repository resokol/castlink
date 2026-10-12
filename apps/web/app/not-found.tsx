"use client";
import { useI18n } from "@/components/I18nProvider";
export default function NotFound() {
  const { t, locale } = useI18n();
  return <main className="graphite-entry status-page">
    <section className="panel stack status-card">
      <p className="eyebrow">CASTLINK · 404</p>
      <h1>{t("Страница не найдена")}</h1>
      <p className="muted">{t("Проверьте адрес ссылки или вернитесь на главную страницу.")}</p>
      <div className="actions"><a className="button-link" href="/">{t("На главную")}</a></div>
    </section>
  </main>;
}
