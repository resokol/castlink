"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { readControlResponse } from "@/lib/control-response";
import { isPlaybackIntentCurrent, shouldSubscribeToWatchTrack, togglePlaybackIntent } from "@/lib/watch-subscriptions";

export default function WatchPage() {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const rtc = useRef<Room | null>(null);
  const [status, setStatus] = useState("Подключаем поток студии…");
  const [sound, setSound] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const soundChoice = useRef(false);
  const soundIntent = useRef({ generation: 0, enabled: false });
  const videoChoice = useRef(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const inviteRef = useRef("");
  useEffect(() => {
    const url = new URL(window.location.href);
    const roomName = url.searchParams.get("room") || "";
    const studioId = url.searchParams.get("studioId") || "studio-default";
    const invite = new URLSearchParams(url.hash.slice(1)).get("invite");
    const storageKey = `castlink-stream-viewer:${studioId}:${roomName}`;
    if (invite) { inviteRef.current = invite; try { sessionStorage.setItem(storageKey, invite); } catch {} }
    else if (!inviteRef.current) { try { inviteRef.current = sessionStorage.getItem(storageKey) || ""; } catch {} }
    if (url.hash) window.history.replaceState(null, "", url.pathname + url.search);
    const room = new Room({ adaptiveStream: true, dynacast: false });
    rtc.current = room;
    soundIntent.current = { generation: soundIntent.current.generation + 1, enabled: soundChoice.current };
    setSoundPending(false);
    let stopped = false, token = "", timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setFailed(false); setStatus("Подключаем поток студии…");
    const attached = new Map<RemoteTrack, HTMLMediaElement>();
    const detach = (track: RemoteTrack) => { const element = attached.get(track); if (element) { track.detach(element); element.srcObject = null; attached.delete(track); } if (track.kind === Track.Kind.Video) setHasVideo(false); };
    const attach = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity !== "studio-panel-main" || stopped) return;
      if (!shouldSubscribeToWatchTrack(track.kind, soundChoice.current, videoChoice.current)) return;
      const element = track.kind === Track.Kind.Video ? video.current : audio.current;
      if (!element) return;
      if (attached.has(track)) {
        if (element.srcObject) return;
        attached.delete(track);
      }
      for (const [old, target] of attached) if (target === element) detach(old);
      track.attach(element); attached.set(track, element);
      if (track.kind === Track.Kind.Video) { setHasVideo(true); setStatus("Прямой эфир студии"); }
      else {
        element.muted = !soundChoice.current;
        if (soundChoice.current) {
          const intent = soundIntent.current.generation;
          void element.play().then(() => {
            if (stopped || rtc.current !== room) return;
            if (isPlaybackIntentCurrent(soundIntent.current, intent, true) && soundChoice.current) return;
            if (!soundIntent.current.enabled) { element.pause(); element.muted = true; }
          }).catch(() => {
          if (stopped || rtc.current !== room || !isPlaybackIntentCurrent(soundIntent.current, intent, true) || !soundChoice.current) return;
          soundChoice.current = false; setSound(false); element.muted = true;
          soundIntent.current = togglePlaybackIntent(soundIntent.current);
          for (const remote of room.remoteParticipants.values()) if (remote.identity === "studio-panel-main") {
            for (const publication of remote.trackPublications.values()) if (publication.kind === Track.Kind.Audio) void publication.setSubscribed(false);
          }
          });
        }
      }
    };
    const applySubscriptions = (participant: RemoteParticipant) => {
      if (participant.identity !== "studio-panel-main") return;
      for (const publication of participant.trackPublications.values()) {
        void publication.setSubscribed(shouldSubscribeToWatchTrack(publication.kind, soundChoice.current, videoChoice.current));
      }
    };
    const onTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity === "studio-panel-main") void publication.setSubscribed(shouldSubscribeToWatchTrack(publication.kind, soundChoice.current, videoChoice.current));
    };
    room.on(RoomEvent.TrackSubscribed, attach);
    room.on(RoomEvent.TrackUnsubscribed, detach);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.ParticipantConnected, applySubscriptions);
    room.on(RoomEvent.Reconnected, () => { setFailed(false); setStatus("Соединение восстановлено."); for (const participant of room.remoteParticipants.values()) applySubscriptions(participant); });
    room.on(RoomEvent.Reconnecting, () => setStatus("Восстанавливаем соединение…"));
    room.on(RoomEvent.Disconnected, () => { if (!stopped) { setHasVideo(false); setFailed(true); setStatus("Соединение прервано. Повторите подключение."); } });
    const request = async (action: string) => readControlResponse(await fetch("/api/studio-viewer", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, studioId, room: roomName, invite: inviteRef.current }) }), "Не удалось открыть поток студии");
    const poll = async () => {
      try {
        const data = await request("subscribe");
        if (stopped) return;
        if (typeof data.token === "string") token = data.token;
        if (!data.tracks) setStatus(data.online ? "Ожидаем включения эфира студии…" : "Студия ещё не подключена…");
      } catch (error) {
        if (!stopped) { setStatus(error instanceof Error ? error.message : "Связь потеряна"); setFailed(true); await room.disconnect(); return; }
      }
      if (!stopped) timer = setTimeout(() => void poll(), 2500);
    };
    void (async () => {
      try {
        if (!roomName || !inviteRef.current) throw new Error("Откройте ссылку просмотра, полученную от студии или администратора.");
        const data = await request("join"); token = data.token;
        if (stopped) return;
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        if (stopped) { await room.disconnect(); return; }
        for (const participant of room.remoteParticipants.values()) applySubscriptions(participant);
        void poll();
      } catch (error) { if (!stopped) { setStatus(error instanceof Error ? error.message : "Не удалось подключиться"); setFailed(true); } }
    })();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); attached.forEach((_, track) => detach(track)); rtc.current = null; void room.disconnect(); };
  }, [attempt]);
  const toggleSound = async () => {
    const room = rtc.current;
    if (!room) return;
    const intent = soundIntent.current = togglePlaybackIntent(soundIntent.current);
    if (!intent.enabled) {
      soundChoice.current = false;
      setSound(false);
      setSoundPending(false);
      if (audio.current) { audio.current.muted = true; audio.current.pause(); }
      for (const participant of room.remoteParticipants.values()) if (participant.identity === "studio-panel-main") {
        for (const publication of participant.trackPublications.values()) if (publication.kind === Track.Kind.Audio) void publication.setSubscribed(false);
      }
      return;
    }
    setSoundPending(true);
    try {
      await room.startAudio();
      if (rtc.current !== room || !isPlaybackIntentCurrent(soundIntent.current, intent.generation, true)) return;
      soundChoice.current = true;
      setSound(true);
      if (audio.current) audio.current.muted = false;
      for (const participant of room.remoteParticipants.values()) if (participant.identity === "studio-panel-main") {
        for (const publication of participant.trackPublications.values()) if (publication.kind === Track.Kind.Audio) void publication.setSubscribed(true);
      }
      if (audio.current?.srcObject) await audio.current.play();
      if (rtc.current !== room || !isPlaybackIntentCurrent(soundIntent.current, intent.generation, true)) {
        if (rtc.current !== room) return;
        if (!soundIntent.current.enabled) {
          soundChoice.current = false;
          if (audio.current) { audio.current.muted = true; audio.current.pause(); }
        }
        return;
      }
    } catch {
      if (rtc.current !== room || !isPlaybackIntentCurrent(soundIntent.current, intent.generation, true)) return;
      soundChoice.current = false; setSound(false);
      soundIntent.current = togglePlaybackIntent(soundIntent.current);
      setSoundPending(false);
      if (audio.current) audio.current.muted = true;
      for (const participant of room.remoteParticipants.values()) if (participant.identity === "studio-panel-main") {
        for (const publication of participant.trackPublications.values()) if (publication.kind === Track.Kind.Audio) void publication.setSubscribed(false);
      }
      setStatus("Браузер не разрешил звук. Нажмите «Звук» ещё раз.");
    } finally {
      if (rtc.current === room && isPlaybackIntentCurrent(soundIntent.current, intent.generation, true)) setSoundPending(false);
    }
  };
  const toggleVideo = () => {
    const room = rtc.current;
    const next = !videoChoice.current;
    videoChoice.current = next;
    setVideoEnabled(next);
    if (!next) { setHasVideo(false); if (video.current) { video.current.pause(); video.current.srcObject = null; } }
    for (const participant of room?.remoteParticipants.values() || []) if (participant.identity === "studio-panel-main") {
      for (const publication of participant.trackPublications.values()) if (publication.kind === Track.Kind.Video) void publication.setSubscribed(next);
    }
  };
  return <main className="stream-watch-page"><button className="room-leave-button" onClick={() => { void rtc.current?.disconnect(); window.location.assign("/"); }}>Выйти из комнаты</button><header className="studio-header"><div><p className="muted">CastLink</p><h1>Поток студии</h1></div><div className="stream-watch-controls"><button type="button" aria-pressed={sound} aria-label={soundPending ? "Отменить включение звука" : sound ? "Выключить звук" : "Включить звук"} onClick={() => void toggleSound()}>{soundPending ? "Звук: запуск…" : sound ? "Звук: вкл." : "Звук: выкл."}</button><button type="button" aria-pressed={videoEnabled} aria-label={videoEnabled ? "Выключить видео" : "Включить видео"} onClick={toggleVideo}>{videoEnabled ? "Видео: вкл." : "Видео: выкл."}</button></div></header><section className="panel stream-watch-monitor"><video ref={video} autoPlay muted playsInline controls={hasVideo} /><audio ref={audio} /><p role="status">{status}</p>{failed && <button onClick={() => setAttempt(value => value + 1)}>Повторить подключение</button>}</section></main>;
}
