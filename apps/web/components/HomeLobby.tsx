"use client";
import { GuestEntrySettings } from "./GuestEntrySettings";
import { defaultGuestEntrySettings } from "@/lib/guest-entry-settings";
import { BrandIcon } from "./BrandIcon";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useState, type FormEvent } from "react";
import { HostedAccessGate } from "./HostedAccessGate";
import { AppFooterSlot } from "./AppChrome";
import { GuestAccessGate } from "./GuestAccessGate";
import { GuestWorkspace } from "./GuestWorkspace";
import { StudioWorkspace } from "./StudioWorkspace";
import { readTransferSnapshot } from "@/lib/client-transfer";
import styles from "./StudioEntry.module.css";

type Entry = {
  mode: "loading" | "lobby" | "checking" | "studio" | "guest";
  name: string;
  studioId: string;
  invite: string;
};

const defaultEntry: Entry = { mode: "loading", name: "", studioId: "studio-default", invite: "" };

export function HomeLobby({ hosted = false, roomCreationEnabled = false }: { hosted?: boolean; roomCreationEnabled?: boolean } = {}) {
  const { t, locale } = useI18n();
  const [entry, setEntry] = useState<Entry>(defaultEntry);
  const [transferSnapshot] = useState(readTransferSnapshot);
  const [entrySettings, setEntrySettings] = useState({ ...defaultGuestEntrySettings });
  const [login, setLogin] = useState(false);
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [studioPassword, setStudioPassword] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [creationPassword, setCreationPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const readEntry = () => {
      const url = new URL(window.location.href);
      const room = url.searchParams.get("name") || url.searchParams.get("room") || "";
      const studioId = url.searchParams.get("studioId") || "studio-default";
      const invite = new URLSearchParams(url.hash.slice(1)).get("invite") || url.searchParams.get("invite") || "";
      if (invite) {
        url.hash = "";
        url.searchParams.delete("invite");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
      setName(room); setJoinName(room); setError("");
      setEntry({ mode: room ? (url.searchParams.get("mode") === "studio" || hosted && url.pathname === "/studio") && !invite ? "checking" : "guest" : "lobby", name: room, studioId, invite });
    };
    readEntry();
    window.addEventListener("popstate", readEntry);
    window.addEventListener("hashchange", readEntry);
    return () => { window.removeEventListener("popstate", readEntry); window.removeEventListener("hashchange", readEntry); };
  }, [hosted]);

  useEffect(() => {
    if (entry.mode !== "checking") return;
    const controller = new AbortController();
    void fetch(`/api/room-studio-access?name=${encodeURIComponent(entry.name)}&studioId=${encodeURIComponent(entry.studioId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || data.allowed !== true) {
          setLogin(true);
          setError(data.exists === false ? "Комната не найдена. Создайте новую или проверьте название." : "Введите пароль студии, чтобы вернуться в свою комнату.");
          setEntry(current => ({ ...current, mode: "lobby" }));
          return;
        }
        setEntry(current => ({ ...current, mode: "studio" }));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLogin(true); setError("Не удалось проверить доступ. Попробуйте войти снова.");
          setEntry(current => ({ ...current, mode: "lobby" }));
        }
      });
    return () => controller.abort();
  }, [entry.mode, entry.name, entry.studioId]);

  const goHome = () => {
    window.history.replaceState(null, "", "/");
    setEntry({ ...defaultEntry, mode: "lobby" });
    setStudioPassword(""); setGuestPassword(""); setCreationPassword(""); setError("");
  };

  const enter = (mode: "studio" | "guest", room: string, studioId = "studio-default") => {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("name", room);
    url.searchParams.set("mode", mode);
    url.searchParams.set("studioId", studioId);
    window.history.replaceState(null, "", url.pathname + url.search);
    setEntry({ mode, name: room, studioId, invite: "" });
    setError("");
  };

  const submitStudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !name.trim() || studioPassword.length < 8 || !login && (!roomCreationEnabled || !creationPassword)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/room-studio-access", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: login ? "login" : "create", name: name.trim(), studioPassword, ...(login ? {} : { password: guestPassword, creationPassword }), studioId: "studio-default" }),
      });
      const data = await response.json();
      if (!response.ok || data.allowed !== true || typeof data.name !== "string" || data.studioId !== "studio-default") throw new Error(data.error || "Не удалось открыть студию.");
      if (!login) {
        const saved = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "settings", room: data.name, studioId: data.studioId, entrySettings }) });
        if (!saved.ok) throw Error("Комната создана. Настройки инвайтов сохраните в студии.");
      }
      setStudioPassword(""); setGuestPassword("");
      enter("studio", data.name, data.studioId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось открыть студию."); }
    finally { setCreationPassword(""); setBusy(false); }
  };

  const content = (() => {
  if (entry.mode === "loading" || entry.mode === "checking") return <main className="guest-entry-page"><div className="panel" role="status">{t("Проверка доступа…")}</div></main>;
  if (entry.mode === "studio") return <>
    {error && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
    <StudioWorkspace studioId={entry.studioId} initialRoom={entry.name} entryPath="/" transferSnapshot={transferSnapshot?.role === "studio" ? transferSnapshot : undefined} simpleRoom onLeave={() => {
      if (busy) return;
      setBusy(true); setError("");
      // The current room can have been renamed or switched without remounting the media tree.
      const url = new URL(window.location.href);
      const currentName = url.searchParams.get("name") || entry.name;
      void fetch(`/api/room-studio-access?name=${encodeURIComponent(currentName)}&studioId=${encodeURIComponent(entry.studioId)}`, { method: "DELETE" })
        .then(response => { if (!response.ok) throw new Error("Не удалось выйти из студии. Попробуйте снова."); goHome(); })
        .catch(cause => setError(cause instanceof Error ? cause.message : "Не удалось выйти из студии."))
        .finally(() => setBusy(false));
    }} />
  </>;
  if (entry.mode === "guest") return <GuestAccessGate initialRoom={entry.name} studioId={entry.studioId} invite={entry.invite} resume entryPath="/" onBack={goHome}>
    {room => <GuestWorkspace key={`${entry.studioId}:${room}`} initialRoomName={room} initialStudioId={entry.studioId} entryPath="/" onLeave={goHome} />}
  </GuestAccessGate>;

  return <main className={`${styles.entryPage} ops-entry graphite-entry`}>
    <div className="ops-lobby" style={{ width: "min(100%, 1040px)", display: "grid", gap: 24 }}>
      <div className={`${styles.brand} ops-brand`}><BrandIcon className={styles.brandMark} /><span>CASTLINK</span></div>
      <div className="ops-lobby-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, alignItems: "start" }}>
        <section className={`${styles.entryCard} ops-card`} style={{ width: "100%" }}>
          <form className={`${styles.stack} ops-stack`} onSubmit={submitStudio}>
            <p className={`${styles.kicker} ops-kicker`}>{t("СТУДИЯ")}</p>
            <h1>{login ? t("Войти в существующую") : t("Создать комнату")}</h1>
            <p className={`${styles.muted} ops-muted`}>{login ? t("Вернитесь в свою студию по названию и паролю студии.") : t("Создайте свою студию и пригласите гостей.")}</p>
            <div className={`${styles.choiceTabs} ops-tabs`}>
              <button type="button" aria-pressed={!login} className={!login ? styles.selectedTab : ""} disabled={busy} onClick={() => { setLogin(false); setCreationPassword(""); setError(""); }}>{t("Новая комната")}</button>
              <button type="button" aria-pressed={login} className={login ? styles.selectedTab : ""} disabled={busy} onClick={() => { setLogin(true); setCreationPassword(""); setError(""); }}>{t("Войти в существующую")}</button>
            </div>
            <label className={`${styles.field} ops-field`}>{t("Название комнаты")}<input required maxLength={100} autoComplete="off" value={name} onChange={event => setName(event.target.value)} /></label>
            <label className={`${styles.field} ops-field`}>{t("Пароль студии")}<input required type="password" minLength={8} maxLength={256} autoComplete={login ? "current-password" : "new-password"} value={studioPassword} onChange={event => setStudioPassword(event.target.value)} /></label>
            <small className={`${styles.muted} ops-muted`}>{t("Минимум 8 символов. Сохраните пароль: он нужен для управления вашей комнатой.")}</small>
            {!login && (roomCreationEnabled ? <>
              <label className={`${styles.field} ops-field`}>{t("Пароль создания комнат")}<input required type="password" maxLength={256} autoComplete="off" value={creationPassword} onChange={event => setCreationPassword(event.target.value)} /></label>
              <small className={`${styles.muted} ops-muted`}>{t("Этот пароль выдаёт владелец сервера.")}</small>
            </> : <p className={`${styles.muted} ops-muted`} role="status">{t("Создание комнат пока недоступно. Обратитесь к владельцу сервера.")}</p>)}
            {!login && <label className={`${styles.field} ops-field`}>{t("Пароль гостей (необязательно)")}<input type="password" maxLength={256} autoComplete="new-password" value={guestPassword} onChange={event => setGuestPassword(event.target.value)} /></label>}
            {!login && <GuestEntrySettings value={entrySettings} onChange={setEntrySettings} disabled={busy} />}
            {error && <p className={`${styles.error} ops-error`} role="alert">{translateWorkspaceMessage(t, error)}</p>}
            <button className={`${styles.primaryButton} ops-primary`} disabled={busy || !name.trim() || studioPassword.length < 8 || !login && (!roomCreationEnabled || !creationPassword)}>{busy ? t("Проверка…") : login ? t("Открыть мою студию") : t("Создать и открыть студию")}</button>
          </form>
        </section>
        <section className={`${styles.entryCard} ops-card`} style={{ width: "100%" }}>
          <form className={`${styles.stack} ops-stack`} onSubmit={event => { event.preventDefault(); if (!busy && joinName.trim()) enter("guest", joinName.trim()); }}>
            <p className={`${styles.kicker} ops-kicker`}>{t("ГОСТЬ")}</p>
            <h1>{t("Войти в комнату")}</h1>
            <p className={`${styles.muted} ops-muted`}>{t("Введите название комнаты. Затем проверьте камеру и микрофон перед входом.")}</p>
            <label className={`${styles.field} ops-field`}>{t("Название комнаты")}<input required maxLength={100} autoComplete="off" value={joinName} onChange={event => setJoinName(event.target.value)} /></label>
            <button className={`${styles.primaryButton} ops-primary`} disabled={busy || !joinName.trim()}>{t("Войти как гость")}</button>
          </form>
        </section>
      </div>
      <AppFooterSlot />
    </div>
  </main>;
  })();
  return hosted && entry.mode !== "guest" ? <HostedAccessGate>{content}</HostedAccessGate> : content;
}
