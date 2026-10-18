"use client";
import { BrandIcon } from "@/components/BrandIcon";
import { useI18n } from "@/components/I18nProvider";

import { FormEvent, useEffect, useState } from "react";
import type { DeploymentModel } from "../../lib/deployment-model";
import styles from "../../components/StudioEntry.module.css";

type SetupMode = "public" | "edge";

export default function SetupPage() {
  const { t, locale } = useI18n();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [deploymentModel, setDeploymentModel] = useState<DeploymentModel>("self-hosted");
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
        if (data.deploymentModel !== "self-hosted" && data.deploymentModel !== "legacy") throw new Error("Не удалось определить модель развёртывания");
        setDeploymentModel(data.deploymentModel);
        setNeedsSetup(data.needsSetup === true);
      })
      .catch(error => {
        setError(error instanceof Error ? error.message : "Не удалось проверить состояние настройки");
        setNeedsSetup(null);
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
        body: JSON.stringify({ mode, serverName, ...(deploymentModel === "legacy" ? { activationCode } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось настроить CastLink");
      setDone(true);
      setNeedsSetup(false);
      setSetupToken("");
      setActivationCode("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось настроить CastLink");
    } finally {
      setBusy(false);
    }
  }

  if (needsSetup === null) {
    return <main className={`${styles.entryPage} ops-entry ops-setup graphite-entry`}><section className={`${styles.entryCard} ops-card`}><p className={error ? styles.error : styles.muted} role={error ? "alert" : undefined}>{error ? t(error) : t("Проверка установки…")}</p></section></main>;
  }

  if (done || !needsSetup) {
    return (
      <main className={`${styles.entryPage} ops-entry ops-setup graphite-entry`}>
        <section className={`${styles.entryCard} ops-card`}>
          <div className={`${styles.brand} ops-brand`}><BrandIcon className={styles.brandMark} /><span>CASTLINK</span></div>
          <div className={`${styles.stack} ops-stack`}>
            <p className={`${styles.kicker} ops-kicker`}>{t("SETUP COMPLETE")}</p>
            <h1>{deploymentModel === "legacy" ? t("Сервер активирован") : t("Сервер настроен")}</h1>
            <p className={`${styles.muted} ops-muted`}>{t("Первичная настройка завершена. Дальше управление доступно через основную студию.")}</p>
            <a className={`${styles.primaryButton} ops-primary entry-action-link`} href="/studio">{t("Открыть студию")}</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`${styles.entryPage} ops-entry ops-setup graphite-entry`}>
      <section className={`${styles.entryCard} ops-card`}>
        <div className={`${styles.brand} ops-brand`}><BrandIcon className={styles.brandMark} /><span>CASTLINK</span></div>
        <form className={`${styles.stack} ops-stack`} onSubmit={submit}>
          <p className={`${styles.kicker} ops-kicker`}>{t("FIRST RUN")}</p>
          <h1>{t("Настройка сервера")}</h1>
          <p className={`${styles.muted} ops-muted`}>{t("Setup token хранится локально на установленном сервере и действует только до завершения первичной настройки.")}</p>

          <label className={`${styles.field} ops-field`}>{t("Режим")}<select value={mode} onChange={event => setMode(event.target.value as SetupMode)}>
              <option value="edge">{t("Этот ПК / private edge")}</option>
              <option value="public">{t("VPS / public server")}</option>
            </select>
          </label>

          <label className={`${styles.field} ops-field`}>{t("Имя сервера")}<input value={serverName} onChange={event => setServerName(event.target.value)} maxLength={120} placeholder={t("Например, Office Moscow")} />
          </label>

          <label className={`${styles.field} ops-field`}>{t("Setup token")}<input type="password" autoComplete="off" value={setupToken} onChange={event => setSetupToken(event.target.value)} maxLength={256} />
          </label>

          {deploymentModel === "legacy" && <label className={`${styles.field} ops-field`}>{t("Код активации / лицензия")}<input type="password" autoComplete="off" value={activationCode} onChange={event => setActivationCode(event.target.value)} maxLength={512} />
          </label>}

          {mode === "edge" && deploymentModel === "legacy" && <p className={`${styles.serverDetail} ops-server-detail`}>{t("Edge-режим предназначен для локального ПК без публичного IP и в целевой архитектуре регистрируется через CastLink Cloud.")}</p>}
          {mode === "edge" && deploymentModel === "self-hosted" && <p className={`${styles.serverDetail} ops-server-detail`}>{t("Сервер работает на вашей инфраструктуре. Для доступа с других устройств настройте HTTPS и медиасеть.")}</p>}
          {mode === "public" && <p className={`${styles.serverDetail} ops-server-detail`}>{t("Public-режим предназначен для VPS/сервера с доступным ingress/TURN.")}</p>}

          {error && <p className={`${styles.error} ops-error`} role="alert">{t(error)}</p>}
          <button className={`${styles.primaryButton} ops-primary`} disabled={busy || !serverName || !setupToken || (deploymentModel === "legacy" && !activationCode)}>
            {busy ? t("Настройка…") : deploymentModel === "legacy" ? t("Активировать сервер") : t("Настроить сервер")}
          </button>
        </form>
      </section>
    </main>
  );
}
