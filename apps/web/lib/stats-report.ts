import { mean, sumRates, type HistoryResponse, type MetricPoint, type TelemetryRole } from "./telemetry-types";

const roleNames: Record<TelemetryRole, string> = {
  studio: "Студия",
  admin: "Администратор",
  moderator: "Модератор",
  guest: "Гость",
  output: "Выход vMix",
  monitor: "Монитор",
};

const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const number = (value: number | null | undefined, digits = 2) => value == null ? "—" : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
const avg = (values: (number | null | undefined)[]) => mean(values);
const peak = (values: (number | null | undefined)[]) => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.max(...valid) : null;
};

export function statisticsReport(history: HistoryResponse, room: string, selection: string) {
  const chart = (title: string, unit: string, fields: { key: keyof MetricPoint; label: string; color: string }[]) => {
    const values = history.series.flatMap(point => fields.map(field => point[field.key])).filter((value): value is number => typeof value === "number");
    const max = Math.max(1, ...values), width = 1000, height = 180;
    const lines = fields.map(field => {
      let active = false;
      const path = history.series.map(point => {
        const value = point[field.key];
        if (typeof value !== "number") { active = false; return ""; }
        const command = active ? "L" : "M";
        active = true;
        const x = 50 + (point.at - history.from) / Math.max(1, history.to - history.from) * (width - 60);
        const y = height - 20 - value / max * (height - 40);
        return `${command}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      return `<path d="${path}" fill="none" stroke="${field.color}" stroke-width="2"/>`;
    }).join("");
    return `<section><h2>${escape(title)} <small>${escape(unit)}</small></h2><p class="legend">${fields.map(field => `<span style="color:${field.color}">● ${escape(field.label)}</span>`).join(" · ")}</p><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}"><text x="0" y="25">${escape(number(max))}</text><text x="20" y="160">0</text>${lines}</svg></section>`;
  };

  const reconnects = history.connections.reduce((total, connection) => total + connection.latest.reconnects, 0);
  const summary = [
    ["Соединений", history.connections.length],
    ["Средний вход", `${number(avg(history.series.map(point => point.inbound)))} кбит/с`],
    ["Пиковый вход", `${number(peak(history.series.map(point => point.inbound)))} кбит/с`],
    ["Средний выход", `${number(avg(history.series.map(point => point.outbound)))} кбит/с`],
    ["Средний RTT", `${number(avg(history.series.map(point => point.rtt)))} мс`],
    ["Средний jitter", `${number(avg(history.series.map(point => point.jitter)))} мс`],
    ["Средние потери", `${number(avg(history.series.map(point => point.loss)))} %`],
    ["Переподключения", reconnects],
  ].map(([label, value]) => `<div class="summary-card"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("");

  const connectionRows = history.connections.map(connection => {
    const latest = connection.latest;
    const inbound = sumRates(latest.streams, "in");
    const outbound = sumRates(latest.streams, "out");
    const rtt = mean(latest.streams.map(stream => stream.rttMs));
    const jitter = mean(latest.streams.map(stream => stream.jitterMs));
    const loss = mean(latest.streams.map(stream => stream.lossPct));
    return `<tr>
      <td><strong>${escape(connection.name)}</strong><small>${escape(connection.identity)}</small></td>
      <td>${escape(roleNames[connection.role])}</td>
      <td>${escape(latest.state)}<small>${escape(latest.quality || "—")}</small></td>
      <td>${escape(new Date(connection.firstSeen).toLocaleString("ru-RU"))}</td>
      <td>${escape(new Date(connection.lastSeen).toLocaleString("ru-RU"))}</td>
      <td>${number(inbound)} / ${number(outbound)}</td>
      <td>${number(rtt)} / ${number(jitter)}</td>
      <td>${number(loss)} %</td>
      <td>${escape(latest.reconnects)}</td>
    </tr>`;
  }).join("");

  const streamRows = history.connections.flatMap(connection => connection.latest.streams.map(stream => `<tr>
    <td><strong>${escape(connection.name)}</strong><small>${escape(connection.identity)}</small></td>
    <td>${escape(roleNames[connection.role])}</td>
    <td>${escape(stream.direction === "in" ? "Вход" : "Выход")} · ${escape(stream.kind === "audio" ? "Аудио" : "Видео")}<small>${escape(stream.source)}</small></td>
    <td>${escape(stream.name)}</td>
    <td>${escape(stream.codec || "—")}</td>
    <td>${number(stream.bitrateKbps)} кбит/с</td>
    <td>${stream.width && stream.height ? `${stream.width}×${stream.height}` : "—"} / ${number(stream.fps)} fps</td>
    <td>${number(stream.lossPct)} % / ${number(stream.jitterMs)} мс / ${number(stream.rttMs)} мс</td>
    <td>${escape(stream.protocol || "—")} · ${escape(stream.candidateType || "—")}</td>
    <td>${number(stream.freezes, 0)} / ${escape(stream.qualityLimitation || "—")}</td>
  </tr>`)).join("");

  const timelineRows = history.series.map(point => `<tr><td>${escape(new Date(point.at).toLocaleString("ru-RU"))}</td>${[point.inbound, point.outbound, point.audioIn, point.videoIn, point.audioOut, point.videoOut, point.loss, point.jitter, point.rtt].map(value => `<td>${number(value)}</td>`).join("")}<td>${point.connections}</td></tr>`).join("");

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CastLink — статистика ${escape(room)}</title><style>
  body{font:14px system-ui,-apple-system,sans-serif;margin:24px auto;padding:0 18px;max-width:1280px;color:#202332;background:#f4f5f9}
  h1,h2{margin-top:0}small{display:block;color:#666;overflow-wrap:anywhere}section{background:#fff;padding:18px;margin:18px 0;border-radius:12px;box-shadow:0 3px 16px #0000000d}
  .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.summary-card{background:#fff;padding:14px;border-radius:10px;border:1px solid #ddd}.summary-card span{display:block;color:#666;margin-bottom:7px}.summary-card strong{font-size:18px}
  .legend{display:flex;gap:12px;flex-wrap:wrap}.table{overflow:auto}svg{width:100%;background:#fafaff;border-radius:8px}
  table{border-collapse:collapse;width:100%;min-width:900px;font-size:12px}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd;vertical-align:top}th{position:sticky;top:0;background:#e9e5fc}tr:nth-child(even){background:#f8f8fc}
  .notice{padding:12px;border:1px solid #dccb86;border-radius:9px;background:#fff9dd;color:#5a4b15}
  @media(max-width:800px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style></head><body>
  <h1>CastLink · ${escape(room)}</h1>
  <p>${escape(new Date(history.from).toLocaleString("ru-RU"))} — ${escape(new Date(history.to).toLocaleString("ru-RU"))}</p>
  <p><strong>Выборка:</strong> ${escape(selection)} · Интервал графиков: ${history.bucketMs / 1000} с · Часовой пояс отчёта: ${escape(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
  <p class="notice">WebRTC telemetry поступает от клиентских браузеров и полезна для диагностики качества, но не является доверенным журналом безопасности.</p>
  <div class="summary">${summary}</div>
  ${chart("Битрейт", "кбит/с", [{ key: "inbound", label: "Вход", color: "#2266bb" }, { key: "outbound", label: "Выход", color: "#7952c9" }])}
  ${chart("Задержка", "мс", [{ key: "rtt", label: "RTT", color: "#d57521" }, { key: "jitter", label: "Jitter", color: "#008577" }])}
  ${chart("Потери", "%", [{ key: "loss", label: "Потери пакетов", color: "#c4334e" }])}
  <section class="table"><h2>Подключения</h2><table><thead><tr><th>Участник</th><th>Роль</th><th>Состояние</th><th>Начало</th><th>Последний замер</th><th>Вход / выход</th><th>RTT / jitter</th><th>Потери</th><th>Reconnect</th></tr></thead><tbody>${connectionRows || '<tr><td colspan="9">Нет подключений в выборке</td></tr>'}</tbody></table></section>
  <section class="table"><h2>Последние медиапотоки</h2><table><thead><tr><th>Участник</th><th>Роль</th><th>Направление</th><th>Поток</th><th>Кодек</th><th>Битрейт</th><th>Размер / FPS</th><th>Loss / jitter / RTT</th><th>Транспорт</th><th>Freeze / limit</th></tr></thead><tbody>${streamRows || '<tr><td colspan="10">Нет медиапотоков в выборке</td></tr>'}</tbody></table></section>
  <section class="table"><h2>Замеры по времени</h2><table><thead><tr><th>Время</th><th>Вход</th><th>Выход</th><th>Audio in</th><th>Video in</th><th>Audio out</th><th>Video out</th><th>Loss %</th><th>Jitter</th><th>RTT</th><th>Соединений</th></tr></thead><tbody>${timelineRows}</tbody></table></section>
  </body></html>`;
}
