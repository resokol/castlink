"use client";
import { acceptGuestInvite, guestResumeStorage } from "../lib/guest-resume";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import { useEffect, useState, type ReactNode } from "react";
import { EntryShell } from "./EntryShell";
import styles from "./EntryFlow.module.css";
import { GuestServerPicker } from "./GuestServerPicker";

export function GuestAccessGate({ initialRoom, studioId, invite, resume, entryPath = "/room", onBack, children }: {
  initialRoom: string; studioId: string; invite: string; resume: boolean; entryPath?: string; onBack?: () => void; children: (room: string) => ReactNode;
}) {
  const { t } = useI18n();
  const [room, setRoom] = useState(initialRoom);
  const [password, setPassword] = useState("");
  const [authorizedRoom, setAuthorizedRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!invite || resume);
  const [error, setError] = useState("");

  useEffect(() => {
    setRoom(initialRoom);
    if (!invite && !resume) {
      setLoading(false);
      setAuthorizedRoom(current => current === initialRoom ? current : "");
      return;
    }
    const controller = new AbortController();
    setAuthorizedRoom("");
    setLoading(true);
    const authorize = async () => {
      try {
        const response = invite ? await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "guest", studioId, room: initialRoom, invite }), signal: controller.signal }) :
          await fetch(`/api/auth?kind=guest&studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(initialRoom)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !data.allowed) throw Error(data.error || "Введите название комнаты и пароль");
        // Different invitations establish their own defaults; reopening the same
        // accepted link retains the signed session used by its assigned output.
        if (invite) acceptGuestInvite(guestResumeStorage(), studioId, initialRoom, invite);
        setAuthorizedRoom(initialRoom);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось войти"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void authorize();
    return () => controller.abort();
  }, [initialRoom, studioId, invite, resume]);

  if (loading) return <EntryShell><div className={styles.card} role="status">{t("Проверка доступа…")}</div></EntryShell>;
  if (authorizedRoom) return <>{children(authorizedRoom)}</>;
  return <EntryShell>{entryPath !== "/" && <GuestServerPicker />}<form className={styles.card} onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const name = room.trim(); if (!name) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "guest", studioId, room: name, password }) });
      const data = await response.json(); if (!response.ok || !data.allowed) throw Error(data.error || "Не удалось войти");
      setPassword(""); setAuthorizedRoom(name);
      const url = new URL(window.location.href); url.pathname = entryPath;
      url.searchParams.set("studioId", studioId); url.searchParams.set("name", name); url.searchParams.delete("invite"); url.searchParams.delete("moved");
      if (entryPath === "/") url.searchParams.set("mode", "guest");
      window.history.replaceState(null, "", url);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка входа"); } finally { setBusy(false); }
  }}>{onBack && <button type="button" className={styles.back} disabled={busy} onClick={onBack}>← {t("Выбрать другую роль")}</button>}<h1>{t("Вход по названию комнаты")}</h1>
    <label className={styles.field}>{t("Название комнаты")}<input autoFocus required maxLength={100} autoComplete="off" value={room} onChange={e => setRoom(e.target.value)} /></label>
    <label className={styles.field}>{t("Пароль гостей")}<input type="password" autoComplete="current-password" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <small className={styles.hint}>{t("Если студия создала комнату без пароля, оставьте поле пароля пустым.")}</small>
    {error && <p className={styles.error} role="alert">{translateManagementMessage(error, t)}</p>}
    <button className={`${styles.primary} ${styles.full}`} disabled={busy || !room.trim()}>{busy ? t("Проверка…") : t("Войти")}</button>
  </form></EntryShell>;
}
