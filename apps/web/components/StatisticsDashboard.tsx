"use client";

import { useEffect, useRef, useState } from "react";
import { mean, sumRates, type HistoryResponse, type MetricPoint, type TelemetryRole } from "@/lib/telemetry-types";
import { statisticsReport } from "@/lib/stats-report";
import { historyCsv, connectionsCsv } from "@/lib/stats-csv";

const periods = [[15, "15 минут"], [60, "1 час"], [360, "6 часов"], [720, "12 часов"], [1440, "24 часа"]] as const;
const roles: Record<TelemetryRole, string> = { studio: "Студия", admin: "Администратор", moderator: "Модератор", guest: "Гость", output: "Выход vMix", monitor: "Монитор" };
const format = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
const time = (at: number) => new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
type Line = { key: keyof Omit<MetricPoint, "at">; label: string; color: string };

export function statisticsTokenRefreshUrl(roomName: string, studioRole: "primary" | "moderator", studioClientId: string, studioEpoch: number, studioId = "studio-default") {
  const params = new URLSearchParams({
    studioId,
    room: roomName,
    clientId: studioClientId,
    role: studioRole === "moderator" ? "studio-moderator" : "studio-panel",
  });
  if (studioRole === "primary") params.set("epoch", String(studioEpoch));
  return `/api/token?${params}`;
}

function HistoryChart({ title, unit, history, lines }: { title: string; unit: string; history: HistoryResponse; lines: Line[] }) {
  const [hover, setHover] = useState<number>();
  const width = 660, height = 200, left = 48, right = 12, top = 18, bottom = 30;
  const values = history.series.flatMap((p) => lines.map((l) => p[l.key]).filter((n): n is number => n !== null));
  const max = Math.max(1, ...values) * 1.1;
  const x = (at: number) => left + Math.max(0, (at - history.from) / (history.to - history.from)) * (width - left - right);
  const y = (v: number) => height - bottom - v / max * (height - top - bottom);
  const point = hover === undefined ? undefined : history.series[hover];
  const path = (key: Line["key"]) => {
    let drawing = false;
    return history.series.map((p) => {
      const value = p[key];
      if (value === null) { drawing = false; return ""; }
      const command = drawing ? "L" : "M"; drawing = true;
      return `${command}${x(p.at).toFixed(1)},${y(value).toFixed(1)}`;
    }).join(" ");
  };
  return <section className="stat-chart panel">
    <h3>{title} <small>{unit}</small></h3>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, ${unit}`} onPointerLeave={() => setHover(undefined)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * width - left) / (width - left - right)));
        const target = history.from + fraction * (history.to - history.from);
        let nearest = 0;
        history.series.forEach((p, i) => { if (Math.abs(p.at - target) < Math.abs(history.series[nearest].at - target)) nearest = i; });
        setHover(nearest);
      }}>
      {[0, .5, 1].map((ratio) => <g key={ratio}><line x1={left} x2={width - right} y1={y(max * ratio)} y2={y(max * ratio)} className="chart-grid" />
        <text x={left - 7} y={y(max * ratio) + 4} textAnchor="end">{format(max * ratio, 0)}</text></g>)}
      {lines.map((line) => <path key={line.key} d={path(line.key)} fill="none" stroke={line.color} strokeWidth="2" />)}
      {[0, .5, 1].map((fraction) => <text key={fraction} x={left + fraction * (width - left - right)} y={height - 5}
        textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{time(history.from + fraction * (history.to - history.from))}</text>)}
      {point && <line x1={x(point.at)} x2={x(point.at)} y1={top} y2={height - bottom} className="chart-cursor" />}
    </svg>
    <div className="chart-legend">{lines.map((line) => <span key={line.key}><i style={{ background: line.color }} />{line.label}
      {point && <strong>{format(point[line.key])} {unit}</strong>}</span>)}{point && <time>{time(point.at)}</time>}</div>
  </section>;
}

export function StatisticsDashboard({ roomName, token, identity, studioRole, studioClientId, studioEpoch, studioId = "studio-default", platformNodeId, platformMediaRoom, initialParticipant = "" }: {
  roomName: string; token?: string; identity: string; studioRole: "primary" | "moderator"; studioClientId: string; studioEpoch: number; studioId?: string; platformNodeId?: string; platformMediaRoom?: string; initialParticipant?: string;
}) {
  const [minutes, setMinutes] = useState(15);
  const [roleFilter, setRoleFilter] = useState<"" | TelemetryRole>("");
  const [participantFilter, setParticipantFilter] = useState(initialParticipant);
  const [session, setSession] = useState("");
  const [history, setHistory] = useState<HistoryResponse>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const statsUrl = (precise = false) => {
    const params = new URLSearchParams({ studioId, room: roomName, minutes: String(minutes) });
    if (roleFilter) params.set("role", roleFilter);
    if (participantFilter) params.set("participant", participantFilter);
    if (session) params.set("session", session);
    if (precise) params.set("resolution", "2s");
    if (platformNodeId) { params.set("nodeId",platformNodeId); params.set("room",platformMediaRoom || roomName); return `/api/super-admin/history?${params}`; }
    return `/api/stats?${params}`;
  };
  const filterConnections = (value: HistoryResponse) => value.connections.filter((connection) =>
    (!roleFilter || connection.role === roleFilter) &&
    (!participantFilter || connection.identity === participantFilter) &&
    (!session || connection.session === session));
  const download = async (kind: "history" | "connections" | "report") => {
    if (!history || exporting) return;
    setExporting(true);
    try {
      const response = await fetch(statsUrl(true), { cache: "no-store", headers: platformNodeId ? {} : { authorization: `Bearer ${bearer.current.token}` } });
      if (!response.ok) throw Error("Не удалось выгрузить замеры. Повторите после обновления статистики.");
      const precise: HistoryResponse = await response.json();
      const filtered = { ...precise, connections: filterConnections(precise) };
      const selectedConnection = filtered.connections.find(connection => connection.session === session);
      const selectedParticipant = filtered.connections.find(connection => connection.identity === participantFilter);
      const selection = selectedConnection ? `${roles[selectedConnection.role]} · ${selectedConnection.name}` :
        selectedParticipant ? `${roles[selectedParticipant.role]} · ${selectedParticipant.name}` :
        roleFilter ? roles[roleFilter] : "Все соединения комнаты";
      const content = kind === "report" ? statisticsReport(filtered, roomName, selection) : kind === "history" ? historyCsv(filtered) : connectionsCsv(filtered);
      const url = URL.createObjectURL(new Blob([content], { type: kind === "report" ? "text/html;charset=utf-8" : "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `castlink-${kind}-${roomName.replace(/[^a-zа-яё0-9_-]/gi, "_")}-${minutes}min.${kind === "report" ? "html" : "csv"}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка выгрузки"); }
    finally { setExporting(false); }
  };
  // The studio may have been open for hours before this tab is mounted.
  const bearer = useRef({ token, at: 0 });
  useEffect(() => { bearer.current = { token, at: 0 }; }, [token, studioRole, studioClientId, studioEpoch]);
  useEffect(() => { setRoleFilter(""); setParticipantFilter(initialParticipant); setSession(""); setHistory(undefined); }, [roomName,studioId,platformNodeId,platformMediaRoom,initialParticipant]);
  useEffect(() => {
    if (!platformNodeId && (!token || !studioClientId)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setHistory(undefined);
    const update = async () => {
      try {
        if (!platformNodeId && Date.now() - bearer.current.at > 50 * 60_000) {
          const response = await fetch(statisticsTokenRefreshUrl(roomName, studioRole, studioClientId, studioEpoch, studioId), { signal: controller.signal });
          if (!response.ok) throw new Error("Не удалось обновить доступ к статистике");
          const refreshed = await response.json();
          if (controller.signal.aborted) return;
          if (typeof refreshed.token !== "string" || !refreshed.token) throw new Error("Сервер не вернул доступ к статистике");
          bearer.current = { token: refreshed.token, at: Date.now() };
        }
        if (controller.signal.aborted) return;
        const response = await fetch(statsUrl(), {
          signal: controller.signal, cache: "no-store", headers: platformNodeId ? {} : { authorization: `Bearer ${bearer.current.token}` },
        });
        if (!response.ok) {
          let message = "Статистика временно недоступна. Повторяем запрос…";
          try { const payload = await response.json(); if (typeof payload.error === "string") message = payload.error; } catch {}
          throw new Error(message);
        }
        const result: HistoryResponse = await response.json();
        if (!controller.signal.aborted) { setHistory(result); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
      finally { if (!controller.signal.aborted) timer = setTimeout(update, 15_000); }
    };
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [roomName, studioId, token, identity, studioRole, studioClientId, studioEpoch, minutes, roleFilter, participantFilter, session, revision, platformNodeId, platformMediaRoom]);

  const roleConnections = history?.connections.filter(connection => !roleFilter || connection.role === roleFilter) ?? [];
  const participantOptions = [...new Map(roleConnections.map(connection => [connection.identity, connection])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const sessionOptions = roleConnections.filter(connection => !participantFilter || connection.identity === participantFilter);
  const visibleConnections = history ? filterConnections(history) : [];
  const selected = history?.connections.find((c) => c.session === session);
  const live = history ? visibleConnections.filter((c) => c.latest.state !== "disconnected" && history.to - c.lastSeen < 35_000) : [];
  return <div className="statistics-dashboard">
    <div className="stats-toolbar panel">
      <div><h2>Статистика соединений</h2><p className="muted">Комната «{roomName}». Замеры клиентов и детальная выгрузка — каждые 2 секунды; обзорные графики обновляются каждые 15 секунд.</p></div>
      <div className="stats-periods" role="group" aria-label="Период статистики">{periods.map(([value, label]) =>
        <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{label}</button>)}</div>
      <div className="stats-filter-grid">
        <label>Роль <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as "" | TelemetryRole); setParticipantFilter(""); setSession(""); }}>
          <option value="">Все роли</option>
          {(Object.keys(roles) as TelemetryRole[]).map(role => <option key={role} value={role}>{roles[role]}</option>)}
        </select></label>
        <label>Участник <select value={participantFilter} onChange={(event) => { setParticipantFilter(event.target.value); setSession(""); }}>
          <option value="">Все участники</option>
          {participantOptions.map(connection => <option value={connection.identity} key={connection.identity}>{connection.name} · {roles[connection.role]}</option>)}
        </select></label>
        <label>Сессия <select value={session} onChange={(event) => setSession(event.target.value)}>
          <option value="">Все сессии выборки</option>
          {sessionOptions.map((c) => <option value={c.session} key={c.session}>{c.name} · {time(c.firstSeen)}</option>)}
        </select></label>
      </div>
      <div className="stats-periods">
        {!platformNodeId && studioRole === "primary" && <button disabled={!history || clearing} onClick={async () => {
          setClearing(true);
          try {
            const response = await fetch("/api/stats", { method: "DELETE", headers: platformNodeId ? {} : { authorization: `Bearer ${bearer.current.token}` } });
            if (!response.ok) throw Error("Не удалось очистить список");
            setSession(""); setRevision(value => value + 1);
          } catch (e) { setError(e instanceof Error ? e.message : "Ошибка очистки"); } finally { setClearing(false); }
        }}>{clearing ? "Очистка…" : "Сбросить отключившихся"}</button>}
        <button disabled={!history || exporting} onClick={() => void download("report")}>Скачать наглядный отчёт</button>
        <button disabled={!history || exporting} onClick={() => void download("history")}>Графики → CSV</button>
        <button disabled={!history || exporting} onClick={() => void download("connections")}>Участники и потоки → CSV</button>
      </div>
      <p className="muted">Сброс очищает список завершённых подключений. Активные участники и история графиков сохраняются. CSV открывается в Excel. Наглядный HTML-отчёт с графиками открывается в браузере без интернета. Старые замеры не дополняются вымышленными значениями.</p>
      <p className="muted">Входящие — от сервера к клиентам. Исходящие — от клиентов к серверу. Для всех соединений битрейты суммируются, RTT, jitter и потери усредняются. Пропуски — нет замеров.</p>
    </div>
    {error && <p role="alert" className="av-error">{error}</p>}
    {!token ? <p className="panel">Ожидание подключения студии…</p> : !history ? <p className="panel">Загружаем историю…</p> : <>
      <div className="stats-summary">
        <div className="panel"><span>Сейчас передают замеры</span><strong>{live.length}</strong></div>
        <div className="panel"><span>Соединений в выборке</span><strong>{visibleConnections.length}</strong></div>
        <div className="panel"><span>История в выбранном периоде</span><strong>{history.retainedFrom ? new Date(history.retainedFrom).toLocaleString("ru-RU") : "Ещё нет данных"}</strong></div>
      </div>
      {!history.retainedFrom ? <div className="panel">Замеров пока нет. Подключите гостя или выход vMix. История сохраняется на сервере и начинает накапливаться после обновления клиентов.</div> : <>
        <div className="stats-chart-grid">
          <HistoryChart title="Битрейт" unit="кбит/с" history={history} lines={[{ key: "inbound", label: "Входящие", color: "#60a5fa" }, { key: "outbound", label: "Исходящие", color: "#34d399" }]} />
          <HistoryChart title="Задержка и jitter" unit="мс" history={history} lines={[{ key: "rtt", label: "RTT", color: "#fbbf24" }, { key: "jitter", label: "Jitter", color: "#c084fc" }]} />
          <HistoryChart title="Аудио и видео" unit="кбит/с" history={history} lines={[
            { key: "audioIn", label: "Аудио вход", color: "#38bdf8" }, { key: "videoIn", label: "Видео вход", color: "#818cf8" },
            { key: "audioOut", label: "Аудио выход", color: "#fbbf24" }, { key: "videoOut", label: "Видео выход", color: "#34d399" }]} />
          <HistoryChart title="Потери пакетов за интервал" unit="%" history={history} lines={[{ key: "loss", label: "Потери", color: "#fb7185" }]} />
          <HistoryChart title="Соединения с замерами" unit="шт." history={history} lines={[{ key: "connections", label: "Соединения", color: "#2dd4bf" }]} />
        </div>
        <div className="panel stats-table-wrap"><table className="stats-table"><caption>Подключения в выбранной выборке</caption>
          <thead><tr><th>Участник</th><th>Тип</th><th>Состояние</th><th>Вход / выход, кбит/с</th><th>RTT / jitter, мс</th><th>Потери, %</th><th>Переподключения</th><th>Последний замер</th></tr></thead>
          <tbody>{visibleConnections.map((c) => <tr key={c.session} className={session === c.session ? "stats-selected" : ""}>
            <td><button className="stats-connection-button" onClick={() => setSession(c.session)}>{c.name}</button><small>{c.identity}</small></td>
            <td>{roles[c.role]}</td><td>{c.latest.state === "disconnected" ? "Отключён" : history.to - c.lastSeen > 35_000 ? "Нет свежих замеров" : c.latest.state === "connected" ? "Подключён" : "Переподключение"}<small>Качество: {c.latest.quality || "—"}</small></td>
            <td>{format(sumRates(c.latest.streams, "in"))} / {format(sumRates(c.latest.streams, "out"))}</td>
            <td>{format(mean(c.latest.streams.map((s) => s.rttMs)))} / {format(mean(c.latest.streams.map((s) => s.jitterMs)))}</td>
            <td>{format(mean(c.latest.streams.map((s) => s.lossPct)), 2)}</td><td>{c.latest.reconnects}</td><td>{time(c.lastSeen)}</td>
          </tr>)}</tbody></table></div>
        {selected && <div className="panel stats-table-wrap"><h3>Потоки: {selected.name}</h3><p className="muted">Время с начала соединения: {format(selected.latest.uptimeSec / 60)} мин. Последний замер: {new Date(selected.lastSeen).toLocaleString("ru-RU")}</p>
          {!selected.latest.streams.length ? <p>В последнем замере нет активных медиапотоков.</p> : <table className="stats-table"><thead><tr><th>Направление / источник</th><th>Участник</th><th>Кодек</th><th>Битрейт</th><th>Размер / FPS</th><th>Потери / jitter / RTT</th><th>Транспорт</th><th>Замирания / ограничение</th></tr></thead>
            <tbody>{selected.latest.streams.map((s) => <tr key={s.id}><td>{s.direction === "in" ? "Вход" : "Выход"} · {s.kind === "audio" ? "Аудио" : "Видео"}<small>{s.source}</small></td>
              <td>{s.name}</td><td>{s.codec || "—"}</td><td>{format(s.bitrateKbps)} кбит/с</td>
              <td>{s.width && s.height ? `${s.width}×${s.height}` : "—"} / {format(s.fps)} fps</td>
              <td>{format(s.lossPct, 2)}% / {format(s.jitterMs)} мс / {format(s.rttMs)} мс</td><td>{s.protocol || "—"} · {s.candidateType || "—"}</td>
              <td>{format(s.freezes, 0)} / {s.qualityLimitation || "—"}</td></tr>)}</tbody></table>}
        </div>}
      </>}
    </>}
  </div>;
}
