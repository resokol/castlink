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
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>CastLink Diagnostics</h1>
        <p>Доступ разрешён только основной студии или администратору комнаты.</p>
      </main>
    );
  }

  const checks = Object.entries(health?.checks || {});

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>CastLink Diagnostics</h1>
          <div style={{ opacity: 0.7 }}>Операторская сводка состояния</div>
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
          <span>Node: {health?.nodeId || "—"}</span>
          <span>Control plane: {health?.controlPlaneMode || "—"}</span>
          <span>Uptime: {typeof health?.uptimeSec === "number" ? `${health.uptimeSec}s` : "—"}</span>
          <span>Stats retention: {health?.statsRetentionHours ?? "—"} h</span>
          <span>Stats cap: {typeof health?.statsMaxBytes === "number" ? `${Math.round(health.statsMaxBytes / 1024 / 1024)} MiB` : "—"}</span>
        </div>
      </section>

      <p style={{ marginTop: 16, opacity: 0.75 }}>Полная topology по всем нодам, студиям и комнатам доступна только в <a href="/super-admin">Super Admin</a>. Эта страница намеренно не показывает tenant topology, токены, секреты и DB credentials.</p>

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
