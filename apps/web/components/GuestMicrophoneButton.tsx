"use client";
import { useEffect, useState, type RefObject } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { setGuestMicrophoneEnabled } from "@/lib/guest-audio";
import type { GuestChoices } from "@/lib/guest-media";

export function GuestMicrophoneButton({ room, choicesRef, generation, disabled, onError }: { room: Room; choicesRef: RefObject<GuestChoices | undefined>; generation: RefObject<number>; disabled: boolean; onError: (error: string) => void }) {
  const [enabled, setEnabled] = useState(room.localParticipant.isMicrophoneEnabled);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(room.localParticipant.isMicrophoneEnabled);
    update();
    room.on(RoomEvent.LocalTrackPublished, update).on(RoomEvent.LocalTrackUnpublished, update).on(RoomEvent.TrackMuted, update).on(RoomEvent.TrackUnmuted, update);
    return () => { room.off(RoomEvent.LocalTrackPublished, update).off(RoomEvent.LocalTrackUnpublished, update).off(RoomEvent.TrackMuted, update).off(RoomEvent.TrackUnmuted, update); };
  }, [room]);
  const toggle = async () => {
    const current = generation.current;
    setBusy(true);
    try {
      if (await setGuestMicrophoneEnabled(room, !room.localParticipant.isMicrophoneEnabled, () => choicesRef.current || {}, () => generation.current === current)) onError("");
    } catch (error) {
      if (generation.current === current) onError(error instanceof Error ? error.message : "Не удалось переключить микрофон");
    } finally { setEnabled(room.localParticipant.isMicrophoneEnabled); setBusy(false); }
  };
  return <button type="button" className="lk-button lk-track-toggle" data-lk-source="microphone" data-lk-enabled={enabled} aria-label={enabled ? "Выключить микрофон" : "Включить микрофон"} aria-pressed={enabled} disabled={disabled || busy} onClick={() => void toggle()}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-3 0h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />{!enabled && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2" />}</svg>
    <span>{enabled ? "Микрофон" : "Микрофон выключен"}</span>
  </button>;
}
