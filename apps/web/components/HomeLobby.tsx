"use client";
import { GuestEntrySettings } from "./GuestEntrySettings";
import { defaultGuestEntrySettings } from "@/lib/guest-entry-settings";
import { EntryShell, EntryIcon } from "./EntryShell";
import { GuestInviteLanding } from "./GuestInviteLanding";
import { parseGuestInviteUrl } from "@/lib/entry-links";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useState, type FormEvent } from "react";
import { HostedAccessGate } from "./HostedAccessGate";
import { GuestAccessGate } from "./GuestAccessGate";
import { GuestWorkspace } from "./GuestWorkspace";
import { StudioWorkspace } from "./StudioWorkspace";
import { readTransferSnapshot } from "@/lib/client-transfer";
import styles from "./EntryFlow.module.css";

type Entry = {
  mode: "loading" | "lobby" | "checking" | "studio" | "guest";
  name: string;
  studioId: string;
  invite: string;
  inviteHref?: string;
};

const defaultEntry: Entry = { mode: "loading", name: "", studioId: "studio-default", invite: "" };

export function HomeLobby({ hosted = false, roomCreationEnabled = false }: { hosted?: boolean; roomCreationEnabled?: boolean } = {}) {
  const { t, locale } = useI18n();
  const [entry, setEntry] = useState<Entry>(defaultEntry);
  const [transferSnapshot] = useState(readTransferSnapshot);
  const [entrySettings, setEntrySettings] = useState({ ...defaultGuestEntrySettings });
  const [login, setLogin] = useState(true);
  const [surface, setSurface] = useState<"roles" | "studio" | "caster" | "manual">("roles");
  const [inviteInput, setInviteInput] = useState("");
  const [continuedInvite, setContinuedInvite] = useState(false);
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
      const inviteHref = invite ? parseGuestInviteUrl(url.href)?.href : undefined;
      setContinuedInvite(false);
      setSurface(url.searchParams.get("mode") === "studio" || url.pathname === "/studio" ? "studio" : url.searchParams.get("mode") === "guest" ? "caster" : "roles");
      if (invite) {
        url.hash = "";
        url.searchParams.delete("invite");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
      setName(room); setJoinName(room); setError("");
      setEntry({ mode: room ? (url.searchParams.get("mode") === "studio" || hosted && url.pathname === "/studio") && !invite ? "checking" : "guest" : "lobby", name: room, studioId, invite, inviteHref });
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
          setLogin(true); setSurface("studio");
          setError(data.exists === false ? "Комната не найдена. Создайте новую или проверьте название." : "Введите пароль студии, чтобы вернуться в свою комнату.");
          setEntry(current => ({ ...current, mode: "lobby" }));
          return;
        }
        setEntry(current => ({ ...current, mode: "studio" }));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLogin(true); setSurface("studio"); setError("Не удалось проверить доступ. Попробуйте войти снова.");
          setEntry(current => ({ ...current, mode: "lobby" }));
        }
      });
    return () => controller.abort();
  }, [entry.mode, entry.name, entry.studioId]);

  const goHome = () => {
    window.history.replaceState(null, "", "/");
    setEntry({ ...defaultEntry, mode: "lobby" });
    setStudioPassword(""); setGuestPassword(""); setCreationPassword(""); setError("");
    setSurface("roles"); setContinuedInvite(false); setInviteInput("");
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

  const chooseRole = (next: typeof surface) => {
    setSurface(next); setStudioPassword(""); setGuestPassword(""); setCreationPassword(""); setError("");
    const url = new URL(window.location.href);
    if (next === "roles") url.searchParams.delete("mode");
    else url.searchParams.set("mode", next === "studio" ? "studio" : "guest");
    window.history.replaceState(null,"",url.pathname+url.search);
  };
  if (entry.mode === "loading" || entry.mode === "checking") return <EntryShell><div className={styles.card} role="status">{t("Проверка доступа…")}</div></EntryShell>;
  if (entry.mode === "studio") return <>
    {error && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
    <StudioWorkspace studioId={entry.studioId} initialRoom={entry.name} entryPath="/" transferSnapshot={transferSnapshot?.role === "studio" ? transferSnapshot : undefined} simpleRoom onLeave={() => {
      if (busy) return;
      setBusy(true); setError("");
      const url = new URL(window.location.href);
      const currentName = url.searchParams.get("name") || entry.name;
      void fetch(`/api/room-studio-access?name=${encodeURIComponent(currentName)}&studioId=${encodeURIComponent(entry.studioId)}`, { method: "DELETE" })
        .then(response => { if (!response.ok) throw new Error("Не удалось выйти из студии. Попробуйте снова."); goHome(); })
        .catch(cause => setError(cause instanceof Error ? cause.message : "Не удалось выйти из студии."))
        .finally(() => setBusy(false));
    }} />
  </>;
  if (entry.mode === "guest") {
    if (entry.inviteHref && !continuedInvite) return <GuestInviteLanding href={entry.inviteHref} onBack={goHome} onContinue={()=>setContinuedInvite(true)}/>;
    return <GuestAccessGate initialRoom={entry.name} studioId={entry.studioId} invite={entry.invite} resume entryPath="/" onBack={goHome}>
      {room => <GuestWorkspace key={`${entry.studioId}:${room}`} initialRoomName={room} initialStudioId={entry.studioId} entryPath="/" onLeave={goHome} />}
    </GuestAccessGate>;
  }
  const back = <button type="button" className={styles.back} disabled={busy} onClick={()=>chooseRole("roles")}>← {t("Выбрать другую роль")}</button>;
  const studioForm = <EntryShell><section className={styles.card}>{back}
    <form onSubmit={submitStudio}>
      <h1>{login ? t("Войти в студию") : t("Создать студию")}</h1>
      <p>{typeof window === "undefined" ? "CastLink" : window.location.host}</p>
      <div className={styles.tabs}>
        <button type="button" aria-pressed={login} disabled={busy} onClick={()=>{setLogin(true);setError("");setCreationPassword("");}}>{t("Войти в комнату")}</button>
        <button type="button" aria-pressed={!login} disabled={busy} onClick={()=>{setLogin(false);setError("");setCreationPassword("");}}>{t("Создать комнату")}</button>
      </div>
      <label className={styles.field}>{t("Название комнаты")}<input required maxLength={100} autoComplete="off" value={name} disabled={busy} onChange={event=>setName(event.target.value)}/></label>
      <label className={styles.field}>{t("Пароль студии")}<input required type="password" minLength={8} maxLength={256} autoComplete={login?"current-password":"new-password"} value={studioPassword} disabled={busy} onChange={event=>setStudioPassword(event.target.value)}/></label>
      <small className={styles.hint}>{login?t("Пароль для управления, а не гостевой пароль."):t("Минимум 8 символов. Сохраните для управления комнатой.")}</small>
      {!login && (roomCreationEnabled ? <><label className={styles.field}>{t("Пароль создания комнат")}<input required type="password" maxLength={256} autoComplete="off" value={creationPassword} disabled={busy} onChange={event=>setCreationPassword(event.target.value)}/></label><small className={styles.hint}>{t("Этот пароль выдаёт владелец сервера.")}</small></> : <p role="status">{t("Создание комнат пока недоступно. Обратитесь к владельцу сервера.")}</p>)}
      {!login && <><label className={styles.field}>{t("Пароль гостей · необязательно")}<input type="password" maxLength={256} autoComplete="new-password" value={guestPassword} disabled={busy} onChange={event=>setGuestPassword(event.target.value)}/></label><details><summary>{t("Настройки гостевого входа")}</summary><GuestEntrySettings value={entrySettings} onChange={setEntrySettings} disabled={busy}/></details></>}
      {error&&<p className={styles.error} role="alert">{translateWorkspaceMessage(t,error)}</p>}
      <button className={`${styles.primary} ${styles.full}`} disabled={busy||!name.trim()||studioPassword.length<8||!login&&(!roomCreationEnabled||!creationPassword)}>{busy?t("Проверка…"):login?t("Открыть студию"):t("Создать и открыть студию")}</button>
    </form>
  </section></EntryShell>;
  if (surface === "studio") return hosted ? <HostedAccessGate onBack={()=>chooseRole("roles")}>{studioForm}</HostedAccessGate> : studioForm;
  if (surface === "manual") return <GuestAccessGate initialRoom={joinName} studioId="studio-default" invite="" resume={false} entryPath="/" onBack={()=>chooseRole("caster")}>
    {room=><GuestWorkspace initialRoomName={room} initialStudioId="studio-default" entryPath="/" onLeave={goHome}/>}
  </GuestAccessGate>;
  if (surface === "caster") return <EntryShell><section className={styles.card}>{back}<form onSubmit={event=>{
    event.preventDefault();const link=parseGuestInviteUrl(inviteInput);
    if(!link){setError("Вставьте действительную HTTPS-ссылку приглашения.");return;}
    window.location.assign(link.href);
  }}><h1>{t("Подключиться к студии")}</h1><p>{t("Вставьте полную ссылку, которую вам отправила студия.")}</p>
    <label className={styles.field}>{t("Ссылка приглашения")}<input type="url" required placeholder="https://…" value={inviteInput} maxLength={16384} autoComplete="off" spellCheck={false} onChange={event=>{setInviteInput(event.target.value);setError("");}}/></label>
    {error&&<p className={styles.error} role="alert">{t(error)}</p>}
    <button className={`${styles.primary} ${styles.full}`} disabled={!inviteInput.trim()}>{t("Продолжить →")}</button>
    <div className={styles.note}>{t("Далее проверим приглашение и откроем настройку камеры и микрофона.")}</div>
    <div className={styles.divided}><button type="button" className={styles.textButton} onClick={()=>chooseRole("manual")}>{t("Нет ссылки? Войти по названию комнаты")} →</button><div className={styles.note}>{t("Понадобятся адрес сервера и гостевой пароль, если он задан.")}</div></div>
  </form></section></EntryShell>;
  return <EntryShell footer={<><a href="/help">{t("О сервисе CastLink")}</a><a href="/help">{t("Помощь с подключением")}</a></>}>
    <div className={styles.intro}><h1>{t("Как вы хотите войти?")}</h1><p>{t("Выберите, что будете делать в CastLink.")}</p></div>
    <div className={styles.roles}>
      <section className={styles.role}><EntryIcon kind="studio"/><h2>{t("Я — студия")}</h2><p>{t("Создать эфир, пригласить кастеров и управлять комнатой.")}</p><button className={`${styles.primary} ${styles.full}`} onClick={()=>chooseRole("studio")}>{t("Войти как студия")}</button></section>
      <section className={styles.role}><EntryIcon kind="person"/><h2>{t("Я — кастер / гость")}</h2><p>{t("Подключиться к студии по приглашению.")}</p><button className={styles.full} onClick={()=>chooseRole("caster")}>{t("Войти как кастер")}</button></section>
    </div><div className={styles.under}>{t("Есть приглашение? Откройте ссылку — CastLink сразу перейдёт к подключению.")}</div>
  </EntryShell>;
}
