"use client";

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
  outputUrl,
  copied,
  receiveBitrate,
  preference,
  preview,
  meter,
  onCopy,
  onQualityChange,
  onMonitoringChange,
}: {
  guest: GuestVideoCardData;
  roomName: string;
  outputUrl: string;
  copied: boolean;
  receiveBitrate: number;
  preference: MonitorPreference;
  preview: ReactNode;
  meter: ReactNode;
  onCopy: () => void;
  onQualityChange: (bitrateKbps: number) => void;
  onMonitoringChange: (patch: Partial<MonitorPreference>) => void;
}) {
  return <div className="panel studio-video-card">
    <div className="guest-card-heading">
      <h2>{guest.name}</h2>
      <span className="guest-media-state">
        <span title={guest.camera ? "Камера включена" : "Камера выключена"}>{guest.camera ? "◉" : "○"} Видео</span>
        <span title={guest.microphone ? "Микрофон включён" : "Микрофон выключен"}>{guest.microphone ? "◖" : "◌"} Аудио</span>
      </span>
    </div>
    {preview}
    <div className="guest-preview-actions">
      <a className="button-link" href={outputUrl} target="_blank" rel="noreferrer">Открыть</a>
      <button onClick={onCopy}>{copied ? "Скопировано" : "Копировать URL"}</button>
      <div className="guest-card-monitoring">
        <RotateVideoButton roomName={roomName} identity={guest.identity} />
        <label className="guest-card-quality">Битрейт
          <select aria-label={`Битрейт участника ${guest.name}`} value={receiveBitrate} onChange={event => onQualityChange(Number(event.target.value))}>
            {videoBitrateOptions(receiveBitrate).map(value => <option key={value} value={value}>{value.toLocaleString("ru-RU")} кбит/с</option>)}
          </select>
        </label>
        <MonitoringControls name={guest.name} value={preference} onChange={onMonitoringChange} />
      </div>
    </div>
    <div className="guest-card-meter">{meter}</div>
    <div className="guest-card-details" aria-label={`Сведения об участнике ${guest.name}`}>
      <div><b>Разрешение</b><span>{guest.resolution}</span></div>
      <div><b>Факт. битрейт</b><span>{guest.bitrateKbps ? `${guest.bitrateKbps} кбит/с` : "—"}</span></div>
      <div><b>Сеть</b><span className={`net net-${guest.stability === "Хорошая" ? "good" : guest.stability === "Средняя" ? "mid" : "bad"}`}>{guest.stability}</span></div>
      <div><b>Камера</b><span>{guest.cameraDevice || "—"}</span></div>
      <div><b>CPU</b><span>{guest.cpu || "—"}</span></div>
      <div><b>GPU</b><span>{guest.gpu || "—"}</span></div>
      <div><b>ОС</b><span>{guest.platform || "—"}</span></div>
      <div><b>RTT / Jitter</b><span>{guest.rttMs} / {guest.jitterMs} мс</span></div>
      <div><b>Потери / Аудио</b><span>{guest.packetLoss} пак. / {guest.sampleRate ? `${guest.sampleRate} Hz` : "—"}</span></div>
    </div>
  </div>;
}
