"use client";
import { METER_FLOOR_DB } from "@/lib/audio-meter";
import styles from "./AudioMeter.module.css";

export function AudioMeter({ db, label = "Микрофон", compact = false, detail }: { db: number; label?: string; compact?: boolean; detail?: string }) {
  const level = Number.isFinite(db) ? Math.max(METER_FLOOR_DB, Math.min(0, db)) : METER_FLOOR_DB;
  const value = level <= METER_FLOOR_DB ? "−∞" : level.toFixed(1);
  return <div className={`${styles.meter}${compact ? ` ${styles.compact}` : ""}`}>
    <div className={styles.heading}><span>{label}</span><strong>{value} <span>dBFS</span></strong></div>
    <div className={styles.segments} role="meter" aria-label={label} aria-valuemin={METER_FLOOR_DB} aria-valuemax={0}
      aria-valuenow={level} aria-valuetext={level <= METER_FLOOR_DB ? "Нет сигнала" : `${value} dBFS`}>
      {Array.from({ length: 30 }, (_, index) => {
        const threshold = METER_FLOOR_DB + (index + 1) * 3;
        return <i key={index} aria-hidden="true" className={`${styles.segment} ${index >= 28 ? styles.red : index >= 24 ? styles.amber : styles.green}${level >= threshold ? ` ${styles.lit}` : ""}`} />;
      })}
    </div>
    {!compact && <div className={styles.scale} aria-hidden="true">{[-90, -60, -30, -12, 0].map(value =>
      <span key={value} style={{ left: `${(value - METER_FLOOR_DB) / -METER_FLOOR_DB * 100}%` }}>{value === 0 ? "0" : `−${-value}`}</span>)}</div>}
    {detail && !compact && <small className={styles.detail}>{detail}</small>}
  </div>;
}
