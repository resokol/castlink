"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { DEFAULT_STUDIO_VIDEO_CODEC, STUDIO_FRAME_RATES, studioVideoBitrateOptions as videoBitrateOptions, type StudioFrameRate, type StudioVideoCodec } from "@/lib/video-quality";
import { StudioVideoModeControls } from "@/components/StudioVideoModeControls";
import type { ReactNode } from "react";
import type { StudioGraphSource, StudioGraphSourceMode, StudioOutboundView } from "@/lib/studio-outbound-stats";

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
  videoCodec = DEFAULT_STUDIO_VIDEO_CODEC,
  simulcast = true,
  h265Supported = false,
  onAir = false,
  onVideoModeChange,
  studioControlError,
  controlPollError,
  controlHeartbeatError,
  onQualityChange,
  headerActions,
  monitoringControls,
  mainView,
  watchView,
  graphSourceMode = "auto",
  graphSource = "main",
  onGraphSourceChange,
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
  videoCodec?: StudioVideoCodec;
  simulcast?: boolean;
  h265Supported?: boolean;
  onAir?: boolean;
  onVideoModeChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
  studioControlError: string;
  controlPollError: string;
  controlHeartbeatError: string;
  onQualityChange: (fps: StudioFrameRate, bitrate: number) => void;
  headerActions?: ReactNode;
  monitoringControls?: ReactNode;
  mainView?: StudioOutboundView;
  watchView?: StudioOutboundView;
  graphSourceMode?: StudioGraphSourceMode;
  graphSource?: StudioGraphSource;
  onGraphSourceChange?: (source: StudioGraphSourceMode) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="panel return-stats">
    <div className="return-stats-heading"><strong>{t("Исходящий поток студии")}</strong>{headerActions}</div>
    <div className="return-stats-diagnostics">
      <div className="return-stat-grid">
        <span><b>{t("Разрешение")}</b><strong>{hasSample ? stats.resolution : "—"}</strong></span>
        <span><b>{t("Частота кадров")}</b><strong>{hasSample ? `${stats.fps} fps` : "—"}</strong></span>
        <span><b>{t("Измеренный видеобитрейт")}</b><strong>{hasSample ? t("{videoKbps} кбит/с", { videoKbps: stats.videoKbps }) : "—"}</strong></span>
        <span><b>{t("Аудиобитрейт")}</b><strong>{hasSample ? t("{audioKbps} кбит/с", { audioKbps: stats.audioKbps }) : "—"}</strong></span>
      </div>
      <div className="bitrate-chart" aria-label={t("Видеобитрейт: последние 60 замеров, шкала до 25 000 кбит/с")}>
        <div><b>{t("Измеренный видеобитрейт")}</b> <small>{t(graphSource === "watch" ? "По ссылке /watch" : "В комнату")}</small></div>
        <svg viewBox="0 0 300 210" role="img" aria-label={hasSample ? t("Текущий видеобитрейт {videoKbps} килобит в секунду", { videoKbps: stats.videoKbps }) : translateWorkspaceMessage(t, statusText)} preserveAspectRatio="none">
          {[500, 5000, 10000, 15000, 20000, 25000].map(value => {
            const y = 198 - value / 25000 * 192;
            return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString(locale)}</text></g>;
          })}
          {historyLength > 1 && <polyline className="bitrate-chart-line" points={bitratePoints} />}
        </svg>
      </div>
      {monitoringControls}
      {studioControlError && <p className="studio-control-error" role="alert">{translateWorkspaceMessage(t, studioControlError)}</p>}
      {controlPollError && <p className="studio-control-error" role="alert">{t("Связь с панелью:")} {translateWorkspaceMessage(t, controlPollError)}</p>}
      {controlHeartbeatError && <p className="studio-control-error" role="alert">{t("Продление управления:")} {translateWorkspaceMessage(t, controlHeartbeatError)}</p>}
    </div>
    <div className="return-output-controls">
      <label>{t("Частота кадров")}<select aria-label={t("Частота кадров студии")} disabled={!clientReady || airBusy} value={fps} onChange={event => onQualityChange(Number(event.target.value) as StudioFrameRate, bitrate)}>{STUDIO_FRAME_RATES.map(value => <option key={value} value={value}>{value} FPS</option>)}</select></label>
      <label>{t("Общий лимит видеобитрейта (эфир и ссылка)")}<select aria-label={t("Общий лимит видеобитрейта (эфир и ссылка)")} disabled={!clientReady || airBusy} value={bitrate} onChange={event => onQualityChange(fps, Number(event.target.value))}>{videoBitrateOptions(bitrate).map(value => <option key={value} value={value}>{value.toLocaleString(locale)} {t("кбит/с")}</option>)}</select></label>
      <StudioVideoModeControls h265Supported={h265Supported} videoCodec={videoCodec} simulcast={simulcast} disabled={!clientReady || airBusy || onAir} onChange={onVideoModeChange} showHelp={false} />
    </div>

  </div>;
}
