"use client";

import { STUDIO_FRAME_RATES, videoBitrateOptions, type StudioFrameRate } from "@/lib/video-quality";

export type StudioReturnStats = {
  resolution: string;
  videoKbps: number;
  audioKbps: number;
  fps: number;
};

export function StudioReturnStatsPanel({
  role,
  statusText,
  hasSample,
  stats,
  bitratePoints,
  historyLength,
  clientReady,
  airBusy,
  fps,
  bitrate,
  studioControlError,
  controlPollError,
  controlHeartbeatError,
  onQualityChange,
}: {
  role: "primary" | "moderator" | "connecting";
  statusText: string;
  hasSample: boolean;
  stats: StudioReturnStats;
  bitratePoints: string;
  historyLength: number;
  clientReady: boolean;
  airBusy: boolean;
  fps: StudioFrameRate;
  bitrate: number;
  studioControlError: string;
  controlPollError: string;
  controlHeartbeatError: string;
  onQualityChange: (fps: StudioFrameRate, bitrate: number) => void;
}) {
  return <div className="panel return-stats">
    <div className="return-stats-heading"><strong>Исходящий поток студии</strong></div>
    {role === "moderator" && <p className="muted" role="status">{statusText}</p>}
    <div className="return-stat-grid">
      <span><b>Разрешение</b><strong>{hasSample ? stats.resolution : "—"}</strong></span>
      <span><b>Частота кадров</b><strong>{hasSample ? `${stats.fps} fps` : "—"}</strong></span>
      <span><b>Видеобитрейт</b><strong>{hasSample ? `${stats.videoKbps} кбит/с` : "—"}</strong></span>
      <span><b>Аудиобитрейт</b><strong>{hasSample ? `${stats.audioKbps} кбит/с` : "—"}</strong></span>
    </div>
    <div className="bitrate-chart" aria-label="Видеобитрейт за последние 2 минуты, шкала до 12 000 кбит/с">
      <div><b>Видеобитрейт</b><small>обновление каждые 2 сек · последние 2 мин</small></div>
      <svg viewBox="0 0 300 210" role="img" aria-label={hasSample ? `Текущий видеобитрейт ${stats.videoKbps} килобит в секунду` : statusText} preserveAspectRatio="none">
        {[500, ...Array.from({ length: 12 }, (_, index) => (index + 1) * 1000)].map(value => {
          const y = 198 - value / 12000 * 192;
          return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString("ru-RU")}</text></g>;
        })}
        {historyLength > 1 && <polyline className="bitrate-chart-line" points={bitratePoints} />}
      </svg>
    </div>
    <div className="return-output-controls">
      <label>Частота кадров<select aria-label="Частота кадров студии" disabled={!clientReady || airBusy} value={fps} onChange={event => onQualityChange(Number(event.target.value) as StudioFrameRate, bitrate)}>{STUDIO_FRAME_RATES.map(value => <option key={value} value={value}>{value} FPS</option>)}</select></label>
      <label>Общий лимит видеобитрейта (эфир и ссылка)<select aria-label="Общий лимит видеобитрейта (эфир и ссылка)" aria-describedby="studio-return-bitrate-help" disabled={!clientReady || airBusy} value={bitrate} onChange={event => onQualityChange(fps, Number(event.target.value))}>{videoBitrateOptions(bitrate).map(value => <option key={value} value={value}>{value.toLocaleString("ru-RU")} кбит/с</option>)}</select></label>
      <small id="studio-return-bitrate-help" className="muted">Ограничивает видеобитрейт Studio Return и дополнительного потока ссылки просмотра.</small>
    </div>
    {studioControlError && <p className="studio-control-error" role="alert">{studioControlError}</p>}
    {controlPollError && <p className="studio-control-error" role="alert">Связь с панелью: {controlPollError}</p>}
    {controlHeartbeatError && <p className="studio-control-error" role="alert">Продление управления: {controlHeartbeatError}</p>}
  </div>;
}
