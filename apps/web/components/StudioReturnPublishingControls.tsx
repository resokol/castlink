"use client";

import type { ReactNode } from "react";

export function StudioReturnPublishingControls({
  studioOnly,
  modeBusy,
  role,
  hasSession,
  onAir,
  airBusy,
  returnActive,
  previewReady,
  screenShare,
  onToggleStudioOnly,
  onTogglePreview,
  onToggleOnAir,
}: {
  studioOnly: boolean;
  modeBusy: boolean;
  role: "primary" | "moderator" | "connecting";
  hasSession: boolean;
  onAir: boolean;
  airBusy: boolean;
  returnActive: boolean;
  previewReady: boolean;
  screenShare: ReactNode;
  onToggleStudioOnly: () => void;
  onTogglePreview: () => void;
  onToggleOnAir: () => void;
}) {
  return <div className="studio-quick-controls" aria-label="Управление Studio Return">
    <button
      type="button"
      aria-pressed={studioOnly}
      className={`room-mode-toggle${studioOnly ? " room-mode-active" : ""}`}
      disabled={modeBusy}
      onClick={onToggleStudioOnly}
    >Гости могут видеть только студию</button>
    <button
      disabled={role === "connecting" || !hasSession || onAir || airBusy}
      onClick={onTogglePreview}
    >{returnActive ? "Остановить проверку" : "Проверить Studio Return"}</button>
    <button
      className={`air-toggle ${onAir ? "air-toggle-live" : ""}`}
      aria-pressed={onAir}
      aria-label={onAir ? "Завершить эфир" : "Начать эфир"}
      disabled={(role === "primary" && (!returnActive || !previewReady)) || role === "connecting" || airBusy || !hasSession}
      onClick={onToggleOnAir}
    >ON AIR</button>
    {screenShare}
  </div>;
}
