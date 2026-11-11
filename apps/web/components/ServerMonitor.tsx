"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "./I18nProvider";
import type { ServerMonitorSample, ServerMonitorSnapshot } from "@/lib/server-monitor-types";
import styles from "./ServerMonitor.module.css";
import { ServerEventJournal } from "./ServerEventJournal";

type Series = { label: string; color: string; dashed?: boolean; value: (sample: ServerMonitorSample) => number | null };
const ratio = (used: number | null, total: number | null) => used !== null && total !== null && total > 0 ? used / total * 100 : null;
const cpu: Series[] = [{ label: "CPU", color: "var(--monitor-accent)", value: sample => sample.cpuPercent }];
const ram: Series[] = [{ label: "RAM", color: "var(--monitor-accent)", value: sample => ratio(sample.memoryUsedBytes, sample.memoryTotalBytes) }];
const disk: Series[] = [{ label: "Диск", color: "var(--monitor-accent)", value: sample => ratio(sample.diskUsedBytes, sample.diskTotalBytes) }];
const network: Series[] = [
  { label: "Входящий", color: "var(--monitor-accent)", value: sample => sample.networkInMbps },
  { label: "Исходящий", color: "var(--text)", dashed: true, value: sample => sample.networkOutMbps },
];
const activity: Series[] = [
  { label: "Комнаты в хранилище", color: "var(--muted)", dashed: true, value: sample => sample.configuredRooms },
  { label: "Активные медиакомнаты", color: "var(--text)", value: sample => sample.activeRooms },
  { label: "Кастеры / гости", color: "var(--monitor-accent)", value: sample => sample.casters },
  { label: "Все подключения", color: "var(--monitor-blue)", dashed: true, value: sample => sample.connections },
];

export function MetricChart({ title, unit = "", history, series, ceiling, pointIntervalMs = 5000, current }: { title: string; unit?: string; history: ServerMonitorSample[]; series: Series[]; ceiling?: number; pointIntervalMs?: number; current?: ServerMonitorSample | null }) {
  const { t, locale } = useI18n();
  const id = useId(), latest = current === undefined ? history.at(-1) : current;
  const firstAt = history[0]?.from ?? history[0]?.at ?? latest?.at ?? 0, lastAt = Math.max(history.at(-1)?.at ?? firstAt, latest?.at ?? firstAt);
  const values = history.flatMap(sample => series.flatMap(item => { const value = item.value(sample); return value === null ? [] : [value]; }));
  const max = ceiling ?? Math.max(1, ...values) * 1.1;
  const x = (at: number) => (lastAt === firstAt ? 1 : (at - firstAt) / (lastAt - firstAt)) * 614;
  const y = (value: number) => 114 - Math.min(max, Math.max(0, value)) / max * 108;
  const number = (value: number | null) => value === null ? t("нет данных") : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
  const time = (at: number) => new Date(at).toLocaleString(locale, lastAt - firstAt >= 6 * 60 * 60_000 ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return <figure className={styles.chart}>
    <figcaption id={`${id}-title`}>{t(title)}</figcaption>
    <ul className={styles.legend}>{series.map(item => <li key={item.label}><span aria-hidden="true" className={styles.swatch} style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid" }} />{t(item.label)} <strong>{number(latest ? item.value(latest) : null)}</strong></li>)}</ul>
    <div className={styles.plot}><div className={styles.yaxis} aria-hidden="true"><span>{max.toLocaleString(locale, { maximumFractionDigits: 1 })}</span><span>0</span></div>
    <svg viewBox="0 0 614 120" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <desc id={`${id}-description`}>{t("История измерений. Пропуски означают отсутствие данных. Точные значения доступны в таблице ниже.")}</desc>
      <line x1="0" y1="6" x2="614" y2="6" className={styles.gridline} />
      <line x1="0" y1="60" x2="614" y2="60" className={styles.gridline} />
      <line x1="0" y1="114" x2="614" y2="114" className={styles.gridline} />
      {series.map(item => {
        let path = "", previousAt: number | null = null, previousFrom: number | null = null;
        for (const sample of history) {
          const value = item.value(sample);
          if (value === null) { previousAt = null; previousFrom = null; continue; }
          const adjacent = !sample.gapBefore && previousAt !== null && (sample.from !== undefined && previousFrom !== null ? sample.from - previousFrom <= pointIntervalMs : sample.at - previousAt <= Math.max(15000, pointIntervalMs * 2));
          path += `${adjacent ? "L" : "M"}${x(sample.at)},${y(value)} `;
          previousAt = sample.at; previousFrom = sample.from ?? null;
        }
        const value = latest ? item.value(latest) : null;
        return <g key={item.label}><path d={path} stroke={item.color} strokeWidth="2" fill="none" strokeDasharray={item.dashed ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />{latest && value !== null && <circle cx={x(latest.at)} cy={y(value)} r="3" fill={item.color} />}</g>;
      })}
    </svg>{!values.length && <span className={styles.noData}>{t("нет данных")}</span>}</div>
    {!!history.length && <div className={styles.xaxis} aria-hidden="true"><span>{time(firstAt)}</span><span>{time(lastAt)}</span></div>}
  </figure>;
}

export function ServerMonitor() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<"1h" | "6h" | "24h">("1h");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ServerMonitorSnapshot>();
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let disposed = false, stopped = false, running = false;
    let timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    const poll = async () => {
      if (disposed || stopped || running || document.hidden) return;
      running = true; controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(`/api/super-admin/metrics?range=${range}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          stopped = true;
          if (!disposed) { setSnapshot(undefined); setForbidden(true); }
          return;
        }
        if (!response.ok) throw new Error("metrics_unavailable");
        const data: ServerMonitorSnapshot = await response.json();
        if (!disposed && !document.hidden) { setSnapshot(data); setError(false); }
      } catch {
        if (!disposed && !document.hidden) setError(true);
      } finally {
        clearTimeout(timeout); running = false;
        if (!disposed) setNow(Date.now());
        if (!disposed && !stopped && !document.hidden) timer = setTimeout(poll, 15000);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else { setNow(Date.now()); void poll(); }
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, [range]);

  const history = snapshot?.history ?? [], latest = snapshot?.latest;
  const stale = !!latest && now - latest.at > 45000;
  const chartProps = { history, pointIntervalMs: snapshot?.resolutionMs ?? 15000, current: latest ?? null };
  const number = (value: number | null | undefined, unit = "") => value == null ? t("нет данных") : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
  const bytes = (value: number | null | undefined) => value == null ? t("нет данных") : number(value / 1024 ** 3, "GiB");
  const percent = (used: number | null, total: number | null) => number(ratio(used, total), "%");
  const service = (state: string | undefined) => !state ? t("нет данных") : t(state === "ok" ? "Доступна" : state === "unconfigured" ? "Не настроена" : "Недоступна");

  return <section className={`panel super-admin-section ${styles.monitor}`} aria-labelledby="server-monitor-title">
    <div className={styles.heading}><div><h2 id="server-monitor-title">{t("Стабильность этого сервера")}</h2><p className="muted">{t("Замеры каждые 15 секунд, даже когда панель закрыта. История за 24 часа сохраняется после перезапуска.")}</p></div>
      <p className={styles.freshness} role="status">{forbidden ? t("Доступ к показателям отозван") : error ? t("Обновление недоступно; последние данные ниже") : stale ? t("Снимок устарел") : latest ? t("Последний замер") : t("Получаем реальные показатели…")}{latest && <time dateTime={new Date(latest.at).toISOString()}>{new Date(latest.at).toLocaleString(locale)}</time>}</p>
    </div>
    <div className={styles.toolbar} role="group" aria-label={t("Период графиков")}><span>{t("Период графиков")}</span>{([["1h", "1 час"], ["6h", "6 часов"], ["24h", "24 часа"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => { if (value !== range) { setSnapshot(undefined); setError(false); setRange(value); } }}>{t(label)}</button>)}</div>
    {snapshot?.storage.state === "unavailable" && <p role="status" className={styles.warning}>{t("Хранилище истории недоступно. Новые замеры могут не сохраняться; проверьте свободное место и права на каталог данных.")}</p>}
    {snapshot && !snapshot.storage.samplerRunning && <p role="status" className={styles.warning}>{t("Фоновый сбор показателей не запущен. Показана только сохранённая история.")}</p>}
    {snapshot?.aggregation === "max" && <p className={styles.scope}>{t("На длинном периоде линии показывают пиковые значения по интервалам. Подписи рядом с графиками — последний замер.")} {t("Интервал графика")}: {(snapshot.resolutionMs / (snapshot.resolutionMs < 60000 ? 1000 : 60000)).toLocaleString(locale)} {t(snapshot.resolutionMs < 60000 ? "сек" : "мин")}</p>}
    {snapshot && <p className={styles.scope}>{t(snapshot.scope === "container" ? "Контейнер: CPU и RAM — доступные показатели ядра хоста, не квота контейнера; сеть — интерфейс контейнера. Windows и другие контейнеры отдельно не измеряются." : snapshot.scope === "wsl" ? "WSL: CPU, RAM и сеть относятся к Linux-гостю WSL, а не ко всему компьютеру Windows." : "CPU, RAM и сеть относятся к операционной системе этого сервера.")} {t("Диск — файловая система каталога данных CastLink; RSS и время работы относятся только к процессу web.")}</p>}
    <div className={styles.services} aria-label={t("Состояние служб")}>
      {([["Web", latest?.services.web], ["LiveKit API", latest?.services.livekit], ["Хранилище комнат", latest?.services.roomStore]] as const).map(([name, state]) => <span key={name}>{t(name)} <strong data-state={stale || error ? "unavailable" : state}>{stale || error ? t("Нет актуального замера") : service(state)}</strong></span>)}
    </div>
    <div className={styles.charts} data-stale={stale || error}>
      <div className={styles.activity}><MetricChart title="Комнаты и подключения" {...chartProps} series={activity} /></div>
      <MetricChart title="Занятость процессора" unit="%" {...chartProps} series={cpu} ceiling={100} />
      <MetricChart title="Использование памяти" unit="%" {...chartProps} series={ram} ceiling={100} />
      <MetricChart title="Использование диска" unit="%" {...chartProps} series={disk} ceiling={100} />
      <MetricChart title="Сетевой трафик" unit="Mbps" {...chartProps} series={network} />
    </div>
    <dl className={styles.details}>
      <div><dt>{t("RAM: использовано / всего")}</dt><dd>{bytes(latest?.memoryUsedBytes)} / {bytes(latest?.memoryTotalBytes)}</dd></div>
      <div><dt>{t("Диск: доступно для записи")}</dt><dd>{bytes(latest?.diskAvailableBytes)}</dd></div>
      <div><dt>{t("Память процесса web (RSS)")}</dt><dd>{bytes(latest?.processRssBytes)}</dd></div>
      <div><dt>{t("Время работы процесса web")}</dt><dd>{latest ? number(Math.floor(latest.processUptimeSec / 60), t("мин")) : t("нет данных")}</dd></div>
    </dl>
    <p className="muted">{t("Кастеры / гости — подключения guest; все подключения также включают студии и технические клиенты. Доступность LiveKit API не подтверждает качество медиа. Первый замер CPU и сети требует следующего отсчёта. Прочерк и разрыв графика означают отсутствие данных, а не нулевую нагрузку.")}</p>
    <details className={styles.history} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>{t("Точные значения и время измерений")}</summary>{historyOpen && <div className="super-admin-table-wrap"><table className="super-admin-table"><caption>{t("Последние 50 точек выбранного периода")}</caption><thead><tr>{["Время", "Комнаты в хранилище", "Активные медиакомнаты", "Кастеры / гости", "Все подключения", "CPU", "RAM", "Диск", "Входящий", "Исходящий"].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead><tbody>{history.slice(-50).reverse().map(sample => <tr key={sample.at}><th scope="row">{sample.from !== undefined && <><time dateTime={new Date(sample.from).toISOString()}>{new Date(sample.from).toLocaleTimeString(locale)}</time> — </>}<time dateTime={new Date(sample.at).toISOString()}>{new Date(sample.at).toLocaleString(locale)}</time></th><td>{number(sample.configuredRooms)}</td><td>{number(sample.activeRooms)}</td><td>{number(sample.casters)}</td><td>{number(sample.connections)}</td><td>{number(sample.cpuPercent, "%")}</td><td>{percent(sample.memoryUsedBytes, sample.memoryTotalBytes)}</td><td>{percent(sample.diskUsedBytes, sample.diskTotalBytes)}</td><td>{number(sample.networkInMbps, "Mbps")}</td><td>{number(sample.networkOutMbps, "Mbps")}</td></tr>)}</tbody></table></div>}</details>
    <ServerEventJournal />
  </section>;
}
