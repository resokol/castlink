"use client";

import { useI18n } from "@/components/I18nProvider";
import { GuestAudioProfileSelector } from "./GuestAudioProfileSelector";
import type { GuestAudioProfile, GuestNoiseSuppressionState } from "@/lib/guest-audio";

export function GuestNoiseSuppressionControl({ profile, state, confirmed, disabled, busy, onChange }: {
  asButton?: boolean;
  profile: GuestAudioProfile;
  state: GuestNoiseSuppressionState;
  confirmed: boolean;
  disabled: boolean;
  busy: boolean;
  onChange: (profile: GuestAudioProfile) => void;
}) {
  const { t } = useI18n();
  const speech = profile === "speech";
  const status = busy ? "Применяем обработку микрофона…"
    : state === "pending" ? "Обработка применится при включении микрофона."
    : !confirmed ? "Браузер не подтвердил обработку микрофона."
    : speech ? "Шумоподавление и защита от эха включены."
    : "Оригинальный звук. Используйте наушники, чтобы избежать эха.";
  return <div className="guest-noise-control" aria-busy={busy}>
    <GuestAudioProfileSelector value={profile} disabled={disabled || busy} onChange={onChange} />
    <p className="muted" role="status">{t(status)}</p>
  </div>;
}
