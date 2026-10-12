"use client";
import { useI18n } from "@/components/I18nProvider";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlatformAccessGate } from "../../components/PlatformAccessGate";
import styles from "../../components/StudioEntry.module.css";

type Server = {
  serverId: string;
  displayName: string;
  serverType: "cloud" | "dedicated" | "self-hosted" | "temporary";
  region?: string;
  endpoint?: string;
  visibility: "platform" | "organization" | "account";
  state: "active" | "disabled" | "expired" | "provisioning";
  expiresAt?: string;
  latencyMs?: number;
  health?: "healthy" | "degraded" | "offline" | "unknown";
};

function ServersPanel() {
  const { t, locale } = useI18n();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [region, setRegion] = useState("frankfurt");
  const [displayName, setDisplayName] = useState("Private Frankfurt");
  const [durationHours, setDurationHours] = useState(24);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/servers", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось получить серверы");
      setServers(Array.isArray(data.servers) ? data.servers : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось получить серверы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createTemporary(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "temporary", region, displayName, durationHours }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось создать временный сервер");
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать временный сервер");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(serverId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deactivate", serverId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось отключить сервер");
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось отключить сервер");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`${styles.entryPage} graphite-entry`}>
      <section className={`${styles.entryCard} servers-registry-card`}>
        <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
        <div className={styles.stack}>
          <p className={styles.kicker}>{t("SERVER REGISTRY")}</p>
          <h1>{t("Мои серверы")}</h1>
          <p className={styles.muted}>{t("Cloud, dedicated, self-hosted и временные private-ноды вашей организации.")}</p>

          <button className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading || busy}>
            {loading ? t("Обновление…") : t("Обновить список")}
          </button>

          <div className={styles.savedList}>
            {servers.map(server => (
              <div key={server.serverId}>
                <span>
                  {server.displayName}
                  <small>
                    {t(server.serverType)} · {server.region || "region —"} · {t(server.health || "unknown")}
                    {typeof server.latencyMs === "number" ? ` · ${Math.round(server.latencyMs)} ms` : ""}
                    {server.expiresAt ? t(" · до {date}", { date: new Date(server.expiresAt).toLocaleString(locale) }) : ""}
                  </small>
                </span>
                {server.visibility !== "platform" && server.state === "active" &&
                  <button className={styles.removeButton} disabled={busy} onClick={() => void deactivate(server.serverId)}>{t("Отключить")}</button>}
              </div>
            ))}
            {!loading && servers.length === 0 && <p className={styles.muted}>{t("Доступных серверов пока нет.")}</p>}
          </div>

          <form className={styles.stack} onSubmit={createTemporary}>
            <p className={styles.kicker}>{t("TEMPORARY PRIVATE NODE")}</p>
            <label className={styles.field}>{t("Регион")}<select value={region} onChange={event => setRegion(event.target.value)}>
                <option value="frankfurt">{t("Frankfurt")}</option>
                <option value="helsinki">{t("Helsinki")}</option>
                <option value="warsaw">{t("Warsaw")}</option>
              </select>
            </label>
            <label className={styles.field}>{t("Название")}<input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={120} />
            </label>
            <label className={styles.field}>{t("Срок")}<select value={durationHours} onChange={event => setDurationHours(Number(event.target.value))}>
                <option value={6}>{t("6 часов")}</option>
                <option value={24}>{t("24 часа")}</option>
                <option value={72}>{t("3 дня")}</option>
                <option value={168}>{t("7 дней")}</option>
              </select>
            </label>
            <button className={styles.primaryButton} disabled={busy || !displayName.trim()}>
              {busy ? t("Создание…") : t("Создать временный сервер")}
            </button>
          </form>

          {error && <p className={styles.error} role="alert">{t(error)}</p>}
        </div>
      </section>
    </main>
  );
}

export default function ServersPage() {
  const { t, locale } = useI18n();
  return <PlatformAccessGate><ServersPanel /></PlatformAccessGate>;
}
