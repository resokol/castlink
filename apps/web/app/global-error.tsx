"use client";
import { useEffect, useState } from "react";
import { reportBrowserError } from "../lib/browser-errors";

const copy = {
  ru: { title: "Не удалось открыть страницу", hint: "Попробуйте ещё раз. Если ошибка повторяется, вернитесь на главную страницу.", retry: "Попробовать снова", home: "На главную" },
  en: { title: "Unable to open this page", hint: "Try again. If the problem continues, return to the home page.", retry: "Try again", home: "Home" },
  "zh-CN": { title: "无法打开此页面", hint: "请重试。如果问题仍然存在，请返回首页。", retry: "重试", home: "返回首页" },
};
/** Root-layout recovery must also work when providers or application CSS failed. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<keyof typeof copy>("ru");
  useEffect(() => {
    reportBrowserError("global-boundary", error);
    try {
      const saved = window.localStorage.getItem("castlink-language");
      setLocale(saved === "en" || saved === "zh-CN" ? saved : "ru");
    } catch { /* The default remains readable when storage failed too. */ }
  }, [error]);
  const text = copy[locale];
  return <html lang={locale}><body style={{ margin: 0, background: "#141817", color: "#f1f3f2", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box" }}>
      <section role="alert" style={{ maxWidth: 480, padding: 28, border: "1px solid #3d4741", borderRadius: 12 }}>
        <p style={{ fontSize: 12, letterSpacing: 2 }}>CASTLINK</p>
        <h1 style={{ fontSize: 24 }}>{text.title}</h1>
        <p>{text.hint}</p>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={reset} style={{ background: "#acd9bb", color: "#17251b", border: 0, borderRadius: 8, padding: "12px 16px", font: "inherit", cursor: "pointer" }}>{text.retry}</button>
          <a href="/" style={{ color: "#acd9bb", padding: "12px 0" }}>{text.home}</a>
        </div>
      </section>
    </main>
  </body></html>;
}
