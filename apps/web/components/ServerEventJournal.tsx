"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "./I18nProvider";
import type { ServerEventRecord, ServerEventSnapshot } from "@/lib/server-event-types";
import styles from "./ServerMonitor.module.css";

type Level = "all" | "info" | "warn" | "error";
const labels = { info: "Информация", warn: "Предупреждение", error: "Ошибка" } as const;

export function ServerEventRows({ events }: { events: ServerEventRecord[] }) {
  const { t, locale } = useI18n();
  return <tbody>{events.length === 0 ? <tr><td colSpan={4} className={styles.empty}>{t("За выбранный период событий нет")}</td></tr> : events.map(event => <tr key={event.id}>
    <th scope="row"><time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleString(locale)}</time></th>
    <td><span className={styles.severity} data-level={event.level}>{t(labels[event.level])}</span></td>
    <td><code className={styles.eventName}>{event.event}</code><small className={styles.eventService}>{event.service}</small></td>
    <td>{Object.keys(event.fields).length > 0 ? <details><summary>{t("Подробности события")}</summary><pre className={styles.eventFields}>{JSON.stringify(event.fields, null, 2)}</pre></details> : "—"}</td>
  </tr>)}</tbody>;
}

export function ServerEventJournal() {
  const { t, locale } = useI18n();
  const id = useId();
  const [level, setLevel] = useState<Level>("all");
  const [cursor, setCursor] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<ServerEventSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let disposed = false, stopped = false, running = false, loaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      if (disposed || stopped || running || document.hidden) return;
      running = true; setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const query = new URLSearchParams({ level });
        if (cursor !== null) query.set("cursor", String(cursor));
        const response = await fetch(`/api/super-admin/events?${query}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          stopped = true;
          if (!disposed) { setSnapshot(undefined); setForbidden(true); }
          return;
        }
        if (!response.ok) throw new Error("events_unavailable");
        const data: ServerEventSnapshot = await response.json();
        if (!disposed && !document.hidden) { loaded = true; setSnapshot(data); setError(false); }
      } catch {
        if (!disposed && !document.hidden) setError(true);
      } finally {
        clearTimeout(timeout); running = false;
        if (!disposed) setLoading(false);
        if (!disposed && !stopped && !document.hidden && cursor === null) timer = setTimeout(poll, 15000);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else if (cursor === null || !loaded) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibility); };
    // A page is a fixed cursor; it refreshes only after an explicit navigation.
  }, [level, cursor, refresh]);

  const unavailable = snapshot?.storage.state === "unavailable";
  const reset = () => { setCursor(null); setRefresh(value => value + 1); };
  return <section className={styles.journal} aria-labelledby={`${id}-title`}>
    <div className={styles.heading}><div><h3 id={`${id}-title`}>{t("Журнал событий")}</h3><p className="muted">{t("Последние 24 часа. При большом потоке событий старые записи могут удаляться раньше из-за ограничения объёма.")}</p></div>
      <p className={styles.freshness} role="status">{forbidden ? t("Доступ к журналу отозван") : error || unavailable ? t("Журнал временно недоступен") : loading ? t("Загружаем события…") : cursor !== null ? t("Страница предыдущих событий") : t("Свежие события")}{snapshot && <time dateTime={new Date(snapshot.generatedAt).toISOString()}>{new Date(snapshot.generatedAt).toLocaleString(locale)}</time>}</p>
    </div>
    <div className={styles.toolbar}>
      <label htmlFor={`${id}-level`}>{t("Уровень событий")}</label>
      <select id={`${id}-level`} value={level} onChange={event => { setSnapshot(undefined); setCursor(null); setLevel(event.target.value as Level); setError(false); }}>
        <option value="all">{t("Все уровни")}</option><option value="error">{t("Ошибки")}</option><option value="warn">{t("Предупреждения")}</option><option value="info">{t("Информация")}</option>
      </select>
      <button type="button" disabled={loading || forbidden} onClick={reset}>{cursor === null ? t("Обновить журнал") : t("К свежим событиям")}</button>
    </div>
    {unavailable && <p className={styles.warning} role="status">{t("Запись журнала недоступна. Проверьте свободное место и права на каталог данных; консольные сообщения продолжают работать.")}</p>}
    {snapshot && snapshot.storage.droppedEvents > 0 && <p className={styles.warning} role="status">{t("Пропущено событий из-за ограничений записи")}: {snapshot.storage.droppedEvents.toLocaleString(locale)}</p>}
    {!forbidden && snapshot && (!unavailable || snapshot.events.length > 0) && <>
      <div className="super-admin-table-wrap"><table className={`super-admin-table ${styles.events}`}>
        <caption>{t("До 50 событий на странице, новые сначала")}</caption>
        <thead><tr>{["Время", "Уровень", "Событие", "Подробности"].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
        <ServerEventRows events={snapshot.events} />
      </table></div>
      <div className={styles.pagination}><button type="button" disabled={loading || snapshot.nextCursor === null} onClick={() => { if (snapshot.nextCursor !== null) { setSnapshot(undefined); setCursor(snapshot.nextCursor); } }}>{t("Более ранние события")}</button></div>
    </>}
  </section>;
}
