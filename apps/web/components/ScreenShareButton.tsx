"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { enableRoomScreenShare } from "@/lib/screen-share";

export function ScreenShareButton({ room, compact = false }: { room: Room; compact?: boolean }) {
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

  return <div className={`screen-share-control${compact ? " screen-share-control-compact" : ""}`}>
    <button type="button" className="button-secondary" title={compact ? (sharing ? "Остановить показ экрана" : "Показать экран / приложение") : undefined} aria-label={compact ? (sharing ? "Остановить показ экрана" : "Показать экран / приложение") : undefined} aria-pressed={sharing} disabled={busy || !connected} onClick={() => void toggle()}>
      {busy ? "Подключаем…" : compact ? sharing ? "Экран: выкл." : "Экран" : sharing ? "Остановить показ экрана" : "Показать экран / приложение"}
    </button>
    {!compact && <small>В диалоге браузера выберите экран, окно приложения или вкладку. Для звука включите «Поделиться звуком», если такая настройка доступна.</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
