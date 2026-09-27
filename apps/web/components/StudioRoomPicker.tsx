"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./StudioEntry.module.css";
import { normalizeSavedServer, normalizeServerOrigin, readSavedServers, writeSavedServers, type SavedServer } from "@/lib/saved-servers";

type ServerChoice = { id: string; label: string; origin: string; detail: string; current?: boolean };
const BUILTIN_SERVERS: ServerChoice[] = [
  { id: "vps", label: "VPS CastLink", origin: "https://castlink.ru", detail: "Основной сервер CastLink" },
  { id: "local", label: "Локальный сервер", origin: "https://caster.em.studio", detail: "caster.em.studio · сеть площадки" },
];

export function StudioRoomPicker({ initialRoom, onJoin }: { initialRoom: string; onJoin: (name: string) => void }) {
  const [stage, setStage] = useState<"server" | "room">("server");
  const [rooms, setRooms] = useState<string[]>([]);
  const [selected, setSelected] = useState(initialRoom);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedServer[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [configured, setConfigured] = useState<ServerChoice[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [addressInput, setAddressInput] = useState("");

  const [currentOrigin, setCurrentOrigin] = useState("");
  const currentChoice: ServerChoice = { id: "current", label: "Текущий сервер", origin: currentOrigin, detail: currentOrigin, current: true };
  const choices = useMemo(() => {
    const all = [currentChoice, ...configured, ...BUILTIN_SERVERS, ...saved.map(s => ({ id: s.origin, label: s.label, origin: s.origin, detail: s.origin }))];
    const seen = new Set<string>();
    return all.filter(item => {
      try { const origin = normalizeServerOrigin(item.origin); if (seen.has(origin)) return false; seen.add(origin); return true; } catch { return false; }
    });
  // currentOrigin changes only during mount/navigation; list is local to this entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrigin, configured, saved]);

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
    setSaved(readSavedServers());
    const controller = new AbortController();
    fetch("/api/server-transfer", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data.targets)) return;
        setConfigured(data.targets.filter((target: any) => typeof target?.label === "string" && typeof target?.origin === "string")
          .map((target: any, i: number) => ({ id: `configured-${i}`, label: target.label, origin: target.origin, detail: target.available ? "Сервер настроен для переноса комнат" : "Настроен администратором" })));
      }).catch(() => {});
    return () => controller.abort();
  }, []);

  const loadRooms = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      if (!response.ok) throw Error("Не удалось загрузить список комнат на этом сервере");
      const data = await response.json();
      const nextRooms: string[] = Array.isArray(data.rooms) ? data.rooms : [];
      setRooms(nextRooms);
      setSelected(nextRooms.includes(initialRoom) ? initialRoom : nextRooms[0] || "");
      setStage("room");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки комнат"); }
    finally { setBusy(false); }
  };

  const connect = () => {
    setError("");
    const effectiveSelection = selectedServer || currentOrigin;
    const target = choices.find(choice => choice.origin === effectiveSelection || choice.id === effectiveSelection);
    if (!target) { setError("Выберите сервер для подключения."); return; }
    try {
      const origin = normalizeServerOrigin(target.origin);
      if (origin === currentOrigin) { void loadRooms(); return; }
      window.location.assign(`${origin}/studio`);
    } catch (e) { setError(e instanceof Error ? e.message : "Некорректный адрес сервера"); }
  };

  const addServer = () => {
    setError("");
    try {
      const entry = normalizeSavedServer(labelInput, addressInput);
      const next = [entry, ...saved.filter(item => item.origin !== entry.origin)].slice(0, 20);
      const stored = writeSavedServers(next);
      setSaved(next);
      setSelectedServer(entry.origin);
      setLabelInput(""); setAddressInput("");
      if (!stored) setError("Браузер не разрешил сохранить список. Сервер добавлен до закрытия этой страницы.");
    } catch (e) { setError(e instanceof Error ? e.message : "Некорректный адрес сервера"); }
  };

  const removeSaved = (origin: string) => {
    const next = saved.filter(item => item.origin !== origin);
    setSaved(next); writeSavedServers(next);
    if (selectedServer === origin) setSelectedServer(currentOrigin);
  };

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    if (!create) { if (selected) onJoin(selected); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", name: name.trim(), password }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось создать комнату");
      onJoin(name.trim());
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка создания комнаты"); } finally { setBusy(false); }
  };

  return <main className={styles.entryPage}>
    <section className={styles.entryCard}>
      <div className={styles.brand}><span className={styles.brandMark}>C</span><span>CASTLINK</span></div>
      <div className={styles.progress}><span className={stage === "server" ? styles.activeStep : styles.doneStep}>1</span><i /><span className={stage === "room" ? styles.activeStep : ""}>2</span></div>
      {stage === "server" ? <div className={styles.stack}>
        <p className={styles.kicker}>ПОДКЛЮЧЕНИЕ</p><h1>Выберите сервер</h1>
        <p className={styles.muted}>Вход выполнится на выбранном сервере. Пароль и данные входа между серверами не передаются.</p>
        <label className={styles.field}>Сервер<select value={selectedServer || currentOrigin} onChange={e => setSelectedServer(e.target.value)}>
          {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label} · {choice.origin}</option>)}
        </select></label>
        {choices.find(choice => choice.origin === (selectedServer || currentOrigin) || choice.id === (selectedServer || currentOrigin)) && <p className={styles.serverDetail}>{choices.find(choice => choice.origin === (selectedServer || currentOrigin) || choice.id === (selectedServer || currentOrigin))?.detail}</p>}
        {saved.length > 0 && <div className={styles.savedList} aria-label="Сохранённые серверы">{saved.map(server => <div key={server.origin}><span>{server.label}<small>{server.origin}</small></span><button type="button" className={styles.removeButton} onClick={() => removeSaved(server.origin)} aria-label={`Удалить ${server.label}`}>Удалить</button></div>)}</div>}
        <details className={styles.addServer}><summary>Добавить сервер вручную</summary><div className={styles.addFields}>
          <label className={styles.field}>Название<input value={labelInput} maxLength={60} onChange={e => setLabelInput(e.target.value)} placeholder="Например, Моя студия" /></label>
          <label className={styles.field}>Адрес сервера<input value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder="https://studio.example" autoCapitalize="none" autoCorrect="off" /></label>
          <small>Будет открыт CastLink на этом сервере. Для удалённых адресов нужен HTTPS; пароль вводится там отдельно.</small>
          <button type="button" className={styles.secondaryButton} onClick={addServer}>Сохранить адрес</button>
        </div></details>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.primaryButton} disabled={busy || !choices.length} onClick={connect}>{busy ? "Подключение…" : "Подключиться к серверу"}</button>
      </div> : <form className={styles.stack} onSubmit={submitRoom}>
        <p className={styles.kicker}>ТЕКУЩИЙ СЕРВЕР</p><h1>Выберите комнату</h1>
        <p className={styles.muted}>Подключено: {currentOrigin}</p><p className={styles.muted}>Для параллельных эфиров откройте отдельную вкладку студии для каждой комнаты. У каждой комнаты свои источники, настройки и основная студия.</p>
        <div className={styles.choiceTabs} role="group" aria-label="Действие с комнатой">
          <button type="button" aria-pressed={!create} className={!create ? styles.selectedTab : ""} onClick={() => setCreate(false)}>Войти в комнату</button>
          <button type="button" aria-pressed={create} className={create ? styles.selectedTab : ""} onClick={() => setCreate(true)}>Создать новую</button>
        </div>
        {create ? <><label className={styles.field}>Название комнаты<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label className={styles.field}>Пароль гостей (необязательно)<input type="password" autoComplete="new-password" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label><small className={styles.muted}>Оставьте поле пустым, чтобы гости входили без пароля.</small></> : <label className={styles.field}>Комната<select value={selected} onChange={e => setSelected(e.target.value)} disabled={busy || !rooms.length}><option value="">{busy ? "Загрузка…" : rooms.length ? "Выберите комнату" : "Комнат пока нет"}</option>{rooms.map(r => <option key={r} value={r}>{r}</option>)}</select></label>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.roomActions}><button type="button" className={styles.secondaryButton} onClick={() => { setStage("server"); setError(""); }}>Назад к серверам</button><button className={styles.primaryButton} disabled={busy || (create ? !name.trim() : !selected)}>{busy ? "Создание…" : create ? "Создать и войти" : "Войти в комнату"}</button></div>
      </form>}
      <div className={styles.footer}>CastLink Studio <span>•</span> Безопасное подключение</div>
    </section>
  </main>;
}
