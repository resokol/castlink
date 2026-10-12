"use client";
import { useEffect, useRef, useState } from "react";
import { ReserveClient, type PreparedReserve, type ReserveView } from "./client-reserve";
import { transferDestination, type TransferSnapshot } from "./client-transfer";

type Options = {
  studioId: string; room: string; token?: string; clientId?: string; canActivate?: boolean;
  snapshot: () => Promise<TransferSnapshot>; beforeHandoff?: () => Promise<void>;
};
export function useSessionTransfer(options: Options) {
  const [view, setView] = useState<ReserveView>({ phase: "unprepared", busy: false });
  const current = useRef(options); current.current = options;
  const client = useRef<ReserveClient | undefined>(undefined);
  const handoff = useRef<((result: Record<string, unknown>) => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    if (!options.token) return;
    let disposed = false, plannedBusy = false, moving = false;
    const navigate = async (result: Record<string, unknown>, prepared?: PreparedReserve) => {
      if (disposed || moving) return;
      moving = true;
      try {
        const snapshot = await current.current.snapshot();
        if (disposed) { moving = false; return; }
        const approved = prepared ? [prepared.targetUrl, prepared.clientTargetUrl] : [result.targetUrl, result.clientTargetUrl];
        const destination = transferDestination(String(result.targetUrl), String(result.ticket), snapshot, typeof result.clientTargetUrl === "string" ? result.clientTargetUrl : undefined, approved.filter((value): value is string => typeof value === "string"));
        await current.current.beforeHandoff?.();
        if (!disposed) window.location.assign(destination);
      } catch (error) { moving = false; throw error; }
    };
    handoff.current = navigate;
    const reserve = new ReserveClient({
      studioId: options.studioId, room: options.room, token: options.token, clientId: options.clientId,
      canActivate: options.canActivate === true, onChange: next => { if (!disposed) setView(next); }, onHandoff: navigate,
    });
    client.current = reserve;
    const prepare = async () => { await reserve.refresh(); if (!disposed) await reserve.poll(); };
    const planned = async () => {
      if (plannedBusy || disposed || moving) return;
      plannedBusy = true;
      try {
        const query = new URLSearchParams({ studioId: options.studioId, room: options.room });
        const response = await fetch(`/api/server-transfer?${query}`, { cache: "no-store", headers: { authorization: `Bearer ${options.token}` }, signal: AbortSignal.timeout(5000) });
        if (response.ok && !disposed) { const result = await response.json(); if (result.ticket && result.targetUrl) await navigate(result); }
      } catch { /* Source outages leave the prepared direct-reserve polling alive. */ }
      finally { plannedBusy = false; }
    };
    void prepare(); void planned();
    const sourceTimer = setInterval(() => void prepare(), 30000);
    const reserveTimer = setInterval(() => void reserve.poll(), 2000);
    const plannedTimer = setInterval(() => void planned(), 2000);
    return () => { disposed = true; reserve.dispose(); clearInterval(sourceTimer); clearInterval(reserveTimer); clearInterval(plannedTimer); if (client.current === reserve) { client.current = undefined; handoff.current = undefined; } };
  }, [options.studioId, options.room, options.token, options.clientId, options.canActivate]);
  return {
    view,
    handoff: (result: Record<string, unknown>) => handoff.current?.(result),
    select: (targetId: string) => client.current?.select(targetId),
    activate: () => client.current?.activate(),
  };
}

export function reserveStatusText(view: ReserveView) {
  if (view.phase === "unprepared") return "Этот браузер ещё не подготовлен к аварийному переносу.";
  if (view.phase === "stale") return "Готовность резерва истекла. Нужна подготовка при доступном основном сервере.";
  if (view.phase === "unreachable") return "Резерв подготовлен, но пока недоступен из этого браузера.";
  if (view.phase === "committed") return "Студия вручную запустила перенос. Подключаемся к резерву…";
  return view.sourceUnavailable ? "Основной сервер недоступен. Подготовленный резерв доступен; перенос запускается кнопкой студии." : "Резерв доступен из этого браузера. Перенос запускается только кнопкой студии.";
}

/** Routine preparation belongs to Studio; guests only need actionable transfer state. */
export function guestReserveStatusText(view: ReserveView): string | null {
  if (view.phase === "committed") return "Студия переносит комнату. Подключаемся к резервному серверу…";
  if (view.error && view.sourceUnavailable) return "Связь с основным сервером прервана. Ожидаем восстановления или переноса комнаты студией.";
  if (view.phase === "unreachable") return "Резервный сервер пока недоступен из вашей сети. Текущее подключение сохраняется.";
  if (view.phase === "stale") return "Готовность резервного подключения истекла. Студия может подготовить его заново.";
  return null;
}
