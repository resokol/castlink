import type { HistoryResponse } from "./telemetry-types";
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
  return csv([["Участник", "Identity", "Сессия", "Роль", "Состояние", "Начало UTC", "Последний замер UTC", "Переподключения", "Направление", "Тип", "Источник", "Поток участника", "Кодек", "Битрейт кбит/с", "Потери %", "Jitter мс", "RTT мс", "Ширина", "Высота", "FPS", "Байты", "Транспорт", "Тип кандидата", "Замирания"],
    ...history.connections.flatMap(c => (c.latest.streams.length ? c.latest.streams : [undefined]).map(s => [c.name, c.identity, c.session, c.role, c.latest.state, new Date(c.firstSeen).toISOString(), new Date(c.lastSeen).toISOString(), c.latest.reconnects,
      s?.direction, s?.kind, s?.source, s?.name, s?.codec, s?.bitrateKbps, s?.lossPct, s?.jitterMs, s?.rttMs, s?.width, s?.height, s?.fps, s?.bytes, s?.protocol, s?.candidateType, s?.freezes]))]);
}
