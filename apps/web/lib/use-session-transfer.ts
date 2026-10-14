"use client";
import { useEffect, useRef, useState } from "react";
import { ReserveClient, type PreparedReserve, type ReserveView } from "./client-reserve";
import { transferDestination, type TransferSnapshot } from "./client-transfer";

type Options = {
  studioId: string; room: string; token?: string; clientId?: string; canActivate?: boolean;
  snapshot: () => Promise<TransferSnapshot>; beforeHandoff?: () => Promise<void>;
};
// Decoding groups client lifetimes only. Server APIs still verify authorization.
function sessionIdentity(token?: string) {
  if (!token) return undefined;
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const metadata = JSON.parse(claims.metadata || "{}");
    const authority = metadata.transferAuthorization;
    if (typeof claims.sub !== "string") return token;
    return JSON.stringify([claims.sub, claims.video?.room, metadata.role, metadata.clientId, metadata.transferSessionId, metadata.viewerAccessVersion, metadata.adminAccessVersion, metadata.moderatorAccessVersion, metadata.roomModeratorSessionId, authority?.kind, authority?.roomId, authority?.creatorAccessId, authority?.credentialVersion]);
  } catch { return token; }
}
export function useSessionTransfer(options: Options) {
  const [view, setView] = useState<ReserveView>({ phase: "unprepared", busy: false });
  const current = useRef(options); current.current = options;
  const client = useRef<ReserveClient | undefined>(undefined);
  const handoff = useRef<((result: Record<string, unknown>) => Promise<void>) | undefined>(undefined);
  const identity = sessionIdentity(options.token);
  useEffect(() => {
    setView({ phase: "unprepared", busy: false });
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
        const response = await fetch(`/api/server-transfer?${query}`, { cache: "no-store", headers: { authorization: `Bearer ${current.current.token}` }, signal: AbortSignal.timeout(5000) });
        if (response.ok && !disposed) { const result = await response.json(); if (result.ticket && result.targetUrl) await navigate(result); }
      } catch { /* Source outages leave the prepared direct-reserve polling alive. */ }
      finally { plannedBusy = false; }
    };
    void prepare(); void planned();
    const sourceTimer = setInterval(() => void prepare(), 30000);
    const reserveTimer = setInterval(() => void reserve.poll(), 2000);
    const plannedTimer = setInterval(() => void planned(), 2000);
    const automaticTimer = options.canActivate === true ? setInterval(() => void reserve.checkAutomatic(), 2000) : undefined;
    return () => { disposed = true; reserve.dispose(); clearInterval(sourceTimer); clearInterval(reserveTimer); clearInterval(plannedTimer); if (automaticTimer !== undefined) clearInterval(automaticTimer); if (client.current === reserve) { client.current = undefined; handoff.current = undefined; } };
  }, [options.studioId, options.room, identity, options.clientId, options.canActivate]);
  useEffect(() => { if (options.token) client.current?.updateToken(options.token); }, [options.token]);
  return {
    view,
    handoff: (result: Record<string, unknown>) => handoff.current?.(result),
    select: (targetId: string) => client.current?.select(targetId),
    activate: () => client.current?.activate(),
    setAutomatic: (enabled: boolean) => client.current?.setAutomatic(enabled),
  };
}

export function reserveStatusText(view: ReserveView) {
  if (view.phase === "unprepared") return "Этот браузер ещё не подготовлен к аварийному переносу.";
  if (view.phase === "stale") return "Готовность резерва истекла. Нужна подготовка при доступном основном сервере.";
  if (view.phase === "unreachable") return "Резерв подготовлен, но пока недоступен из этого браузера.";
  if (view.phase === "committed") return "Перенос подтверждён. Подключаемся к резерву…";
  if (view.prepared?.autoEnabled === true && view.autoPending !== false) return view.sourceUnavailable ? "Проверяем отказ основного сервера. Резерв независимо подтвердит его перед автоматическим переносом." : "Автоматический резерв включён. Плановый перенос и возврат запускаются вручную.";
  return view.sourceUnavailable ? "Основной сервер недоступен. Подготовленный резерв доступен; перенос запускается кнопкой студии." : "Резерв доступен из этого браузера. Перенос запускается только кнопкой студии.";
}

export function reserveAutomaticStatusText(view: ReserveView) {
  if (view.autoUnconfirmed) return view.autoPending === false ? "Выключение на резерве не подтверждено. Этот браузер уже прекратил автоматические попытки; повторите выключение." : "Включение на резерве не подтверждено. Повторите запрос.";
  if (!view.prepared) return "Сначала выберите резервный сервер и дождитесь его подготовки.";
  if (!view.prepared.autoSupported || view.prepared.autoProtocol !== "outbound-heartbeat-v1") return "Резерв не подтвердил совместимый протокол автоматики. Дождись завершения обновления резервного сервера, сними подготовку резерва и выбери его снова.";
  if (view.prepared.autoEnabled === true && view.prepared.autoHeartbeatReady !== true) return "Автоматика включена, но ещё не готова: ждём сигнал доступности от основного сервера.";
  return view.prepared.autoEnabled === true ? "Автоматика включена и подтверждена резервом." : "Автоматика выключена.";
}

/** Routine preparation belongs to Studio; guests only need actionable transfer state. */
export function guestReserveStatusText(view: ReserveView): string | null {
  if (view.phase === "committed") return "Студия переносит комнату. Подключаемся к резервному серверу…";
  if (view.error && view.sourceUnavailable) return "Связь с основным сервером прервана. Ожидаем восстановления или переноса комнаты студией.";
  if (view.phase === "unreachable") return "Резервный сервер пока недоступен из вашей сети. Текущее подключение сохраняется.";
  if (view.phase === "stale") return "Готовность резервного подключения истекла. Студия может подготовить его заново.";
  return null;
}
