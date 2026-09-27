import type { HistoryResponse, MetricPoint } from "./telemetry-types";
const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
export function statisticsReport(history: HistoryResponse, room: string, selection: string) {
  const chart = (title: string, unit: string, fields: { key: keyof MetricPoint; label: string; color: string }[]) => {
    const values = history.series.flatMap(p => fields.map(f => p[f.key])).filter((v): v is number => v !== null);
    const max = Math.max(1, ...values), width = 1000, height = 180;
    const lines = fields.map(field => {
      let active = false;
      const path = history.series.map(p => {
        const value = p[field.key]; if (value === null) { active = false; return ""; }
        const cmd = active ? "L" : "M"; active = true;
        return `${cmd}${(50 + (p.at - history.from) / Math.max(1, history.to - history.from) * (width - 60)).toFixed(1)},${(height - 20 - value / max * (height - 40)).toFixed(1)}`;
      }).join(" ");
      return `<path d="${path}" fill="none" stroke="${field.color}" stroke-width="2"/>`;
    }).join("");
    return `<section><h2>${title} (${unit})</h2><p>${fields.map(f => `<span style="color:${f.color}">● ${f.label}</span>`).join(" · ")}</p><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><text x="0" y="25">${escape(number(max))}</text><text x="20" y="160">0</text>${lines}</svg></section>`;
  };
  const rows = history.series.map(p => `<tr><td>${escape(new Date(p.at).toLocaleString("ru-RU"))}</td>${[p.inbound,p.outbound,p.loss,p.jitter,p.rtt].map(v=>`<td>${number(v)}</td>`).join("")}<td>${p.connections}</td></tr>`).join("");
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CastLink — статистика ${escape(room)}</title><style>body{font:15px system-ui;margin:24px auto;padding:0 18px;max-width:1100px;color:#202332;background:#f4f5f9}section{background:white;padding:18px;margin:18px 0;border-radius:12px}svg{width:100%;background:#fafaff}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px;text-align:right;border-bottom:1px solid #ddd}th:first-child,td:first-child{text-align:left}th{position:sticky;top:0;background:#e9e5fc}tr:nth-child(even){background:#f5f5fa}.table{overflow:auto}small{color:#555}</style><h1>CastLink · ${escape(room)}</h1><p>${escape(new Date(history.from).toLocaleString("ru-RU"))} — ${escape(new Date(history.to).toLocaleString("ru-RU"))}</p><p>${escape(selection)} · Интервал: ${history.bucketMs / 1000} с · Часовой пояс: ${escape(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p><small>Вход — от сервера к клиентам; выход — от клиентов к серверу. По всем соединениям битрейты суммируются; задержки и потери усредняются. Прочерк и разрыв графика означают отсутствие замера, а не нулевое значение.</small>${chart("Битрейт", "кбит/с", [{key:"inbound",label:"Вход",color:"#2266bb"},{key:"outbound",label:"Выход",color:"#7952c9"}])}${chart("Задержка", "мс", [{key:"rtt",label:"RTT",color:"#d57521"},{key:"jitter",label:"Jitter",color:"#008577"}])}${chart("Потери", "%", [{key:"loss",label:"Потери пакетов",color:"#c4334e"}])}<section class="table"><h2>Замеры с шагом 2 секунды</h2><table><thead><tr><th>Время</th><th>Вход, кбит/с</th><th>Выход, кбит/с</th><th>Потери, %</th><th>Jitter, мс</th><th>RTT, мс</th><th>Соединений</th></tr></thead><tbody>${rows}</tbody></table></section></html>`;
}
