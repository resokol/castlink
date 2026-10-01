"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AccessState = { allowed?: boolean; bootstrapAllowed?: boolean; error?: string };
type NodeInfo = {
  nodeId: string; name: string; region: string; endpoint?: string; state: string; health: string; lastSeenAt: number;
  maxActiveStudios: number; maxParticipants: number; maxVideoTracks: number;
  activeStudios: number; activeParticipants: number; activeVideoTracks: number;
  cpuLoad: number | null; memoryLoad: number | null; networkOutMbps: number | null;
};
type StudioInfo = {
  studioId: string; organizationId: string; name: string; assignmentMode: string; assignedNodeId: string | null; broadcastState: string;
};
type RoomInfo = { roomId: string; studioId: string; organizationId: string; name: string; updatedAt: number };
type Overview = {
  generatedAt: number;
  summary: { nodes: number; healthyNodes: number; studios: number; liveStudios: number; rooms: number; participants: number; videoTracks: number };
  nodes: NodeInfo[];
  studios: StudioInfo[];
  rooms: RoomInfo[];
};

const age = (at: number) => {
  if (!at) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? `${seconds} сек` : seconds < 3600 ? `${Math.floor(seconds / 60)} мин` : `${Math.floor(seconds / 3600)} ч`;
};
const percent = (value: number | null) => value == null ? "—" : `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
const number = (value: number | null | undefined, suffix = "") => value == null ? "—" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}${suffix}`;

export default function SuperAdminPage() {
  const [access, setAccess] = useState<AccessState>({});
  const [overview, setOverview] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/super-admin", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось получить данные Super Admin");
    setOverview(data);
  }, []);

  const refreshAccess = useCallback(async () => {
    const response = await fetch("/api/super-admin-access", { cache: "no-store" });
    const data: AccessState = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось проверить доступ Super Admin");
    setAccess(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError("");
      try {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
        const bearer = fragment.get("access");
        if (url.hash) window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        if (bearer) {
          const response = await fetch("/api/super-admin-access", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "accept", invite: bearer }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Не удалось принять Super Admin access");
        }
        const state = await refreshAccess();
        if (!cancelled && state.allowed) await loadOverview();
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Ошибка Super Admin");
      } finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, [refreshAccess, loadOverview]);

  useEffect(() => {
    if (!access.allowed) return;
    const timer = window.setInterval(() => void loadOverview().catch(() => undefined), 15000);
    return () => window.clearInterval(timer);
  }, [access.allowed, loadOverview]);

  const postAccess = async (body: Record<string, unknown>) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/super-admin-access", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Операция Super Admin не выполнена");
      return data;
    } finally { setBusy(false); }
  };

  const bootstrap = async () => {
    try {
      await postAccess({ action: "bootstrap" });
      const state = await refreshAccess();
      if (state.allowed) await loadOverview();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось включить Super Admin"); }
  };

  const createInvite = async () => {
    try {
      const data = await postAccess({ action: "create-invite" });
      const url = new URL(data.path, window.location.origin).toString();
      setInviteUrl(url);
      try { await navigator.clipboard.writeText(url); setMessage("Super Admin link скопирована."); }
      catch { setMessage("Super Admin link создана. Скопируйте её из поля."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку"); }
  };

  const revoke = async () => {
    if (!window.confirm("Отозвать ВСЕ Super Admin ссылки и активные Super Admin сессии?")) return;
    try {
      await postAccess({ action: "revoke" });
      setOverview(undefined); setInviteUrl(""); setAccess({ allowed: false, bootstrapAllowed: false });
      setMessage("Все Super Admin доступы отозваны. Для повторного bootstrap нужен platform owner.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось отозвать доступ"); }
  };

  const logout = async () => {
    try { await postAccess({ action: "logout" }); } catch {}
    window.location.assign("/");
  };

  const studiosByNode = useMemo(() => {
    const map = new Map<string, StudioInfo[]>();
    for (const studio of overview?.studios || []) {
      const key = studio.assignedNodeId || "unassigned";
      map.set(key, [...(map.get(key) || []), studio]);
    }
    return map;
  }, [overview]);

  if (loading) return <main className="super-admin-page"><section className="panel super-admin-gate"><p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1><p>Проверяем доступ…</p></section></main>;

  if (!access.allowed) return <main className="super-admin-page"><section className="panel super-admin-gate">
    <p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1>
    <p className="muted">Отдельная platform-level роль. Она не имеет прав публикации камеры, микрофона, эфира или демонстрации экрана.</p>
    {access.bootstrapAllowed
      ? <button disabled={busy} onClick={() => void bootstrap()}>{busy ? "Включаем…" : "Войти как Super Admin (bootstrap)"}</button>
      : <p>Нужна действующая Super Admin ссылка или bootstrap от platform owner.</p>}
    {message && <p role="status">{message}</p>}
    {error && <p className="av-error" role="alert">{error}</p>}
  </section></main>;

  const summary = overview?.summary;
  return <main className="super-admin-page">
    <header className="super-admin-header">
      <div><p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1><p className="muted">Control plane, topology и диагностика. Без эфирных media controls.</p></div>
      <div className="super-admin-actions">
        <button className="button-secondary" disabled={busy} onClick={() => void loadOverview().catch(cause => setError(cause instanceof Error ? cause.message : "Ошибка обновления"))}>Обновить</button>
        <button className="button-secondary" disabled={busy} onClick={() => void createInvite()}>Создать Super Admin link</button>
        <button className="button-secondary super-admin-danger" disabled={busy} onClick={() => void revoke()}>Отозвать все доступы</button>
        <button className="button-secondary" disabled={busy} onClick={() => void logout()}>Выйти</button>
      </div>
    </header>

    {inviteUrl && <section className="panel super-admin-invite"><strong>Новая Super Admin link</strong><input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></section>}
    {message && <p className="panel" role="status">{message}</p>}
    {error && <p className="panel av-error" role="alert">{error}</p>}

    <section className="super-admin-summary">
      <div className="panel"><span>Ноды</span><strong>{summary?.nodes ?? "—"}</strong><small>{summary ? `${summary.healthyNodes} healthy` : "—"}</small></div>
      <div className="panel"><span>Студии</span><strong>{summary?.studios ?? "—"}</strong><small>{summary ? `${summary.liveStudios} live` : "—"}</small></div>
      <div className="panel"><span>Комнаты</span><strong>{summary?.rooms ?? "—"}</strong></div>
      <div className="panel"><span>Участники</span><strong>{summary?.participants ?? "—"}</strong></div>
      <div className="panel"><span>Видео-треки</span><strong>{summary?.videoTracks ?? "—"}</strong></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">CLUSTER</p><h2>Ноды</h2></div><span>Heartbeat и текущая capacity</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Node</th><th>State / Health</th><th>Heartbeat</th><th>Studios</th><th>Participants</th><th>Video</th><th>CPU</th><th>RAM</th><th>Network out</th></tr></thead>
        <tbody>{overview?.nodes.map(node => <tr key={node.nodeId}><td><strong>{node.name}</strong><small>{node.nodeId} · {node.region}</small></td><td>{node.state} / {node.health}</td><td>{age(node.lastSeenAt)}</td><td>{node.activeStudios}/{node.maxActiveStudios}</td><td>{node.activeParticipants}/{node.maxParticipants}</td><td>{node.activeVideoTracks}/{node.maxVideoTracks}</td><td>{percent(node.cpuLoad)}</td><td>{percent(node.memoryLoad)}</td><td>{number(node.networkOutMbps, " Mbps")}</td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">TENANTS</p><h2>Студии</h2></div><span>Assignment и эфирное состояние</span></div>
      <div className="super-admin-card-grid">{overview?.studios.map(studio => <article className="super-admin-card" key={studio.studioId}>
        <strong>{studio.name}</strong><small>{studio.studioId}</small><span>Org: {studio.organizationId}</span><span>Node: {studio.assignedNodeId || "не назначена"}</span><span>{studio.assignmentMode} · {studio.broadcastState}</span>
      </article>)}</div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">TOPOLOGY</p><h2>Комнаты</h2></div><span>Control-plane metadata</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Комната</th><th>Studio</th><th>Organization</th><th>Node</th><th>Обновлена</th></tr></thead>
        <tbody>{overview?.rooms.map(room => {
          const studio = overview.studios.find(item => item.studioId === room.studioId);
          return <tr key={room.roomId}><td><strong>{room.name}</strong><small>{room.roomId}</small></td><td>{room.studioId}</td><td>{room.organizationId}</td><td>{studio?.assignedNodeId || "—"}</td><td>{new Date(room.updatedAt).toLocaleString("ru-RU")}</td></tr>;
        })}</tbody></table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">NODE MAP</p><h2>Распределение</h2></div></div>
      <div className="super-admin-card-grid">{overview?.nodes.map(node => <article className="super-admin-card" key={node.nodeId}>
        <strong>{node.name}</strong><small>{node.nodeId}</small>
        {(studiosByNode.get(node.nodeId) || []).map(studio => <span key={studio.studioId}>{studio.name} · {studio.broadcastState}</span>)}
        {!(studiosByNode.get(node.nodeId)?.length) && <span className="muted">Studios не назначены</span>}
      </article>)}</div>
    </section>
  </main>;
}
