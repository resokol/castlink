"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack, type RemoteAudioTrack } from "livekit-client";
import { useI18n } from "@/components/I18nProvider";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { bindPrivateTalkbackAudio } from "@/lib/private-talkback-audio";
import { createPrivateReplyController, waitForPrivateReplyPermission } from "@/lib/private-talkback-reply";
import { setGuestMicrophoneGain } from "@/lib/guest-audio-gain";
import { guestAudioCaptureOptions, setGuestMicrophoneEnabled, type GuestAudioProfile } from "@/lib/guest-audio";

type PrivateSession = { id: string; room: Room; dispose: () => void; track?: LocalAudioTrack; reply: ReturnType<typeof createPrivateReplyController<LocalAudioTrack>>; restoreEpoch: number };

/** Only the held guest reply gates its microphone; the rest of the program is untouched. */
export function GuestPrivateTalkback({ room, roomName, studioId, token, microphoneId, onReplyBusyChange, listenGain = 100, audioProfile = "raw", micGain = 100, microphoneMuteEpochRef, disabled = false }: {
  room: Room; roomName: string; studioId: string; token: string; microphoneId: string; onReplyBusyChange?: (active: boolean) => void; listenGain?: number; audioProfile?: GuestAudioProfile; micGain?: number; microphoneMuteEpochRef?: React.RefObject<number>; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [staffName, setStaffName] = useState("");
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = useRef<PrivateSession | undefined>(undefined);
  const mounted = useRef(false);
  const onBusy = useRef(onReplyBusyChange); onBusy.current = onReplyBusyChange;
  const inputGain = useRef(micGain); inputGain.current = micGain;
  const listeningVolume = useRef(1); listeningVolume.current = Math.max(0, Math.min(100, listenGain)) / 100;
  const audioChoices = useRef({ audioDeviceId: microphoneId, audioProfile }); audioChoices.current = { audioDeviceId: microphoneId, audioProfile };
  const releaseReply = () => { void session.current?.reply.release(); };
  useEffect(() => {
    for (const participant of session.current?.room.remoteParticipants.values() || []) {
      for (const publication of participant.trackPublications.values()) if (publication.track?.kind === Track.Kind.Audio) (publication.track as RemoteAudioTrack).setVolume(listeningVolume.current);
    }
  }, [listenGain]);

  useEffect(() => {
    mounted.current = true;
    let generation = 0, polling = false, clearing = false;
    const requestReply = async (active: PrivateSession, action: "reply-begin" | "reply-end", replyId?: string) => {
      const response = await fetch("/api/talkback", { method: "POST", headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, studioId, room: roomName, sessionId: active.id, ...(replyId ? { replyId } : {}) }), signal: AbortSignal.timeout(5000) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Приватная связь недоступна");
      return result;
    };
    const clear = async () => {
      if (clearing) return;
      clearing = true;
      generation++;
      const active = session.current;
      session.current = undefined;
      active?.dispose();
      if (active) {
        await active.reply.release();
        await active.room.disconnect().catch(() => undefined);
        await fetch("/api/talkback", { method: "DELETE", headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, sessionId: active.id }), keepalive: true, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
      }
      if (mounted.current) { setStaffName(""); setReplying(false); }
      clearing = false;
    };
    const poll = async () => {
      if (polling || clearing || !mounted.current) return;
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
        if (!mounted.current || generation !== joinTicket || room.state !== "connected") { await privateRoom.disconnect(); return; }
        const current = { id: offer.sessionId, room: privateRoom, dispose: bindPrivateTalkbackAudio(privateRoom, room, () => listeningVolume.current), restoreEpoch: 0 } as PrivateSession;
        const microphoneAllowed = (target: Room) => {
          const permission = target.localParticipant.permissions;
          return permission?.canPublish === true && (!permission.canPublishSources?.length || permission.canPublishSources.includes(Track.sourceToProto(Track.Source.Microphone)));
        };
        let mainGateObserved = false;
        const permissionChanged = () => { if (!microphoneAllowed(room)) mainGateObserved = true; };
        room.on(RoomEvent.ParticipantPermissionsChanged, permissionChanged);
        const disposePlayback = current.dispose;
        current.dispose = () => { disposePlayback(); room.off(RoomEvent.ParticipantPermissionsChanged, permissionChanged); };
        current.reply = createPrivateReplyController<LocalAudioTrack>({
          begin: async () => {
            current.restoreEpoch = microphoneMuteEpochRef?.current || 0;
            mainGateObserved = !microphoneAllowed(room);
            const result = await requestReply(current, "reply-begin");
            if (typeof result.replyId !== "string") throw new Error("Приватная связь недоступна");
            return { replyId: result.replyId };
          },
          end: async replyId => {
            const result = await requestReply(current, "reply-end", replyId);
            return { restoreMicrophone: result.restoreMicrophone === true };
          },
          ready: isCurrent => waitForPrivateReplyPermission(() => mainGateObserved && microphoneAllowed(current.room), isCurrent),
          muteMain: () => setGuestMicrophoneEnabled(room, false, () => audioChoices.current),
          restoreMain: async () => {
            const canRestore = () => mounted.current && room.state === "connected" && (!session.current || session.current === current) && (microphoneMuteEpochRef?.current || 0) === current.restoreEpoch;
            if (!await waitForPrivateReplyPermission(() => mainGateObserved && microphoneAllowed(room), canRestore)) {
              if (mounted.current && room.state !== "connected") throw new Error("Приватная связь недоступна");
              return;
            }
            const restored = await setGuestMicrophoneEnabled(room, true, () => audioChoices.current, canRestore);
            if (!restored || !canRestore()) await setGuestMicrophoneEnabled(room, false, () => audioChoices.current);
          },
          capture: () => createLocalAudioTrack(guestAudioCaptureOptions(audioChoices.current)),
          publish: async track => {
            current.track = track;
            await current.room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, name: "Приватный ответ", dtx: true });
            if (!await setGuestMicrophoneGain(current.room, inputGain.current, () => session.current === current)) throw new Error("Приватная связь недоступна");
          },
          unpublish: async track => { current.track = undefined; await current.room.localParticipant.unpublishTrack(track, true); },
          current: () => mounted.current && session.current === current && room.state === "connected" && current.room.state === "connected",
          canRestore: () => mounted.current && room.state === "connected" && (!session.current || session.current === current) && (microphoneMuteEpochRef?.current || 0) === current.restoreEpoch,
          warnIfRestoreBlocked: () => mounted.current && room.state !== "connected",
          busy: value => { onBusy.current?.(value); if (mounted.current) { setBusy(value); if (value) setError(""); } },
          speaking: value => { if (mounted.current) setReplying(value); },
          failed: () => { if (mounted.current) setError(t("Не удалось безопасно завершить приватный ответ. Микрофон в эфире оставлен выключенным. Включите его вручную.")); },
        });
        const privateReconnect = () => { void current.reply.release(); };
        privateRoom.on(RoomEvent.Reconnecting, privateReconnect);
        const disposeSession = current.dispose;
        current.dispose = () => { disposeSession(); current.room.off(RoomEvent.Reconnecting, privateReconnect); };
        session.current = current;
        privateRoom.once(RoomEvent.Disconnected, () => { if (session.current === current) void clear(); });
        setStaffName(offer.staffName || t("Модератор")); setError("");
      } catch {
        if (privateRoom && session.current?.room !== privateRoom) await privateRoom.disconnect().catch(() => undefined);
        if (session.current) await clear();
      } finally { polling = false; }
    };
    const disconnected = () => { void clear(); };
    const release = () => { void session.current?.reply.release(); };
    const hidden = () => { if (document.visibilityState === "hidden") release(); };
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.Reconnecting, release);
    window.addEventListener("blur", release);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    document.addEventListener("visibilitychange", hidden);
    void poll();
    const timer = setInterval(() => { void poll(); }, 2000);
    return () => {
      mounted.current = false; clearInterval(timer);
      room.off(RoomEvent.Disconnected, disconnected); room.off(RoomEvent.Reconnecting, release);
      window.removeEventListener("blur", release); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); document.removeEventListener("visibilitychange", hidden);
      void clear();
    };
  }, [room, roomName, studioId, token, t, microphoneMuteEpochRef]);

  if (!staffName) return error ? <p className="media-device-error" role="alert">{error}</p> : null;
  return <section className="panel private-talkback" aria-label={t("Приватная связь")}>
    <p role="status"><strong>{t("Приватная связь")}</strong> · {staffName}</p>
    <p>{t("Удерживайте кнопку для приватного ответа. Только ваш микрофон временно исключается из эфира; программа продолжает звучать.")}</p>
    <button type="button" className={replying ? "talkback-speak" : undefined} disabled={disabled && !busy} aria-busy={busy} aria-pressed={replying} style={{ touchAction: "none", userSelect: "none" }}
      onPointerDown={event => { event.preventDefault(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture may be unavailable. */ } if (!disabled) session.current?.reply.press(); }}
      onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) releaseReply(); }}
      onPointerUp={releaseReply} onPointerOut={releaseReply} onPointerCancel={releaseReply} onLostPointerCapture={releaseReply} onBlur={releaseReply}
      onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); if (!disabled) session.current?.reply.press(); } }}
      onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); releaseReply(); } }}>
      {replying ? t("Отпустите, чтобы вернуться в эфир") : busy ? t("Подключение…") : t("Удерживать: ответить приватно")}
    </button>
    {replying && <p role="status">{t("Ваш ответ слышит только собеседник. Программа не прерывается.")}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
