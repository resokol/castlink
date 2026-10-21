"use client";

import { useI18n } from "@/components/I18nProvider";
import { DEFAULT_STUDIO_VIDEO_CODEC, type StudioVideoCodec } from "@/lib/video-quality";

export function StudioVideoModeControls({ videoCodec = DEFAULT_STUDIO_VIDEO_CODEC, simulcast = true, disabled, onChange, showHelp = true }: {
  videoCodec?: StudioVideoCodec; simulcast?: boolean; disabled: boolean;
  onChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
  showHelp?: boolean;
}) {
  const { t, locale } = useI18n();
  return <>
    <label>{t("Видеокодек")}<select aria-label={t("Видеокодек студии")} disabled={disabled} value={videoCodec} onChange={event => onChange?.({ videoCodec: event.target.value as StudioVideoCodec })}>
      <option value="vp9">VP9</option><option value="h264">{t("H.264 (по умолчанию)")}</option><option value="av1">AV1</option>{videoCodec === "vp8" && <option value="vp8">VP8</option>}
    </select></label>
    <label>{t("Поток основной студии")}<select aria-label={t("Режим видеопотока студии")} disabled={disabled} value={simulcast ? "simulcast" : "single"} onChange={event => onChange?.({ simulcast: event.target.value === "simulcast" })}>
      <option value="simulcast">{(videoCodec === "av1" || videoCodec === "vp9") ? t("Несколько слоёв (SVC)") : t("Simulcast (по умолчанию)")}</option><option value="single">{t("Один видеопоток")}</option>
    </select></label>
    {showHelp && <small className="muted">{t("Кодек и режим меняются в OFF AIR. Один слой уменьшает нагрузку; /watch передаётся без дополнительных пространственных слоёв. H264 и AV1 не гарантируют аппаратное ускорение. Для AV1 нужна поддержка у отправителя и зрителей.")}</small>}
  </>;
}
