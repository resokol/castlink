"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AccessGate } from "../../components/AccessGate";
import styles from "../../components/StudioEntry.module.css";

type Studio = {
  studioId: string;
  organizationId: string;
  name: string;
  assignmentMode: "auto" | "pinned";
  assignedNodeId: string | null;
  broadcastState: "idle" | "starting" | "live" | "stopping";
};

type Node = {
  nodeId: string;
  name: string;
  region: string;
  health: string;
  state: string;
  activeStudios: number;
  maxActiveStudios: number;
  activeParticipants: number;
  maxParticipants: number;
  activeVideoTracks: number;
  maxVideoTracks: number;
};

function StudiosPanel() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/studios", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось получить студии");
      setStudios(Array.isArray(data.studios) ? data.studios : []);
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось получить студии");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/studios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const reason = data.reason === "no_capacity"
          ? "На доступных CastLink nodes сейчас нет свободной мощности."
          : data.reason === "active_broadcast_locked"
            ? "Нельзя менять сервер во время активного эфира."
            : data.reason === "pinned_node_unavailable"
              ? "Выбранный сервер сейчас недоступен или заполнен."
              : data.error || "Операция не выполнена";
        throw new Error(reason);
      }
      await refresh();
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await action({ action: "create", name: name.trim() });
      setName("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать студию");
    }
  }

  async function assignAuto(studioId: string) {
    try { await action({ action: "auto", studioId }); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось выбрать сервер"); }
  }

  async function pin(studioId: string, nodeId: string) {
    try { await action({ action: "pin", studioId, nodeId }); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось закрепить сервер"); }
  }

  const nodeById = new Map(nodes.map(node => [node.nodeId, node]));

  return (
    <main className={styles.entryPage}>
      <section className={styles.entryCard} style={{ width: "min(100%, 860px)" }}>
        <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
        <div className={styles.stack}>
          <p className={styles.kicker}>MULTI-STUDIO CLOUD</p>
          <h1>Студии и серверы</h1>
          <p className={styles.muted}>Одна физическая node может обслуживать несколько изолированных студий. Auto выбирает node по текущей мощности.</p>

          <form className={styles.roomActions} onSubmit={create}>
            <input className={styles.field} value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder="Новая студия" />
            <button className={styles.primaryButton} disabled={busy || !name.trim()}>Создать</button>
          </form>

          <div className={styles.savedList}>
            {studios.map(studio => {
              const assigned = studio.assignedNodeId ? nodeById.get(studio.assignedNodeId) : undefined;
              return (
                <div key={studio.studioId} style={{ alignItems: "flex-start" }}>
                  <span>
                    {studio.name}
                    <small>{studio.broadcastState} · {studio.assignmentMode} · {assigned ? `${assigned.name} / ${assigned.region}` : "server не назначен"}</small>
                  </span>
                  <div style={{ display: "grid", gap: 6, minWidth: 190 }}>
                    <button className={styles.secondaryButton} disabled={busy || studio.broadcastState === "live"} onClick={() => void assignAuto(studio.studioId)}>Auto</button>
                    <select
                      value={studio.assignmentMode === "pinned" ? studio.assignedNodeId || "" : ""}
                      disabled={busy || studio.broadcastState === "live"}
                      onChange={event => { if (event.target.value) void pin(studio.studioId, event.target.value); }}
                    >
                      <option value="">Закрепить сервер…</option>
                      {nodes.map(node => (
                        <option key={node.nodeId} value={node.nodeId} disabled={node.health !== "healthy" || node.state !== "active"}>
                          {node.name} · {node.region} · {node.activeStudios}/{node.maxActiveStudios} studios
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
            {!studios.length && <p className={styles.muted}>Студий пока нет.</p>}
          </div>

          <p className={styles.kicker}>NODES</p>
          <div className={styles.savedList}>
            {nodes.map(node => (
              <div key={node.nodeId}>
                <span>
                  {node.name}
                  <small>{node.region} · {node.health} · studios {node.activeStudios}/{node.maxActiveStudios} · participants {node.activeParticipants}/{node.maxParticipants} · video {node.activeVideoTracks}/{node.maxVideoTracks}</small>
                </span>
              </div>
            ))}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      </section>
    </main>
  );
}

export default function StudiosPage() {
  return <AccessGate kind="studio"><StudiosPanel /></AccessGate>;
}
