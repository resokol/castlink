"use client";
import { useEffect, useState, type ReactNode } from "react";
export function AccessGate({ kind, room = "", children }: { kind: "studio" | "guest"; room?: string; children: ReactNode }) {
  const [allowed, setAllowed] = useState(false), [loading, setLoading] = useState(true);
  const [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setAllowed(false); setLoading(true);
    fetch(`/api/auth?kind=${kind}&room=${encodeURIComponent(room)}`, { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw Error("Не удалось проверить доступ"); return r.json(); })
      .then(data => { setAllowed(data.allowed); setExists(data.exists !== false); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, room]);
  if (loading) return <main><div className="panel">Проверка доступа…</div></main>;
  if (allowed) return <>{children}</>;
  if (!exists) return <main><div className="panel">Комната не найдена.</div></main>;
  return <main><form className="panel stack guest-name-card" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, room, password }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Не удалось войти");
      setPassword(""); setAllowed(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка входа"); } finally { setBusy(false); }
  }}><h1>{kind === "studio" ? "Вход в студию" : `Вход в комнату «${room}»`}</h1>
    <label>Пароль<input autoFocus type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={256} /></label>
    {error && <p role="alert">{error}</p>}<button disabled={busy || !password}>{busy ? "Проверка…" : "Войти"}</button>
  </form></main>;
}
