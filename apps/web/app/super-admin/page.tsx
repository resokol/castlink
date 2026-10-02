"use client";

import { StatisticsDashboard } from "../../components/StatisticsDashboard";
import { PlatformParticipantActions } from "../../components/PlatformParticipantActions";
import type { StreamStat } from "../../lib/telemetry-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AccessState = { allowed?: boolean; bootstrapAllowed?: boolean; error?: string };
type NodeInfo = {
  operationalRevision:number; appliedRevision:number|null; appliedAt:number|null;
  nodeId: string; name: string; region: string; endpoint?: string; state: string; health: string; lastSeenAt: number;
  maxActiveStudios: number; maxParticipants: number; maxVideoTracks: number;
  activeStudios: number; activeParticipants: number; activeVideoTracks: number;
  cpuLoad: number | null; memoryLoad: number | null; networkOutMbps: number | null;
};
type StudioInfo = {
  studioId: string; organizationId: string; name: string; assignmentMode: string; assignedNodeId: string | null; broadcastState: string; observedLive?: boolean; observedNodeIds?: string[];
};
type ParticipantInfo = {
  sid?:string;streams?:StreamStat[];telemetryFresh?:boolean;
  identity: string; name: string; role: string; trackCount: number; sources: string[]; state: string; lastSampleAt: number | null;
  bitrateInKbps: number | null; bitrateOutKbps: number | null; rttMs: number | null; jitterMs: number | null; lossPct: number | null; reconnects: number | null;
};
type RoomInfo = {
  roomId: string; studioId: string; organizationId: string; name: string; updatedAt: number;
  nodeId: string | null; mediaRoom: string; participantCount: number | null; participants: ParticipantInfo[];
  topologyAvailable: boolean; nodeLatencyMs: number | null;
};
type NodeTopology = { nodeId: string; ok: boolean; latencyMs: number | null; error?: string };
type Overview = {
  generatedAt: number;
  summary: { nodes: number; healthyNodes: number; studios: number; liveStudios: number; rooms: number; participants: number|null; videoTracks: number|null; observedParticipants:number; observedVideoTracks:number; topologyComplete:boolean };
  nodes: NodeInfo[];
  studios: StudioInfo[];
  rooms: RoomInfo[];
  nodeTopologies: NodeTopology[];
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
  const [nodeFilter,setNodeFilter]=useState("");
  const [roomFilter,setRoomFilter]=useState("");
  const [participantSearch,setParticipantSearch]=useState("");
  const [historyTarget,setHistoryTarget]=useState<{nodeId:string;room:string;name:string;studioId:string;participant?:string}>();
  const overviewSequence=useRef(0);
  const historyPanel=useRef<HTMLElement>(null);

  const loadOverview = useCallback(async () => {
    const sequence=++overviewSequence.current;
    const response = await fetch("/api/super-admin", { cache: "no-store",signal:AbortSignal.timeout(10000) });
    const data = await response.json().catch(() => ({}));
    if (response.status===401 || response.status===403) { setAccess({allowed:false});setOverview(undefined); }
    if (!response.ok) throw new Error(data.error || "Не удалось получить данные Super Admin");
    if(sequence===overviewSequence.current) setOverview(data);
  }, []);

  const refreshAccess = useCallback(async () => {
    const response = await fetch("/api/super-admin-access", { cache: "no-store" });
    const data: AccessState = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось проверить доступ Super Admin");
    setAccess(data);
    return data;
  }, []);

  // Reuse acceptance across React StrictMode effect replays: invitations are single-use.
  const initialAccess = useRef<Promise<AccessState> | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!initialAccess.current) initialAccess.current = (async () => {
      const url = new URL(window.location.href);
      const bearer = new URLSearchParams(url.hash.replace(/^#/, "")).get("access");
      if (url.hash) window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      if (bearer) {
        const response = await fetch("/api/super-admin-access", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept", invite: bearer }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Не удалось принять ссылку Super Admin");
      }
      return refreshAccess();
    })();
    void initialAccess.current.then(async state => {
      if (!cancelled && state.allowed) await loadOverview();
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Ошибка Super Admin");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshAccess, loadOverview]);

  useEffect(() => {
    if (!access.allowed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { await loadOverview(); if (!cancelled) setError(""); }
      catch { if (!cancelled) setError("Обновление недоступно. Ниже последние полученные данные; смотрите время снимка."); }
      finally { if (!cancelled) timer = setTimeout(tick, 5000); }
    };
    timer = setTimeout(tick, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
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

  const createInvite = async () => {
    try {
      const data = await postAccess({ action: "create-invite" });
      const url = new URL(data.path, window.location.origin).toString();
      setInviteUrl(url);
      try { await navigator.clipboard.writeText(url); setMessage("Super Admin link скопирована."); }
      catch { setMessage("Одноразовая ссылка создана на 15 минут. Скопируйте её из поля."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку"); }
  };

  const revoke = async () => {
    if (!window.confirm("Отозвать ВСЕ Super Admin ссылки и активные Super Admin сессии?")) return;
    try {
      await postAccess({ action: "revoke" });
      setOverview(undefined); setInviteUrl(""); setAccess({ allowed: false, bootstrapAllowed: false });
      setMessage("Все Super Admin доступы отозваны. Новую ссылку восстановления может выдать только владелец сервера.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось отозвать доступ"); }
  };

  const setNodeState = async (node: NodeInfo, state: "active" | "draining" | "disabled" | "force_offline") => {
    if (state === "force_offline") {
      const load = `${node.activeStudios} Studios, ${node.activeParticipants} участников, ${node.activeVideoTracks} video tracks`;
      if (!window.confirm(`FORCE OFFLINE: ${node.name}\n\nТекущая нагрузка: ${load}.\nАктивные сессии могут быть потеряны. Продолжить?`)) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/super-admin", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "node-state", nodeId: node.nodeId, state, confirmForceOffline:state === "force_offline" }),signal:AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.reason === "node_not_drained") throw new Error(`Сначала переведите ноду в Draining. Активно: ${data.activeStudios || 0} Studios, ${data.activeParticipants || 0} участников, ${data.activeVideoTracks || 0} video tracks.`);
        throw new Error(data.error || "Не удалось изменить состояние ноды");
      }
      if (data.applied === false) setMessage(`${node.name}: состояние сохранено, но ещё НЕ применено нодой. ${data.enforcementError || "Нет подтверждения"}.`);
      else setMessage(state === "force_offline" ? `${node.name}: Force Offline` : `${node.name}: ${state === "active" ? "Enabled" : state === "draining" ? "Draining" : "Disabled"}`);
      await loadOverview();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить состояние ноды"); }
    finally { setBusy(false); }
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
  const topologyByNode = useMemo(() => new Map((overview?.nodeTopologies || []).map(item => [item.nodeId, item])), [overview]);

  if (loading) return <main className="super-admin-page"><section className="panel super-admin-gate"><p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1><p>Проверяем доступ…</p></section></main>;

  if (!access.allowed) return <main className="super-admin-page"><section className="panel super-admin-gate">
    <p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1>
    <p className="muted">Отдельная platform-level роль. Она не имеет прав публикации камеры, микрофона, эфира или демонстрации экрана.</p>
    <p>Первый доступ выдаёт владелец сервера. Используйте личную одноразовую ссылку Super Admin. Роли студии, администратора комнаты, модератора и гостя не дают доступа к этой странице.</p>
    {message && <p role="status">{message}</p>}
    {error && <p className="av-error" role="alert">{error}</p>}
  </section></main>;

  const summary = overview?.summary;
  const visibleRooms=(overview?.rooms || []).filter(room=>(!nodeFilter || room.nodeId===nodeFilter) && (!roomFilter || room.roomId===roomFilter));
  const openHistory=(room:RoomInfo,participant?:string)=>{
    if(!room.nodeId || !room.mediaRoom) return;
    setHistoryTarget({nodeId:room.nodeId,room:room.mediaRoom,name:room.name,studioId:room.studioId || "studio-default",participant});
    setTimeout(()=>historyPanel.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);
  };
  return <main className="super-admin-page">
    <header className="super-admin-header">
      <div><p className="eyebrow">CASTLINK PLATFORM</p><h1>Super Admin</h1><p className="muted">Control plane, topology и диагностика. Без эфирных media controls.</p><p className="muted">Снимок: {overview ? new Date(overview.generatedAt).toLocaleString("ru-RU") : "нет данных"}</p></div>
      <div className="super-admin-actions">
        <a className="button-link" href="/studios">Управление студиями</a>
        <a className="button-link" href="/servers">Реестр серверов</a>
        <button className="button-secondary" disabled={busy} onClick={() => void loadOverview().catch(cause => setError(cause instanceof Error ? cause.message : "Ошибка обновления"))}>Обновить</button>
        <button className="button-secondary" disabled={busy} onClick={() => void createInvite()}>Создать Super Admin link</button>
        <button className="button-secondary super-admin-danger" disabled={busy} onClick={() => void revoke()}>Отозвать все доступы</button>
        <button className="button-secondary" disabled={busy} onClick={() => void logout()}>Выйти</button>
      </div>
    </header>

    {inviteUrl && <section className="panel super-admin-invite"><strong>Одноразовая ссылка Super Admin · срок 15 минут</strong><input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></section>}
    {message && <p className="panel" role="status">{message}</p>}
    {error && <p className="panel av-error" role="alert">{error}</p>}

    <section className="super-admin-summary">
      <div className="panel"><span>Ноды</span><strong>{summary?.nodes ?? "—"}</strong><small>{summary ? `${summary.healthyNodes} healthy` : "—"}</small></div>
      <div className="panel"><span>Студии</span><strong>{summary?.studios ?? "—"}</strong><small>{summary ? `${summary.liveStudios} live` : "—"}</small></div>
      <div className="panel"><span>Комнаты</span><strong>{summary?.rooms ?? "—"}</strong></div>
      <div className="panel"><span>Подключения</span><strong>{summary?.participants ?? "—"}</strong><small>{summary && !summary.topologyComplete ? `Подтверждено: ${summary.observedParticipants}; часть нод недоступна` : "Все доступные ноды"}</small></div>
      <div className="panel"><span>Видео-треки</span><strong>{summary?.videoTracks ?? "—"}</strong><small>{summary && !summary.topologyComplete ? `Подтверждено: ${summary.observedVideoTracks}` : ""}</small></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">CLUSTER</p><h2>Ноды</h2></div><span>Heartbeat и текущая capacity</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Node</th><th>State / Health</th><th>Heartbeat</th><th>Control latency</th><th>Studios</th><th>Participants</th><th>Video</th><th title="Heartbeat: loadavg на ядро, а не процент занятости процессора">Load / CPU</th><th>RAM</th><th>Network out</th><th>Управление</th></tr></thead>
        <tbody>{overview?.nodes.map(node => {
          const topology = topologyByNode.get(node.nodeId);
          return <tr key={node.nodeId}>
          <td><strong>{node.name}</strong><small>{node.nodeId} · {node.region}</small></td>
          <td>{node.state === "active" ? "Enabled" : node.state === "draining" ? "Draining" : node.state === "disabled" ? "Disabled" : "Force Offline"} / {node.health}<small>{node.appliedRevision===node.operationalRevision ? `Подтверждено нодой ${age(node.appliedAt || 0)} назад` : "Ожидается применение нодой"}</small></td>
          <td>{age(node.lastSeenAt)}</td><td>{topology?.ok ? `${topology.latencyMs} ms` : topology?.error || "—"}</td><td>{node.activeStudios}/{node.maxActiveStudios}</td><td>{node.activeParticipants}/{node.maxParticipants}</td><td>{node.activeVideoTracks}/{node.maxVideoTracks}</td><td>{number(node.cpuLoad)}</td><td>{percent(node.memoryLoad)}</td><td>{number(node.networkOutMbps, " Mbps")}</td>
          <td><div className="super-admin-node-actions">
            <select aria-label={`Состояние ${node.name}`} disabled={busy} value={node.state} onChange={event => void setNodeState(node, event.target.value as "active" | "draining" | "disabled")}>
              <option value="active">Enabled</option><option value="draining">Draining</option><option value="disabled">Disabled</option><option value="force_offline" disabled>Force Offline</option>
            </select>
            <button type="button" className="button-secondary super-admin-danger" disabled={busy} onClick={() => void setNodeState(node, "force_offline")}>Force Offline</button>
          </div></td>
        </tr>;
        })}</tbody>
      </table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">TENANTS</p><h2>Студии</h2></div><span>Assignment и эфирное состояние</span></div>
      <div className="super-admin-card-grid">{overview?.studios.map(studio => <article className="super-admin-card" key={studio.studioId}>
        <strong>{studio.name}</strong><small>{studio.studioId}</small><span>Org: {studio.organizationId}</span><span>Назначение в реестре: {studio.assignedNodeId || "не назначено"}</span><span>Комнаты наблюдаются на: {studio.observedNodeIds?.join(", ") || "нет свежих данных"}</span><span>{studio.assignmentMode} · {studio.observedLive ? "Наблюдается эфир" : "Эфир не подтверждён"}</span><small>Состояние реестра: {studio.broadcastState}</small>
      </article>)}</div>
    </section>

    <section className="panel super-admin-filters">
      <label>Нода<select value={nodeFilter} onChange={event=>{setNodeFilter(event.target.value);setRoomFilter("");}}><option value="">Все ноды</option>{overview?.nodes.map(node=><option key={node.nodeId} value={node.nodeId}>{node.name}</option>)}</select></label>
      <label>Комната<select value={roomFilter} onChange={event=>setRoomFilter(event.target.value)}><option value="">Все комнаты</option>{overview?.rooms.filter(room=>!nodeFilter || room.nodeId===nodeFilter).map(room=><option value={room.roomId} key={room.roomId}>{room.name} · {room.studioId} · {room.nodeId}</option>)}</select></label>
      <label>Участник<input placeholder="Имя, identity или роль" value={participantSearch} onChange={event=>setParticipantSearch(event.target.value)} /></label>
    </section>
    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">TOPOLOGY</p><h2>Комнаты</h2></div><span>Control plane + live node telemetry</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Комната</th><th>Studio</th><th>Organization</th><th>Node</th><th>Участники</th><th>Node latency</th><th>Topology</th><th>Время данных</th></tr></thead>
        <tbody>{visibleRooms.map(room => <tr key={room.roomId}>
          <td><strong>{room.name}</strong><small>{room.roomId} · media: {room.mediaRoom}</small><button className="button-secondary" type="button" disabled={!room.mediaRoom || !room.topologyAvailable} onClick={()=>openHistory(room)}>Статистика комнаты</button></td>
          <td>{room.studioId}</td><td>{room.organizationId}</td><td>{room.nodeId || "—"}</td><td>{room.participantCount ?? "—"}</td><td>{room.nodeLatencyMs == null ? "—" : `${room.nodeLatencyMs} ms`}</td><td>{room.topologyAvailable ? "Live" : "Недоступна"}</td><td>{new Date(room.updatedAt).toLocaleString("ru-RU")}</td>
        </tr>)}</tbody></table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">PARTICIPANTS</p><h2>Участники по комнатам</h2></div><span>Последняя доступная WebRTC telemetry</span></div>
      <div className="super-admin-room-grid">{visibleRooms.map(room => <article className="super-admin-room-card" key={room.roomId}>
        <div className="super-admin-room-title"><div><strong>{room.name}</strong><small>{room.studioId} · {room.nodeId || "node —"}</small></div><span>{room.participantCount ?? "—"}</span></div>
        {!room.topologyAvailable ? <p className="muted">Topology этой ноды недоступна.</p> : room.participants.length === 0 ? <p className="muted">Активных участников нет.</p> :
          <div className="super-admin-participants">{room.participants.filter(participant=>!participantSearch || `${participant.name} ${participant.identity} ${participant.role}`.toLocaleLowerCase().includes(participantSearch.toLocaleLowerCase())).map(participant => <div className="super-admin-participant" key={participant.identity}>
            <div><strong>{participant.name}</strong><small>{participant.role} · {participant.identity}</small></div>
            <span>Tracks {participant.trackCount}</span><span>In/Out {number(participant.bitrateInKbps)} / {number(participant.bitrateOutKbps)} кбит/с</span>
            <span>RTT {number(participant.rttMs, " ms")}</span><span>Jitter {number(participant.jitterMs, " ms")}</span><span>Loss {number(participant.lossPct, "%")}</span>
            <span>Reconnect {participant.reconnects ?? "—"}</span><small>{participant.lastSampleAt ? `Замер ${age(participant.lastSampleAt)} назад${participant.telemetryFresh ? "" : " · устарел"}` : "Клиент ещё не отправил RTC-замер"}</small>
            {room.nodeId && room.mediaRoom && <PlatformParticipantActions nodeId={room.nodeId} room={room.mediaRoom} participant={participant} onChanged={loadOverview} onHistory={()=>openHistory(room,participant.identity)} />}
            {!!participant.streams?.length && <details className="platform-stream-details"><summary>Медиапотоки · {participant.streams.length}</summary><div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Источник</th><th>Направление</th><th>Разрешение / FPS</th><th>Битрейт</th><th>Кодек</th><th>Транспорт</th><th>Потери / Jitter / RTT</th></tr></thead><tbody>{participant.streams.map(stream=><tr key={stream.id}><td>{stream.kind} · {stream.source}</td><td>{stream.direction}</td><td>{stream.width && stream.height ? `${stream.width}×${stream.height}` : "—"} / {number(stream.fps)}</td><td>{number(stream.bitrateKbps," кбит/с")}</td><td>{stream.codec || "—"}</td><td>{stream.protocol || "—"} / {stream.candidateType || "—"}</td><td>{number(stream.lossPct)}% / {number(stream.jitterMs)} / {number(stream.rttMs)} мс</td></tr>)}</tbody></table></div></details>}
          </div>)}</div>}
      </article>)}</div>
      <p className="muted">RTT/jitter/loss/bitrate — клиентская WebRTC telemetry и используется для диагностики качества, а не как доверенный security log. Node latency — время получения серверной диагностики, не media RTT. Прочерк означает отсутствие данных, а не нулевую нагрузку. Число подключений включает технические output/monitor/viewer-клиенты; это не число уникальных людей.</p>
    </section>

    {historyTarget && <section ref={historyPanel} className="super-admin-history"><div className="actions"><h2>История: {historyTarget.name}</h2><button type="button" className="button-secondary" onClick={()=>setHistoryTarget(undefined)}>Закрыть историю</button></div><StatisticsDashboard key={`${historyTarget.nodeId}:${historyTarget.room}:${historyTarget.participant || ""}`} roomName={historyTarget.name} studioId={historyTarget.studioId} identity="" studioRole="moderator" studioClientId="" studioEpoch={0} platformNodeId={historyTarget.nodeId} platformMediaRoom={historyTarget.room} initialParticipant={historyTarget.participant} /></section>}
    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">NODE MAP</p><h2>Распределение</h2></div></div>
      <div className="super-admin-card-grid">{overview?.nodes.map(node => <article className="super-admin-card" key={node.nodeId}>
        <strong>{node.name}</strong><small>{node.nodeId}</small>
        {(studiosByNode.get(node.nodeId) || []).map(studio => <span key={studio.studioId}>{studio.name} · {studio.observedLive ? "эфир" : "нет подтверждённого эфира"}</span>)}
        {!(studiosByNode.get(node.nodeId)?.length) && <span className="muted">Studios не назначены</span>}
      </article>)}</div>
    </section>
  </main>;
}
