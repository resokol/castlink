"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "./I18nProvider";

export function HostedAccessGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "required" | "allowed" | "error">("loading");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void fetch("/api/hosted-access", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.enabled !== "boolean" || typeof data.allowed !== "boolean") throw new Error();
        setState(data.allowed ? "allowed" : "required");
      }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [attempt]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/hosted-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.trim() }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.allowed !== true) {
        setError(response.status === 429 ? "Слишком много попыток" : response.status === 401 ? "Токен недействителен, отозван или срок его действия истёк" : "Вход временно недоступен");
        return;
      }
      setToken(""); setState("allowed");
    } catch { setError("Вход временно недоступен"); }
    finally { setBusy(false); }
  }
  if (state === "allowed") return <>{children}</>;
  return <main className="graphite-entry"><section className="panel status-card hosted-access-card">
    <p className="eyebrow">CASTLINK</p>
    <h1>{t("Доступ к студии")}</h1>
    {state === "loading" ? <p role="status">{t("Проверяем доступ…")}</p>
      : state === "error" ? <><p role="alert">{t("Вход временно недоступен")}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t("Повторить")}</button></>
      : <form onSubmit={submit}>
        <p>{t("Введите токен, который вы получили от владельца CastLink.")}</p>
        <label htmlFor="hosted-token">{t("Токен доступа")}</label>
        <input id="hosted-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} disabled={busy} />
        {error && <p role="alert">{t(error)}</p>}
        <button type="submit" className="primary" disabled={busy || !token.trim()}>{t(busy ? "Проверяем доступ…" : "Продолжить")}</button>
        <p className="muted">{t("Токен можно использовать повторно до окончания срока действия или отзыва владельцем.")}</p>
      </form>}
  </section></main>;
}
