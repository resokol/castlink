"use client";
import type { TranslationParams } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";

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

type Notice = string | { source: string; params?: TranslationParams };
const age = (at: number, t: (source: string, params?: TranslationParams) => string) => {
  if (!at) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? t("{count} сек", { count: seconds }) : seconds < 3600 ? t("{count} мин", { count: Math.floor(seconds / 60) }) : t("{count} ч", { count: Math.floor(seconds / 3600) });
};
const percent = (value: number | null) => value == null ? "—" : `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
const formatNumber = (locale: string, value: number | null | undefined, suffix = "") => value == null ? "—" : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${suffix}`;

export default function SuperAdminPage() {
  const { t, locale } = useI18n();
  const number = (value: number | null | undefined, suffix = "") => formatNumber(locale, value, suffix);
  const notice = (value: Notice) => typeof value === "string" ? t(value) : t(value.source, value.params ? { ...value.params, ...(typeof value.params.reason === "string" ? {reason: t(value.params.reason)} : {}), ...(typeof value.params.state === "string" ? {state: t(value.params.state)} : {}) } : undefined);
  const [access, setAccess] = useState<AccessState>({});
  const [overview, setOverview] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Notice>("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState<Notice>("");
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
    if (!window.confirm(t("Отозвать ВСЕ Super Admin ссылки и активные Super Admin сессии?"))) return;
    try {
      await postAccess({ action: "revoke" });
      setOverview(undefined); setInviteUrl(""); setAccess({ allowed: false, bootstrapAllowed: false });
      setMessage("Все Super Admin доступы отозваны. Новую ссылку восстановления может выдать только владелец сервера.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось отозвать доступ"); }
  };

  const setNodeState = async (node: NodeInfo, state: "active" | "draining" | "disabled" | "force_offline") => {
    if (state === "force_offline") {
      const load = t("{studios} студий, {participants} участников, {tracks} видеотреков", { studios: node.activeStudios, participants: node.activeParticipants, tracks: node.activeVideoTracks });
      if (!window.confirm(t("Принудительно отключить: {name}\n\nТекущая нагрузка: {load}.\nАктивные сессии могут быть потеряны. Продолжить?", { name: node.name, load }))) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/super-admin", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "node-state", nodeId: node.nodeId, state, confirmForceOffline:state === "force_offline" }),signal:AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.reason === "node_not_drained") { setError({ source: "Сначала переведите ноду в Draining. Активно: {studios} студий, {participants} участников, {tracks} видеотреков.", params: { studios: data.activeStudios || 0, participants: data.activeParticipants || 0, tracks: data.activeVideoTracks || 0 } }); return; }
        throw new Error(data.error || "Не удалось изменить состояние ноды");
      }
      if (data.applied === false) setMessage({ source: "{name}: состояние сохранено, но ещё НЕ применено нодой. {reason}.", params: { name: node.name, reason: data.enforcementError || "Нет подтверждения" } });
      else setMessage({ source: "{name}: {state}", params: { name: node.name, state: state === "force_offline" ? "Force Offline" : state === "active" ? "Enabled" : state === "draining" ? "Draining" : "Disabled" } });
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

  if (loading) return <main className="super-admin-page graphite-page"><section className="panel super-admin-gate status-card"><p className="eyebrow">{t("CASTLINK PLATFORM")}</p><h1>{t("Super Admin")}</h1><p>{t("Проверяем доступ…")}</p></section></main>;

  if (!access.allowed) return <main className="super-admin-page graphite-page"><section className="panel super-admin-gate status-card">
    <p className="eyebrow">{t("CASTLINK PLATFORM")}</p><h1>{t("Super Admin")}</h1>
    <p className="muted">{t("Отдельная platform-level роль. Она не имеет прав публикации камеры, микрофона, эфира или демонстрации экрана.")}</p>
    <p>{t("Первый доступ выдаёт владелец сервера. Используйте личную одноразовую ссылку Super Admin. Роли студии, администратора комнаты, модератора и гостя не дают доступа к этой странице.")}</p>
    {message && <p role="status">{notice(message)}</p>}
    {error && <p className="av-error" role="alert">{notice(error)}</p>}
  </section></main>;

  const summary = overview?.summary;
  const visibleRooms=(overview?.rooms || []).filter(room=>(!nodeFilter || room.nodeId===nodeFilter) && (!roomFilter || room.roomId===roomFilter));
  const openHistory=(room:RoomInfo,participant?:string)=>{
    if(!room.nodeId || !room.mediaRoom) return;
    setHistoryTarget({nodeId:room.nodeId,room:room.mediaRoom,name:room.name,studioId:room.studioId || "studio-default",participant});
    setTimeout(()=>historyPanel.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);
  };
  return <main className="super-admin-page graphite-page">
    <header className="super-admin-header">
      <div><p className="eyebrow">{t("CASTLINK PLATFORM")}</p><h1>{t("Super Admin")}</h1><p className="muted">{t("Control plane, topology и диагностика. Без эфирных media controls.")}</p><p className="muted">{t("Снимок:")}{" "}{overview ? new Date(overview.generatedAt).toLocaleString(locale) : t("нет данных")}</p></div>
      <div className="super-admin-actions">
        <a className="button-link" href="/studios">{t("Управление студиями")}</a>
        <a className="button-link" href="/servers">{t("Реестр серверов")}</a>
        <button className="button-secondary" disabled={busy} onClick={() => void loadOverview().catch(cause => setError(cause instanceof Error ? cause.message : "Ошибка обновления"))}>{t("Обновить")}</button>
        <button className="button-secondary" disabled={busy} onClick={() => void createInvite()}>{t("Создать Super Admin link")}</button>
        <button className="button-secondary super-admin-danger" disabled={busy} onClick={() => void revoke()}>{t("Отозвать все доступы")}</button>
        <button className="button-secondary" disabled={busy} onClick={() => void logout()}>{t("Выйти")}</button>
      </div>
    </header>

    {inviteUrl && <section className="panel super-admin-invite"><strong>{t("Одноразовая ссылка Super Admin · срок 15 минут")}</strong><input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></section>}
    {message && <p className="panel" role="status">{notice(message)}</p>}
    {error && <p className="panel av-error" role="alert">{notice(error)}</p>}

    <section className="super-admin-summary">
      <div className="panel"><span>{t("Ноды")}</span><strong>{summary?.nodes ?? "—"}</strong><small>{summary ? t("{count} исправных", {count: summary.healthyNodes}) : "—"}</small></div>
      <div className="panel"><span>{t("Студии")}</span><strong>{summary?.studios ?? "—"}</strong><small>{summary ? t("{count} в эфире", {count: summary.liveStudios}) : "—"}</small></div>
      <div className="panel"><span>{t("Комнаты")}</span><strong>{summary?.rooms ?? "—"}</strong></div>
      <div className="panel"><span>{t("Подключения")}</span><strong>{summary?.participants ?? "—"}</strong><small>{summary && !summary.topologyComplete ? t("Подтверждено: {count}; часть нод недоступна", {count: summary.observedParticipants}) : t("Все доступные ноды")}</small></div>
      <div className="panel"><span>{t("Видео-треки")}</span><strong>{summary?.videoTracks ?? "—"}</strong><small>{summary && !summary.topologyComplete ? t("Подтверждено: {count}", {count: summary.observedVideoTracks}) : ""}</small></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">{t("CLUSTER")}</p><h2>{t("Ноды")}</h2></div><span>{t("Heartbeat и текущая capacity")}</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>{t("Node")}</th><th>{t("State / Health")}</th><th>{t("Heartbeat")}</th><th>{t("Control latency")}</th><th>{t("Studios")}</th><th>{t("Participants")}</th><th>{t("Video")}</th><th title={t("Heartbeat: loadavg на ядро, а не процент занятости процессора")}>{t("Load / CPU")}</th><th>{t("RAM")}</th><th>{t("Network out")}</th><th>{t("Управление")}</th></tr></thead>
        <tbody>{overview?.nodes.map(node => {
          const topology = topologyByNode.get(node.nodeId);
          return <tr key={node.nodeId}>
          <td><strong>{node.name}</strong><small>{node.nodeId} · {node.region}</small></td>
          <td>{t(node.state === "active" ? "Enabled" : node.state === "draining" ? "Draining" : node.state === "disabled" ? "Disabled" : "Force Offline")} / {t(node.health)}<small>{node.appliedRevision===node.operationalRevision ? t("Подтверждено нодой {age} назад", {age: age(node.appliedAt || 0, t)}) : t("Ожидается применение нодой")}</small></td>
          <td>{age(node.lastSeenAt, t)}</td><td>{topology?.ok ? `${topology.latencyMs} ms` : topology?.error || "—"}</td><td>{node.activeStudios}/{node.maxActiveStudios}</td><td>{node.activeParticipants}/{node.maxParticipants}</td><td>{node.activeVideoTracks}/{node.maxVideoTracks}</td><td>{number(node.cpuLoad)}</td><td>{percent(node.memoryLoad)}</td><td>{number(node.networkOutMbps, " Mbps")}</td>
          <td><div className="super-admin-node-actions">
            <select aria-label={t("Состояние {name}", {name: node.name})} disabled={busy} value={node.state} onChange={event => void setNodeState(node, event.target.value as "active" | "draining" | "disabled")}>
              <option value="active">{t("Enabled")}</option><option value="draining">{t("Draining")}</option><option value="disabled">{t("Disabled")}</option><option value="force_offline" disabled>{t("Force Offline")}</option>
            </select>
            <button type="button" className="button-secondary super-admin-danger" disabled={busy} onClick={() => void setNodeState(node, "force_offline")}>{t("Force Offline")}</button>
          </div></td>
        </tr>;
        })}</tbody>
      </table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">{t("TENANTS")}</p><h2>{t("Студии")}</h2></div><span>{t("Assignment и эфирное состояние")}</span></div>
      <div className="super-admin-card-grid">{overview?.studios.map(studio => <article className="super-admin-card" key={studio.studioId}>
        <strong>{studio.name}</strong><small>{studio.studioId}</small><span>{t("Org:")}{" "}{studio.organizationId}</span><span>{t("Назначение в реестре:")}{" "}{studio.assignedNodeId || t("не назначено")}</span><span>{t("Комнаты наблюдаются на:")}{" "}{studio.observedNodeIds?.join(", ") || t("нет свежих данных")}</span><span>{t(studio.assignmentMode)} · {studio.observedLive ? t("Наблюдается эфир") : t("Эфир не подтверждён")}</span><small>{t("Состояние реестра:")}{" "}{t(studio.broadcastState)}</small>
      </article>)}</div>
    </section>

    <section className="panel super-admin-filters">
      <label>{t("Нода")}<select value={nodeFilter} onChange={event=>{setNodeFilter(event.target.value);setRoomFilter("");}}><option value="">{t("Все ноды")}</option>{overview?.nodes.map(node=><option key={node.nodeId} value={node.nodeId}>{node.name}</option>)}</select></label>
      <label>{t("Комната")}<select value={roomFilter} onChange={event=>setRoomFilter(event.target.value)}><option value="">{t("Все комнаты")}</option>{overview?.rooms.filter(room=>!nodeFilter || room.nodeId===nodeFilter).map(room=><option value={room.roomId} key={room.roomId}>{room.name} · {room.studioId} · {room.nodeId}</option>)}</select></label>
      <label>{t("Участник")}<input placeholder={t("Имя, identity или роль")} value={participantSearch} onChange={event=>setParticipantSearch(event.target.value)} /></label>
    </section>
    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">{t("TOPOLOGY")}</p><h2>{t("Комнаты")}</h2></div><span>{t("Control plane + live node telemetry")}</span></div>
      <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>{t("Комната")}</th><th>{t("Studio")}</th><th>{t("Organization")}</th><th>{t("Node")}</th><th>{t("Участники")}</th><th>{t("Node latency")}</th><th>{t("Topology")}</th><th>{t("Время данных")}</th></tr></thead>
        <tbody>{visibleRooms.map(room => <tr key={room.roomId}>
          <td><strong>{room.name}</strong><small>{room.roomId} {" "}{t("· media:")}{" "}{room.mediaRoom}</small><button className="button-secondary" type="button" disabled={!room.mediaRoom || !room.topologyAvailable} onClick={()=>openHistory(room)}>{t("Статистика комнаты")}</button></td>
          <td>{room.studioId}</td><td>{room.organizationId}</td><td>{room.nodeId || "—"}</td><td>{room.participantCount ?? "—"}</td><td>{room.nodeLatencyMs == null ? "—" : `${room.nodeLatencyMs} ms`}</td><td>{room.topologyAvailable ? t("Live") : t("Недоступна")}</td><td>{new Date(room.updatedAt).toLocaleString(locale)}</td>
        </tr>)}</tbody></table></div>
    </section>

    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">{t("PARTICIPANTS")}</p><h2>{t("Участники по комнатам")}</h2></div><span>{t("Последняя доступная WebRTC telemetry")}</span></div>
      <div className="super-admin-room-grid">{visibleRooms.map(room => <article className="super-admin-room-card" key={room.roomId}>
        <div className="super-admin-room-title"><div><strong>{room.name}</strong><small>{room.studioId} · {room.nodeId || "node —"}</small></div><span>{room.participantCount ?? "—"}</span></div>
        {!room.topologyAvailable ? <p className="muted">{t("Topology этой ноды недоступна.")}</p> : room.participants.length === 0 ? <p className="muted">{t("Активных участников нет.")}</p> :
          <div className="super-admin-participants">{room.participants.filter(participant=>!participantSearch || `${participant.name} ${participant.identity} ${t(participant.role)}`.toLocaleLowerCase().includes(participantSearch.toLocaleLowerCase())).map(participant => <div className="super-admin-participant" key={participant.identity}>
            <div><strong>{participant.name}</strong><small>{t(participant.role)} · {participant.identity}</small></div>
            <span>{t("Tracks")}{" "}{participant.trackCount}</span><span>{t("In/Out")}{" "}{number(participant.bitrateInKbps)} / {number(participant.bitrateOutKbps)} {" "}{t("кбит/с")}</span>
            <span>{t("RTT")}{" "}{number(participant.rttMs, " ms")}</span><span>{t("Jitter")}{" "}{number(participant.jitterMs, " ms")}</span><span>{t("Loss")}{" "}{number(participant.lossPct, "%")}</span>
            <span>{t("Reconnect")}{" "}{participant.reconnects ?? "—"}</span><small>{participant.lastSampleAt ? t("Замер {age} назад{stale}", {age: age(participant.lastSampleAt, t), stale: participant.telemetryFresh ? "" : t(" · устарел")}) : t("Клиент ещё не отправил RTC-замер")}</small>
            {room.nodeId && room.mediaRoom && <PlatformParticipantActions nodeId={room.nodeId} room={room.mediaRoom} participant={participant} onChanged={loadOverview} onHistory={()=>openHistory(room,participant.identity)} />}
            {!!participant.streams?.length && <details className="platform-stream-details"><summary>{t("Медиапотоки ·")}{" "}{participant.streams.length}</summary><div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>{t("Источник")}</th><th>{t("Направление")}</th><th>{t("Разрешение / FPS")}</th><th>{t("Битрейт")}</th><th>{t("Кодек")}</th><th>{t("Транспорт")}</th><th>{t("Потери / Jitter / RTT")}</th></tr></thead><tbody>{participant.streams.map(stream=><tr key={stream.id}><td>{t(stream.kind)} · {t(stream.source)}</td><td>{t(stream.direction)}</td><td>{stream.width && stream.height ? `${stream.width}×${stream.height}` : "—"} / {number(stream.fps)}</td><td>{number(stream.bitrateKbps,t(" кбит/с"))}</td><td>{stream.codec || "—"}</td><td>{stream.protocol || "—"} / {stream.candidateType || "—"}</td><td>{number(stream.lossPct)}% / {number(stream.jitterMs)} / {number(stream.rttMs)} {" "}{t("мс")}</td></tr>)}</tbody></table></div></details>}
          </div>)}</div>}
      </article>)}</div>
      <p className="muted">{t("RTT/jitter/loss/bitrate — клиентская WebRTC telemetry и используется для диагностики качества, а не как доверенный security log. Node latency — время получения серверной диагностики, не media RTT. Прочерк означает отсутствие данных, а не нулевую нагрузку. Число подключений включает технические output/monitor/viewer-клиенты; это не число уникальных людей.")}</p>
    </section>

    {historyTarget && <section ref={historyPanel} className="super-admin-history"><div className="actions"><h2>{t("История:")}{" "}{historyTarget.name}</h2><button type="button" className="button-secondary" onClick={()=>setHistoryTarget(undefined)}>{t("Закрыть историю")}</button></div><StatisticsDashboard key={`${historyTarget.nodeId}:${historyTarget.room}:${historyTarget.participant || ""}`} roomName={historyTarget.name} studioId={historyTarget.studioId} identity="" studioRole="moderator" studioClientId="" studioEpoch={0} platformNodeId={historyTarget.nodeId} platformMediaRoom={historyTarget.room} initialParticipant={historyTarget.participant} /></section>}
    <section className="panel super-admin-section">
      <div className="section-heading"><div><p className="eyebrow">{t("NODE MAP")}</p><h2>{t("Распределение")}</h2></div></div>
      <div className="super-admin-card-grid">{overview?.nodes.map(node => <article className="super-admin-card" key={node.nodeId}>
        <strong>{node.name}</strong><small>{node.nodeId}</small>
        {(studiosByNode.get(node.nodeId) || []).map(studio => <span key={studio.studioId}>{studio.name} · {studio.observedLive ? t("эфир") : t("нет подтверждённого эфира")}</span>)}
        {!(studiosByNode.get(node.nodeId)?.length) && <span className="muted">{t("Studios не назначены")}</span>}
      </article>)}</div>
    </section>
  </main>;
}
