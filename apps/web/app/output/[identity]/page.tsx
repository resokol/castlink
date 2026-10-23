"use client";
import { remotePcOutputMatches } from '@/lib/remote-pc-sources';
import { REMOTE_PC_ENDPOINT, REMOTE_PC_PURPOSE, type RemotePcSource } from '@/lib/remote-pc-protocol';
import { useI18n } from "@/components/I18nProvider";
import { useVideoRotation } from "@/lib/video-rotation";
import { createOutputTrackBindings } from "@/lib/output-track-bindings";

import { getLiveKitUrl } from "@/lib/livekit-url";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";

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
    let disposed = false,outputToken='',remotePcSources:RemotePcSource[]=[],sourceTimer:ReturnType<typeof setTimeout>|undefined;
    const sourceAbort=new AbortController();
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

    const matchesSource = (publication: RemoteTrackPublication) => sourceMode === "screen"
      ? publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio
      : publication.source === Track.Source.Camera || publication.source === Track.Source.Microphone;
    const applyQuality = (publication: RemoteTrackPublication) => {
      if (!matchesSource(publication) || publication.kind !== Track.Kind.Video) return;
      // The camera sender owns the bitrate cap; outputs preserve its full resolution.
      publication.setVideoQuality(VideoQuality.HIGH);
    };
    const attach = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!remotePcOutputMatches(room,identity,sourceMode,_publication,participant,remotePcSources)) return;
      if (track.kind === Track.Kind.Video) {
        applyQuality(_publication);
      }
      bindings.attach(track);
      if (track.kind === Track.Kind.Audio) resumePlayback();
      if (track.kind === Track.Kind.Video) setStatus("");
    };

    room.on(RoomEvent.TrackSubscribed, attach);
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity === identity || remotePcSources.some(source=>source.helper.identity===participant.identity)) clearFeed();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      if (!remotePcOutputMatches(room,identity,sourceMode,_publication,participant,remotePcSources)) return;
      bindings.detach(track);
    });
    room.on(RoomEvent.Reconnecting, clearFeed);
    room.on(RoomEvent.Disconnected, clearFeed);
    document.documentElement.classList.add("studiolink-output-document");


    const restoreTarget = () => {
      let targetFound=false;
      for(const participant of room.remoteParticipants.values())for(const publication of participant.trackPublications.values()){
        const wanted=remotePcOutputMatches(room,identity,sourceMode,publication,participant,remotePcSources);
        if(publication.isDesired!==wanted)publication.setSubscribed(wanted);
        if(wanted){targetFound=true;if(publication.kind===Track.Kind.Video)applyQuality(publication);if(publication.track)attach(publication.track,publication,participant);}
        else if(publication.track)bindings.detach(publication.track);
      }
      if(!targetFound)clearFeed();
      resumePlayback(true,"room-reconnected");
    };
    const pollSources=async()=>{
      try{const response=await fetch(REMOTE_PC_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+outputToken},body:JSON.stringify({purpose:REMOTE_PC_PURPOSE,action:'read',studioId,room:roomName}),cache:'no-store',credentials:'omit',signal:sourceAbort.signal});
        if(!response.ok)throw new Error('Source unavailable');const data=await response.json();if(disposed)return;remotePcSources=data.sources||[];restoreTarget();
      }catch{if(!disposed){remotePcSources=[];restoreTarget();}}
      finally{if(!disposed)sourceTimer=setTimeout(pollSources,1000);}
    };
    const subscribeTarget = () => restoreTarget();
    const participantConnected = () => restoreTarget();
    (async () => {
      try {
        const response = await fetch(`/api/token?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(`output-${crypto.randomUUID()}`)}&targetIdentity=${encodeURIComponent(identity)}&role=output`, {
          headers: access ? { "x-castlink-view-access": access } : undefined,
        });
        if (!response.ok) throw new Error(await response.text());
        const { token,remotePcSources:initialSources } = await response.json();
        outputToken=token;remotePcSources=initialSources||[];
        if (disposed) return;
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        if (disposed) { await room.disconnect(); return; }
        stopTelemetry = startRoomTelemetry(room, roomName, token, undefined, access, () => bindings.inspectAudio());
        await room.startAudio().catch(() => undefined);
        restoreTarget();
        if(sourceMode==="screen")void pollSources();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Ошибка подключения");
      }
    })();
    room.on(RoomEvent.TrackPublished, subscribeTarget);
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.Reconnected, restoreTarget);
    return () => { disposed = true;sourceAbort.abort();clearTimeout(sourceTimer); window.clearInterval(playbackTimer); document.removeEventListener("visibilitychange", visible); room.off(RoomEvent.AudioPlaybackStatusChanged, playbackChanged); if (retryAudio.current === retryPlayback) retryAudio.current = undefined; stopTelemetry?.(); room.off(RoomEvent.TrackSubscribed, attach); room.off(RoomEvent.TrackPublished, subscribeTarget); room.off(RoomEvent.ParticipantConnected, participantConnected); room.off(RoomEvent.Reconnected, restoreTarget); clearFeed(); room.disconnect(); document.documentElement.classList.remove("studiolink-output-document"); };
  }, [identity, studioId, roomName, sourceMode, access, accessState.ready]);

  return (
    <main className="output-page" data-castlink-clean-output="source">
      <div ref={videoRef} className="output-video" />
      <div ref={audioRef} className="output-audio" />
      {status && <div className="output-status">{t(status)}</div>}
      {audioStatus && !status && <div className="output-status output-audio-status" role="status">{t(audioStatus)} <button type="button" onClick={() => retryAudio.current?.()}>{t("Включить звук")}</button></div>}
    </main>
  );
}
