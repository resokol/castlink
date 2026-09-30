"use client";
import { useEffect, useState } from "react";
import { readControlResponse } from "@/lib/control-response";

export function ModeratorRoomTools({ roomName, studioId = "studio-default" }: { roomName: string; studioId?: string }) {
  const [rooms, setRooms] = useState<string[]>([]);
  const [selected, setSelected] = useState(roomName);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [renameRoom, setRenameRoom] = useState(roomName);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}`, { cache: "no-store", signal: controller.signal })
      .then(response => readControlResponse(response, "Не удалось загрузить комнаты"))
      .then(data => { if (!controller.signal.aborted) setRooms(Array.isArray(data.rooms) ? data.rooms : []); })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [revision, studioId]);
  const change = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage("");
    try {
      await readControlResponse(await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, studioId }) }), "Не удалось изменить комнату");
      setRevision(value => value + 1); setMessage("Изменения сохранены.");
      if (body.action === "create") { setSelected(String(body.name)); setName(""); setPassword(""); }
      else { setRenameRoom(String(body.newName)); setNewName(""); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка изменения комнаты"); }
    finally { setBusy(false); }
  };
  return <section className="panel stack">
    <h2>Комнаты студии</h2>
    <label>Перейти в комнату<select value={selected} onChange={event => setSelected(event.target.value)}>{rooms.map(room => <option key={room}>{room}</option>)}</select></label>
    <button disabled={busy || !selected || selected === roomName} onClick={() => { window.location.href = `/moderator?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(selected)}`; }}>Открыть комнату</button>
    <details><summary>Создать комнату</summary><form className="stack" onSubmit={event => { event.preventDefault(); if (name.trim()) void change({ action: "create", name: name.trim(), password }); }}>
      <label>Название новой комнаты<input value={name} maxLength={100} onChange={event => setName(event.target.value)} /></label>
      <label>Пароль гостей (необязательно)<input type="password" autoComplete="new-password" value={password} maxLength={256} onChange={event => setPassword(event.target.value)} /></label>
      <button disabled={busy || !name.trim()}>Создать комнату</button>
    </form></details>
    <details><summary>Переименовать пустую комнату</summary><form className="stack" onSubmit={event => { event.preventDefault(); if (newName.trim()) void change({ action: "rename", name: renameRoom, newName: newName.trim() }); }}>
      <label>Комната<select value={renameRoom} onChange={event => setRenameRoom(event.target.value)}>{rooms.map(room => <option key={room}>{room}</option>)}</select></label>
      <label>Новое название<input maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} /></label>
      <p className="muted">Переименовать можно только пустую комнату. Пароль и режим открытой комнаты меняются ниже.</p>
      <button disabled={busy || !renameRoom || !newName.trim() || newName.trim() === renameRoom}>Переименовать</button>
    </form></details>
    {message && <p role="status">{message}</p>}
  </section>;
}
