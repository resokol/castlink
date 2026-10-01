"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { ScreenShareIcon, ScreenShareStopIcon } from "@livekit/components-react";
import { enableRoomScreenShare } from "@/lib/screen-share";

export function ScreenShareButton({ room, compact = false, toolbar = false }: { room: Room; compact?: boolean; toolbar?: boolean }) {
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(room.state === "connected");
  const mounted = useRef(false);
  const generation = useRef(0);
  const flight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const update = () => {
      const isConnected = room.state === "connected";
      setConnected(isConnected);
      if (!isConnected) generation.current++;
      const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const participantState = room.localParticipant as typeof room.localParticipant & { isScreenShareEnabled?: boolean };
      setSharing(typeof participantState.isScreenShareEnabled === "boolean" ? participantState.isScreenShareEnabled : !!publication?.track && publication.track.mediaStreamTrack.readyState === "live");
    };
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Disconnected];
    events.forEach(event => room.on(event, update));
    update();
    return () => { mounted.current = false; generation.current++; events.forEach(event => room.off(event, update)); };
  }, [room]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const toggle = async () => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true); setError("");
    const request = ++generation.current;
    try {
      if (sharing) await room.localParticipant.setScreenShareEnabled(false);
      else {
        const started = await enableRoomScreenShare(room, () => mounted.current && generation.current === request);
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

  const label = sharing ? "Остановить показ экрана" : "Показать экран / приложение";
  return <div className={`screen-share-control${compact ? " screen-share-control-compact" : ""}${toolbar ? " screen-share-control-toolbar" : ""}`}>
    <button type="button" className={toolbar ? "lk-button guest-screen-share-button" : "button-secondary"} title={compact || toolbar ? label : undefined} aria-label={compact || toolbar ? label : undefined} aria-pressed={sharing} disabled={busy || !connected} onClick={() => void toggle()}>
      {toolbar ? (sharing ? <ScreenShareStopIcon /> : <ScreenShareIcon />) : busy ? "Подключаем…" : compact ? sharing ? "Экран: выкл." : "Экран" : label}
    </button>
    {!compact && !toolbar && <small>В диалоге браузера выберите экран, окно приложения или вкладку. Для звука включите «Поделиться звуком», если такая настройка доступна.</small>}
    {error && <small className={toolbar ? "guest-screen-share-error" : undefined} role="alert">{error}</small>}
  </div>;
}
