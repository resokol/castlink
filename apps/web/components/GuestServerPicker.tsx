"use client";
import { useEffect, useState } from "react";
import { normalizeSavedServer, normalizeServerOrigin, readSavedServers, writeSavedServers, type SavedServer } from "@/lib/saved-servers";
import styles from "./GuestServerPicker.module.css";

export function GuestServerPicker() {
  const [current, setCurrent] = useState("");
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState<SavedServer[]>([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setCurrent(window.location.origin); setSaved(readSavedServers()); }, []);
  const choices = [
    { label: "Текущий сервер", origin: current },
    { label: "VPS · CastLink", origin: "https://castlink.ru" },
    { label: "Локальный сервер", origin: "https://caster.em.studio" },
    ...saved,
  ].filter((item, index, all) => item.origin && all.findIndex(other => other.origin === item.origin) === index);
  const destination = selected || current;
  return <section className={styles.picker} aria-label="Сервер для подключения гостя">
    <details>
      <summary>Сервер подключения <small>{current ? new URL(current).host : "Загрузка…"}</small></summary>
      <div className={styles.fields}>
        <label>Сервер<select aria-label="Сервер гостя" value={destination} onChange={event => { setSelected(event.target.value); setError(""); }}>
          {choices.map(item => <option key={item.origin} value={item.origin}>{item.label} · {new URL(item.origin).host}</option>)}
        </select></label>
        <p>Название комнаты и пароль вводятся на выбранном сервере. Приглашение с текущего сайта туда не переносится.</p>
        <button type="button" disabled={!destination || destination === current} onClick={() => {
          try { window.location.assign(`${normalizeServerOrigin(destination)}/room`); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось открыть сервер"); }
        }}>Открыть выбранный сервер</button>
        <details><summary>Добавить другой сервер</summary><div className={styles.fields}>
          <label>Название сервера<input maxLength={60} value={label} onChange={event => setLabel(event.target.value)} placeholder="Моя студия" /></label>
          <label>HTTPS-адрес<input maxLength={2048} value={address} onChange={event => setAddress(event.target.value)} placeholder="https://studio.example.ru" autoCapitalize="none" autoCorrect="off" /></label>
          <button type="button" onClick={() => {
            try {
              const entry = normalizeSavedServer(label, address);
              const next = [entry, ...saved.filter(item => item.origin !== entry.origin)].slice(0, 20);
              const stored = writeSavedServers(next);
              setSaved(next); setSelected(entry.origin); setLabel(""); setAddress("");
              setError(stored ? "" : "Адрес добавлен на эту страницу, но браузер не разрешил сохранить его.");
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Проверьте адрес"); }
          }}>Сохранить адрес</button>
        </div></details>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  </section>;
}
