"use client";

import { useI18n } from "@/components/I18nProvider";
import type { GuestAudioProfile, GuestNoiseSuppressionState } from "@/lib/guest-audio";

export function GuestNoiseSuppressionControl({ profile, state, confirmed, disabled, busy, onChange, asButton = false }: {
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
    {asButton ? <button type="button" className="button-secondary guest-audio-processing-toggle" role="switch" aria-checked={speech} disabled={disabled || busy} onClick={() => onChange(speech ? "raw" : "speech")}><span>{t("Шумоподавление и защита от эха")}</span><strong>{t(speech ? "Включено" : "Выключено")}</strong></button> : <label><input type="checkbox" role="switch" checked={speech} disabled={disabled || busy} onChange={event => onChange(event.target.checked ? "speech" : "raw")} />
      <span>{t("Шумоподавление и защита от эха")}</span>
    </label>}
    <p className="muted" role="status">{t(status)}</p>
  </div>;
}
