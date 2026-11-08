"use client";


import { useI18n } from "@/components/I18nProvider";
import { StudioConsoleIcon } from "./StudioConsoleIcon";
import type { ReactNode } from "react";

export function StudioReturnPublishingControls({
  presentation = "default",
  settingsTarget,
  settingsOpen = false,
  outputMuted = false,
  onToggleOutputMuted,
  studioOnly,
  modeBusy,
  role,
  hasSession,
  onAir,
  airBusy,
  screenShare,
  onToggleStudioOnly,
  onToggleOnAir,
}: {
  presentation?: "default" | "console";
  settingsTarget?: string;
  settingsOpen?: boolean;
  outputMuted?: boolean;
  onToggleOutputMuted?: () => void;
  studioOnly: boolean;
  modeBusy: boolean;
  role: "primary" | "moderator" | "connecting";
  hasSession: boolean;
  onAir: boolean;
  airBusy: boolean;
  screenShare: ReactNode;
  onToggleStudioOnly: () => void;
  onToggleOnAir: () => void;
}) {
  const { t, locale } = useI18n();
  if(presentation === "console") return <div className="studio-console-publishing" aria-label={t("Управление Studio Return")}>
    <div className="studio-console-air-row"><button type="button" className={`air-toggle ${onAir ? "air-toggle-live" : ""}`} aria-pressed={onAir} aria-label={t(onAir ? "Завершить эфир" : "Начать эфир")} disabled={role === "connecting" || airBusy || !hasSession} onClick={onToggleOnAir}><i aria-hidden="true"/>ON AIR</button>
    {onToggleOutputMuted && <button type="button" className="studio-console-sound" aria-label={t(outputMuted ? "Выход: звук выключен" : "Выключить звук выхода")} title={t(outputMuted ? "Выход: звук выключен" : "Выключить звук выхода")} aria-pressed={outputMuted} disabled={!hasSession || role === "connecting"} onClick={onToggleOutputMuted}><StudioConsoleIcon kind="sound"/></button>}</div>
    <div className="studio-console-program-actions">{settingsTarget&&<button type="button" className="studio-settings-toggle" popoverTarget={settingsTarget} aria-controls={settingsTarget} aria-haspopup="dialog" aria-expanded={settingsOpen}><StudioConsoleIcon kind="devices"/>{t("Устройства")}</button>}<button type="button" className={`room-mode-toggle${studioOnly?" room-mode-active":""}`} aria-pressed={studioOnly} aria-label={t("Гости могут видеть только студию")} title={t("Гости могут видеть только студию")} disabled={modeBusy} onClick={onToggleStudioOnly}>{t(studioOnly?"Только студия":"Общий просмотр")}</button></div>
    <div className="studio-console-share">{screenShare}</div>
  </div>;
  return <div className="studio-quick-controls" aria-label={t("Управление Studio Return")}>
    <button
      type="button"
      aria-pressed={studioOnly}
      className={`room-mode-toggle${studioOnly ? " room-mode-active" : ""}`}
      disabled={modeBusy}
      onClick={onToggleStudioOnly}
    >{t("Гости могут видеть только студию")}</button>
    {screenShare}
    {onToggleOutputMuted && <button type="button" aria-pressed={outputMuted} className={outputMuted ? "room-mode-active" : ""} disabled={!hasSession || role === "connecting"} onClick={onToggleOutputMuted}>{t(outputMuted ? "Выход: звук выключен" : "Выключить звук выхода")}</button>}
    <button
      className={`air-toggle ${onAir ? "air-toggle-live" : ""}`}
      aria-pressed={onAir}
      aria-label={onAir ? t("Завершить эфир") : t("Начать эфир")}
      disabled={role === "connecting" || airBusy || !hasSession}
      onClick={onToggleOnAir}
    >ON AIR</button>
  </div>;
}
