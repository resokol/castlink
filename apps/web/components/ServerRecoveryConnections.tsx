"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { RecoveryCode } from "./RecoveryCode";
import styles from "./ServerRecovery.module.css";

type Profile = { id: string; label: string; origin: string; scope: string };

/** Mounted only after the existing Super Admin session gate succeeds. */
export function ServerRecoveryConnections() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const sequence = useRef(0), active = useRef<AbortController | null>(null);
  async function load() {
    const request = ++sequence.current; active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const deadline = setTimeout(() => controller.abort(), 20000);
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/server-recovery", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      const data = await response.json();
      if (request !== sequence.current) return;
      if (!response.ok || !Array.isArray(data.profiles)) throw new Error();
      setProfiles(data.profiles.filter((profile: Profile) => profile.scope === "installation"));
    } catch {
      if (request === sequence.current) { setProfiles([]); setError("Не удалось получить подключения установки. Проверь доступ Super Admin и повтори попытку."); }
    } finally {
      clearTimeout(deadline);
      if (request === sequence.current) { active.current = null; setLoading(false); }
    }
  }
  useEffect(() => {
    void load();
    return () => { sequence.current++; active.current?.abort(); active.current = null; };
  }, []);
  return <details className="panel super-admin-section">
    <summary>{t("Восстановление связей серверов")}</summary>
    <p className="muted">{t("Здесь восстанавливаются общие подключения установки. Подключения отдельной комнаты восстанавливает её создатель в студии.")}</p>
    {loading && <p role="status">{t("Загружаем подключения…")}</p>}
    {error && <p className="av-error" role="alert">{t("Не удалось получить подключения установки. Проверь доступ Super Admin и повтори попытку.")}</p>}
    {!loading && !error && profiles.length === 0 && <p className="muted">{t("Общих подключений установки нет.")}</p>}
    <div className="stack">{profiles.map(profile => <div className={styles.connection} key={profile.id}>
      <strong>{profile.label}</strong><p className="muted">{profile.origin}</p>
      <RecoveryCode peerId={profile.id} disabled={loading} />
    </div>)}</div>
    <button type="button" className="button-secondary" disabled={loading} onClick={load}>{t("Обновить список подключений")}</button>
  </details>;
}
