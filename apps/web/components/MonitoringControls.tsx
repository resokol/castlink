"use client";


import { useI18n } from "@/components/I18nProvider";
import { defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";

export function MonitoringControls({ name, value = defaultMonitor, onChange }: {
  name: string; value?: MonitorPreference; onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="personal-monitor-controls">
    <button type="button" aria-pressed={value.audio} aria-label={t("Звук {name} только у меня", { name: name })}
      onClick={() => onChange({ audio: !value.audio })}>{value.audio ? t("Звук вкл.") : t("Звук выкл.")}</button>
    <button type="button" aria-pressed={value.video} aria-label={t("Видео {name} только у меня", { name: name })}
      onClick={() => onChange({ video: !value.video })}>{value.video ? t("Видео вкл.") : t("Видео выкл.")}</button>
    <label>{t("Громкость")} <input aria-label={t("Громкость {name} только у меня", { name: name })} type="range" min="0" max="100"
      value={value.volume} onChange={(event) => onChange({ volume: Number(event.target.value) })} />
      <output>{value.volume}%</output></label>
  </div>;
}
