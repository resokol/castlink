"use client";

import type { MonitorPreference } from "@/lib/personal-monitoring";

export function ModeratorStudioMonitoring({
  value,
  onChange,
}: {
  value: MonitorPreference;
  onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  return <div className="studio-moderator-listen">
    <p className="muted">Устройства управляются основной студией. Звук опубликованного эфира слышен только у вас.</p>
    <div className="personal-monitor-controls">
      <button type="button" aria-pressed={value.audio} onClick={() => onChange({ audio: !value.audio })}>
        {value.audio ? "Не слушать студию" : "Слушать студию"}
      </button>
      <button type="button" aria-label="Видео основной студии только у меня" aria-pressed={value.video} onClick={() => onChange({ video: !value.video })}>
        {value.video ? "Видео вкл." : "Видео выкл."}
      </button>
      <label>Личная громкость <input aria-label="Личная громкость Studio Return" type="range" min="0" max="100" value={value.volume} onChange={event => onChange({ volume: Number(event.target.value) })} />
        <output>{value.volume}%</output>
      </label>
    </div>
  </div>;
}
