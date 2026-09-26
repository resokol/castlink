"use client";
import { useEffect, useState } from "react";

export function StudioRoomPicker({ initialRoom, onJoin }: { initialRoom: string; onJoin: (name: string) => void }) {
  const [rooms, setRooms] = useState<string[]>([]);
  const [selected, setSelected] = useState(initialRoom);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rooms", { cache: "no-store", signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error("Не удалось загрузить список комнат");
      const data = await r.json(); setRooms(data.rooms);
      setSelected(data.rooms.includes(initialRoom) ? initialRoom : data.rooms[0] || "");
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [initialRoom]);
  return <main><form className="panel stack guest-name-card" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    if (!create) { if (selected) onJoin(selected); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", name: name.trim(), password }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось создать комнату");
      onJoin(name.trim());
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка создания комнаты"); } finally { setBusy(false); }
  }}><h1>Выберите комнату студии</h1>
    <label>Действие<select value={create ? "create" : "join"} onChange={e => setCreate(e.target.value === "create")}><option value="join">Войти в существующую комнату</option><option value="create">Создать новую комнату</option></select></label>
    {create ? <><label>Название<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>Пароль гостей (необязательно)<input type="password" autoComplete="new-password" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label><small>Оставьте пароль пустым для входа гостей без пароля.</small></> : <label>Комната<select value={selected} onChange={e => setSelected(e.target.value)}>{rooms.map(r => <option key={r}>{r}</option>)}</select></label>}
    {error && <p role="alert">{error}</p>}<button className="button-primary" disabled={busy || (create ? !name.trim() : !selected)}>{busy ? "Загрузка…" : create ? "Создать и войти" : "Войти в комнату"}</button>
  </form></main>;
}
