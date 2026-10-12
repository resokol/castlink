"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { ParticipantRenameButton } from "./ParticipantRenameButton";
import { MonitoringControls } from "@/components/MonitoringControls";
import { RotateVideoButton } from "@/components/RotateVideoButton";
import { videoBitrateOptions } from "@/lib/video-quality";
import type { MonitorPreference } from "@/lib/personal-monitoring";
import type { ReactNode } from "react";

export type GuestVideoCardData = {
  identity: string;
  name: string;
  resolution: string;
  bitrateKbps: number;
  packetLoss: number;
  jitterMs: number;
  rttMs: number;
  stability: "Хорошая" | "Средняя" | "Плохая";
  camera: boolean;
  microphone: boolean;
  cameraDevice?: string;
  cpu?: string;
  gpu?: string;
  platform?: string;
  sampleRate?: number;
};

export function GuestVideoCard({
  guest,
  roomName,
  studioId = "studio-default",
  outputUrl,
  screenShareUrl,
  screenShareActive = false,
  copied,
  screenShareCopied = false,
  receiveBitrate,
  preference,
  preview,
  meter,
  mediaControls,
  onCopy,
  onCopyScreenShare,
  onQualityChange,
  onMonitoringChange,
}: {
  guest: GuestVideoCardData;
  roomName: string;
  studioId?: string;
  outputUrl: string;
  screenShareUrl?: string;
  screenShareActive?: boolean;
  copied: boolean;
  screenShareCopied?: boolean;
  receiveBitrate: number;
  preference: MonitorPreference;
  preview: ReactNode;
  meter: ReactNode;
  mediaControls?: ReactNode;
  onCopy: () => void;
  onCopyScreenShare?: () => void;
  onQualityChange: (bitrateKbps: number) => void;
  onMonitoringChange: (patch: Partial<MonitorPreference>) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="panel studio-video-card">
    <div className="guest-card-heading">
      <h2>{guest.name}</h2>
      <span className="guest-media-state">
        <span title={guest.camera ? t("Камера включена") : t("Камера выключена")}>{guest.camera ? "◉" : "○"} {t("Видео")}</span>
        <span title={guest.microphone ? t("Микрофон включён") : t("Микрофон выключен")}>{guest.microphone ? "◖" : "◌"} {t("Аудио")}</span>
      </span>
    </div>
    {preview}
    <div className="guest-preview-actions">
      <a className="button-link guest-output-open" href={outputUrl} target="_blank" rel="noreferrer">{t("Открыть выход")}</a>
      <button className="guest-output-copy" title={t("Индивидуальная ссылка на видео и аудио участника")} onClick={onCopy}>{copied ? t("Скопировано") : t("Копировать URL")}</button>
      <ParticipantRenameButton studioId={studioId} roomName={roomName} identity={guest.identity} name={guest.name} />
      <div className="guest-card-monitoring">
        <div className="guest-card-tools"><div className="guest-card-rotation"><RotateVideoButton roomName={roomName} studioId={studioId} identity={guest.identity} /></div>{mediaControls}</div>
        <label className="guest-card-quality" title={t("Лимит кодировщика камеры для всей комнаты; не постоянный CBR и не полный сетевой трафик")}>{t("Лимит камеры")}<select aria-label={t("Битрейт участника {name}", { name: guest.name })} value={receiveBitrate} onChange={event => onQualityChange(Number(event.target.value))}>
            {videoBitrateOptions(receiveBitrate).map(value => <option key={value} value={value}>{value.toLocaleString(locale)} {t("кбит/с")}</option>)}
          </select>
        </label>
        <MonitoringControls name={guest.name} value={preference} onChange={onMonitoringChange} />
      </div>
    </div>
    {screenShareActive && screenShareUrl && <div className="guest-screen-share-output">
      <div><strong>{t("Экран участника")}</strong><small>{t("Отдельный input для vMix / Browser Source")}</small></div>
      <div className="guest-screen-share-actions">
        <a className="button-link" href={screenShareUrl} target="_blank" rel="noreferrer">{t("Открыть экран")}</a>
        <button type="button" onClick={onCopyScreenShare}>{screenShareCopied ? t("Скопировано") : t("Копировать URL экрана")}</button>
      </div>
    </div>}
    <div className="guest-card-meter">{meter}</div>
    <details className="guest-diagnostics"><summary>{t("Устройства и качество соединения")}</summary><div className="guest-card-details" aria-label={t("Сведения об участнике {name}", { name: guest.name })}>
      <div><b>{t("Разрешение")}</b><span>{guest.resolution}</span></div>
      <div><b>{t("Приём камеры · факт")}</b><span>{guest.bitrateKbps ? t("{bitrateKbps} кбит/с", { bitrateKbps: guest.bitrateKbps }) : "—"}</span></div>
      <div><b>{t("Сеть")}</b><span className={`net net-${guest.stability === "Хорошая" ? "good" : guest.stability === "Средняя" ? "mid" : "bad"}`}>{t(guest.stability)}</span></div>
      <div><b>{t("Камера")}</b><span>{guest.cameraDevice === "Неизвестная камера" ? t("Неизвестная камера") : guest.cameraDevice || "—"}</span></div>
      <div><b>CPU</b><span>{guest.cpu ? translateWorkspaceMessage(t, guest.cpu) : "—"}</span></div>
      <div><b>GPU</b><span>{guest.gpu === "Недоступно браузеру" ? t("Недоступно браузеру") : guest.gpu || "—"}</span></div>
      <div><b>{t("ОС")}</b><span>{guest.platform || "—"}</span></div>
      <div><b>RTT / Jitter</b><span>{guest.rttMs} / {guest.jitterMs} {t("мс")}</span></div>
      <div><b>{t("Потери / Аудио")}</b><span>{guest.packetLoss} {t("пак. /")} {guest.sampleRate ? `${guest.sampleRate} Hz` : "—"}</span></div>
    </div></details>
  </div>;
}
