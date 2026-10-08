"use client";
import type { StudioVideoCodec } from "@/lib/video-quality";

export function StudioVideoModeControls({ videoCodec = "vp8", simulcast = true, disabled, onChange }: {
  videoCodec?: StudioVideoCodec; simulcast?: boolean; disabled: boolean;
  onChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
}) {
  return <>
    <label>Видеокодек<select aria-label="Видеокодек студии" disabled={disabled} value={videoCodec} onChange={event => onChange?.({ videoCodec: event.target.value as StudioVideoCodec })}>
      <option value="vp8">VP8 (по умолчанию)</option><option value="h264">H264</option><option value="av1">AV1</option>
    </select></label>
    <label>Поток основной студии<select aria-label="Режим видеопотока студии" disabled={disabled} value={simulcast ? "simulcast" : "single"} onChange={event => onChange?.({ simulcast: event.target.value === "simulcast" })}>
      <option value="simulcast">{videoCodec === "av1" ? "Несколько слоёв (AV1 SVC)" : "Simulcast (по умолчанию)"}</option><option value="single">Один видеопоток</option>
    </select></label>
    <small className="muted">Кодек и режим меняются в OFF AIR. Один слой уменьшает нагрузку; /watch передаётся без дополнительных пространственных слоёв. H264 и AV1 не гарантируют аппаратное ускорение. Для AV1 нужна поддержка у отправителя и зрителей.</small>
  </>;
}
