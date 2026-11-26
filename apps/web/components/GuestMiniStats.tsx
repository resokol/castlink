"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { OutputRateSnapshot } from "@/lib/guest-receive-bitrate";
import type { GuestUplink } from "@/lib/guest-camera-outbound";
import { formatPacketLoss, type PacketLoss } from "@/lib/guest-network-stats";
import { useI18n } from "./I18nProvider";
import { StudioConsoleIcon } from "./StudioConsoleIcon";
import { positionStudioConsolePopover } from "./studio-console-popover-position";
import styles from "./GuestVideoCard.module.css";

export type GuestMiniStatsData = {
  identity?: string;
  cameraSid?: string;
  microphoneSid?: string;
  name?: string;
  receiveVideoKbps?: number | null;
  receiveAudioKbps?: number | null;
  networkMeasured?: boolean;
  statsSampledAt?: number;
  statsSampledAtRef?: { current: number };
  networkSampledAtRef?: { current: number };
  stability: "Хорошая" | "Средняя" | "Плохая";
  packetLoss: number;
  currentLoss?: PacketLoss | null;
  totalLoss?: PacketLoss | null;
  uplink?: GuestUplink;
  jitterMs: number | null;
  rttMs: number | null;
  camera: boolean;
  microphone: boolean;
};

// One card-local clock updates only statistics consumers, preserving media owners.
const GuestStatsTime = createContext<number | null>(null);
function useGuestStatsTime() {
  const shared = useContext(GuestStatsTime);
  const [now, setNow] = useState(Date.now);
  const hasSharedClock = shared !== null;
  useEffect(() => {
    if (hasSharedClock) return;
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [hasSharedClock]);
  return shared ?? now;
}
export function GuestStatsClock({ children }: { children: ReactNode }) {
  const now = useGuestStatsTime();
  return <GuestStatsTime.Provider value={now}>{children}</GuestStatsTime.Provider>;
}
export function useGuestStatsFreshness(guest: GuestMiniStatsData) {
  const now = useGuestStatsTime();
  const sampledAt = guest.statsSampledAtRef?.current ?? guest.statsSampledAt;
  const networkSampledAt = guest.networkSampledAtRef?.current ?? sampledAt;
  const measured = networkSampledAt != null && networkSampledAt > 0 && now - networkSampledAt <= 6000 && !!guest.networkMeasured;
  const upstream = guest.uplink && Object.fromEntries(Object.entries(guest.uplink).map(([kind, value]) => {
    const current = value.active && now <= value.expiresAt;
    return [kind, { ...value, currentLoss: current ? value.currentLoss : null, jitterMs: current ? value.jitterMs : null,
      rttMs: current ? value.rttMs : null, stability: current ? value.stability : null }];
  })) as GuestUplink | undefined;
  const grades = [measured ? guest.stability : null, ...(upstream ? Object.values(upstream).filter(leg => leg.active).map(leg => leg.stability) : [null])];
  const stability = grades.includes("Плохая") ? "Плохая" : grades.includes("Средняя") ? "Средняя"
    : measured && upstream && Object.values(upstream).some(leg => leg.active) && grades.every(grade => grade === "Хорошая") ? "Хорошая" : null;
  return {
    now, uplink: upstream, stability,
    fresh: sampledAt != null && sampledAt > 0 && now - sampledAt < 8000,
    measured,
  };
}

export function GuestMiniStats({ guest, outputSnapshot }: { guest: GuestMiniStatsData; outputSnapshot?: OutputRateSnapshot }) {
  const { t, locale } = useI18n();
  const { now, measured, uplink, stability } = useGuestStatsFreshness(guest);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const positionHelp = () => { if (popup.current && trigger.current) positionStudioConsolePopover(popup.current, trigger.current); };
  useEffect(() => {
    if (!helpOpen) return;
    window.addEventListener("resize", positionHelp);
    window.addEventListener("scroll", positionHelp, true);
    return () => { window.removeEventListener("resize", positionHelp); window.removeEventListener("scroll", positionHelp, true); };
  }, [helpOpen]);
  const quality = !stability ? "unknown" : stability === "Хорошая" ? "good" : stability === "Средняя" ? "mid" : "bad";
  const outputBitrate = (sid?: string) => {
    const snapshot = outputSnapshot;
    if (!sid || !snapshot) return "—";
    const values = snapshot.rates.filter(rate => rate.trackSid === sid && rate.participant === guest.identity
      && now < snapshot.requestedAt + rate.ttlMs).map(rate => rate.kbps);
    if (!values.length) return "—";
    const low = Math.min(...values), high = Math.max(...values);
    const range = low === high ? low.toLocaleString(locale) : `${low.toLocaleString(locale)}–${high.toLocaleString(locale)}`;
    return `${range} ${t("кбит/с")}`;
  };
  const lossText = (value: PacketLoss | null | undefined) => {
    const formatted = formatPacketLoss(value, locale);
    return formatted == null ? "—" : t("{loss} пак.", { loss: formatted });
  };
  const metric = (value: number | null) => value != null && Number.isFinite(value) && value >= 0 ? `${value.toLocaleString(locale)} ${t("мс")}` : "—";
  const detail = measured ? t("Потери: {loss}; джиттер: {jitter}; RTT: {rtt}", {
    loss: lossText(guest.currentLoss), jitter: metric(guest.jitterMs), rtt: metric(guest.rttMs),
  }) : t("Нет свежего замера соединения");
  return <><dl className={styles.miniStats} aria-label={t("Статистика соединения")}>
    <div title={t("Приём камеры на выходе OBS/vMix. Для нескольких выходов показан диапазон. Прочерк — нет свежего замера.")}><dt>{t("Видео OBS/vMix")}</dt><dd>{outputBitrate(guest.cameraSid)}</dd></div>
    <div title={t("Приём микрофона на выходе OBS/vMix. Для нескольких выходов показан диапазон. Прочерк — нет свежего замера.")}><dt>{t("Аудио OBS/vMix")}</dt><dd>{outputBitrate(guest.microphoneSid)}</dd></div>
    <div><dt>{t("Сеть")}</dt><dd className={styles.network} data-quality={quality}>
      <button ref={trigger} type="button" data-network-help-toggle="true" className={styles.networkHelpToggle} popoverTarget={menuId}
        aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls={menuId}
        aria-label={guest.name ? t("Памятка о качестве сети: {name}", { name: guest.name }) : t("Памятка о качестве сети")}
        onClick={positionHelp}>
        <i aria-hidden="true" /><span>{t(stability ?? "Нет данных")}</span>
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
      <li data-network-help-grade="good"><strong>{t("Хорошая")}</strong><span>{t("Потери < 1% · джиттер ≤ 30 мс · RTT ≤ 150 мс")}</span></li>
      <li data-network-help-grade="mid"><strong>{t("Средняя")}</strong><span>{t("Потери 1–<5% · джиттер >30–60 мс · RTT >150–300 мс")}</span></li>
      <li data-network-help-grade="bad"><strong>{t("Плохая")}</strong><span>{t("Потери ≥ 5% · джиттер > 60 мс · RTT > 300 мс")}</span></li>
    </ul>
    <p className={styles.networkHelpNote}>{t("Оценка — за последние 10 секунд, замер каждые 2 секунды. История потерь хранится отдельно; это не скорость интернета.")}</p>
    <div className={styles.networkHelpCurrent}><strong>{t("Сервер → студия")}</strong><p>{detail}</p></div>
    <GuestUplinkDetails uplink={uplink} />
    <p className={styles.networkHelpNote}>{t("Приём: свежесть 6 с. Отправка: обратная связь сервера до 12 с; при её отсутствии — нет данных.")}</p>
    <p className={styles.networkHelpNote}>{t("Оценка учитывает худший свежий участок. Хорошая — только при свежих данных обоих участков.")}</p>
    <div className={styles.networkHelpCurrent}><strong>{t("За сессию участника")}: {t("Сервер → студия")}</strong><p>{lossText(guest.totalLoss)}</p></div>
  </div></>;
}

export function GuestUplinkDetails({ uplink }: { uplink?: GuestUplink }) {
  const { t, locale } = useI18n();
  const loss = (value: PacketLoss | null) => { const text = formatPacketLoss(value, locale); return text == null ? "—" : t("{loss} пак.", { loss: text }); };
  const metric = (value: number | null) => value == null ? "—" : `${value.toLocaleString(locale)} ${t("мс")}`;
  return <div className={styles.networkHelpCurrent} data-guest-uplink="true"><strong>{t("Кастер → сервер")}</strong>
    {!uplink && <p>{t("Нет свежего замера соединения")}</p>}
    {uplink && (["video", "audio"] as const).map(kind => {
      const leg = uplink[kind];
      if (!leg.active && !leg.totalLoss) return null;
      return <p key={kind}><b>{t(kind === "video" ? "Видео" : "Аудио")}</b>: {leg.currentLoss
        ? t("Потери: {loss}; джиттер: {jitter}; RTT: {rtt}", { loss: loss(leg.currentLoss), jitter: metric(leg.jitterMs), rtt: metric(leg.rttMs) }) : t("Нет свежего замера соединения")}<br />
        {t("За сессию участника")}: {loss(leg.totalLoss)}</p>;
    })}
  </div>;
}
