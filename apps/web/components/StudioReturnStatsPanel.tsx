"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { STUDIO_FRAME_RATES, studioVideoBitrateOptions as videoBitrateOptions, type StudioFrameRate, type StudioVideoCodec } from "@/lib/video-quality";
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
  videoCodec = "vp8",
  simulcast = true,
  onAir = false,
  onVideoModeChange,
  studioControlError,
  controlPollError,
  controlHeartbeatError,
  onQualityChange,
  headerActions,
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
  onAir?: boolean;
  onVideoModeChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
  studioControlError: string;
  controlPollError: string;
  controlHeartbeatError: string;
  onQualityChange: (fps: StudioFrameRate, bitrate: number) => void;
  headerActions?: ReactNode;
  mainView?: StudioOutboundView;
  watchView?: StudioOutboundView;
  graphSourceMode?: StudioGraphSourceMode;
  graphSource?: StudioGraphSource;
  onGraphSourceChange?: (source: StudioGraphSourceMode) => void;
}) {
  const { t, locale } = useI18n();
  const sourceLabel = graphSource === "watch" ? t("По ссылке /watch") : t("В комнату");
  const rateText = (view?: StudioOutboundView) => view?.status === "live" && view.sample ? t("{videoKbps} кбит/с", { videoKbps: view.sample.videoKbps }) : "—";
  return <div className="panel return-stats">
    <div className="return-stats-heading"><strong>{t("Исходящий поток студии")}</strong>{headerActions}</div>
    {mainView && watchView && <>
      <div className="return-output-controls">
        <label>{t("Измерения")}<select aria-label={t("Источник измерений потока")} value={graphSourceMode} onChange={event => onGraphSourceChange?.(event.target.value as StudioGraphSourceMode)}>
          <option value="auto">{t("Авто")}</option><option value="main">{t("В комнату")}</option><option value="watch">{t("По ссылке /watch")}</option>
        </select></label>
        <small className="muted">{t("Измерено · В комнату:")} {rateText(mainView)} {t("· По ссылке /watch:")} {rateText(watchView)}</small>
      </div>
      <p className="muted" role="status">{t("График:")} {sourceLabel}{graphSourceMode === "auto" ? t(" · Авто") : ""}. {translateWorkspaceMessage(t, statusText)}</p>
      {mainView.status === "live" && mainView.sample?.videoKbps === 0 && <small className="muted">{t("Измеренный видеобитрейт основной комнаты: 0 кбит/с.")}</small>}
    </>}
    {!mainView && role === "moderator" && <p className="muted" role="status">{translateWorkspaceMessage(t, statusText)}</p>}
    <div className="return-stat-grid">
      <span><b>{t("Разрешение")}</b><strong>{hasSample ? stats.resolution : "—"}</strong></span>
      <span><b>{t("Частота кадров")}</b><strong>{hasSample ? `${stats.fps} fps` : "—"}</strong></span>
      <span><b>{t("Измеренный видеобитрейт")}</b><strong>{hasSample ? t("{videoKbps} кбит/с", { videoKbps: stats.videoKbps }) : "—"}</strong></span>
      <span><b>{t("Аудиобитрейт")}</b><strong>{hasSample ? t("{audioKbps} кбит/с", { audioKbps: stats.audioKbps }) : "—"}</strong></span>
    </div>
    <div className="bitrate-chart" aria-label={t("Видеобитрейт за последние 2 минуты, шкала до 25 000 кбит/с")}>
      <div><b>{t("Измеренный видеобитрейт")}</b><small>{sourceLabel}{t(", сумма видеослоёв · каждый поток отдельно · каждые 2 сек · последние 2 мин")}</small></div>
      <svg viewBox="0 0 300 210" role="img" aria-label={hasSample ? t("Текущий видеобитрейт {videoKbps} килобит в секунду", { videoKbps: stats.videoKbps }) : translateWorkspaceMessage(t, statusText)} preserveAspectRatio="none">
        {[500, 5000, 10000, 15000, 20000, 25000].map(value => {
          const y = 198 - value / 25000 * 192;
          return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString(locale)}</text></g>;
        })}
        {historyLength > 1 && <polyline className="bitrate-chart-line" points={bitratePoints} />}
      </svg>
    </div>
    <div className="return-output-controls">
      <label>{t("Частота кадров")}<select aria-label={t("Частота кадров студии")} disabled={!clientReady || airBusy} value={fps} onChange={event => onQualityChange(Number(event.target.value) as StudioFrameRate, bitrate)}>{STUDIO_FRAME_RATES.map(value => <option key={value} value={value}>{value} FPS</option>)}</select></label>
      <label>{t("Общий лимит видеобитрейта (эфир и ссылка)")}<select aria-label={t("Общий лимит видеобитрейта (эфир и ссылка)")} aria-describedby="studio-return-bitrate-help" disabled={!clientReady || airBusy} value={bitrate} onChange={event => onQualityChange(fps, Number(event.target.value))}>{videoBitrateOptions(bitrate).map(value => <option key={value} value={value}>{value.toLocaleString(locale)} {t("кбит/с")}</option>)}</select></label>
      <StudioVideoModeControls videoCodec={videoCodec} simulcast={simulcast} disabled={!clientReady || airBusy || onAir} onChange={onVideoModeChange} />
      <small id="studio-return-bitrate-help" className="muted">{t("Лимит каждого потока отдельно: Studio Return и /watch. При зрителях суммарный видеотрафик может достигать удвоенного лимита.")}</small>
    </div>
    {studioControlError && <p className="studio-control-error" role="alert">{translateWorkspaceMessage(t, studioControlError)}</p>}
    {controlPollError && <p className="studio-control-error" role="alert">{t("Связь с панелью:")} {translateWorkspaceMessage(t, controlPollError)}</p>}
    {controlHeartbeatError && <p className="studio-control-error" role="alert">{t("Продление управления:")} {translateWorkspaceMessage(t, controlHeartbeatError)}</p>}
  </div>;
}
