"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPresets, LocalAudioTrack, LocalVideoTrack, Room, Track } from "livekit-client";
import { getLiveKitUrl } from "./livekit-url";
import { applyStudioSenderQuality, assertStudioVideoCodecSupported, assertPublishedStudioVideoCodec, studioVideoEncodingsMatch, studioVideoPublishOptions, type StudioFrameRate, type StudioVideoCodec } from "./video-quality";
import { createStudioSenderStatsState, sampleStudioSenderStats, type StudioSenderStatsState } from "./studio-sender-stats";
import { createStudioOutboundSample, type StudioOutboundSample } from "./studio-outbound-stats";

type RelayProps = {
  roomName: string;
  clientId: string;
  epoch: number;
  enabled: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  fps: StudioFrameRate;
  bitrateKbps: number;
  videoCodec?: StudioVideoCodec;
};

type RelayTracks = {
  room: Room;
  roomName: string;
  owner: number;
  tracks: (LocalAudioTrack | LocalVideoTrack)[];
  video?: LocalVideoTrack;
  audio?: LocalAudioTrack;
  stats: StudioSenderStatsState;
  history: number[];
  statsBusy: boolean;
  qualityQueue: Promise<void>;
  sourceListeners: Array<{ source: MediaStreamTrack; handler: () => void }>;
  onReconnecting: () => void;
  onDisconnected: () => void;
};

/**
 * Mirrors the already-processed Studio Return tracks into the isolated viewer room.
 * The main-room tracks are only cloned; this hook never stops or republishes them.
 */
export function useStudioStreamRelay({ roomName, clientId, epoch, enabled, audioTrack, videoTrack, fps, bitrateKbps, videoCodec = "vp8" }: RelayProps) {
  const active = useRef<RelayTracks | undefined>(undefined);
  const stopFlight = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState("");
  const [outbound, setOutbound] = useState<StudioOutboundSample | null>(null);
  const [relayActive, setRelayActive] = useState(false);
  const quality = useRef({ fps, bitrateKbps, videoCodec });
  quality.current = { fps, bitrateKbps, videoCodec };
  const applyRelayQuality = useCallback((relay: RelayTracks) => {
    const work = relay.qualityQueue.catch(() => undefined).then(async () => {
      if (active.current !== relay || !relay.video) return;
      const desired = quality.current;
      const track = relay.video;
      const senders = new Set<RTCRtpSender>();
      if (track.sender) senders.add(track.sender);
      track.simulcastCodecs.forEach(info => { if (info.sender) senders.add(info.sender); });
      if (!senders.size) throw new Error("Не найден видеокодировщик ссылки просмотра");
      if (track.publishOptions) track.publishOptions.videoEncoding = { ...track.publishOptions.videoEncoding, maxBitrate: desired.bitrateKbps * 1000, maxFramerate: desired.fps };
      for (const sender of senders) {
        if (active.current !== relay) return;
        if (!studioVideoEncodingsMatch(sender.getParameters().encodings || [], desired.bitrateKbps, desired.fps)) {
          await applyStudioSenderQuality(sender, desired.bitrateKbps, desired.fps);
        }
      }
    });
    relay.qualityQueue = work;
    return work;
  }, []);

  useEffect(() => {
    const relay = active.current;
    if (!relay?.video) return;
    void applyRelayQuality(relay).then(() => {
      if (active.current === relay) setError("");
    }).catch(cause => {
      if (active.current === relay) setError(cause instanceof Error ? cause.message : "Не удалось изменить качество ссылки просмотра");
    });
  }, [fps, bitrateKbps, applyRelayQuality]);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    const ticket = ++generation.current;
    const current = () => !stopped && generation.current === ticket;
    const stopRelay = async (relay: RelayTracks) => {
      if (!relay) return;
      if (active.current === relay) {
        active.current = undefined;
        setOutbound(null);
        setRelayActive(false);
      }
      relay.room.off("reconnecting", relay.onReconnecting);
      relay.room.off("disconnected", relay.onDisconnected);
      for (const { source, handler } of relay.sourceListeners) source.removeEventListener("ended", handler);
      for (const track of relay.tracks) track.mediaStreamTrack.stop();
      const finishing = stopFlight.current.catch(() => undefined).then(async () => {
        await Promise.all(relay.tracks.map(track => relay.room.localParticipant.unpublishTrack(track, true).catch(() => undefined)));
        await relay.room.disconnect().catch(() => undefined);
      });
      stopFlight.current = finishing;
      await finishing;
    };
    const sampleOutbound = async () => {
      const relay = active.current;
      if (!current() || !relay || relay.owner !== ticket || !relay.video || !relay.audio || relay.statsBusy) return;
      relay.statsBusy = true;
      try {
        const measured = await sampleStudioSenderStats(relay.stats, relay.video, relay.audio);
        if (!current() || active.current !== relay || !measured) return;
        relay.history = [...relay.history, measured.metrics.videoKbps].slice(-60);
        setOutbound(createStudioOutboundSample(measured.metrics, relay.history));
      } catch {
        // Telemetry failure leaves the last real sample to age out; it must not affect publishing.
      } finally { relay.statsBusy = false; }
    };
    const poll = async () => {
      if (!current() || busy) return;
      if (!audioTrack || !videoTrack || audioTrack.readyState !== "live" || videoTrack.readyState !== "live") {
        setViewerCount(0);
        if (active.current?.owner === ticket) await stopRelay(active.current);
        return;
      }
      busy = true;
      try {
        const response = await fetch("/api/studio-viewer", {
          method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
          body: JSON.stringify({ action: "publisher", room: roomName, clientId, epoch }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await response.json().catch(() => ({}));
        if (!current()) return;
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Не удалось проверить зрителей потока");
        const count = Number(data.viewerCount);
        setViewerCount(Number.isSafeInteger(count) && count > 0 ? count : 0);
        setError("");
        if (count <= 0) { if (active.current?.owner === ticket) await stopRelay(active.current); return; }
        if (typeof data.token !== "string" || typeof data.room !== "string") throw new Error("Сервер не вернул доступ к изолированному потоку");
        if (active.current?.owner === ticket && active.current.roomName === data.room) {
          try { await applyRelayQuality(active.current); }
          catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : "Не удалось применить общий битрейт к ссылке просмотра"); }
          return;
        }
        if (active.current?.owner === ticket) await stopRelay(active.current);

        await stopFlight.current.catch(() => undefined);
        if (!current()) return;

        const relayRoom = new Room({ adaptiveStream: false, dynacast: false });
        const relayTracks: (LocalAudioTrack | LocalVideoTrack)[] = [];
        let relay: RelayTracks;
        const onReconnecting = () => { void stopRelay(relay); };
        const onDisconnected = () => { void stopRelay(relay); };
        relay = { room: relayRoom, roomName: data.room, owner: ticket, tracks: relayTracks, stats: createStudioSenderStatsState(), history: [], statsBusy: false, qualityQueue: Promise.resolve(), sourceListeners: [], onReconnecting, onDisconnected };
        active.current = relay;
        relayRoom.on("reconnecting", onReconnecting);
        relayRoom.on("disconnected", onDisconnected);
        await relayRoom.connect(getLiveKitUrl(), data.token, { autoSubscribe: false });
        if (!current() || active.current !== relay || audioTrack.readyState !== "live" || videoTrack.readyState !== "live") { await stopRelay(relay); return; }

        // The audio input is already the Web Audio gain-processed Studio Return track.
        const clonedVideo = new LocalVideoTrack(videoTrack.clone(), videoTrack.getConstraints(), true);
        const clonedAudio = new LocalAudioTrack(audioTrack.clone(), audioTrack.getConstraints(), true);
        clonedVideo.source = Track.Source.Camera;
        clonedAudio.source = Track.Source.Microphone;
        relayTracks.push(clonedVideo, clonedAudio);
        const sourceEnded = () => { if (current()) void stopRelay(relay); };
        videoTrack.addEventListener("ended", sourceEnded, { once: true });
        audioTrack.addEventListener("ended", sourceEnded, { once: true });
        relay.sourceListeners.push({ source: videoTrack, handler: sourceEnded }, { source: audioTrack, handler: sourceEnded });
        try {
          const requested = quality.current;
          // One full-quality encoding for the viewer room, with the same shared ceiling as the main stream.
          assertStudioVideoCodecSupported(requested.videoCodec);
          await relayRoom.localParticipant.publishTrack(clonedVideo, studioVideoPublishOptions(requested.bitrateKbps, requested.fps, requested.videoCodec, false));
          assertPublishedStudioVideoCodec(clonedVideo, requested.videoCodec);
          relay.video = clonedVideo;
          await applyRelayQuality(relay);
          if (!current() || active.current !== relay) { await stopRelay(relay); return; }
          await relayRoom.localParticipant.publishTrack(clonedAudio, {
            source: Track.Source.Microphone, name: "Studio Return Audio",
            audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: true,
          });
          if (!current() || active.current !== relay) { await stopRelay(relay); return; }
          relay.audio = clonedAudio;
          setRelayActive(true);
          void sampleOutbound();
        } catch (cause) {
          await stopRelay(relay);
          throw cause;
        }
      } catch (cause) {
        if (active.current?.owner === ticket) await stopRelay(active.current);
        if (current()) { setViewerCount(0); setError(cause instanceof Error ? cause.message : "Не удалось передать поток зрителям"); }
      } finally { busy = false; }
    };

    if (enabled && clientId && epoch > 0) {
      void poll();
      timer = setInterval(() => void poll(), 5000);
      statsTimer = setInterval(() => void sampleOutbound(), 2000);
    } else {
      setViewerCount(0);
      setError("");
    }
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (statsTimer) clearInterval(statsTimer);
      if (active.current?.owner === ticket) void stopRelay(active.current);
    };
  }, [roomName, clientId, epoch, enabled, audioTrack, videoTrack, videoCodec, applyRelayQuality]);

  return { viewerCount, error, outbound, active: relayActive };
}
