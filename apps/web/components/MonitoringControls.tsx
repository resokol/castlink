"use client";

import { defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";

export function MonitoringControls({ name, value = defaultMonitor, onChange }: {
  name: string; value?: MonitorPreference; onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  return <div className="personal-monitor-controls">
    <button type="button" aria-pressed={value.audio} aria-label={`Звук ${name} только у меня`}
      onClick={() => onChange({ audio: !value.audio })}>{value.audio ? "Звук вкл." : "Звук выкл."}</button>
    <button type="button" aria-pressed={value.video} aria-label={`Видео ${name} только у меня`}
      onClick={() => onChange({ video: !value.video })}>{value.video ? "Видео вкл." : "Видео выкл."}</button>
    <label>Громкость <input aria-label={`Громкость ${name} только у меня`} type="range" min="0" max="100"
      value={value.volume} onChange={(event) => onChange({ volume: Number(event.target.value) })} />
      <output>{value.volume}%</output></label>
  </div>;
}
