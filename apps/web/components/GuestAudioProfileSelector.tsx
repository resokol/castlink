"use client";
import { useId } from "react";
import { useI18n } from "@/components/I18nProvider";
import { guestAudioProfile, type GuestAudioProfile } from "@/lib/guest-audio";
import styles from "./GuestAudioProfileSelector.module.css";

export function GuestAudioProfileSelector({ value, onChange, disabled = false, busy = false }: { value?: GuestAudioProfile; onChange: (profile: GuestAudioProfile) => void; disabled?: boolean; busy?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const enabled = guestAudioProfile(value) === "speech";
  return <div className={styles.root} aria-busy={busy}>
    <label className={styles.control}>
      <span className={styles.copy}>
        <span id={`${id}-label`} className={styles.title}>{t("Шумоподавление и эхо")}</span>
        <span id={`${id}-hint`} className={styles.hint}>{enabled ? t("Включено — подавляет фоновый шум и эхо.") : t("Выключено — оригинальный звук. Используйте наушники.")}</span>
      </span>
      <input className={styles.switch} type="checkbox" role="switch" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} checked={enabled} disabled={disabled || busy} onChange={event => onChange(event.target.checked ? "speech" : "raw")} />
    </label>
    {busy && <small className={styles.hint} role="status">{t("Переключение микрофона…")}</small>}
  </div>;
}
