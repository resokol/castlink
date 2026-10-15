"use client";
import { useI18n } from "@/components/I18nProvider";
import { useEffect, useState, type RefObject } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { setGuestCameraEnabled } from "@/lib/guest-video-codec";
import type { GuestChoices } from "@/lib/guest-media";

export function GuestCodecCameraButton({ room, choicesRef, generation, disabled, onError }: { room: Room; choicesRef: RefObject<GuestChoices | undefined>; generation: RefObject<number>; disabled: boolean; onError: (error: string) => void }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(room.localParticipant.isCameraEnabled);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(room.localParticipant.isCameraEnabled);
    update();
    const events = [RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    events.forEach(event => room.on(event, update));
    return () => { events.forEach(event => room.off(event, update)); };
  }, [room]);
  const toggle = async () => {
    const current = generation.current;
    setBusy(true);
    try { if (await setGuestCameraEnabled(room, !room.localParticipant.isCameraEnabled, () => choicesRef.current!, () => generation.current === current)) onError(""); }
    catch (cause) { if (generation.current === current) onError(cause instanceof Error ? cause.message : "Не удалось переключить камеру"); }
    finally { setEnabled(room.localParticipant.isCameraEnabled); setBusy(false); }
  };
  return <button type="button" className="lk-button lk-track-toggle" data-lk-source="camera" data-lk-enabled={enabled} aria-pressed={enabled} aria-label={enabled ? t("Выключить камеру") : t("Включить камеру")} disabled={disabled || busy} onClick={() => void toggle()}>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" fill="none" stroke="currentColor" strokeWidth="2" />{!enabled && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />}</svg>
    <span>{enabled ? t("Камера") : t("Камера выключена")}</span>
  </button>;
}
