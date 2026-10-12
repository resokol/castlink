"use client";

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
          <p className="eyebrow">CASTLINK · ДИАГНОСТИКА</p>
          <h1>CastLink Diagnostics</h1>
          <p className="muted">Доступ разрешён только основной студии или администратору комнаты.</p>
        </section>
      </main>
    );
  }

  const checks = Object.entries(health?.checks || {});

  return (
    <main className="graphite-page diagnostics-page">
      <header className="studio-header diagnostics-header">
        <div>
          <p className="eyebrow">CASTLINK · ДИАГНОСТИКА</p>
          <h1>CastLink Diagnostics</h1>
          <p className="muted">Операторская сводка состояния</p>
        </div>
        <button className="button-secondary" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Проверка…" : "Обновить"}
        </button>
      </header>

      <section className="panel diagnostics-summary">
        <strong>Статус: {health?.status || (loading ? "loading" : "unknown")}</strong>
        <div className="diagnostics-facts">
          <span>Версия: {health?.productVersion || "—"}</span>
          <span>Build: {health?.buildId || "—"}</span>
          <span>Storage: {health?.storageBackend || "—"}</span>
          <span>Node: {health?.nodeId || "—"}</span>
          <span>Control plane: {health?.controlPlaneMode || "—"}</span>
          <span>Uptime: {typeof health?.uptimeSec === "number" ? `${health.uptimeSec}s` : "—"}</span>
          <span>Stats retention: {health?.statsRetentionHours ?? "—"} h</span>
          <span>Stats cap: {typeof health?.statsMaxBytes === "number" ? `${Math.round(health.statsMaxBytes / 1024 / 1024)} MiB` : "—"}</span>
        </div>
      </section>

      <p className="muted diagnostics-note">Полная topology по всем нодам, студиям и комнатам доступна только в <a href="/super-admin">Super Admin</a>. Эта страница намеренно не показывает tenant topology, токены, секреты и DB credentials.</p>

      <section className="diagnostics-checks">
        {checks.map(([name, check]) => (
          <div key={name} className="panel diagnostics-check">
            <strong>{name}: {check.ok ? "OK" : "DEGRADED"}</strong>
            {typeof check.latencyMs === "number" && <div className="muted">Latency: {check.latencyMs} ms</div>}
            {check.error && <div className="av-error">Error: {check.error}</div>}
          </div>
        ))}
        {!loading && checks.length === 0 && <div className="muted">Нет данных о компонентах.</div>}
      </section>
    </main>
  );
}
