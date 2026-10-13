"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState } from "react";
import { mean, sumRates, type AudioHistoryResponse, type HistoryResponse, type MetricPoint, type TelemetryRole } from "@/lib/telemetry-types";
import { statisticsReport } from "@/lib/stats-report";
import { audioHistoryCsv, historyCsv, connectionsCsv } from "@/lib/stats-csv";

const periods = [[15, "15 минут"], [60, "1 час"], [360, "6 часов"], [720, "12 часов"], [1440, "24 часа"]] as const;
const roles: Record<TelemetryRole, string> = { studio: "Студия", admin: "Администратор", moderator: "Модератор", guest: "Гость", output: "Выход vMix", monitor: "Монитор" };
const formatValue = (value: number | null | undefined, digits = 1, locale = "ru") => value == null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: digits });
const formatTime = (at: number, locale = "ru") => new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
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
  const { t, locale } = useI18n();
  const format = (value: number | null | undefined, digits = 1) => formatValue(value, digits, locale);
  const time = (at: number) => formatTime(at, locale);
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
    <div className="chart-legend">{lines.map((line) => <span key={line.key}><i style={{ background: line.color }} />{t(line.label)}
      {point && <strong>{format(point[line.key])} {unit}</strong>}</span>)}{point && <time>{time(point.at)}</time>}</div>
  </section>;
}

export function StatisticsDashboard({ roomName, token, identity, studioRole, studioClientId, studioEpoch, studioId = "studio-default", platformNodeId, platformMediaRoom, initialParticipant = "" }: {
  roomName: string; token?: string; identity: string; studioRole: "primary" | "moderator"; studioClientId: string; studioEpoch: number; studioId?: string; platformNodeId?: string; platformMediaRoom?: string; initialParticipant?: string;
}) {
  const { t, locale } = useI18n();
  const format = (value: number | null | undefined, digits = 1) => formatValue(value, digits, locale);
  const time = (at: number) => formatTime(at, locale);
  const [minutes, setMinutes] = useState(15);
  const [historyDay, setHistoryDay] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | TelemetryRole>("");
  const [participantFilter, setParticipantFilter] = useState(initialParticipant);
  const [session, setSession] = useState("");
  const [history, setHistory] = useState<HistoryResponse>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const statsUrl = (precise = false) => {
    const params = new URLSearchParams({ studioId, room: roomName, minutes: String(minutes) });
    if (roleFilter) params.set("role", roleFilter);
    if (participantFilter) params.set("participant", participantFilter);
    if (session) params.set("session", session);
    if (precise) params.set("resolution", "2s");
    if (historyDay) params.set("to", String(Math.min(Date.now(), Date.parse(`${historyDay}T23:59:59.999+03:00`))));
    if (platformNodeId) { params.set("nodeId",platformNodeId); params.set("room",platformMediaRoom || roomName); return `/api/super-admin/history?${params}`; }
    return `/api/stats?${params}`;
  };
  const filterConnections = (value: HistoryResponse) => value.connections.filter((connection) =>
    (!roleFilter || connection.role === roleFilter) &&
    (!participantFilter || connection.identity === participantFilter) &&
    (!session || connection.session === session));
  const download = async (kind: "history" | "connections" | "report" | "audio") => {
    if (!history || exporting) return;
    setExporting(true);
    setExportNote("");
    try {
      if (kind === "audio") {
        const parts: string[] = [];
        let cursor: string | null = null, to: number | undefined, count = 0, bytes = 0, complete = false;
        // Bounded requests and download size keep a busy 24-hour room usable.
        do {
          const url = new URL(statsUrl(), window.location.origin);
          url.searchParams.set("diagnostics", "audio"); url.searchParams.set("limit", "2000");
          if (cursor) url.searchParams.set("cursor", cursor);
          if (to !== undefined) url.searchParams.set("to", String(to));
          const response = await fetch(url.pathname + url.search, { cache: "no-store", signal: AbortSignal.timeout(15000),
            credentials: "same-origin" });
          if (!response.ok) throw Error("Не удалось выгрузить аудиоисторию. Повторите после обновления статистики.");
          const page: AudioHistoryResponse = await response.json();
          to = page.to;
          const content = audioHistoryCsv(page.samples);
          const chunk = parts.length ? content.slice(content.indexOf("\r\n") + 2) : content;
          if (!parts.length || page.samples.length) parts.push(chunk);
          count += page.samples.length; bytes += chunk.length;
          if (page.nextCursor && page.nextCursor === cursor) throw Error("Сервер не продолжил аудиоисторию");
          cursor = page.nextCursor;
          complete = !cursor;
          setExportNote(`Подготовлено замеров аудио: ${count.toLocaleString(locale)}…`);
        } while (cursor && count < 50000 && bytes < 20 * 1024 * 1024);
        const url = URL.createObjectURL(new Blob(parts.map((part, index) => index ? "\r\n" + part : part), { type: "text/csv;charset=utf-8" }));
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = `castlink-audio-${roomName.replace(/[^a-zа-яё0-9_-]/gi, "_")}-${historyDay || "live"}-${minutes}min${complete ? "" : "-partial"}.csv`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportNote(complete ? `Аудиоистория выгружена: ${count.toLocaleString(locale)} замеров за выбранный период и фильтры.` :
          `Выгружена часть истории: ${count.toLocaleString(locale)} замеров. Достигнут лимит файла; выберите отдельную сессию или более короткий период для полной выгрузки.`);
        return;
      }
      const response = await fetch(statsUrl(true), { cache: "no-store", credentials: "same-origin" });
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
      anchor.download = `castlink-${kind}-${roomName.replace(/[^a-zа-яё0-9_-]/gi, "_")}-${historyDay || "live"}-${minutes}min.${kind === "report" ? "html" : "csv"}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка выгрузки"); }
    finally { setExporting(false); }
  };
  // The studio may have been open for hours before this tab is mounted.
  const bearer = useRef({ token, at: 0 });
  useEffect(() => { bearer.current = { token, at: 0 }; }, [token, studioRole, studioClientId, studioEpoch]);
  useEffect(() => { setRoleFilter(""); setParticipantFilter(initialParticipant); setSession(""); setHistory(undefined); }, [roomName,studioId,platformNodeId,platformMediaRoom,initialParticipant]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setHistory(undefined);
    const update = async () => {
      try {
        if (controller.signal.aborted) return;
        const response = await fetch(statsUrl(), {
          signal: controller.signal, cache: "no-store", credentials: "same-origin",
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
  }, [roomName, studioId, minutes, historyDay, roleFilter, participantFilter, session, revision, platformNodeId, platformMediaRoom]);

  const roleConnections = history?.connections.filter(connection => !roleFilter || connection.role === roleFilter) ?? [];
  const participantOptions = [...new Map(roleConnections.map(connection => [connection.identity, connection])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const sessionOptions = roleConnections.filter(connection => !participantFilter || connection.identity === participantFilter);
  const visibleConnections = history ? filterConnections(history) : [];
  const selected = history?.connections.find((c) => c.session === session);
  const live = history ? visibleConnections.filter((c) => c.latest.state !== "disconnected" && history.to - c.lastSeen < 35_000) : [];
  return <div className="statistics-dashboard">
    <div className="stats-toolbar panel">
      <div><h2>{t("Статистика соединений")}</h2><p className="muted">{t("Комната «")}{roomName}{t("». Замеры клиентов и детальная выгрузка — каждые 2 секунды; обзорные графики обновляются каждые 15 секунд.")}</p></div>
      <div className="stats-periods" role="group" aria-label={t("Период статистики")}>{periods.map(([value, label]) =>
        <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{t(label)}</button>)}</div>
      <div className="stats-periods"><label>{t("Прошедший день (МСК, UTC+3)")} <input type="date" value={historyDay}
        min={new Date(Date.now() - (history?.retention?.days ?? 30) * 86400000 + 3 * 3600000).toISOString().slice(0, 10)}
        max={new Date(Date.now() - 86400000 + 3 * 3600000).toISOString().slice(0, 10)}
        onChange={event => { setHistoryDay(event.target.value); if (event.target.value) setMinutes(1440); setSession(""); }} /></label>
        <button aria-pressed={!historyDay} onClick={() => { setHistoryDay(""); setMinutes(15); setSession(""); }}>{t("Текущая история")}</button></div>
      <div className="stats-filter-grid">
        <label>{t("Роль")} <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as "" | TelemetryRole); setParticipantFilter(""); setSession(""); }}>
          <option value="">{t("Все роли")}</option>
          {(Object.keys(roles) as TelemetryRole[]).map(role => <option key={role} value={role}>{t(roles[role])}</option>)}
        </select></label>
        <label>{t("Участник")} <select value={participantFilter} onChange={(event) => { setParticipantFilter(event.target.value); setSession(""); }}>
          <option value="">{t("Все участники")}</option>
          {participantOptions.map(connection => <option value={connection.identity} key={connection.identity}>{connection.name} · {t(roles[connection.role])}</option>)}
        </select></label>
        <label>{t("Сессия")} <select value={session} onChange={(event) => setSession(event.target.value)}>
          <option value="">{t("Все сессии выборки")}</option>
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
        }}>{clearing ? t("Очистка…") : t("Сбросить отключившихся")}</button>}
        <button disabled={!history || exporting} onClick={() => void download("report")}>{t("Скачать наглядный отчёт")}</button>
        <button disabled={!history || exporting} onClick={() => void download("history")}>{t("Графики → CSV")}</button>
        <button disabled={!history || exporting} onClick={() => void download("connections")}>{t("Участники и потоки → CSV")}</button>
        <button disabled={!history || exporting} onClick={() => void download("audio")}>{t("История аудио → CSV")}</button>
      </div>
      {exportNote && <p className="muted" role="status">{translateWorkspaceMessage(t, exportNote)}</p>}
      <p className="muted">{t("Сброс очищает список завершённых подключений. Активные участники и история графиков сохраняются. CSV открывается в Excel. Наглядный HTML-отчёт с графиками открывается в браузере без интернета. Старые замеры не дополняются вымышленными значениями.")}</p>
      <p className="muted">{t("Входящие — от сервера к клиентам. Исходящие — от клиентов к серверу. Для всех соединений битрейты суммируются, RTT, jitter и потери усредняются. Пропуски — нет замеров.")}</p>
      <p className="muted">{t("История аудио содержит каждый сохранённый замер с точным временем UTC, потерями, concealment, jitter buffer и состоянием воспроизведения выхода. По умолчанию история хранится 30 дней: прошедшие часы сжимаются без потери двухсекундных замеров, без записи аудио и видео. Общий лимит диска может сократить доступный период; уже удалённые старые дни восстановить невозможно. Старые клиенты не передают новые поля. Отсутствие прироста samples и нулевой уровень не доказывают обрыв: возможны тишина и DTX.")}</p>
    </div>
    {error && <p role="alert" className="av-error">{error}</p>}
    {!history ? <p className="panel">{t("Загружаем историю…")}</p> : <>
      <div className="stats-summary">
        <div className="panel"><span>{historyDay ? t("Свежие замеры в конце выборки") : t("Сейчас передают замеры")}</span><strong>{live.length}</strong></div>
        <div className="panel"><span>{t("Соединений в выборке")}</span><strong>{visibleConnections.length}</strong></div>
        <div className="panel"><span>{t("История в выбранном периоде")}</span><strong>{history.retainedFrom ? new Date(history.retainedFrom).toLocaleString(locale) : t("Ещё нет данных")}</strong></div>
      </div>
      {history.retention && <p className="panel muted">{t("Лимит хранения:")} {history.retention.days} {t("дней /")} {format(history.retention.maxBytes / 1024 / 1024, 0)} {t("МиБ на сервере. Самый ранний сохранённый час комнаты:")} {history.retention.availableFrom ? new Date(history.retention.availableFrom).toLocaleString(locale, { timeZone: "Europe/Moscow" }) + t(" МСК") : t("Ещё нет данных")}. {historyDay ? t("Выбран день {historyDay} по МСК; время графиков — по часовому поясу браузера, CSV — UTC.", { historyDay: historyDay }) : t("Графики — по часовому поясу браузера, CSV — UTC.")}</p>}
      {history.audioSummary && <div className="panel"><h3>{t("Аудио за выбранный период")}</h3>
        <p>{t("Замеров аудио:")} {format(history.audioSummary.samples, 0)}{t(". С потерями:")} {format(history.audioSummary.lossIntervals, 0)}{t("; с concealment:")} {format(history.audioSummary.concealmentIntervals, 0)}{t("; без прироста принятых samples:")} {format(history.audioSummary.noSampleProgressIntervals, 0)}{t(". Замеров с паузой, ошибкой или отсутствием подписки:")} {format(history.audioSummary.playbackWarnings, 0)}{t(". Попыток восстановления по счётчикам сессий:")} {format(history.audioSummary.recoveryAttempts, 0)}.</p>
        <p className="muted">{t("Это числа замеров, а не отдельных происшествий. Счётчики восстановления накоплены с начала сессии и могут включать попытки до выбранного периода. Для разбора выберите роль «Выход vMix», участника и сессию, затем скачайте историю аудио.")}</p>
      </div>}
      {!history.retainedFrom ? <div className="panel">{t("Замеров пока нет. Подключите гостя или выход vMix. История сохраняется на сервере и начинает накапливаться после обновления клиентов.")}</div> : <>
        <div className="stats-chart-grid">
          <HistoryChart title={t("Битрейт")} unit={t("кбит/с")} history={history} lines={[{ key: "inbound", label: t("Входящие"), color: "#60a5fa" }, { key: "outbound", label: t("Исходящие"), color: "#34d399" }]} />
          <HistoryChart title={t("Задержка и jitter")} unit={t("мс")} history={history} lines={[{ key: "rtt", label: "RTT", color: "#fbbf24" }, { key: "jitter", label: "Jitter", color: "#c084fc" }]} />
          <HistoryChart title={t("Аудио и видео")} unit={t("кбит/с")} history={history} lines={[
            { key: "audioIn", label: t("Аудио вход"), color: "#38bdf8" }, { key: "videoIn", label: t("Видео вход"), color: "#818cf8" },
            { key: "audioOut", label: t("Аудио выход"), color: "#fbbf24" }, { key: "videoOut", label: t("Видео выход"), color: "#34d399" }]} />
          <HistoryChart title={t("Потери пакетов за интервал")} unit="%" history={history} lines={[{ key: "loss", label: t("Потери"), color: "#fb7185" }]} />
          <HistoryChart title={t("Соединения с замерами")} unit={t("шт.")} history={history} lines={[{ key: "connections", label: t("Соединения"), color: "#2dd4bf" }]} />
        </div>
        <div className="panel stats-table-wrap"><table className="stats-table"><caption>{t("Подключения в выбранной выборке")}</caption>
          <thead><tr><th>{t("Участник")}</th><th>{t("Тип")}</th><th>{t("Состояние")}</th><th>{t("Вход / выход, кбит/с")}</th><th>{t("RTT / jitter, мс")}</th><th>{t("Потери, %")}</th><th>{t("Переподключения")}</th><th>{t("Последний замер")}</th></tr></thead>
          <tbody>{visibleConnections.map((c) => <tr key={c.session} className={session === c.session ? "stats-selected" : ""}>
            <td><button className="stats-connection-button" onClick={() => setSession(c.session)}>{c.name}</button><small>{c.identity}</small></td>
            <td>{t(roles[c.role])}</td><td>{c.latest.state === "disconnected" ? t("Отключён") : history.to - c.lastSeen > 35_000 ? t("Нет свежих замеров") : c.latest.state === "connected" ? t("Подключён") : t("Переподключение")}<small>{t("Качество:")} {c.latest.quality || "—"}</small></td>
            <td>{format(sumRates(c.latest.streams, "in"))} / {format(sumRates(c.latest.streams, "out"))}</td>
            <td>{format(mean(c.latest.streams.map((s) => s.rttMs)))} / {format(mean(c.latest.streams.map((s) => s.jitterMs)))}</td>
            <td>{format(mean(c.latest.streams.map((s) => s.lossPct)), 2)}</td><td>{c.latest.reconnects}</td><td>{time(c.lastSeen)}</td>
          </tr>)}</tbody></table></div>
        {selected && <div className="panel stats-table-wrap"><h3>{t("Потоки:")} {selected.name}</h3><p className="muted">{t("Время с начала соединения:")} {format(selected.latest.uptimeSec / 60)} {t("мин. Последний замер:")} {new Date(selected.lastSeen).toLocaleString(locale)}</p>
          {!selected.latest.streams.length ? <p>{t("В последнем замере нет активных медиапотоков.")}</p> : <table className="stats-table"><thead><tr><th>{t("Направление / источник")}</th><th>{t("Участник")}</th><th>{t("Кодек")}</th><th>{t("Битрейт")}</th><th>{t("Размер / FPS")}</th><th>{t("Потери / jitter / RTT")}</th><th>{t("Транспорт")}</th><th>{t("Замирания / ограничение")}</th></tr></thead>
            <tbody>{selected.latest.streams.map((s) => <tr key={s.id}><td>{s.direction === "in" ? t("Вход") : t("Выход")} · {s.kind === "audio" ? t("Аудио") : t("Видео")}<small>{s.source}</small></td>
              <td>{s.name}</td><td>{s.codec || "—"}</td><td>{format(s.bitrateKbps)} {t("кбит/с")}</td>
              <td>{s.width && s.height ? `${s.width}×${s.height}` : "—"} / {format(s.fps)} fps</td>
              <td>{format(s.lossPct, 2)}% / {format(s.jitterMs)} {t("мс /")} {format(s.rttMs)} {t("мс")}</td><td>{s.protocol || "—"} · {s.candidateType || "—"}</td>
              <td>{format(s.freezes, 0)} / {s.qualityLimitation || "—"}</td></tr>)}</tbody></table>}
        </div>}
      </>}
    </>}
  </div>;
}
