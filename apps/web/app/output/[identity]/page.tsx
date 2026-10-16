"use client";
import { useI18n } from "@/components/I18nProvider";
import { useVideoRotation } from "@/lib/video-rotation";
import { createOutputTrackBindings } from "@/lib/output-track-bindings";

import { getLiveKitUrl } from "@/lib/livekit-url";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { isValidGuestVideoBitrateKbps } from "@/lib/video-quality";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Room, RoomEvent, Track, VideoQuality, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";

export default function OutputPage() {
  const { t, locale } = useI18n();
  const { identity: rawIdentity } = useParams<{ identity: string }>();
  const identity = decodeURIComponent(rawIdentity);
  const search = useSearchParams();
  const roomName = search.get("room") || "demo-room";
  const studioId = search.get("studioId") || "studio-default";
  const sourceMode = search.get("source") === "screen" ? "screen" : "camera";
  const legacyAccess = search.get("access") || "";
  const [accessState, setAccessState] = useState({ ready: false, value: "" });
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragmentAccess = new URLSearchParams(url.hash.slice(1)).get("access") || "";
    const storageKey = `castlink-output-access:${studioId}:${roomName}:${identity}:${sourceMode}`;
    let storedAccess = "";
    try { storedAccess = sessionStorage.getItem(storageKey) || ""; } catch {}
    const nextAccess = fragmentAccess || legacyAccess || storedAccess;
    if (fragmentAccess || legacyAccess) {
      try { sessionStorage.setItem(storageKey, nextAccess); } catch {}
      url.hash = "";
      url.searchParams.delete("access");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setAccessState({ ready: true, value: nextAccess });
  }, [identity, studioId, roomName, sourceMode, legacyAccess]);
  const access = accessState.value;
  const requestedBitrate = Number(search.get("bitrate") || 2500);
  const initialBitrate = isValidGuestVideoBitrateKbps(requestedBitrate) ? requestedBitrate : 2500;
  const videoRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const [rotationRoom, setRotationRoom] = useState<Room>();
  useVideoRotation(sourceMode === "camera" ? rotationRoom : undefined, identity, videoRef, true);
  const [status, setStatus] = useState("");
  const [audioStatus, setAudioStatus] = useState("");
  const retryAudio = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!accessState.ready) return;
    // vMix output is a production feed: do not let element visibility/size select a low simulcast layer.
    const room = new Room({ adaptiveStream: false, dynacast: false });
    setRotationRoom(room);
    let disposed = false;
    let stopTelemetry: (() => void) | undefined;
    const bindings = createOutputTrackBindings(() => videoRef.current, () => audioRef.current);
    const clearFeed = () => { bindings.clear(); setStatus(""); setAudioStatus(""); };
    const resumePlayback = (reset = false, reason: "paused" | "manual" | "room-reconnected" = "paused") => {
      void bindings.resumeAudio(reset, reason).then(result => {
        if (disposed || result === "idle") return;
        setAudioStatus(result === "playing" ? "" : result === "blocked"
          ? "Браузер заблокировал звук. Нажмите «Включить звук»."
          : "Воспроизведение звука остановлено. Нажмите «Включить звук».");
      });
    };
    const retryPlayback = () => {
      // Call the SDK synchronously inside the click gesture for browser permission.
      resumePlayback(true, "manual");
      void room.startAudio().catch(() => undefined);
    };
    retryAudio.current = retryPlayback;
    const playbackChanged = () => resumePlayback();
    const visible = () => { if (!document.hidden) resumePlayback(); };
    const playbackTimer = window.setInterval(() => resumePlayback(), 2000);
    room.on(RoomEvent.AudioPlaybackStatusChanged, playbackChanged);
    document.addEventListener("visibilitychange", visible);

    let targetBitrate = initialBitrate;
    const matchesSource = (publication: RemoteTrackPublication) => sourceMode === "screen"
      ? publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio
      : publication.source === Track.Source.Camera || publication.source === Track.Source.Microphone;
    const applyQuality = (publication: RemoteTrackPublication) => {
      if (!matchesSource(publication) || publication.kind !== Track.Kind.Video) return;
      if (targetBitrate <= 750) { publication.setVideoQuality(VideoQuality.LOW); publication.setVideoDimensions({width:320,height:180}); }
      else if (targetBitrate <= 1800) { publication.setVideoQuality(VideoQuality.MEDIUM); publication.setVideoDimensions({width:640,height:360}); }
      else if (targetBitrate <= 3000) { publication.setVideoQuality(VideoQuality.HIGH); publication.setVideoDimensions({width:1280,height:720}); }
      else { publication.setVideoQuality(VideoQuality.HIGH); publication.setVideoDimensions({width:1920,height:1080}); }
    };
    const attach = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity !== identity || !matchesSource(_publication)) return;
      if (track.kind === Track.Kind.Video) {
        applyQuality(_publication);
      }
      bindings.attach(track);
      if (track.kind === Track.Kind.Audio) resumePlayback();
      if (track.kind === Track.Kind.Video) setStatus("");
    };

    room.on(RoomEvent.TrackSubscribed, attach);
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== "studiolink-output-quality" || payload.byteLength > 1024 || participant?.identity !== "studio-panel-main") return;
      try {
        const metadata = JSON.parse(participant.metadata || "{}");
        if (metadata.role !== "studio-panel" || metadata.accessRole !== "admin") return;
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.target !== identity || !isValidGuestVideoBitrateKbps(msg.bitrateKbps)) return;
        targetBitrate = msg.bitrateKbps;
        const p = room.remoteParticipants.get(identity);
        for (const pub of p?.trackPublications.values() || []) applyQuality(pub);
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity === identity) clearFeed();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      if (participant.identity !== identity || !matchesSource(_publication)) return;
      bindings.detach(track);
    });
    room.on(RoomEvent.Reconnecting, clearFeed);
    room.on(RoomEvent.Disconnected, clearFeed);
    document.documentElement.classList.add("studiolink-output-document");

    (async () => {
      try {
        const response = await fetch(`/api/token?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(`output-${crypto.randomUUID()}`)}&targetIdentity=${encodeURIComponent(identity)}&role=output`, {
          headers: access ? { "x-castlink-view-access": access } : undefined,
        });
        if (!response.ok) throw new Error(await response.text());
        const { token } = await response.json();
        if (disposed) return;
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        if (disposed) { await room.disconnect(); return; }
        stopTelemetry = startRoomTelemetry(room, roomName, token, undefined, access, () => bindings.inspectAudio());
        await room.startAudio().catch(() => undefined);
        const participant = room.remoteParticipants.get(identity);
        if (!participant) clearFeed();
        else {
          for (const publication of participant.trackPublications.values()) {
            if (!matchesSource(publication)) continue;
            if (publication.kind === Track.Kind.Video) applyQuality(publication);
            publication.setSubscribed(true);
            if (publication.track) attach(publication.track, publication, participant);
          }
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Ошибка подключения");
      }
    })();

    const subscribeTarget = (_publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity === identity && matchesSource(_publication)) _publication.setSubscribed(true);
    };
    const restoreTarget = () => {
      const participant = room.remoteParticipants.get(identity);
      if (!participant) { clearFeed(); return; }
      for (const publication of participant.trackPublications.values()) {
        if (!matchesSource(publication)) continue;
        publication.setSubscribed(true);
        if (publication.kind === Track.Kind.Video) applyQuality(publication);
        if (publication.track) attach(publication.track, publication, participant);
      }
      resumePlayback(true, "room-reconnected");
    };
    const participantConnected = (participant: RemoteParticipant) => {
      if (participant.identity === identity) for (const pub of participant.trackPublications.values()) if (matchesSource(pub)) pub.setSubscribed(true);
    };
    room.on(RoomEvent.TrackPublished, subscribeTarget);
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.Reconnected, restoreTarget);
    return () => { disposed = true; window.clearInterval(playbackTimer); document.removeEventListener("visibilitychange", visible); room.off(RoomEvent.AudioPlaybackStatusChanged, playbackChanged); if (retryAudio.current === retryPlayback) retryAudio.current = undefined; stopTelemetry?.(); room.off(RoomEvent.TrackSubscribed, attach); room.off(RoomEvent.DataReceived, onData); room.off(RoomEvent.TrackPublished, subscribeTarget); room.off(RoomEvent.ParticipantConnected, participantConnected); room.off(RoomEvent.Reconnected, restoreTarget); clearFeed(); room.disconnect(); document.documentElement.classList.remove("studiolink-output-document"); };
  }, [identity, studioId, roomName, sourceMode, initialBitrate, access, accessState.ready]);

  return (
    <main className="output-page">
      <div ref={videoRef} className="output-video" />
      <div ref={audioRef} className="output-audio" />
      {status && <div className="output-status">{t(status)}</div>}
      {audioStatus && !status && <div className="output-status output-audio-status" role="status">{t(audioStatus)} <button type="button" onClick={() => retryAudio.current?.()}>{t("Включить звук")}</button></div>}
    </main>
  );
}
