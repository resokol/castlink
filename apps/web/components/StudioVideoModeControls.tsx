"use client";

import { useI18n } from "@/components/I18nProvider";
import type { StudioVideoCodec } from "@/lib/video-quality";

export function StudioVideoModeControls({ videoCodec = "vp8", simulcast = true, disabled, onChange }: {
  videoCodec?: StudioVideoCodec; simulcast?: boolean; disabled: boolean;
  onChange?: (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }) => void;
}) {
  const { t, locale } = useI18n();
  return <>
    <label>{t("Видеокодек")}<select aria-label={t("Видеокодек студии")} disabled={disabled} value={videoCodec} onChange={event => onChange?.({ videoCodec: event.target.value as StudioVideoCodec })}>
      <option value="vp8">{t("VP8 (по умолчанию)")}</option><option value="h264">H264</option><option value="av1">AV1</option>
    </select></label>
    <label>{t("Поток основной студии")}<select aria-label={t("Режим видеопотока студии")} disabled={disabled} value={simulcast ? "simulcast" : "single"} onChange={event => onChange?.({ simulcast: event.target.value === "simulcast" })}>
      <option value="simulcast">{videoCodec === "av1" ? t("Несколько слоёв (AV1 SVC)") : t("Simulcast (по умолчанию)")}</option><option value="single">{t("Один видеопоток")}</option>
    </select></label>
    <small className="muted">{t("Кодек и режим меняются в OFF AIR. Один слой уменьшает нагрузку; /watch передаётся без дополнительных пространственных слоёв. H264 и AV1 не гарантируют аппаратное ускорение. Для AV1 нужна поддержка у отправителя и зрителей.")}</small>
  </>;
}
