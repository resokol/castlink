"use client";


import { useI18n } from "@/components/I18nProvider";
import type { ReactNode } from "react";

export function StudioReturnPublishingControls({
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
