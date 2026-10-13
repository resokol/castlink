"use client";
import { useI18n } from "@/components/I18nProvider";
import { guestAudioProfile, type GuestAudioProfile } from "@/lib/guest-audio";

export function GuestAudioProfileSelector({ value, onChange, disabled = false, busy = false }: { value?: GuestAudioProfile; onChange: (profile: GuestAudioProfile) => void; disabled?: boolean; busy?: boolean }) {
  const { t, locale } = useI18n();
  const profile = guestAudioProfile(value);
  return <div>
    <label>{t("Режим микрофона")} <select aria-label={t("Режим микрофона")} value={profile} disabled={disabled || busy} onChange={event => onChange(guestAudioProfile(event.target.value))}>
      <option value="speech">{t("Обычная речь")}</option>
      <option value="raw">{t("Оригинальный звук")}</option>
    </select></label>
    {profile === "raw" && <p className="muted">{t("Без шумоподавления и автоматического усиления. Используйте наушники, чтобы избежать эха.")}</p>}
    {busy && <small role="status">{t("Переключение микрофона…")}</small>}
  </div>;
}
