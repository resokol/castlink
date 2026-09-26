"use client";
import { useEffect, useState, type ReactNode } from "react";

export function GuestAccessGate({ initialRoom, invite, resume, children }: {
  initialRoom: string; invite: string; resume: boolean; children: (room: string) => ReactNode;
}) {
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
        const response = invite ? await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "guest", room: initialRoom, invite }), signal: controller.signal }) :
          await fetch(`/api/auth?kind=guest&room=${encodeURIComponent(initialRoom)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !data.allowed) throw Error(data.error || "Введите название комнаты и пароль");
        setAuthorizedRoom(initialRoom);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось войти"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void authorize();
    return () => controller.abort();
  }, [initialRoom, invite, resume]);

  if (loading) return <main><div className="panel">Проверка доступа…</div></main>;
  if (authorizedRoom) return <>{children(authorizedRoom)}</>;
  return <main><form className="panel stack guest-name-card" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const name = room.trim(); if (!name) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "guest", room: name, password }) });
      const data = await response.json(); if (!response.ok || !data.allowed) throw Error(data.error || "Не удалось войти");
      setPassword(""); setAuthorizedRoom(name);
      const url = new URL(window.location.href); url.pathname = "/room";
      url.searchParams.set("name", name); url.searchParams.delete("invite"); url.searchParams.delete("moved");
      window.history.replaceState(null, "", url);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка входа"); } finally { setBusy(false); }
  }}><h1>Вход в комнату</h1>
    <label>Название комнаты<input autoFocus required maxLength={100} autoComplete="off" value={room} onChange={e => setRoom(e.target.value)} /></label>
    <label>Пароль<input type="password" autoComplete="current-password" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <small>Если студия создала комнату без пароля, оставьте поле пароля пустым.</small>
    {error && <p role="alert">{error}</p>}
    <button className="button-primary" disabled={busy || !room.trim()}>{busy ? "Проверка…" : "Войти"}</button>
  </form></main>;
}
