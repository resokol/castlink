"use client";

import { getLiveKitUrl } from "@/lib/livekit-url";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Room, RoomEvent, Track, VideoQuality, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";

export default function OutputPage() {
  const { identity: rawIdentity } = useParams<{ identity: string }>();
  const identity = decodeURIComponent(rawIdentity);
  const search = useSearchParams();
  const roomName = search.get("room") || "demo-room";
  const access = search.get("access") || "";
  const initialBitrate = Number(search.get("bitrate") || 2500);
  const videoRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // vMix output is a production feed: do not let element visibility/size select a low simulcast layer.
    const room = new Room({ adaptiveStream: false, dynacast: false });
    let disposed = false;
    let stopTelemetry: (() => void) | undefined;
    const clearFeed = () => {
      for (const container of [videoRef.current, audioRef.current]) {
        container?.querySelectorAll("video, audio").forEach((node) => { (node as HTMLMediaElement).srcObject = null; });
        container?.replaceChildren();
      }
      setStatus("");
    };

    let targetBitrate = initialBitrate;
    const applyQuality = (publication: RemoteTrackPublication) => {
      if (publication.kind !== Track.Kind.Video) return;
      if (targetBitrate <= 750) { publication.setVideoQuality(VideoQuality.LOW); publication.setVideoDimensions({width:320,height:180}); }
      else if (targetBitrate <= 1800) { publication.setVideoQuality(VideoQuality.MEDIUM); publication.setVideoDimensions({width:640,height:360}); }
      else if (targetBitrate <= 3000) { publication.setVideoQuality(VideoQuality.HIGH); publication.setVideoDimensions({width:1280,height:720}); }
      else { publication.setVideoQuality(VideoQuality.HIGH); publication.setVideoDimensions({width:1920,height:1080}); }
    };
    const attach = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity !== identity) return;
      if (track.kind === Track.Kind.Video) {
        applyQuality(_publication);
      }
      const element = track.attach();
      element.autoplay = true;
      if (track.kind === Track.Kind.Video) {
        videoRef.current?.replaceChildren(element);
        setStatus("");
      } else if (track.kind === Track.Kind.Audio) {
        audioRef.current?.replaceChildren(element);
      }
    };

    room.on(RoomEvent.TrackSubscribed, attach);
    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic !== "studiolink-output-quality") return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.target !== identity) return;
        targetBitrate = Number(msg.bitrateKbps) || targetBitrate;
        const p = room.remoteParticipants.get(identity);
        for (const pub of p?.trackPublications.values() || []) applyQuality(pub);
      } catch {}
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity === identity) clearFeed();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      if (participant.identity !== identity) return;
      track.detach().forEach((element) => element.remove());
      if (track.kind === Track.Kind.Video) videoRef.current?.replaceChildren();
    });
    room.on(RoomEvent.Reconnecting, clearFeed);
    room.on(RoomEvent.Disconnected, clearFeed);
    document.documentElement.classList.add("studiolink-output-document");

    (async () => {
      try {
        const response = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(`output-${crypto.randomUUID()}`)}&role=output&access=${encodeURIComponent(access)}`);
        if (!response.ok) throw new Error(await response.text());
        const { token } = await response.json();
        if (disposed) return;
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        if (disposed) { await room.disconnect(); return; }
        stopTelemetry = startRoomTelemetry(room, roomName, token);
        for (const p of room.remoteParticipants.values()) {
          if (p.identity === identity) for (const pub of p.trackPublications.values()) pub.setSubscribed(true);
        }
        await room.startAudio().catch(() => undefined);
        const participant = room.remoteParticipants.get(identity);
        if (!participant) clearFeed();
        else {
          for (const publication of participant.trackPublications.values()) {
            if (publication.kind === Track.Kind.Video) {
              applyQuality(publication);
            }
            if (publication.track) attach(publication.track, publication, participant);
          }
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Ошибка подключения");
      }
    })();

    const subscribeTarget = (_publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (participant.identity === identity) _publication.setSubscribed(true);
    };
    room.on(RoomEvent.TrackPublished, subscribeTarget);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity === identity) for (const pub of participant.trackPublications.values()) pub.setSubscribed(true);
    });
    return () => { disposed = true; stopTelemetry?.(); clearFeed(); room.disconnect(); document.documentElement.classList.remove("studiolink-output-document"); };
  }, [identity, roomName, initialBitrate, access]);

  return (
    <main className="output-page">
      <div ref={videoRef} className="output-video" />
      <div ref={audioRef} className="output-audio" />
      {status && <div className="output-status">{status}</div>}
    </main>
  );
}
