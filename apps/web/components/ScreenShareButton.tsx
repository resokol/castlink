"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { ScreenShareIcon, ScreenShareStopIcon } from "@livekit/components-react";
import { enableRoomScreenShare, enableStudioScreenShare, setRoomScreenShareOutputMuted, stopStudioScreenShare } from "@/lib/screen-share";

export function ScreenShareButton({ room, compact = false, toolbar = false, outputMuted, getOutputMuted }: { room: Room; compact?: boolean; toolbar?: boolean; outputMuted?: boolean; getOutputMuted?: () => boolean }) {
  const { t, locale } = useI18n();
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(room.state === "connected");
  const [supported, setSupported] = useState<boolean | null>(null);
  const getMuted = useRef(getOutputMuted); getMuted.current = getOutputMuted;
  const mounted = useRef(false);
  const generation = useRef(0);
  const flight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    setSupported(typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function");
    const update = () => {
      const isConnected = room.state === "connected";
      setConnected(isConnected);
      if (getMuted.current) setRoomScreenShareOutputMuted(room, !isConnected || getMuted.current());
      if (!isConnected) generation.current++;
      const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const participantState = room.localParticipant as typeof room.localParticipant & { isScreenShareEnabled?: boolean };
      setSharing(typeof participantState.isScreenShareEnabled === "boolean" ? participantState.isScreenShareEnabled : !!publication?.track && publication.track.mediaStreamTrack.readyState === "live");
    };
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Disconnected];
    events.forEach(event => room.on(event, update));
    update();
    return () => { mounted.current = false; generation.current++; events.forEach(event => room.off(event, update)); if (getMuted.current) void stopStudioScreenShare(room).catch(() => undefined); };
  }, [room]);

  useEffect(() => { if (getMuted.current) setRoomScreenShareOutputMuted(room, getMuted.current()); }, [room, outputMuted]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const toggle = async () => {
    if (supported === false) {
      setError("Демонстрация экрана недоступна в этом браузере. На Android Chrome веб-версия не поддерживает захват экрана.");
      return;
    }
    if (flight.current) return;
    flight.current = true;
    setBusy(true); setError("");
    const request = ++generation.current;
    try {
      if (sharing) { if (getMuted.current) await stopStudioScreenShare(room); else await room.localParticipant.setScreenShareEnabled(false); }
      else {
        const current = () => mounted.current && generation.current === request;
        const started = getMuted.current ? await enableStudioScreenShare(room, current, () => getMuted.current?.() ?? true) : await enableRoomScreenShare(room, current);
        if (!mounted.current || generation.current !== request) return;
        if (!started) setError("Выбор экрана отменён или браузер не разрешил захват.");
      }
    } catch (cause) {
      if (!mounted.current || generation.current !== request) return;
      setError(cause instanceof DOMException && (cause.name === "AbortError" || cause.name === "NotAllowedError")
        ? "Выбор экрана отменён или браузер не разрешил захват."
        : cause instanceof Error ? cause.message : "Не удалось включить показ экрана");
    } finally {
      flight.current = false;
      if (mounted.current) {
        setBusy(false);
      }
      if (mounted.current && generation.current === request) {
        const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const participantState = room.localParticipant as typeof room.localParticipant & { isScreenShareEnabled?: boolean };
        setSharing(typeof participantState.isScreenShareEnabled === "boolean" ? participantState.isScreenShareEnabled : !!publication?.track && publication.track.mediaStreamTrack.readyState === "live");
      }
    }
  };

  const label = supported === false
    ? t("Демонстрация экрана не поддерживается этим браузером")
    : sharing ? t("Остановить показ экрана") : t("Показать экран / приложение");
  return <div className={`screen-share-control${compact ? " screen-share-control-compact" : ""}${toolbar ? " screen-share-control-toolbar" : ""}`}>
    <button type="button" className={toolbar ? "lk-button guest-screen-share-button" : "button-secondary"} title={compact || toolbar ? label : undefined} aria-label={compact || toolbar ? label : undefined} aria-pressed={sharing} disabled={busy || !connected || supported !== true} onClick={() => void toggle()}>
      {toolbar ? (sharing ? <ScreenShareStopIcon /> : <ScreenShareIcon />) : busy ? t("Подключаем…") : compact ? sharing ? t("Экран: выкл.") : t("Экран") : label}
    </button>
    {!compact && !toolbar && <small>{supported === false ? t("Этот браузер не умеет захватывать экран через веб-страницу. На Android Chrome используйте другой способ передачи экрана; на компьютере откройте CastLink в Chrome/Edge.") : t("В диалоге браузера выберите экран, окно приложения или вкладку. Для звука включите «Поделиться звуком», если такая настройка доступна.")}</small>}
    {supported === false && toolbar && <small className="guest-screen-share-unavailable" role="status">{t("Показ экрана недоступен в этом браузере")}</small>}
    {error && <small className={toolbar ? "guest-screen-share-error" : undefined} role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
}
