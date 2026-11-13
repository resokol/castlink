"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import styles from "./GuestVideoCard.module.css";

export type GuestMiniStatsData = {
  receiveVideoKbps?: number | null;
  receiveAudioKbps?: number | null;
  networkMeasured?: boolean;
  statsSampledAt?: number;
  statsSampledAtRef?: { current: number };
  stability: "Хорошая" | "Средняя" | "Плохая";
  packetLoss: number;
  jitterMs: number;
  rttMs: number;
  camera: boolean;
  microphone: boolean;
};

export function GuestMiniStats({ guest }: { guest: GuestMiniStatsData }) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(timer); }, []);
  const sampledAt = guest.statsSampledAtRef?.current ?? guest.statsSampledAt;
  const fresh = sampledAt != null && sampledAt > 0 && now - sampledAt < 8000;
  const measured = fresh && guest.networkMeasured;
  const quality = !measured ? "unknown" : guest.stability === "Хорошая" ? "good" : guest.stability === "Средняя" ? "mid" : "bad";
  const bitrate = (value: number | null | undefined, enabled: boolean) => fresh && enabled && value != null && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString(locale)} ${t("кбит/с")}` : "—";
  const detail = measured ? t("Потери: {loss} пак. за всё время трека; джиттер: {jitter} мс; RTT: {rtt}", {
    loss: guest.packetLoss, jitter: guest.jitterMs, rtt: guest.rttMs > 0 ? `${guest.rttMs} ${t("мс")}` : "—",
  }) : t("Нет свежего замера соединения");
  return <dl className={styles.miniStats} aria-label={t("Статистика соединения")}>
    <div title={t("Измеренный приём камеры этой студией; без аудио")}><dt>{t("Приём видео")}</dt><dd>{bitrate(guest.receiveVideoKbps, guest.camera)}</dd></div>
    <div title={t("Измеренный приём микрофона этой студией; без видео")}><dt>{t("Приём аудио")}</dt><dd>{bitrate(guest.receiveAudioKbps, guest.microphone)}</dd></div>
    <div title={detail}><dt>{t("Сеть")}</dt><dd className={styles.network} data-quality={quality}><i aria-hidden="true" />{t(measured ? guest.stability : "Нет данных")}</dd></div>
  </dl>;
}
