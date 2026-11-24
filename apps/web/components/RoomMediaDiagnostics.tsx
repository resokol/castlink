"use client";
import { useEffect, useRef, useState } from "react";
import { IncidentMinuteEvidence } from "./IncidentMinuteEvidence";
import { useI18n } from "./I18nProvider";
import { downloadRoomDiagnostics } from "../lib/room-diagnostics-download";
import type { RoomDiagnosticsReport } from "../lib/room-diagnostics-types";
import type { RoomMediaFinding, RoomMediaFindingCode } from "../lib/room-media-diagnosis";
import type { ConnectionProblemPeriod, HistoryResponse } from "../lib/telemetry-types";

const advice: Record<RoomMediaFindingCode, [string, string]> = {
  "sender-cpu": ["Кодирование ограничено процессором", "На отправителе закройте тяжёлые приложения или уменьшите разрешение и частоту кадров."],
  "sender-bandwidth": ["Кодировщик ограничен пропускной способностью", "Проверьте исходящий канал отправителя. Попробуйте кабель и меньший битрейт."],
  "sender-loss": ["Потери от отправителя до медиасервера", "Проверьте сеть отправителя и загрузку его исходящего канала. Сравните с другими отправителями в эту же минуту."],
  "receiver-decode": ["Приёмник не успевает декодировать видео", "На приёмнике проверьте нагрузку на процессор и видеокарту. Попробуйте меньший видеослой."],
  "receiver-path": ["Ухудшение на пути к приёмнику", "Проверьте сеть приёмника, Wi-Fi и входящий трафик. Сравните с другим приёмником этого потока."],
  "shared-path": ["Один поток ухудшился у нескольких приёмников", "Сопоставьте исходящий поток отправителя и загрузку медиасервера в указанный интервал."],
  "unlocalized": ["Сторона сбоя не определена", "Сравните тот же поток у отправителя и других приёмников. Для анализа выберите все роли и сессии."],
};
const metrics: Partial<Record<keyof RoomMediaFinding["evidence"], string>> = {
  lossPct: "Потери, %", senderLossPct: "Потери до сервера, %", jitterMs: "Джиттер, мс",
  droppedPct: "Отброшено кадров, %", freezes: "Новых зависаний за интервал", concealedPct: "Замещено аудиосэмплов, %",
  healthyReceivers: "Приёмников без этого симптома", affectedReceivers: "Затронуто приёмников",
  fps: "Кадров/с", outboundKbps: "Отправка, кбит/с", encodeMsPerFrame: "Кодирование, мс/кадр",
  decodeMsPerFrame: "Декодирование, мс/кадр", receivedFrames: "Получено кадров за интервал", decodedFrames: "Декодировано кадров за интервал",
  availableOutgoingKbps: "Доступная скорость отправки, кбит/с", sfuEgressPacketsDelta: "Пакетов отправлено LiveKit между отчётами",
  sfuEgressBytesDelta: "Байтов отправлено LiveKit между отчётами",
};
const confidence = { observed: "Зафиксировано измерением", likely: "Вероятная причина", unknown: "Недостаточно данных" };

function episodeKey(p: ConnectionProblemPeriod) {
  return p.firstAt + ":" + p.lastAt;
}

function localMinute(at: number) {
  const date = new Date(at);
  return new Date(at - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RoomMediaDiagnostics({ statsUrl, start, cutoff, connections, filtered, problemPeriods, hasMeasurements }: {
  statsUrl: string; start?: number; cutoff?: number; connections: { identity: string; name: string }[]; filtered: boolean;
  problemPeriods?: HistoryResponse["problemPeriods"]; hasMeasurements: boolean;
}) {
  const { t, locale } = useI18n();
  const [picked, setPicked] = useState<ConnectionProblemPeriod>();
  const periods = problemPeriods?.periods ?? [];
  // Keep the selected snapshot while the overview advances or reorders episodes.
  const selected = picked ?? periods[0];
  const archivedPick = picked && !periods.some(p => episodeKey(p) === episodeKey(picked));
  const options = picked && archivedPick ? [picked, ...periods] : periods;
  const [minuteInput, setMinuteInput] = useState<string>();
  const [review, setReview] = useState<{ report: RoomDiagnosticsReport; episode: boolean }>();
  const report = review?.report;
  const fullPeriodCutoff = review && !review.episode && report?.minute === undefined ? review.report.to : cutoff;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const episodeHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (review?.episode) episodeHeading.current?.focus(); }, [review]);
  const selectedMinute = minuteInput ?? (cutoff ? localMinute(cutoff) : "");
  const minuteAt = Date.parse(selectedMinute);
  const minuteValid = start !== undefined && cutoff !== undefined && minuteAt <= cutoff && minuteAt + 59_999 >= start;
  const urlAt = ({ to, from, minute }: { to?: number; from?: number; minute?: number }) => {
    const url = new URL(statsUrl, window.location.origin);
    if (to !== undefined) url.searchParams.set("to", String(to));
    if (from !== undefined) url.searchParams.set("from", String(from));
    if (minute !== undefined) url.searchParams.set("minute", String(minute));
    return url;
  };
  const analyze = async ({ minute, from, to = cutoff }: { minute?: number; from?: number; to?: number } = {}) => {
    if (controller.current || to === undefined) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(""); setReview(undefined);
    try {
      const url = urlAt({ to, from, minute }); url.searchParams.set("diagnostics", "analysis");
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: request.signal });
      if (res.status === 429) throw Error("Сервер уже обрабатывает диагностику. Повторите чуть позже.");
      if (!res.ok) throw Error();
      const result: RoomDiagnosticsReport = await res.json();
      if (!result.diagnosis?.coverage || !Array.isArray(result.diagnosis.findings) || !Array.isArray(result.sfu?.samples)) throw Error();
      if (minute !== undefined && (result.minute !== minute || !result.incident?.node || !Array.isArray(result.incident.paths))) throw Error();
      if (from !== undefined && (result.from !== from || result.to !== to || result.minute !== undefined)) throw Error();
      if (!request.signal.aborted) setReview({ report: result, episode: from !== undefined });
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error && cause.message.startsWith("Сервер") ? cause.message : "Не удалось получить диагностику для выбранного периода.");
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const name = (id: string) => connections.find(c => c.identity === id)?.name || id;
  const time = (at: number) => new Date(at).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const observed = (p: ConnectionProblemPeriod) => p.firstAt === p.lastAt ? time(p.firstAt) : time(p.firstAt) + " — " + time(p.lastAt);
  const reasons = selected && [
    selected.lossPct > 0 && t("Пик потерь пакетов {value}%", { value: selected.lossPct.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
    selected.concealedPct > 0 && t("Пик замещения аудиосэмплов {value}%", { value: selected.concealedPct.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
    selected.freezes > 0 && t("Новых зависаний за один интервал трека: до {count}", { count: selected.freezes }),
    selected.reconnect && t("Переподключение"),
    selected.poorQuality && t("Низкое качество связи"),
  ].filter(Boolean).join(" · ");
  const result = report && <div aria-live="polite">
    {review?.episode && <h3 tabIndex={-1} ref={episodeHeading}>{t("Диагностика выбранного эпизода")}</h3>}
    <p>{time(report.from)} — {time(report.to)} · {t("Замеров: {count}", { count: report.sampleCount })}</p>
    {review?.episode && <button onClick={() => downloadRoomDiagnostics(urlAt({ from: report.from, to: report.to }).href)}>{t("Скачать диагностику этого эпизода")}</button>}
    {report.minute !== undefined && <button onClick={() => downloadRoomDiagnostics(urlAt({ minute: report.minute, to: report.to }).href)}>{t("Скачать диагностику этой минуты")}</button>}
    {(!report.complete || report.sfu.clippedSnapshots > 0 || report.diagnosis.coverage.limited) && <p>{t("Часть истории или сравнений недоступна. Подробности есть в конце выгрузки.")}</p>}
    {report.incident && <IncidentMinuteEvidence evidence={report.incident} name={name} />}
    <p className="muted">{report.sfu.samples.length ? t("LiveKit подтвердил состояние публикаций. Сетевые потери оцениваются по отчётам WebRTC.") : t("За этот период нет доступных снимков публикаций LiveKit.")}</p>
    {report.serverLoad && <p className="muted">{report.serverLoad.reason === "platform-access-required"
      ? t("График нагрузки узла доступен администратору платформы.")
      : report.serverLoad.reason ? t("За этот период нет доступных измерений нагрузки узла.")
      : t("Замеров нагрузки узла: {samples}. Интервалов CPU от {threshold}% длительностью от {seconds} с: {count}.", {
        samples: report.serverLoad.observedSamples, threshold: report.serverLoad.thresholdPercent,
        seconds: report.serverLoad.qualifyingSpanMs / 1000, count: report.serverLoad.elevated.length,
      })}</p>}
    {!report.diagnosis.findings.length && <p>{t(report.diagnosis.coverage.evaluable
      ? "В доступных измерениях признаки сбоя не выявлены." : "Недостаточно сопоставимых измерений для диагноза.")}</p>}
    {report.diagnosis.findings.map((f, index) => {
      const [title, action] = advice[f.code] ?? advice.unlocalized;
      const cpu = report.serverLoad?.overlaps.find(overlap => overlap.findingIndex === index);
      return <details key={index} open={index === 0}>
        <summary><strong>{t(title)}</strong> · {name(f.source)}{f.receiver && <> → {name(f.receiver)}</>} · {time(f.firstAt)}</summary>
        <p>{t(confidence[f.confidence])} · {t(f.kind === "audio" ? "Аудио" : "Видео")}{f.mediaSource && <> · {f.mediaSource}</>} · {time(f.firstAt)} — {time(f.lastAt)}</p>
        {f.receivers?.some(id => id !== f.receiver) && <p>{t("Приёмники")} · {f.receivers.map(name).join(", ")}</p>}
        <p className="muted">{Object.entries(metrics).flatMap(([k, label]) => {
          const value = f.evidence[k as keyof typeof f.evidence];
          return value === undefined ? [] : [t(label) + " " + value.toLocaleString(locale, { maximumFractionDigits: 1 })];
        }).join(" · ")}</p>
        {cpu && <p>{t("В {time} одновременно наблюдалась высокая нагрузка узла (до {peak}% CPU). Проверьте процессы узла за этот интервал.", {
          time: time(cpu.at), peak: Math.round(cpu.peakPercent),
        })}</p>}
        <p>{t(action)}</p>
      </details>;
    })}
  </div>;
  return <section className="panel room-media-diagnostics">
    <h2>{t("Диагностика связи")}</h2>
    <div className="stats-periods">
      <button disabled={!cutoff || busy} onClick={() => void analyze()}>{busy ? t("Сравниваем замеры…") : t("Разобрать проблемы связи")}</button>
      <button disabled={!cutoff || busy} onClick={() => downloadRoomDiagnostics(urlAt({ to: fullPeriodCutoff }).href)}>{t("Скачать полную диагностику")}</button>
    </div>
    {cutoff !== undefined && <section>
      <h3>{t("Эпизоды с признаками сбоя · местное время")}</h3>
      {!problemPeriods ? <p className="muted">{t("На этом узле автоматический поиск эпизодов недоступен.")}</p>
        : !hasMeasurements ? <p className="muted">{t("За выбранный период с этими фильтрами нет замеров.")}</p>
        : !problemPeriods.total ? <p className="muted">{t("В сохранённых замерах за выбранный период признаки сбоя не выявлены.")}</p>
        : problemPeriods.total > problemPeriods.periods.length && <p className="muted">{t("Показаны наиболее выраженные эпизоды: {shown} из {total}.", { shown: problemPeriods.periods.length, total: problemPeriods.total })}</p>}
      {selected && <>
        <div className="stats-periods episode-picker">
          <select aria-label={t("Эпизоды с признаками сбоя · местное время")} value={episodeKey(selected)} disabled={busy}
            onChange={event => {
              const period = options.find(p => episodeKey(p) === event.target.value);
              if (period) { setPicked(period); setReview(undefined); setError(""); }
            }}>
            {options.map(period => <option key={episodeKey(period)} value={episodeKey(period)}>
              {observed(period)}{period === picked && archivedPick ? " · " + t("Выбран ранее") : ""}
            </option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => {
            setPicked(selected);
            void analyze({ from: selected.from, to: selected.to });
          }}>{t("Разобрать эпизод")}</button>
        </div>
        <p className="muted">{reasons}</p>
      </>}
      {review?.episode && result}
    </section>}
    <form className="stats-periods" onSubmit={event => { event.preventDefault(); if (minuteValid) void analyze({ minute: minuteAt }); }}>
      <label>{t("Минута сбоя · местное время")} <input type="datetime-local" step="60" required value={selectedMinute}
        disabled={busy || !cutoff} min={start === undefined ? undefined : localMinute(start)} max={cutoff === undefined ? undefined : localMinute(cutoff)}
        onChange={event => setMinuteInput(event.target.value)} /></label>
      <button disabled={!minuteValid || busy}>{t("Разобрать минуту")}</button>
    </form>
    <p className="muted">{t("Файл NDJSON содержит сохранённые замеры за выбранный период и итог анализа. Последняя строка показывает полноту выгрузки.")}</p>
    {filtered && <p className="muted">{t("Фильтры ограничивают сравнение. Чтобы сопоставить отправителя и всех приёмников, выберите все роли, участников и сессии.")}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {!review?.episode && result}
  </section>;
}
