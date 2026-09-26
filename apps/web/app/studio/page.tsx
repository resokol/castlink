"use client";

import { AccessGate } from "@/components/AccessGate";
import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { StudioRoomPicker } from "@/components/StudioRoomPicker";
import { RoomInviteButton } from "@/components/RoomInviteButton";
import { useRoomMode } from "@/lib/room-mode";
import { STUDIO_FRAME_RATES, VIDEO_BITRATES_KBPS, studioVideoConstraints, studioVideoPublishOptions, type StudioFrameRate } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { RoomAudioRenderer } from "@livekit/components-react";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AudioPresets, Room, RoomEvent, Track, VideoQuality, type RemoteAudioTrack, type RemoteTrackPublication } from "livekit-client";

type GuestStat = {
  identity: string;
  name: string;
  resolution: string;
  bitrateKbps: number;
  packetLoss: number;
  jitterMs: number;
  rttMs: number;
  stability: "Хорошая" | "Средняя" | "Плохая";
  camera: boolean;
  microphone: boolean;
  cameraDevice?: string;
  cpu?: string;
  gpu?: string;
  platform?: string;
  sampleRate?: number;
  signalLevel?: number;
  signalDb?: number;
};

function GuestAudioMeter({ track, fallbackDb = -60 }: { track?: RemoteAudioTrack; fallbackDb?: number }) {
  const [db, setDb] = useState(fallbackDb);
  const [debug, setDebug] = useState("PCM: ожидание");
  useEffect(() => {
    if (!track?.mediaStreamTrack) { setDb(fallbackDb); setDebug("PCM: нет track"); return; }
    let stopped = false, raf = 0, ctx: AudioContext | undefined, source: MediaStreamAudioSourceNode | undefined, analyser: AnalyserNode | undefined, sink: GainNode | undefined;
    let meterTrack: MediaStreamTrack | undefined;
    let shown = 0, frames = 0, lastDebug = 0;
    try {
      ctx = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0;
      meterTrack = track.mediaStreamTrack.clone();
      source = ctx.createMediaStreamSource(new MediaStream([meterTrack]));
      sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
      const data = new Float32Array(analyser.fftSize);
      void ctx.resume();
      const tick = (now: number) => {
        if (stopped || !analyser || !ctx) return;
        analyser.getFloatTimeDomainData(data);
        let sum = 0, peak = 0;
        for (let i = 0; i < data.length; i++) { const v = data[i]; sum += v * v; peak = Math.max(peak, Math.abs(v)); }
        const rms = Math.sqrt(sum / data.length);
        shown = rms >= shown ? rms : Math.max(rms, shown * 0.68);
        const nextDb = shown > 0.0001 ? Math.max(-60, Math.min(0, 20 * Math.log10(shown))) : -60;
        setDb(nextDb);
        frames++;
        if (now - lastDebug > 500) {
          setDebug(`PCM direct: ${ctx.state} · rms=${rms.toFixed(5)} · peak=${peak.toFixed(5)} · ${frames}f`);
          frames = 0; lastDebug = now;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch (e) {
      setDebug(`PCM ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try { source?.disconnect(); analyser?.disconnect(); sink?.disconnect(); meterTrack?.stop(); } catch {}
      void ctx?.close();
    };
  }, [track, fallbackDb]);
  const width = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
  return <><span className="signal-row vdo-audio-level"><b>MIC</b><i className="signal-meter"><i style={{width: `${width}%`}} /></i><strong>{db.toFixed(1)} dBFS</strong></span><small style={{display:"block",opacity:.7}}>{debug}</small></>;
}

function GuestPreview({ room, identity, name, preference = defaultMonitor, onChange }: {
  room: Room; identity: string; name: string; preference?: MonitorPreference; onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let detach: (() => void) | undefined;
    const attach = () => {
      detach?.();
      const element = video.current;
      const track = room.remoteParticipants.get(identity)?.getTrackPublication(Track.Source.Camera)?.track;
      if (element && track && preference.video) { track.attach(element); detach = () => { track.detach(element); element.srcObject = null; }; }
      else if (element) element.srcObject = null;
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackUnpublished, RoomEvent.ParticipantDisconnected];
    events.forEach((event) => room.on(event, attach)); attach();
    return () => { detach?.(); events.forEach((event) => room.off(event, attach)); };
  }, [room, identity, preference.video]);
  return <div className="guest-preview-cell">
    <div className="studio-guest-video-wrap"><video ref={video} autoPlay playsInline muted className="guest-mini-video" />
      {!preference.video && <span className="monitor-video-disabled">Видео выключено у вас</span>}
      <button className="preview-fullscreen" title="Во весь экран" onClick={(event) => void event.currentTarget.parentElement?.requestFullscreen()}>⛶</button>
    </div>
  </div>;
}

function StudioContent({ initialRoom }: { initialRoom: string }) {
  const [roomName, setRoomName] = useState(initialRoom);
  const [rooms, setRooms] = useState<string[]>([initialRoom]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const [viewAccess, setViewAccess] = useState("");
  const room = useMemo(() => new Room({ adaptiveStream: false, dynacast: false }), [roomName]);
  const { studioOnly, setStudioOnly } = useRoomMode(roomName);
  const [modeBusy, setModeBusy] = useState(false);
  const monitoring = usePersonalMonitoring(room, roomName);
  const [activeTab, setActiveTab] = useState<"studio" | "statistics">("studio");
  const [sessionToken, setSessionToken] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/rooms", { cache: "no-store" }).then(async r => {
      if (!r.ok) throw Error("Не удалось загрузить комнаты");
      const data = await r.json();
      if (active) { setRooms(data.rooms); if (!data.rooms.includes(initialRoom)) setRoomName(data.rooms[0]); }
    }).catch(e => { if (active) setStatus(e.message); });
    return () => { active = false; };
  }, [initialRoom]);
  useEffect(() => {
    let active = true; setViewAccess("");
    fetch("/api/rooms?name=" + encodeURIComponent(roomName), { cache: "no-store" }).then(r => r.json()).then(data => { if (active) setViewAccess(data.viewAccess || ""); });
    return () => { active = false; };
  }, [roomName]);
  const editRoom = async (data: Record<string, string>) => {
    const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || "Ошибка изменения комнаты");
    setRooms(result.rooms); return result.rooms as string[];
  };
  const switchRoom = (next: string) => {
    if (!next || next === roomName) return;
    setSessionToken(undefined); setRoomName(next);
    window.history.replaceState(null, "", `/studio?room=${encodeURIComponent(next)}`);
  };
  const createRoom = async () => {
    const next = newRoomName.trim(); if (!next || roomBusy) return;
    setRoomBusy(true);
    try { await editRoom({ action: "create", name: next, password: newRoomPassword }); setNewRoomName(""); setNewRoomPassword(""); switchRoom(next); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка создания"); } finally { setRoomBusy(false); }
  };
  const renameRoom = async () => {
    const next = window.prompt("Новое название комнаты", roomName)?.trim(); if (!next || next === roomName) return;
    try {
      await editRoom({ action: "rename", name: roomName, newName: next });
      await Promise.all(guests.map(g => fetch("/api/move-guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: roomName, identity: g.identity, targetRoom: next }) })));
      switchRoom(next);
    } catch (e) { alert(e instanceof Error ? e.message : "Ошибка переименования"); }
  };
  const deleteRoom = async () => {
    if (!window.confirm(`Удалить комнату «${roomName}» из списка Studio?`)) return;
    try { const remaining = await editRoom({ action: "delete", name: roomName }); switchRoom(remaining[0]); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка удаления"); }
  };
  const kick = async (identity: string, name: string) => {
    if (!window.confirm(`Отключить «${name}» от комнаты? Участник сможет войти снова.`)) return;
    try {
      const response = await fetch("/api/participants", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: roomName, identity }) });
      if (!response.ok) throw Error((await response.json()).error || "Не удалось отключить участника");
    } catch (e) { alert(e instanceof Error ? e.message : "Ошибка отключения"); }
  };
  const [status, setStatus] = useState("Подключение…");
  const [guests, setGuests] = useState<GuestStat[]>([]);
  const [copied, setCopied] = useState<string>();
  const [receiveSettings, setReceiveSettings] = useState<Record<string, number>>({});
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [returnStats, setReturnStats] = useState({ resolution: "—", videoKbps: 0, audioKbps: 0, fps: 0 });
  const [statsDebug, setStatsDebug] = useState("ожидание");
  const [audioDebug, setAudioDebug] = useState<Record<string,string>>({});
  const returnPrevStats = useRef({ videoBytes: 0, audioBytes: 0, ts: 0 });
  const clientInfoRef = useRef<Record<string, { camera?: string; cpu?: string; gpu?: string; platform?: string; sampleRate?: number }>>({});
  const guestMeterTargetsRef = useRef<Record<string, number>>({});
  const guestMeterDisplayRef = useRef<Record<string, number>>({});
  const [returnVideoDevice, setReturnVideoDevice] = useState("");
  const [returnAudioDevice, setReturnAudioDevice] = useState("");
  const [returnOutputDevice, setReturnOutputDevice] = useState("default");
  const [returnFps, setReturnFps] = useState<StudioFrameRate>(30);
  const [returnBitrate, setReturnBitrate] = useState(4000);
  const [returnDevices, setReturnDevices] = useState<MediaDeviceInfo[]>([]);
  const [returnLevel, setReturnLevel] = useState(-60);
  const [returnGain, setReturnGain] = useState(100);
  const returnGainNodeRef = useRef<GainNode | undefined>(undefined);
  const [returnActive, setReturnActive] = useState(false);
  const [returnMonitor, setReturnMonitor] = useState<MonitorPreference>({ audio: false, video: true, volume: 100 });
  const [onAir, setOnAir] = useState(false);
  const [airBusy, setAirBusy] = useState(false);
  const onAirRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const [onAirStatus, setOnAirStatus] = useState("OFF AIR");
  const returnVideoRef = useRef<HTMLVideoElement>(null);
  const returnStreamRef = useRef<MediaStream | undefined>(undefined);
  const returnPublishedRef = useRef<{ video?: any; audio?: any }>({});
  const returnPublicationRef = useRef<{ video?: any; audio?: any }>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let meterRaf = 0;
    let stopTelemetry: (() => void) | undefined;
    setSessionToken(undefined);
    onAirRef.current = false;
    setOnAir(false);
    setReturnActive(false);
    setOnAirStatus("OFF AIR");
    returnPublishedRef.current = {};
    returnPublicationRef.current = {};
    setGuests([]);
    const previous = new Map<string, { bytes: number; ts: number }>();
    const previousAudio = new Map<string, { energy: number; duration: number }>();

    const refresh = async () => {
      const rows: GuestStat[] = [];
      for (const participant of room.remoteParticipants.values()) {
        if (!participant.identity.startsWith("guest-")) continue;
        const cameraPub = participant.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
        const micPub = participant.getTrackPublication(Track.Source.Microphone) as RemoteTrackPublication | undefined;
        let resolution = "—";
        let bitrateKbps = 0;
        let packetLoss = 0;
        let jitterMs = 0;
        let rttMs = 0;
        let signalDb = -60;
        let signalLevel = 0;

        if (cameraPub?.track) {
          const report = await cameraPub.track.getRTCStatsReport();
          report?.forEach((stat) => {
            if (stat.type === "inbound-rtp" && stat.kind === "video") {
              if (stat.frameWidth && stat.frameHeight) resolution = `${stat.frameWidth}×${stat.frameHeight}`;
              const prev = previous.get(participant.identity);
              if (prev && stat.timestamp > prev.ts) {
                bitrateKbps = Math.max(0, Math.round(((stat.bytesReceived - prev.bytes) * 8) / (stat.timestamp - prev.ts)));
              }
              previous.set(participant.identity, { bytes: stat.bytesReceived || 0, ts: stat.timestamp });
              packetLoss = Math.max(0, stat.packetsLost || 0);
              jitterMs = Math.round((stat.jitter || 0) * 1000);
            }
            if (stat.type === "remote-inbound-rtp" && stat.kind === "video") {
              rttMs = Math.round((stat.roundTripTime || 0) * 1000);
            }
          });
        }

        if (micPub?.track) {
          const linear = Number(participant.audioLevel || 0);
          signalDb = linear > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(linear))) : -60;
          signalLevel = Math.round(Math.max(0, Math.min(100, linear * 100)));
        }

        const stability: GuestStat["stability"] =
          packetLoss > 10 || jitterMs > 60 || rttMs > 300 ? "Плохая" :
          packetLoss > 2 || jitterMs > 30 || rttMs > 150 ? "Средняя" : "Хорошая";

        rows.push({
          identity: participant.identity,
          name: participant.name || participant.identity.replace(/^guest-/, ""),
          resolution,
          bitrateKbps,
          packetLoss,
          jitterMs,
          rttMs,
          stability,
          camera: !!cameraPub && !cameraPub.isMuted,
          microphone: !!micPub && !micPub.isMuted,
          cameraDevice: clientInfoRef.current[participant.identity]?.camera,
          cpu: clientInfoRef.current[participant.identity]?.cpu,
          gpu: clientInfoRef.current[participant.identity]?.gpu,
          platform: clientInfoRef.current[participant.identity]?.platform,
          sampleRate: clientInfoRef.current[participant.identity]?.sampleRate,
          signalLevel,
          signalDb,
        });
      }
      if (onAirRef.current) {
        const localPubs = Array.from(room.localParticipant.trackPublications.values()) as any[];
        const videoPubNow = returnPublicationRef.current.video || localPubs.find((p:any) => p.kind === Track.Kind.Video);
        const audioPubNow = returnPublicationRef.current.audio || localPubs.find((p:any) => p.kind === Track.Kind.Audio);
        const videoTrack = returnPublishedRef.current.video || videoPubNow?.track;
        const audioTrack = returnPublishedRef.current.audio || audioPubNow?.track;
        if (videoTrack) returnPublishedRef.current.video = videoTrack;
        if (audioTrack) returnPublishedRef.current.audio = audioTrack;
        let resolution = "—", videoKbps = 0, audioKbps = 0, videoBytes = 0, audioBytes = 0, fps = 0, packets = 0, ts = performance.now();
        if (videoTrack && "getSenderStats" in videoTrack) {
          const stats = await (videoTrack as any).getSenderStats();
          const list = Array.isArray(stats) ? stats : stats ? [stats] : [];
          const s = list.find((x: any) => x.frameWidth && x.frameHeight) || list[0];
          if (s) { resolution = s.frameWidth && s.frameHeight ? `${s.frameWidth}×${s.frameHeight}` : resolution; fps = s.framesPerSecond || 0; }
          videoBytes = list.reduce((sum: number, x: any) => sum + (x.bytesSent || 0), 0);
          if (resolution === "—") { const ms = returnStreamRef.current?.getVideoTracks()[0]?.getSettings(); if (ms?.width && ms?.height) resolution = `${ms.width}×${ms.height}`; }
        }
        if (audioTrack && "getSenderStats" in audioTrack) {
          const s = await (audioTrack as any).getSenderStats();
          if (s) audioBytes = s.bytesSent || 0;
        }
        if (!videoBytes && videoTrack && "getRTCStatsReport" in videoTrack) {
          const raw = await (videoTrack as any).getRTCStatsReport();
          raw?.forEach((s: any) => {
            if (s.type === "outbound-rtp" && !s.isRemote && (s.kind === "video" || s.mediaType === "video")) {
              videoBytes += Number(s.bytesSent || 0);
              fps = Number(s.framesPerSecond || fps);
              if (s.frameWidth && s.frameHeight) resolution = String(s.frameWidth) + "×" + String(s.frameHeight);
            }
          });
        }
        if (!audioBytes && audioTrack && "getRTCStatsReport" in audioTrack) {
          const raw = await (audioTrack as any).getRTCStatsReport();
          raw?.forEach((s: any) => {
            if (s.type === "outbound-rtp" && !s.isRemote && (s.kind === "audio" || s.mediaType === "audio")) audioBytes += Number(s.bytesSent || 0);
          });
        }
        const prev = returnPrevStats.current;
        const videoStats = videoTrack && "getSenderStats" in videoTrack ? await (videoTrack as any).getSenderStats() : [];
        const videoList = Array.isArray(videoStats) ? videoStats : videoStats ? [videoStats] : [];
        const activeVideo = videoList.reduce((best: any, s: any) => Number(s.bytesSent || 0) > Number(best?.bytesSent || 0) ? s : best, undefined);
        const audioStats = audioTrack && "getSenderStats" in audioTrack ? await (audioTrack as any).getSenderStats() : undefined;
        if (activeVideo) {
          videoBytes = Number(activeVideo.bytesSent || 0);
          fps = Number(activeVideo.framesPerSecond || 0);
          if (activeVideo.frameWidth && activeVideo.frameHeight) resolution = activeVideo.frameWidth + "×" + activeVideo.frameHeight;
          ts = Number(activeVideo.timestamp || ts);
        }
        if (audioStats) audioBytes = Number(audioStats.bytesSent || 0);
        if (prev.ts && ts > prev.ts) {
          videoKbps = Math.max(0, Math.round((videoBytes - prev.videoBytes) * 8 / (ts - prev.ts)));
          audioKbps = Math.max(0, Math.round((audioBytes - prev.audioBytes) * 8 / (ts - prev.ts)));
        }
        returnPrevStats.current = { videoBytes, audioBytes, ts };
        if (!cancelled) {
          setReturnStats({ resolution, videoKbps, audioKbps, fps });
          setStatsDebug(`ON AIR=${onAirRef.current}; pubs=${localPubs.length}; videoPub=${!!videoPubNow}; audioPub=${!!audioPubNow}; videoTrack=${!!videoTrack}; audioTrack=${!!audioTrack}; videoStats=${videoList.length}; videoBytes=${videoBytes}; audioBytes=${audioBytes}; ts=${Math.round(ts)}`);
        }
      } else if (!cancelled) { setReturnStats({ resolution: "—", videoKbps: 0, audioKbps: 0, fps: 0 }); setStatsDebug(`ON AIR=${onAirRef.current}; публикация выключена`); }
      if (!cancelled) setGuests(rows.filter(row => room.remoteParticipants.has(row.identity)));
    };
    refreshRef.current = refresh;

    (async () => {
      try {
        const identity = `studio-panel-${crypto.randomUUID()}`;
        const response = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&name=Studio%20Panel&role=studio-panel`);
        if (!response.ok) throw new Error(await response.text());
        const { token } = await response.json();
        if (cancelled) return;
        await room.connect(getLiveKitUrl(), token);
        if (cancelled) return;
        setSessionToken(token);
        stopTelemetry = startRoomTelemetry(room, roomName, token);
        if (!cancelled) setStatus("Онлайн");
        await refresh();
        timer = setInterval(refresh, 2000);
        const animateMeters = () => {
          if (cancelled) return;
          setGuests((current) => current.map((g) => {
            const target = guestMeterTargetsRef.current[g.identity] ?? 0;
            const shown = guestMeterDisplayRef.current[g.identity] ?? 0;
            const next = target > shown
              ? shown + (target - shown) * 0.72
              : shown + (target - shown) * 0.12;
            const settled = next < 0.0005 ? 0 : next;
            guestMeterDisplayRef.current[g.identity] = settled;
            const signalDb = settled > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(settled))) : -60;
            return { ...g, signalDb, signalLevel: Math.round(settled * 100) };
          }));
          meterRaf = requestAnimationFrame(animateMeters);
        };
        meterRaf = requestAnimationFrame(animateMeters);
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Ошибка подключения");
      }
    })();

    const update = () => void refresh();
    room.on(RoomEvent.ParticipantConnected, update);
    const departed = (participant: { identity: string }) => {
      setGuests(current => current.filter(g => g.identity !== participant.identity));
      delete clientInfoRef.current[participant.identity];
      delete guestMeterTargetsRef.current[participant.identity];
      delete guestMeterDisplayRef.current[participant.identity];
      update();
    };
    room.on(RoomEvent.ParticipantDisconnected, departed);
    room.on(RoomEvent.TrackPublished, update);
    room.on(RoomEvent.TrackUnpublished, update);
    room.on(RoomEvent.TrackMuted, update);
    room.on(RoomEvent.TrackUnmuted, update);
    const updateMeterTargets = () => {
      for (const participant of room.remoteParticipants.values()) {
        if (!participant.identity.startsWith("guest-")) continue;
        guestMeterTargetsRef.current[participant.identity] = Number(participant.audioLevel || 0);
      }
    };
    room.on(RoomEvent.ActiveSpeakersChanged, updateMeterTargets);
    const onData = (payload: Uint8Array, participant?: { identity: string }, _kind?: unknown, topic?: string) => {
      if (topic !== "studiolink-client-info" || !participant?.identity.startsWith("guest-")) return;
      try { clientInfoRef.current[participant.identity] = JSON.parse(new TextDecoder().decode(payload)); void refresh(); } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    const debugTracks = () => {
      const next: Record<string,string> = {};
      for (const p of room.remoteParticipants.values()) {
        if (!p.identity.startsWith("guest-")) continue;
        const pubs = Array.from(p.trackPublications.values());
        next[p.identity] = pubs.map((x:any) => `${x.kind}/${x.source}/sub=${x.isSubscribed}/muted=${x.isMuted}/track=${!!x.track}`).join(" | ") || "нет publications";
      }
      setAudioDebug(next);
    };
    room.on(RoomEvent.TrackSubscribed, debugTracks);
    room.on(RoomEvent.TrackPublished, debugTracks);
    const debugTimer = setInterval(debugTracks, 1000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      clearInterval(debugTimer);
      stopTelemetry?.();
      cancelAnimationFrame(meterRaf);
      room.off(RoomEvent.TrackSubscribed, debugTracks);
      room.off(RoomEvent.TrackPublished, debugTracks);
      room.off(RoomEvent.ParticipantConnected, update);
      room.off(RoomEvent.ParticipantDisconnected, departed);
      room.off(RoomEvent.TrackPublished, update);
      room.off(RoomEvent.TrackUnpublished, update);
      room.off(RoomEvent.TrackMuted, update);
      room.off(RoomEvent.TrackUnmuted, update);
      room.off(RoomEvent.ActiveSpeakersChanged, updateMeterTargets);
      room.off(RoomEvent.DataReceived, onData);
      room.disconnect();
    };
  }, [room, roomName]);

  useEffect(() => {
    if (!returnActive) return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | undefined;
    let captured: MediaStream | undefined;
    let processed: MediaStream | undefined;
    (async () => {
      try {
        returnStreamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: studioVideoConstraints(returnVideoDevice, returnFps),
          audio: returnAudioDevice ? { deviceId: { exact: returnAudioDevice }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        captured = new MediaStream(stream.getTracks());
        returnStreamRef.current = stream;
        if (returnVideoRef.current) { returnVideoRef.current.srcObject = stream; await returnVideoRef.current.play().catch(() => undefined); }
        const devices = await navigator.mediaDevices.enumerateDevices();
        setReturnDevices(devices);
        // Do not copy the browser-selected default device IDs back into state here.
        // Doing so retriggers this effect, its cleanup stops the very MediaStreamTracks
        // that may already have been published by ON AIR, and LiveKit then unpublishes them.
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        const gain = ctx.createGain();
        gain.gain.value = returnGain / 100;
        returnGainNodeRef.current = gain;
        const destination = ctx.createMediaStreamDestination();
        processed = destination.stream;
        source.connect(gain);
        gain.connect(analyser);
        gain.connect(destination);
        const processedAudio = destination.stream.getAudioTracks()[0];
        stream.removeTrack(stream.getAudioTracks()[0]);
        stream.addTrack(processedAudio);
        const data = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(data);
          let peak = 0;
          for (const sample of data) peak = Math.max(peak, Math.abs(sample));
          const db = peak > 0 ? 20 * Math.log10(peak) : -60;
          setReturnLevel(Math.max(-60, Math.min(0, Math.round(db * 10) / 10)));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { console.error("Studio return preview failed", e); if (!cancelled) setOnAirStatus(e instanceof Error ? e.message : "Не удалось открыть устройства Studio Return"); }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); captured?.getTracks().forEach((t) => t.stop()); processed?.getTracks().forEach((t) => t.stop()); returnStreamRef.current = undefined; void ctx?.close().catch(() => undefined); };
  }, [returnActive, returnVideoDevice, returnAudioDevice, returnFps]);

  useEffect(() => { if (returnGainNodeRef.current) returnGainNodeRef.current.gain.value = returnGain / 100; }, [returnGain]);
  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.enumerateDevices().then(devices => { if (active) setReturnDevices(devices); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const video = returnVideoRef.current;
    if (video) { video.muted = !returnMonitor.audio; video.volume = returnMonitor.volume / 100; }
  }, [returnMonitor, returnActive]);

  const toggleOnAir = async () => {
    if (airBusy) return;
    setAirBusy(true);
    try {
      const stream = returnStreamRef.current;
      if (!stream) throw Error("Дождитесь готовности предпросмотра Studio Return");
      if (onAir) {
        for (const publication of room.localParticipant.trackPublications.values()) {
          if (publication.track) await room.localParticipant.unpublishTrack(publication.track, false);
        }
        returnPublishedRef.current = {};
        returnPublicationRef.current = {};
        returnPrevStats.current = { videoBytes: 0, audioBytes: 0, ts: 0 };
        onAirRef.current = false;
        setOnAir(false);
        setOnAirStatus("OFF AIR");
        return;
      }
      const video = stream.getVideoTracks()[0];
      const audio = stream.getAudioTracks()[0];
      if (!video || !audio || video.readyState !== "live" || audio.readyState !== "live") throw new Error("Нет видео или аудио Studio Return");
      const videoPub = await room.localParticipant.publishTrack(video, studioVideoPublishOptions(returnBitrate, returnFps));
      const audioPub = await room.localParticipant.publishTrack(audio, { source: Track.Source.Microphone, name: "Studio Return Audio", audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: true });
      returnPublicationRef.current = { video: videoPub, audio: audioPub };
      returnPublishedRef.current = { video: videoPub.track, audio: audioPub.track };
      onAirRef.current = true;
      returnPrevStats.current = { videoBytes: 0, audioBytes: 0, ts: 0 };
      setOnAir(true);
      void refreshRef.current();
      setOnAirStatus("ON AIR");
    } catch (e) {
      console.error("Studio Return publish failed", e);
      for (const publication of room.localParticipant.trackPublications.values()) {
        if (publication.track) await room.localParticipant.unpublishTrack(publication.track, false);
      }
      onAirRef.current = false; setOnAir(false);
      setOnAirStatus("Ошибка публикации");
    } finally { setAirBusy(false); }
  };

  const base = typeof window === "undefined" ? "" : window.location.origin;
  const outputUrl = (identity: string) => `${base}/output/${encodeURIComponent(identity)}?room=${encodeURIComponent(roomName)}&bitrate=${receiveFor(identity)}&access=${encodeURIComponent(viewAccess)}`;
  const receiveFor = (identity: string) => receiveSettings[identity] || 2500;
  const applyReceiveQuality = (identity: string, bitrateKbps: number) => {
    const participant = room.remoteParticipants.get(identity);
    const publication = participant?.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
    if (!publication) return;
    // LiveKit simulcast exposes discrete layers rather than an arbitrary subscriber bitrate.
    // Map the requested receive budget to the highest sensible layer.
    if (bitrateKbps <= 750) {
      publication.setVideoDimensions({ width: 320, height: 180 });
    } else if (bitrateKbps <= 1800) {
      publication.setVideoDimensions({ width: 640, height: 360 });
    } else if (bitrateKbps <= 3000) {
      publication.setVideoDimensions({ width: 1280, height: 720 });
    } else {
      publication.setVideoDimensions({ width: 1920, height: 1080 });
    }
    setReceiveSettings((s) => ({ ...s, [identity]: bitrateKbps }));
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ target: identity, bitrateKbps })), { reliable: true, topic: "studiolink-output-quality" });
  };

  return (
    <main className="media-page studio-page">
      <div className="studio-header">
        <div>
          <p className="muted">StudioLink · Studio Panel</p>
          <h1>{roomName}</h1>

        </div>
        <div className="status-pill">{status}</div>
      </div>
      <section className="studio-video-wall" hidden={activeTab !== "studio"} aria-label="Видео студии и гостей">
        <div className="panel studio-video-card"><h2>Studio Return</h2>
          {returnActive ? <video ref={returnVideoRef} muted={!returnMonitor.audio} playsInline className="return-preview" style={{ opacity: returnMonitor.video ? 1 : 0 }} /> : <div className="studio-preview-placeholder">Проверка Studio Return остановлена</div>}
        </div>
        {guests.map(g => <div className="panel studio-video-card" key={g.identity}><h2>{g.name}</h2><GuestPreview room={room} identity={g.identity} name={g.name} preference={monitoring.preferences[g.identity]} onChange={(patch) => monitoring.change(g.identity, patch)} /></div>)}
      </section>
      <nav className="studio-tabs" aria-label="Раздел студии">
        <button aria-pressed={activeTab === "studio"} onClick={() => setActiveTab("studio")}>Студия</button>
        <button aria-pressed={activeTab === "statistics"} onClick={() => setActiveTab("statistics")}>Статистика и графики</button>
        <button onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.reload(); }}>Выйти из студии</button>
      </nav>
      <RoomAudioRenderer room={room} />
          <div className="panel studio-room-controls">
            <select value={roomName} onChange={(e) => switchRoom(e.target.value)} aria-label="Активная комната">
              {rooms.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createRoom(); }} placeholder="Название новой комнаты" aria-label="Название новой комнаты" style={{minWidth:220}} />
            <input type="password" autoComplete="new-password" value={newRoomPassword} onChange={e => setNewRoomPassword(e.target.value)} placeholder="Пароль гостей (необязательно)" aria-label="Пароль новой комнаты" maxLength={256} />
            <button type="button" disabled={!newRoomName.trim() || roomBusy} onClick={createRoom}>+ Создать комнату</button>
            <button type="button" onClick={renameRoom}>✎ Изменить</button>
            <button type="button" onClick={deleteRoom}>Удалить комнату</button>
          </div>
      <div className="panel"><MediaDevicePicker cameraId={returnVideoDevice} microphoneId={returnAudioDevice} headphonesId={returnOutputDevice} onChange={change => {
        if (change.cameraId !== undefined) setReturnVideoDevice(change.cameraId);
        if (change.microphoneId !== undefined) setReturnAudioDevice(change.microphoneId);
        if (change.headphonesId !== undefined) setReturnOutputDevice(change.headphonesId);
      }} />

        <RoomInviteButton roomName={roomName} key={roomName} />
      </div>
      {activeTab === "statistics" && <StatisticsDashboard roomName={roomName} token={sessionToken} identity={room.localParticipant.identity} />}
      <section hidden={activeTab !== "studio"}>
      <div className="panel return-panel">
        <div className="return-title"><div><h2>Studio Return <span className={`air-state ${onAir ? "air-live" : ""}`}>{onAirStatus}</span></h2><p className="muted">Предпросмотр видео и аудио, которые отправляются гостям.</p></div><div className="return-buttons">        <button type="button" aria-pressed={studioOnly} className={studioOnly ? "on-air-button" : ""} disabled={modeBusy} onClick={async () => {
          const next = !studioOnly; setModeBusy(true);
          try {
            const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mode", name: roomName, studioOnly: next }) });
            if (!response.ok) throw Error("Не удалось изменить режим комнаты");
            setStudioOnly(next);
          } catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка режима комнаты"); } finally { setModeBusy(false); }
        }}>Гости могут видеть только студию</button><button disabled={onAir || airBusy} onClick={() => setReturnActive((v) => !v)}>{returnActive ? "Остановить проверку" : "Проверить Studio Return"}</button><button className={onAir ? "off-air-button" : "on-air-button"} disabled={!returnActive || airBusy || !sessionToken} onClick={() => void toggleOnAir()}>{onAir ? "OFF AIR" : "ON AIR"}</button></div></div>
        <div className="av-grid">
          <label>Частота кадров студии<select aria-label="Частота кадров студии" disabled={onAir || airBusy} value={returnFps} onChange={e => setReturnFps(Number(e.target.value) as StudioFrameRate)}>{STUDIO_FRAME_RATES.map(fps => <option key={fps} value={fps}>{fps} FPS</option>)}</select></label>
          <label>Лимит видеобитрейта студии<select aria-label="Лимит видеобитрейта студии" disabled={onAir || airBusy} value={returnBitrate} onChange={e => setReturnBitrate(Number(e.target.value))}>{VIDEO_BITRATES_KBPS.map(bitrate => <option key={bitrate} value={bitrate}>{bitrate} кбит/с</option>)}</select></label>
        </div>
        <p className="muted">FPS и битрейт выбираются до ON AIR. Фактические значения показаны ниже и зависят от источника и сети.</p>
        {returnActive && <div className="return-settings">
          <div className="return-controls">
            <div className="return-audio-meter">
              <div className="meter-label"><span>Studio Return</span><strong>{returnLevel.toFixed(1)} dBFS</strong></div>
              <div className="db-meter"><div className="db-meter-fill" style={{ width: `${Math.max(0, Math.min(100, (returnLevel + 60) / 60 * 100))}%` }} /></div>
              <div className="db-scale"><span>-60</span><span>-18</span><span>-10</span><span>0 dB</span></div>
              <div className="gain-control"><span>Gain</span><input type="range" min="0" max="200" value={returnGain} onChange={(e) => setReturnGain(Number(e.target.value))} /><strong>{returnGain}%</strong></div>
            </div>
            <strong>Мой Studio Return — мониторинг</strong>
            <MonitoringControls name="Studio Return" value={returnMonitor} onChange={(patch) => setReturnMonitor((value) => ({ ...value, ...patch }))} />
            <p className="muted">Эти переключатели меняют только предпросмотр. ON AIR управляет эфиром. Для прослушивания собственного микрофона используйте наушники.</p>
          </div>
        </div>}
      </div>
      <div className="panel return-stats"><strong>Исходящий поток студии</strong><span>Видео: {returnStats.resolution} · {returnStats.videoKbps} кбит/с · {returnStats.fps} fps</span><span>Аудио: {returnStats.audioKbps} кбит/с</span><small style={{opacity:.75}}>Диагностика: {statsDebug}</small></div>
      <div className="panel"><h2>Участники комнаты</h2>
        {monitoring.participants.length ? monitoring.participants.map(p => <div className="personal-monitor-row" key={p.identity}><span>{p.name || p.identity}</span><button onClick={() => void kick(p.identity, p.name || p.identity)}>Отключить участника</button></div>) : <p className="muted">Пока подключена только эта студия.</p>}
      </div>
      <div className="panel">
        <p className="muted">Мониторинг гостей меняется только в этой студии. Громкость и выключение видео не влияют на эфир, других гостей и выходы vMix.</p>
        {guests.length === 0 ? <p className="muted">Подключённых гостей пока нет.</p> : (
          <div className="guest-table-wrap">
            <table className="guest-table">
              <thead><tr><th>Гость</th><th>Мониторинг</th><th>Разрешение</th><th>Факт. битрейт</th><th>Сеть</th><th>RTT / jitter</th><th>Входящий поток</th><th>vMix</th></tr></thead>
              <tbody>{guests.map((g) => (
                <tr key={g.identity}>
                  <td><strong>{g.name}</strong><small>{g.identity}</small><small>Камера: {g.cameraDevice || "—"}</small><small>CPU: {g.cpu || "—"}</small><small>GPU: {g.gpu || "—"}</small><small>ОС: {g.platform || "—"}</small><div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}><select value={moveTargets[g.identity] || ""} onChange={(e)=>setMoveTargets((v)=>({...v,[g.identity]:e.target.value}))}><option value="">Перевести в комнату…</option>{rooms.filter((name)=>name!==roomName).map((name)=><option key={name} value={name}>{name}</option>)}</select><button disabled={!moveTargets[g.identity]} onClick={async()=>{const targetRoom=moveTargets[g.identity];if(!targetRoom)return;const response=await fetch("/api/move-guest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({room:roomName,identity:g.identity,targetRoom})});if(!response.ok)alert("Не удалось перевести гостя");}}>Перевести</button><button onClick={async()=>{const p=room.remoteParticipants.get(g.identity);if(!p)return;for(const pub of p.trackPublications.values()){if(pub.kind===Track.Kind.Video||pub.kind===Track.Kind.Audio){pub.setSubscribed(false);}}await new Promise(r=>setTimeout(r,250));for(const pub of p.trackPublications.values()){if(pub.kind===Track.Kind.Video||pub.kind===Track.Kind.Audio){pub.setSubscribed(true);if(pub.kind===Track.Kind.Video){pub.setVideoQuality(VideoQuality.HIGH);}}}monitoring.apply();setTimeout(()=>void refreshRef.current(),500);}}>↻ Обновить</button></div></td>
                  <td><MonitoringControls name={g.name} value={monitoring.preferences[g.identity]} onChange={(patch) => monitoring.change(g.identity, patch)} /></td>
                  <td>{g.resolution}</td>
                  <td>{g.bitrateKbps ? `${g.bitrateKbps} кбит/с` : "—"}</td>
                  <td><span className={`net net-${g.stability === "Хорошая" ? "good" : g.stability === "Средняя" ? "mid" : "bad"}`}>{g.stability}</span></td>
                  <td><div className="detailed-net"><span>RTT: {g.rttMs || "—"} мс</span><span>Jitter: {g.jitterMs || "—"} мс</span><span>Потери: {g.packetLoss} пак.</span><span>Audio: {g.sampleRate ? `${g.sampleRate} Hz` : "—"}</span><GuestAudioMeter track={room.remoteParticipants.get(g.identity)?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined} fallbackDb={g.signalDb} /><small style={{display:"block",maxWidth:360,overflowWrap:"anywhere",opacity:.7}}>TRACK: {audioDebug[g.identity] || "ожидание"}</small></div></td>
                  <td>
                    <div className="quality-controls">
                      <select value={receiveFor(g.identity)} onChange={(e) => applyReceiveQuality(g.identity, Number(e.target.value))}>
                        {VIDEO_BITRATES_KBPS.map((v) => <option key={v} value={v}>{v} кбит/с</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="actions">
                    <a className="button-link" href={outputUrl(g.identity)} target="_blank" rel="noreferrer">Открыть</a>
                    <button onClick={async () => { await navigator.clipboard.writeText(outputUrl(g.identity)); setCopied(g.identity); setTimeout(() => setCopied(undefined), 1200); }}>{copied === g.identity ? "Скопировано" : "Копировать URL"}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted studio-note">Статистика обновляется каждые 2 секунды. Входящий лимит выбирает подходящий simulcast-слой для Studio Panel; фактический битрейт зависит от содержимого кадра и сети.</p>
      </section>
    </main>
  );
}

export default function StudioPage() {
  return <Suspense fallback={<main><div className="panel">Загрузка Studio Panel…</div></main>}><AccessGate kind="studio"><StudioEntry /></AccessGate></Suspense>;
}

function StudioEntry() {
  const params = useSearchParams();
  const [selected, setSelected] = useState<string>();
  return selected ? <StudioContent initialRoom={selected} /> : <StudioRoomPicker initialRoom={params.get("room") || ""} onJoin={name => { window.history.replaceState(null, "", `/studio?room=${encodeURIComponent(name)}`); setSelected(name); }} />;
}
