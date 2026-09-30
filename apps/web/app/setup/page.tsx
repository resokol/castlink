"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../../components/StudioEntry.module.css";

type SetupMode = "public" | "edge";

export default function SetupPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [mode, setMode] = useState<SetupMode>("edge");
  const [serverName, setServerName] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Не удалось проверить состояние настройки");
        const data = await response.json();
        setNeedsSetup(data.needsSetup === true);
      })
      .catch(error => {
        setError(error instanceof Error ? error.message : "Не удалось проверить состояние настройки");
        setNeedsSetup(false);
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-castlink-setup-token": setupToken,
        },
        body: JSON.stringify({ mode, serverName, activationCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось активировать CastLink");
      setDone(true);
      setNeedsSetup(false);
      setSetupToken("");
      setActivationCode("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось активировать CastLink");
    } finally {
      setBusy(false);
    }
  }

  if (needsSetup === null) {
    return <main className={styles.entryPage}><section className={styles.entryCard}><p className={styles.muted}>Проверка установки…</p></section></main>;
  }

  if (done || !needsSetup) {
    return (
      <main className={styles.entryPage}>
        <section className={styles.entryCard}>
          <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
          <div className={styles.stack}>
            <p className={styles.kicker}>SETUP COMPLETE</p>
            <h1>Сервер активирован</h1>
            <p className={styles.muted}>Первичная настройка завершена. Дальше управление доступно через основную студию.</p>
            <a className={styles.primaryButton} href="/studio" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Открыть студию</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.entryPage}>
      <section className={styles.entryCard}>
        <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
        <form className={styles.stack} onSubmit={submit}>
          <p className={styles.kicker}>FIRST RUN</p>
          <h1>Настройка сервера</h1>
          <p className={styles.muted}>Setup token хранится локально на установленном сервере и действует только до завершения первичной настройки.</p>

          <label className={styles.field}>Режим
            <select value={mode} onChange={event => setMode(event.target.value as SetupMode)}>
              <option value="edge">Этот ПК / private edge</option>
              <option value="public">VPS / public server</option>
            </select>
          </label>

          <label className={styles.field}>Имя сервера
            <input value={serverName} onChange={event => setServerName(event.target.value)} maxLength={120} placeholder="Например, Office Moscow" />
          </label>

          <label className={styles.field}>Setup token
            <input type="password" autoComplete="off" value={setupToken} onChange={event => setSetupToken(event.target.value)} maxLength={256} />
          </label>

          <label className={styles.field}>Код активации / лицензия
            <input type="password" autoComplete="off" value={activationCode} onChange={event => setActivationCode(event.target.value)} maxLength={512} />
          </label>

          {mode === "edge" && <p className={styles.serverDetail}>Edge-режим предназначен для локального ПК без публичного IP и в целевой архитектуре регистрируется через CastLink Cloud.</p>}
          {mode === "public" && <p className={styles.serverDetail}>Public-режим предназначен для VPS/сервера с доступным ingress/TURN.</p>}

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primaryButton} disabled={busy || !serverName || !setupToken || !activationCode}>
            {busy ? "Активация…" : "Активировать сервер"}
          </button>
        </form>
      </section>
    </main>
  );
}
