"use client";

import { useCallback, useEffect, useState } from "react";

type HealthPayload = {
  status?: string;
  productVersion?: string | null;
  buildId?: string | null;
  storageBackend?: string;
  uptimeSec?: number;
  checks?: Record<string, { ok?: boolean; latencyMs?: number; error?: string }>;
  error?: string;
};

export default function DiagnosticsPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body = await response.json();
      setHealth(body);
    } catch {
      setHealth({ status: "unavailable", error: "Не удалось получить диагностику" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const checks = Object.entries(health?.checks || {});

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>CastLink Diagnostics</h1>
          <div style={{ opacity: 0.7 }}>Безопасная операторская сводка состояния</div>
        </div>
        <button onClick={() => void refresh()} disabled={loading} style={{ padding: "10px 16px", cursor: "pointer" }}>
          {loading ? "Проверка…" : "Обновить"}
        </button>
      </div>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid currentColor", borderRadius: 12 }}>
        <strong>Статус: {health?.status || (loading ? "loading" : "unknown")}</strong>
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          <span>Версия: {health?.productVersion || "—"}</span>
          <span>Build: {health?.buildId || "—"}</span>
          <span>Storage: {health?.storageBackend || "—"}</span>
          <span>Uptime: {typeof health?.uptimeSec === "number" ? `${health.uptimeSec}s` : "—"}</span>
        </div>
      </section>

      <section style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {checks.map(([name, check]) => (
          <div key={name} style={{ padding: 16, border: "1px solid currentColor", borderRadius: 12 }}>
            <strong>{name}: {check.ok ? "OK" : "DEGRADED"}</strong>
            {typeof check.latencyMs === "number" && <div>Latency: {check.latencyMs} ms</div>}
            {check.error && <div>Error: {check.error}</div>}
          </div>
        ))}
        {!loading && checks.length === 0 && <div>Нет данных о компонентах.</div>}
      </section>
    </main>
  );
}
