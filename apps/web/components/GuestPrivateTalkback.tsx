"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack, type RemoteAudioTrack } from "livekit-client";
import { useI18n } from "@/components/I18nProvider";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { bindPrivateTalkbackAudio } from "@/lib/private-talkback-audio";
import { setGuestMicrophoneGain } from "@/lib/guest-audio-gain";
import { guestAudioCaptureOptions, setGuestMicrophoneEnabled, type GuestAudioProfile } from "@/lib/guest-audio";

type PrivateSession = { id: string; room: Room; dispose: () => void; track?: LocalAudioTrack };

/** The private room is never exposed to RoomConference, monitoring, or the program mix. */
export function GuestPrivateTalkback({ room, roomName, studioId, token, microphoneId, onActiveChange, listenGain = 100, audioProfile = "speech", micGain = 100, microphoneMuteEpochRef }: {
  room: Room; roomName: string; studioId: string; token: string; microphoneId: string; onActiveChange?: (active: boolean) => void; listenGain?: number; audioProfile?: GuestAudioProfile; micGain?: number; microphoneMuteEpochRef?: React.RefObject<number>;
}) {
  const { t } = useI18n();
  const [staffName, setStaffName] = useState("");
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = useRef<PrivateSession | undefined>(undefined);
  const mounted = useRef(false);
  const replyFlight = useRef(false);
  const onActive = useRef(onActiveChange); onActive.current = onActiveChange;
  const inputGain = useRef(micGain); inputGain.current = micGain;
  useEffect(() => {
    const active = session.current;
    if (active?.track) void setGuestMicrophoneGain(active.room, micGain, () => session.current === active).catch(cause => { if (session.current === active) setError(cause instanceof Error ? cause.message : t("Приватная связь недоступна")); });
  }, [micGain, t]);
  const listeningVolume = useRef(1); listeningVolume.current = Math.max(0, Math.min(100, listenGain)) / 100;
  const audioChoices = useRef({ audioDeviceId: microphoneId, audioProfile }); audioChoices.current = { audioDeviceId: microphoneId, audioProfile };
  useEffect(() => {
    for (const participant of session.current?.room.remoteParticipants.values() || []) {
      for (const publication of participant.trackPublications.values()) if (publication.track?.kind === Track.Kind.Audio) (publication.track as RemoteAudioTrack).setVolume(listeningVolume.current);
    }
  }, [listenGain]);

  useEffect(() => {
    mounted.current = true;
    let generation = 0, polling = false;
    const clear = async () => {
      const restoreEpoch = microphoneMuteEpochRef?.current || 0;
      generation++;
      const active = session.current;
      session.current = undefined;
      active?.track?.stop(); active?.dispose();
      if (active) await active.room.disconnect().catch(() => undefined);
      if (active) {
        const response = await fetch("/api/talkback", { method: "DELETE", headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, sessionId: active.id }), keepalive: true }).catch(() => undefined);
        const ended = response?.ok ? await response.json().catch(() => ({})) : undefined;
        const canRestore = () => mounted.current && room.state === "connected" && !session.current && (microphoneMuteEpochRef?.current || 0) === restoreEpoch;
        if (ended?.restoreMicrophone === true && canRestore()) {
          await setGuestMicrophoneEnabled(room, true, () => audioChoices.current, canRestore).catch(() => undefined);
        }
      }
      onActive.current?.(false);
      if (mounted.current) { setStaffName(""); setReplying(false); }
    };
    const poll = async () => {
      if (polling || !mounted.current) return;
      if (room.state !== "connected") { await clear(); return; }
      polling = true;
      const ticket = generation;
      let privateRoom: Room | undefined;
      try {
        const params = new URLSearchParams({ studioId, room: roomName });
        const response = await fetch(`/api/talkback?${params}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("Приватная связь недоступна");
        const offer = await response.json();
        if (!mounted.current || generation !== ticket) return;
        if (!offer.active) { if (session.current) await clear(); return; }
        if (session.current?.id === offer.sessionId) return;
        if (session.current) await clear();
        const joinTicket = generation;
        privateRoom = new Room({ adaptiveStream: false, dynacast: false });
        await privateRoom.connect(getLiveKitUrl(), offer.token, { autoSubscribe: true });
        if (!mounted.current || generation !== joinTicket || room.state !== "connected") { await privateRoom.disconnect(); return; }
        const output = room.getActiveDevice("audiooutput");
        if (output) await privateRoom.switchActiveDevice("audiooutput", output);
        const current: PrivateSession = { id: offer.sessionId, room: privateRoom, dispose: bindPrivateTalkbackAudio(privateRoom, room, () => listeningVolume.current) };
        session.current = current;
        privateRoom.once(RoomEvent.Disconnected, () => { if (session.current === current) void clear(); });
        onActive.current?.(true);
        setStaffName(offer.staffName || t("Студия")); setError("");
      } catch {
        if (privateRoom && session.current?.room !== privateRoom) await privateRoom.disconnect().catch(() => undefined);
        // A lost lease/network fails closed, including a running private microphone.
        if (session.current) await clear();
      } finally { polling = false; }
    };
    const disconnected = () => { void clear(); };
    room.on(RoomEvent.Disconnected, disconnected);
    void poll();
    const timer = setInterval(() => { void poll(); }, 2000);
    return () => { mounted.current = false; clearInterval(timer); room.off(RoomEvent.Disconnected, disconnected); void clear(); };
  }, [room, roomName, studioId, token, t, microphoneMuteEpochRef]);

  const toggleReply = async () => {
    const active = session.current;
    if (!active || replyFlight.current) return;
    replyFlight.current = true; setBusy(true); setError("");
    let track: LocalAudioTrack | undefined;
    try {
      if (active.track) {
        const previous = active.track; active.track = undefined;
        previous.stop();
        await active.room.localParticipant.unpublishTrack(previous, true);
        if (mounted.current) setReplying(false);
      } else {
        // Main-room microphone is server-muted for the private session. Never reuse
        // its publication: only this separately captured track can carry the reply.
        await setGuestMicrophoneEnabled(room, false, () => audioChoices.current, () => session.current === active);
        if (session.current !== active || room.state !== "connected") return;
        track = await createLocalAudioTrack(guestAudioCaptureOptions(audioChoices.current));
        if (session.current !== active || room.state !== "connected") { track.stop(); return; }
        await track.mute();
        active.track = track;
        await active.room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, name: "Приватный ответ студии", dtx: true });
        if (!await setGuestMicrophoneGain(active.room, inputGain.current, () => session.current === active)) { track.stop(); return; }
        if (session.current !== active) { track.stop(); return; }
        await track.unmute();
        if (session.current !== active) { track.stop(); return; }
        setReplying(true);
      }
    } catch (cause) {
      track?.stop();
      if (active.track === track) active.track = undefined;
      if (mounted.current) { setReplying(false); setError(cause instanceof Error ? cause.message : t("Приватная связь недоступна")); }
    } finally { replyFlight.current = false; if (mounted.current) setBusy(false); }
  };

  if (!staffName) return null;
  return <section className="panel private-talkback" aria-label={t("Приватная связь со студией")}>
    <p role="status"><strong>{t("Приватная связь со студией")}</strong> · {staffName}</p>
    <p>{t("Разговор слышите только вы и выбранная студия. Ваш микрофон в общей комнате временно выключен.")}</p>
    <button type="button" className={replying ? "talkback-speak" : undefined} disabled={busy} aria-pressed={replying} onClick={() => { void toggleReply(); }}>{busy ? t("Подключение…") : replying ? t("Завершить приватный ответ") : t("Ответить приватно")}</button>
    {replying && <p role="status">{t("Вы отвечаете приватно. Другие гости и эфир вас не слышат.")}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
