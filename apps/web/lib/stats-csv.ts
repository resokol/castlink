import type { HistoryResponse, TelemetryRole, TelemetrySample } from "./telemetry-types";
const roleNames: Record<TelemetryRole, string> = { studio: "Студия", admin: "Администратор", moderator: "Модератор", guest: "Гость", output: "Выход vMix", monitor: "Монитор" };
export function csv(rows: (string | number | null | undefined)[][]) {
  return "\ufeff" + rows.map(row => row.map(value => {
    let text = value == null ? "" : String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(";")).join("\r\n");
}
export function historyCsv(history: HistoryResponse) {
  return csv([["Время UTC", "Вход кбит/с", "Выход кбит/с", "Аудио вход", "Видео вход", "Аудио выход", "Видео выход", "Потери %", "Jitter мс", "RTT мс", "Подключений"],
    ...history.series.map(p => [new Date(p.at).toISOString(), p.inbound, p.outbound, p.audioIn, p.videoIn, p.audioOut, p.videoOut, p.loss, p.jitter, p.rtt, p.connections])]);
}
export function connectionsCsv(history: HistoryResponse) {
  return csv([["Участник", "Identity", "Сессия", "Роль", "Состояние", "Качество", "Uptime сек", "Начало UTC", "Последний замер UTC", "Переподключения", "Направление", "Тип", "Источник", "Поток участника", "Кодек", "Битрейт кбит/с", "Потери %", "Jitter мс", "RTT мс", "Ширина", "Высота", "FPS", "Байты", "Транспорт", "Тип кандидата", "Замирания", "Ограничение качества"],
    ...history.connections.flatMap(c => (c.latest.streams.length ? c.latest.streams : [undefined]).map(s => [c.name, c.identity, c.session, roleNames[c.role], c.latest.state, c.latest.quality, c.latest.uptimeSec, new Date(c.firstSeen).toISOString(), new Date(c.lastSeen).toISOString(), c.latest.reconnects,
      s?.direction, s?.kind, s?.source, s?.name, s?.codec, s?.bitrateKbps, s?.lossPct, s?.jitterMs, s?.rttMs, s?.width, s?.height, s?.fps, s?.bytes, s?.protocol, s?.candidateType, s?.freezes, s?.qualityLimitation]))]);
}

export function audioHistoryCsv(samples: TelemetrySample[]) {
  return csv([["Замер сервера UTC", "Замер клиента UTC", "Участник", "Identity", "Сессия", "Роль", "Состояние", "Переподключения",
    "Направление", "Источник", "Поток участника", "ID потока", "Битрейт кбит/с", "Потери %", "Потеряно пакетов (счётчик)", "Jitter мс", "RTT мс",
    "RTC timestamp мс", "Интервал мс", "Принято samples (счётчик)", "Concealed samples (счётчик)", "Concealment events (счётчик)",
    "Принято samples за интервал", "Concealed samples за интервал", "Concealment events за интервал", "Concealed %", "Jitter buffer мс за интервал", "Уровень аудио",
    "Воспроизведение разрешено", "Подписка", "Track state", "Paused", "Muted", "Ready state", "Current time сек", "Ошибка media code", "AudioContext",
    "Попыток восстановления (счётчик)", "Последнее восстановление UTC", "Причина восстановления"],
  ...samples.flatMap(sample => {
    const streams = sample.streams.filter(stream => stream.kind === "audio");
    const p = sample.audioPlayback;
    return (streams.length ? streams : [undefined]).map(s => [new Date(sample.at).toISOString(), sample.clientAt ? new Date(sample.clientAt).toISOString() : null,
      sample.name, sample.identity, sample.session, roleNames[sample.role], sample.state, sample.reconnects, s?.direction, s?.source, s?.participant, s?.id,
      s?.bitrateKbps, s?.lossPct, s?.lostPackets, s?.jitterMs, s?.rttMs, s?.audio?.statsAt, s?.audio?.intervalMs,
      s?.audio?.receivedSamples, s?.audio?.concealedSamples, s?.audio?.concealmentEvents, s?.audio?.receivedSamplesDelta,
      s?.audio?.concealedSamplesDelta, s?.audio?.concealmentEventsDelta, s?.audio?.concealedPct, s?.audio?.jitterBufferDelayMs, s?.audio?.audioLevel,
      p ? Number(p.enabled) : null, p?.subscribed == null ? null : Number(p.subscribed), p?.trackState,
      p?.paused == null ? null : Number(p.paused), p?.muted == null ? null : Number(p.muted), p?.readyState, p?.currentTime,
      p?.errorCode, p?.contextState, p?.recoveryAttempts, p?.lastRecoveryAt ? new Date(p.lastRecoveryAt).toISOString() : null, p?.lastRecoveryReason]);
  })]);
}
