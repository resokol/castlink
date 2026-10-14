"use client";
import { displayBuildId } from "@/lib/app-update";
import { useI18n } from "@/components/I18nProvider";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type HealthPayload = {
  status?: string;
  productVersion?: string | null;
  buildId?: string | null;
  storageBackend?: string;
  nodeId?: string | null;
  controlPlaneMode?: "local" | "remote";
  statsRetentionHours?: number;
  statsMaxBytes?: number;
  uptimeSec?: number;
  checks?: Record<string, { ok?: boolean; latencyMs?: number; error?: string }>;
  error?: string;
};

export default function DiagnosticsPage() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const room = params.get("room")?.trim() || "";
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const suffix = room ? `?room=${encodeURIComponent(room)}` : "";
      const response = await fetch(`/api/health${suffix}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setForbidden(true);
        setHealth(null);
        return;
      }
      const body = await response.json();
      setHealth(body);
    } catch {
      setHealth({ status: "unavailable", error: "Не удалось получить диагностику" });
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (forbidden) {
    return (
      <main className="graphite-entry status-page diagnostics-page">
        <section className="panel status-card diagnostics-summary">
          <p className="eyebrow">{t("CASTLINK · ДИАГНОСТИКА")}</p>
          <h1>{t("CastLink Diagnostics")}</h1>
          <p className="muted">{t("Доступ разрешён только основной студии или администратору комнаты.")}</p>
        </section>
      </main>
    );
  }

  const checks = Object.entries(health?.checks || {});

  return (
    <main className="graphite-page diagnostics-page">
      <header className="studio-header diagnostics-header">
        <div>
          <p className="eyebrow">{t("CASTLINK · ДИАГНОСТИКА")}</p>
          <h1>{t("CastLink Diagnostics")}</h1>
          <p className="muted">{t("Операторская сводка состояния")}</p>
        </div>
        <button className="button-secondary" onClick={() => void refresh()} disabled={loading}>
          {loading ? t("Проверка…") : t("Обновить")}
        </button>
      </header>

      <section className="panel diagnostics-summary">
        <strong>{t("Статус:")}{" "}{t(health?.status || (loading ? "loading" : "unknown"))}</strong>
        <div className="diagnostics-facts">
          <span>{t("Версия:")}{" "}{health?.productVersion || "—"}</span>
          <span>{t("Build:")}{" "}{health?.buildId ? <span title={health.buildId}>{displayBuildId(health.buildId)}</span> : "—"}</span>
          <span>{t("Storage:")}{" "}{health?.storageBackend || "—"}</span>
          <span>{t("Node:")}{" "}{health?.nodeId || "—"}</span>
          <span>{t("Control plane:")}{" "}{health?.controlPlaneMode || "—"}</span>
          <span>{t("Uptime:")}{" "}{typeof health?.uptimeSec === "number" ? `${health.uptimeSec}s` : "—"}</span>
          <span>{t("Stats retention:")}{" "}{health?.statsRetentionHours ?? "—"} {" "}{t("h")}</span>
          <span>{t("Stats cap:")}{" "}{typeof health?.statsMaxBytes === "number" ? `${Math.round(health.statsMaxBytes / 1024 / 1024)} MiB` : "—"}</span>
        </div>
      </section>

      <p className="muted diagnostics-note">{t("Полная topology по всем нодам, студиям и комнатам доступна только в")}{" "}<a href="/super-admin">{t("Super Admin")}</a>{t(". Эта страница намеренно не показывает tenant topology, токены, секреты и DB credentials.")}</p>

      <section className="diagnostics-checks">
        {checks.map(([name, check]) => (
          <div key={name} className="panel diagnostics-check">
            <strong>{name}: {t(check.ok ? "OK" : "DEGRADED")}</strong>
            {typeof check.latencyMs === "number" && <div className="muted">{t("Latency:")}{" "}{check.latencyMs} {" "}{t("ms")}</div>}
            {check.error && <div className="av-error">{t("Error:")}{" "}{check.error}</div>}
          </div>
        ))}
        {!loading && checks.length === 0 && <div className="muted">{t("Нет данных о компонентах.")}</div>}
      </section>
    </main>
  );
}
