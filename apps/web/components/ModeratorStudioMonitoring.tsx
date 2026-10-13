"use client";


import { useI18n } from "@/components/I18nProvider";
import type { MonitorPreference } from "@/lib/personal-monitoring";

export function ModeratorStudioMonitoring({
  value,
  onChange,
}: {
  value: MonitorPreference;
  onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="studio-moderator-listen">
    <p className="muted">{t("Устройства управляются основной студией. Звук опубликованного эфира слышен только у вас.")}</p>
    <div className="personal-monitor-controls">
      <button type="button" aria-pressed={value.audio} onClick={() => onChange({ audio: !value.audio })}>
        {value.audio ? t("Не слушать студию") : t("Слушать студию")}
      </button>
      <button type="button" aria-label={t("Видео основной студии только у меня")} aria-pressed={value.video} onClick={() => onChange({ video: !value.video })}>
        {value.video ? t("Видео вкл.") : t("Видео выкл.")}
      </button>
      <label>{t("Личная громкость")} <input aria-label={t("Личная громкость Studio Return")} type="range" min="0" max="100" value={value.volume} onChange={event => onChange({ volume: Number(event.target.value) })} />
        <output>{value.volume}%</output>
      </label>
    </div>
  </div>;
}
