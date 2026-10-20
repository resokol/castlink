"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EntryShell } from "./EntryShell";
import styles from "./EntryFlow.module.css";
import { useI18n } from "./I18nProvider";

export function HostedAccessGate({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
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
  return <EntryShell><section className={styles.card}>
    {onBack && <button type="button" className={styles.back} onClick={onBack}>← {t("Выбрать другую роль")}</button>}
    <h1>{t("Доступ к студии")}</h1>
    {state === "loading" ? <p role="status">{t("Проверяем доступ…")}</p>
      : state === "error" ? <><p className={styles.error} role="alert">{t("Вход временно недоступен")}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t("Повторить")}</button></>
      : <form onSubmit={submit}>
        <p>{t("Введите токен, который вы получили от владельца CastLink.")}</p>
        <label className={styles.field} htmlFor="hosted-token">{t("Токен доступа")}<input id="hosted-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} disabled={busy} /></label>
        {error && <p className={styles.error} role="alert">{t(error)}</p>}
        <button type="submit" className={`${styles.primary} ${styles.full}`} disabled={busy || !token.trim()}>{t(busy ? "Проверяем доступ…" : "Продолжить")}</button>
        <p className="muted">{t("Токен можно использовать повторно до окончания срока действия или отзыва владельцем.")}</p>
      </form>}
  </section></EntryShell>;
}
