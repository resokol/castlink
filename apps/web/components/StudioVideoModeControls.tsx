"use client";
import type { StudioVideoCodec } from "@/lib/video-quality";

export function StudioVideoModeControls({ videoCodec = "vp8", simulcast = true, disabled, onChange }: {
  videoCodec?: StudioVideoCodec; simulcast?: boolean; disabled: boolean;
  onChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
}) {
  return <>
    <label>Видеокодек<select aria-label="Видеокодек студии" disabled={disabled} value={videoCodec} onChange={event => onChange?.({ videoCodec: event.target.value as StudioVideoCodec })}>
      <option value="vp8">VP8 (по умолчанию)</option><option value="h264">H264</option>
    </select></label>
    <label>Поток основной студии<select aria-label="Режим видеопотока студии" disabled={disabled} value={simulcast ? "simulcast" : "single"} onChange={event => onChange?.({ simulcast: event.target.value === "simulcast" })}>
      <option value="simulcast">Simulcast (по умолчанию)</option><option value="single">Один видеопоток</option>
    </select></label>
    <small className="muted">Кодек и режим меняются в OFF AIR. Один поток уменьшает число кодировщиков; /watch всегда получает один поток. H264 не гарантирует аппаратное ускорение.</small>
  </>;
}
