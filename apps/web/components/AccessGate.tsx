"use client";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./StudioEntry.module.css";

export function AccessGate({ kind, room = "", ownerStudioId, children }: { kind: "studio" | "guest"; room?: string; ownerStudioId?: string; children: ReactNode }) {
  const [allowed, setAllowed] = useState(false), [loading, setLoading] = useState(true);
  const [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setAllowed(false); setLoading(true);
    const accessUrl = kind === "studio" && ownerStudioId ? `/api/studio-access?studioId=${encodeURIComponent(ownerStudioId)}` : `/api/auth?kind=${kind}&room=${encodeURIComponent(room)}`;
    fetch(accessUrl, { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw Error("Не удалось проверить доступ"); return r.json(); })
      .then(data => { setAllowed(data.allowed); setExists(data.exists !== false); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, room, ownerStudioId]);
  if (loading) return <main className={styles.entryPage}><section className={styles.entryCard}><div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div><p className={styles.muted}>Проверка доступа…</p></section></main>;
  if (allowed) return <>{children}</>;
  if (!exists) return <main className={styles.entryPage}><section className={styles.entryCard}><div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div><h1>Комната не найдена</h1></section></main>;
  return <main className={styles.entryPage}><section className={styles.entryCard}>
    <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
    <form className={styles.stack} onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, room, password }) });
        const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось войти");
        setPassword(""); setAllowed(true);
      } catch (e) { setError(e instanceof Error ? e.message : "Ошибка входа"); } finally { setBusy(false); }
    }}>
      <p className={styles.kicker}>{kind === "studio" ? "STUDIO ACCESS" : "ROOM ACCESS"}</p>
      <h1>{kind === "studio" ? "Вход в студию" : `Вход в комнату «${room}»`}</h1>
      {kind === "studio" && <p className={styles.muted}>Пароль действует только на этом сервере. Для другого сервера выполните вход на нём отдельно.</p>}
      <label className={styles.field}>Пароль<input autoFocus type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={256} /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primaryButton} disabled={busy || !password}>{busy ? "Проверка…" : "Войти"}</button>
    </form>
    <div className={styles.footer}>CastLink Studio <span>•</span> Безопасное подключение</div>
  </section></main>;
}
