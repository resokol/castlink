"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { StudioConsoleIcon } from "./StudioConsoleIcon";
import { positionStudioConsolePopover } from "./studio-console-popover-position";
import styles from "./GuestVideoCard.module.css";

export type GuestMiniStatsData = {
  name?: string;
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
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const positionHelp = () => { if (popup.current && trigger.current) positionStudioConsolePopover(popup.current, trigger.current); };
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!helpOpen) return;
    window.addEventListener("resize", positionHelp);
    window.addEventListener("scroll", positionHelp, true);
    return () => { window.removeEventListener("resize", positionHelp); window.removeEventListener("scroll", positionHelp, true); };
  }, [helpOpen]);
  const sampledAt = guest.statsSampledAtRef?.current ?? guest.statsSampledAt;
  const fresh = sampledAt != null && sampledAt > 0 && now - sampledAt < 8000;
  const measured = fresh && guest.networkMeasured;
  const quality = !measured ? "unknown" : guest.stability === "Хорошая" ? "good" : guest.stability === "Средняя" ? "mid" : "bad";
  const bitrate = (value: number | null | undefined, enabled: boolean) => fresh && enabled && value != null && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString(locale)} ${t("кбит/с")}` : "—";
  const detail = measured ? t("Потери: {loss} пак. за всё время трека; джиттер: {jitter} мс; RTT: {rtt}", {
    loss: guest.packetLoss, jitter: guest.jitterMs, rtt: guest.rttMs > 0 ? `${guest.rttMs} ${t("мс")}` : "—",
  }) : t("Нет свежего замера соединения");
  return <><dl className={styles.miniStats} aria-label={t("Статистика соединения")}>
    <div title={t("Измеренный приём камеры этой студией; без аудио")}><dt>{t("Приём видео")}</dt><dd>{bitrate(guest.receiveVideoKbps, guest.camera)}</dd></div>
    <div title={t("Измеренный приём микрофона этой студией; без видео")}><dt>{t("Приём аудио")}</dt><dd>{bitrate(guest.receiveAudioKbps, guest.microphone)}</dd></div>
    <div><dt>{t("Сеть")}</dt><dd className={styles.network} data-quality={quality}>
      <button ref={trigger} type="button" data-network-help-toggle="true" className={styles.networkHelpToggle} popoverTarget={menuId}
        aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls={menuId}
        aria-label={guest.name ? t("Памятка о качестве сети: {name}", { name: guest.name }) : t("Памятка о качестве сети")}
        onClick={positionHelp}>
        <i aria-hidden="true" /><span>{t(measured ? guest.stability : "Нет данных")}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
    </dd></div>
  </dl>
  <div ref={popup} id={menuId} data-network-help="true" popover="auto" role="dialog" aria-labelledby={`${menuId}-title`} className={styles.networkHelpPopover}
    onToggle={event => {
      if (event.target !== event.currentTarget) return;
      const open = event.newState === "open";
      setHelpOpen(open);
      if (open) { positionHelp(); popup.current?.querySelector<HTMLButtonElement>("[data-network-help-close]")?.focus({ preventScroll: true }); }
      else if (document.activeElement === document.body) trigger.current?.focus({ preventScroll: true });
    }}>
    <header className={styles.networkHelpHeader}><strong id={`${menuId}-title`}>{t("Качество сети")}</strong><button type="button" data-network-help-close className={styles.networkHelpClose} popoverTarget={menuId} popoverTargetAction="hide" aria-label={t("Закрыть")}><StudioConsoleIcon kind="close" /></button></header>
    <p className={styles.networkHelpIntro}>{t("Срабатывает худший из трёх показателей.")}</p>
    <ul className={styles.networkHelpGrades}>
      <li data-network-help-grade="good"><strong>{t("Хорошая")}</strong><span>{t("Потери ≤ 2 пак. · джиттер ≤ 30 мс · RTT ≤ 150 мс")}</span></li>
      <li data-network-help-grade="mid"><strong>{t("Средняя")}</strong><span>{t("Потери 3–10 пак. · джиттер 31–60 мс · RTT 151–300 мс")}</span></li>
      <li data-network-help-grade="bad"><strong>{t("Плохая")}</strong><span>{t("Потери > 10 пак. · джиттер > 60 мс · RTT > 300 мс")}</span></li>
    </ul>
    <p className={styles.networkHelpNote}>{t("Потери — за всё время видеотрека, не процент за последние секунды и не скорость интернета.")}</p>
    <div className={styles.networkHelpCurrent}><strong>{t("Текущий замер")}</strong><p>{detail}</p></div>
  </div></>;
}
