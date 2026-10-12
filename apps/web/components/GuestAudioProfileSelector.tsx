"use client";
import { guestAudioProfile, type GuestAudioProfile } from "@/lib/guest-audio";

export function GuestAudioProfileSelector({ value, onChange, disabled = false, busy = false }: { value?: GuestAudioProfile; onChange: (profile: GuestAudioProfile) => void; disabled?: boolean; busy?: boolean }) {
  const profile = guestAudioProfile(value);
  return <div>
    <label>Режим микрофона <select aria-label="Режим микрофона" value={profile} disabled={disabled || busy} onChange={event => onChange(guestAudioProfile(event.target.value))}>
      <option value="speech">Обычная речь</option>
      <option value="raw">Оригинальный звук</option>
    </select></label>
    {profile === "raw" && <p className="muted">Без шумоподавления и автоматического усиления. Используйте наушники, чтобы избежать эха.</p>}
    {busy && <small role="status">Переключение микрофона…</small>}
  </div>;
}
