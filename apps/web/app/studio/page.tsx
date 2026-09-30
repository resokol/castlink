"use client";
import { readTrackStats } from "@/lib/media-stats";
import { RemoteVideoPreview } from "@/components/RemoteVideoPreview";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { RotateVideoButton } from "@/components/RotateVideoButton";

import { AccessGate } from "@/components/AccessGate";
import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { RemoteStudioDevices } from "@/components/RemoteStudioDevices";
import type { StudioDesired } from "@/lib/studio-control";
import { StudioRoomPicker } from "@/components/StudioRoomPicker";
import { useStudioStreamRelay } from "@/lib/studio-stream-relay";
import { StudioStreamInviteButton } from "@/components/StudioStreamInviteButton";
import { RoomInviteButton } from "@/components/RoomInviteButton";
import { AdminInviteButton } from "@/components/AdminInviteButton";
import { ModeratorInviteButton } from "@/components/ModeratorInviteButton";
import { useRoomMode } from "@/lib/room-mode";
import { DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, STUDIO_FRAME_RATES, applyStudioSenderQuality, isValidStudioVideoBitrateKbps, studioVideoEncodingsMatch, studioVideoConstraints, studioVideoPublishOptions, videoBitrateOptions, type StudioFrameRate } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { createStudioOutboundSample, selectStudioOutboundView, receiveStudioActual, type StudioOutboundSample } from "@/lib/studio-outbound-stats";
import { readControlResponse } from "@/lib/control-response";
import { RoomAudioRenderer } from "@livekit/components-react";
import { clearTransferSnapshot, readTransferSnapshot, transferDestination, type TransferSnapshot } from "@/lib/client-transfer";
import { resolveParticipantRole } from "@/lib/participant-role";
import { outputQualityRecipients, parseGuestClientInfo } from "@/lib/guest-media";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AudioPresets, Room, RoomEvent, Track, VideoQuality, type LocalVideoTrack, type RemoteAudioTrack, type RemoteTrackPublication } from "livekit-client";

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

const moderatorStudioMonitorDefaults: Record<string, MonitorPreference> = {
  "studio-panel-main": { audio: false, video: true, volume: 100 },
};

type TransferTarget = { id: string; label: string; origin: string; available: boolean; reason?: string };

function getStudioClientId(studioId: string) {
  const key = `studiolink-studio-control-client-id:${studioId}`;
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
  return value;
}

async function acquireStudioClientId(studioId: string) {
  const holder = window as Window & { __studioClientLease?: Promise<{ clientId: string; release: () => void }> };
  if (holder.__studioClientLease) return holder.__studioClientLease;
  const acquire = (id: string) => new Promise<boolean>(resolve => {
    let settled = false;
    void navigator.locks.request(`studiolink-studio-control:${id}`, { mode: "exclusive", ifAvailable: true }, lock => {
      settled = true;
      resolve(Boolean(lock));
      return lock ? new Promise<void>(() => undefined) : undefined;
    }).catch(() => { if (!settled) resolve(false); });
  });
  holder.__studioClientLease = (async () => {
    const key = `studiolink-studio-control-client-id:${studioId}`;
    let clientId = getStudioClientId(studioId);
    if (navigator.locks && !(await acquire(clientId))) {
      clientId = crypto.randomUUID();
      sessionStorage.setItem(key, clientId);
      await acquire(clientId);
    }
    // The document owns this ID until the browser releases its Web Lock on unload.
    return { clientId, release: () => undefined };
  })();
  return holder.__studioClientLease;
}

function GuestAudioMeter({ track, fallbackDb = -60, compact = false }: { track?: RemoteAudioTrack; fallbackDb?: number; compact?: boolean }) {
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
  return <><span className="signal-row vdo-audio-level"><b>MIC</b><i className="signal-meter"><i style={{width: `${width}%`}} /></i><strong>{db.toFixed(1)} dBFS</strong></span>{!compact && <small style={{display:"block",opacity:.7}}>{debug}</small>}</>;
}

function GuestPreview({ room, identity, name, preference = defaultMonitor, onChange }: {
  room: Room; identity: string; name: string; preference?: MonitorPreference; onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  return <div className="guest-preview-cell">
    <div className="studio-guest-video-wrap"><RemoteVideoPreview room={room} identity={identity} enabled={preference.video} />
      <button className="preview-fullscreen" title="Во весь экран" onClick={(event) => void event.currentTarget.parentElement?.requestFullscreen()}>⛶</button>
    </div>
  </div>;
}

function StudioContent({ studioId, initialRoom, transferSnapshot }: { studioId: string; initialRoom: string; transferSnapshot?: TransferSnapshot }) {
  const [roomName, setRoomName] = useState(initialRoom);
  const [rooms, setRooms] = useState<string[]>([initialRoom]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomEditOpen, setRoomEditOpen] = useState(false);
  const [editRoomName, setEditRoomName] = useState(initialRoom);
  const [editRoomPassword, setEditRoomPassword] = useState("");
  const [currentRoomPassword, setCurrentRoomPassword] = useState("");
  const [showEditRoomPassword, setShowEditRoomPassword] = useState(false);
  const [removeRoomPassword, setRemoveRoomPassword] = useState(false);
  const [roomPasswordSet, setRoomPasswordSet] = useState(false);
  const [roomAccessVersion, setRoomAccessVersion] = useState(0);
  const [viewAccess, setViewAccess] = useState("");
  const room = useMemo(() => new Room({ adaptiveStream: false, dynacast: false }), [studioId, roomName]);
  const { studioOnly, setStudioOnly } = useRoomMode(roomName, studioId);
  const [modeBusy, setModeBusy] = useState(false);
  const monitoring = usePersonalMonitoring(room, roomName, false, moderatorStudioMonitorDefaults);
  const [participantMetadataRevision, setParticipantMetadataRevision] = useState(0);
  useEffect(() => {
    const refreshParticipantRoles = () => setParticipantMetadataRevision((revision) => revision + 1);
    room.on(RoomEvent.ParticipantMetadataChanged, refreshParticipantRoles);
    return () => { room.off(RoomEvent.ParticipantMetadataChanged, refreshParticipantRoles); };
  }, [room]);
  const [activeTab, setActiveTab] = useState<"studio" | "participants" | "statistics">("studio");
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>();
  const [transferInfo, setTransferInfo] = useState<{ current?: { id: string; label: string }; targets: TransferTarget[]; error?: string; loading: boolean }>({ targets: [], loading: true });
  const [transferRefresh, setTransferRefresh] = useState(0);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreAutoOnAir, setRestoreAutoOnAir] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const previewReadyRef = useRef(false);
  previewReadyRef.current = previewReady;
  const [pendingStudioLabels, setPendingStudioLabels] = useState<{ video?: string; audio?: string; output?: string }>(() => ({ video: String(transferSnapshot?.settings?.videoLabel || "") || undefined, audio: String(transferSnapshot?.settings?.audioLabel || "") || undefined, output: String(transferSnapshot?.settings?.outputLabel || "") || undefined }));
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}`, { cache: "no-store" }).then(async r => {
      if (!r.ok) throw Error("Не удалось загрузить комнаты");
      const data = await r.json();
      if (active) { setRooms(data.rooms); if (!data.rooms.includes(initialRoom)) setRoomName(data.rooms[0]); }
    }).catch(e => { if (active) setStatus(e.message); });
    return () => { active = false; };
  }, [initialRoom, studioId]);
  useEffect(() => {
    let active = true; setViewAccess("");
    fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(roomName)}`, { cache: "no-store" }).then(r => r.json()).then(data => { if (active) { setViewAccess(data.viewAccess || ""); setRoomPasswordSet(data.passwordSet === true); setCurrentRoomPassword(data.guestPassword || ""); } });
    return () => { active = false; };
  }, [roomName, roomAccessVersion, studioId]);
  useEffect(() => {
    let active = true;
    setTransferInfo(current => ({ ...current, loading: true, error: undefined }));
    fetch(`/api/server-transfer?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось получить список серверов.");
        if (active) setTransferInfo({ current: data.current, targets: Array.isArray(data.targets) ? data.targets : [], loading: false });
      })
      .catch(error => { if (active) setTransferInfo(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Список серверов временно недоступен." })); });
    return () => { active = false; };
  }, [roomName, transferRefresh, studioId]);
  useEffect(() => {
    if (!transferSnapshot || transferSnapshot.role !== "studio") return;
    setRestoreMessage("Комната перенесена. Устройства браузера нужно подтвердить на этом сервере; публикация пока выключена.");
    queueMicrotask(clearTransferSnapshot);
  }, [transferSnapshot]);
  const startServerTransfer = async () => {
    if (!transferTargetId || transferBusy) return;
    setTransferBusy(true); setTransferError("");
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
      const deviceLabels = Object.fromEntries(devices.filter(device => device.label).map(device => [device.deviceId, device.label]));
      const actualVideoId = returnVideoDevice || returnSourceDeviceIdsRef.current.video;
      const actualAudioId = returnAudioDevice || returnSourceDeviceIdsRef.current.audio;
      const response = await fetch("/api/server-transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", studioId, room: roomName, targetId: transferTargetId }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.ticket || !data.targetUrl) throw new Error(data.error || "Не удалось начать перенос комнаты.");
      const snapshot: TransferSnapshot = {
        role: "studio", room: data.room || roomName, sourceOrigin: window.location.origin,
        settings: {
          fps: returnFps, bitrate: returnBitrate, gain: returnGain,
          onAir, returnActive,
          videoLabel: deviceLabels[actualVideoId], audioLabel: deviceLabels[actualAudioId], outputLabel: returnOutputDevice === "default" ? undefined : deviceLabels[returnOutputDevice],
        },
      };
      setRestoreMessage("Подготовлен перенос комнаты. Участники переподключатся на целевом сервере.");
      await new Promise(resolve => setTimeout(resolve, 1500));
      window.location.href = transferDestination(data.targetUrl, data.ticket, snapshot, data.clientTargetUrl);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Не удалось перенести комнату. Текущая сессия продолжает работать.");
    } finally { setTransferBusy(false); }
  };
  const editRoom = async (data: Record<string, string>) => {
    const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, studioId }) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || "Ошибка изменения комнаты");
    setRooms(result.rooms); return result.rooms as string[];
  };
  const switchRoom = (next: string) => {
    if (!next || next === roomName) return;
    setSessionToken(undefined); setRoomName(next);
    window.history.replaceState(null, "", `/studio?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(next)}`);
  };
  const createRoom = async () => {
    const next = newRoomName.trim(); if (!next || roomBusy) return;
    setRoomBusy(true);
    try { await editRoom({ action: "create", name: next, password: newRoomPassword }); setNewRoomName(""); setNewRoomPassword(""); switchRoom(next); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка создания"); } finally { setRoomBusy(false); }
  };
  const openRoomEditor = () => {
    setEditRoomName(roomName); setEditRoomPassword(currentRoomPassword); setRemoveRoomPassword(false); setShowEditRoomPassword(false); setRoomEditOpen(true);
  };
  const saveRoomSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = editRoomName.trim();
    if (!next || roomBusy) return;
    setRoomBusy(true);
    let targetRoom = roomName;
    const passwordChanged = removeRoomPassword || editRoomPassword !== currentRoomPassword;
    try {
      if (next !== roomName) {
        await editRoom({ action: "rename", name: roomName, newName: next });
        await Promise.all(guests.map(g => fetch("/api/move-guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, identity: g.identity, targetRoom: next }) })));
        targetRoom = next;
      }
      if (passwordChanged) {
        await editRoom({ action: "password", name: targetRoom, password: removeRoomPassword ? "" : editRoomPassword });
      }
      setRoomEditOpen(false);
      if (targetRoom !== roomName) switchRoom(targetRoom);
      else if (passwordChanged) {
        setRoomPasswordSet(!removeRoomPassword && !!editRoomPassword);
        setCurrentRoomPassword(removeRoomPassword ? "" : editRoomPassword);
        setViewAccess("");
        setRoomAccessVersion(version => version + 1);
      }
    } catch (e) {
      if (targetRoom !== roomName) switchRoom(targetRoom);
      alert(e instanceof Error ? e.message : "Не удалось изменить настройки комнаты");
    } finally { setRoomBusy(false); }
  };
  const deleteRoom = async () => {
    if (!window.confirm(`Удалить комнату «${roomName}» из списка Studio?`)) return;
    try { const remaining = await editRoom({ action: "delete", name: roomName }); switchRoom(remaining[0]); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка удаления"); }
  };
  const kick = async (identity: string, name: string) => {
    if (!window.confirm(`Отключить «${name}» от комнаты? Участник сможет войти снова.`)) return;
    try {
      const response = await fetch("/api/participants", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, identity }) });
      if (!response.ok) throw Error((await response.json()).error || "Не удалось отключить участника");
    } catch (e) { alert(e instanceof Error ? e.message : "Ошибка отключения"); }
  };
  const [status, setStatus] = useState("Подключение…");
  const [guests, setGuests] = useState<GuestStat[]>([]);
  const [copied, setCopied] = useState<string>();
  const [receiveSettings, setReceiveSettings] = useState<Record<string, number>>({});
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const returnBitrateHistoryRef = useRef<number[]>([]);
  const localOutboundRef = useRef<StudioOutboundSample | null>(null);
  const [localOutboundSample, setLocalOutboundSample] = useState<StudioOutboundSample | null>(null);
  const remoteActualRef = useRef<unknown>(null);
  const [remoteActual, setRemoteActual] = useState<unknown>(null);
  const bitrateSampleAtRef = useRef(0);
  const recordReturnBitrate = (value: number) => {
    const now = Date.now();
    if (now - bitrateSampleAtRef.current < 1900) return returnBitrateHistoryRef.current;
    bitrateSampleAtRef.current = now;
    const history = [...returnBitrateHistoryRef.current, value].slice(-60);
    returnBitrateHistoryRef.current = history;
    return history;
  };
  const [statsDebug, setStatsDebug] = useState("ожидание");
  const [audioDebug, setAudioDebug] = useState<Record<string,string>>({});
  const returnPrevStats = useRef({ videoBytes: 0, audioBytes: 0, ts: 0 });
  const clientInfoRef = useRef<Record<string, { camera?: string; cpu?: string; gpu?: string; platform?: string; sampleRate?: number }>>({});
  const guestMeterTargetsRef = useRef<Record<string, number>>({});
  const guestMeterDisplayRef = useRef<Record<string, number>>({});
  const [returnVideoDevice, setReturnVideoDevice] = useState("");
  const [returnAudioDevice, setReturnAudioDevice] = useState("");
  const [returnOutputDevice, setReturnOutputDevice] = useState("default");
  const [outputRequestKey, setOutputRequestKey] = useState(0);
  const confirmedOutputRef = useRef("default");
  const [returnFps, setReturnFps] = useState<StudioFrameRate>(() => STUDIO_FRAME_RATES.includes(Number(transferSnapshot?.settings?.fps) as StudioFrameRate) ? Number(transferSnapshot?.settings?.fps) as StudioFrameRate : 60);
  const returnFpsRef = useRef(returnFps);
  returnFpsRef.current = returnFps;
  const [previewFps, setPreviewFps] = useState(returnFps);
  const [returnBitrate, setReturnBitrate] = useState(() => isValidStudioVideoBitrateKbps(Number(transferSnapshot?.settings?.bitrate)) ? Number(transferSnapshot?.settings?.bitrate) : DEFAULT_STUDIO_VIDEO_BITRATE_KBPS);
  const returnBitrateRef = useRef(returnBitrate);
  returnBitrateRef.current = returnBitrate;
  const [returnDevices, setReturnDevices] = useState<MediaDeviceInfo[]>([]);
  const returnDevicesRef = useRef(returnDevices);
  returnDevicesRef.current = returnDevices;
  const selectedDevicesRef = useRef({ videoDeviceId: returnVideoDevice, audioDeviceId: returnAudioDevice, outputDeviceId: returnOutputDevice });
  selectedDevicesRef.current = { videoDeviceId: returnVideoDevice, audioDeviceId: returnAudioDevice, outputDeviceId: returnOutputDevice };
  const [remoteDesired, setRemoteDesired] = useState<StudioDesired>();
  const deviceRevisionRef = useRef(0);
  const deviceErrorRef = useRef("");
  const previewDeviceErrorRef = useRef("");
  const deviceBusyRef = useRef(false);
  const [returnLevel, setReturnLevel] = useState(-60);
  const [returnGain, setReturnGain] = useState(() => typeof transferSnapshot?.settings?.gain === "number" ? transferSnapshot.settings.gain : 100);
  const returnGainRef = useRef(returnGain);
  returnGainRef.current = returnGain;
  const returnGainNodeRef = useRef<GainNode | undefined>(undefined);
  const [returnActive, setReturnActive] = useState(false);
  const returnActiveRef = useRef(returnActive);
  returnActiveRef.current = returnActive;
  const [returnMonitor, setReturnMonitor] = useState<MonitorPreference>({ audio: false, video: true, volume: 100 });
  const [studioRole, setStudioRole] = useState<"connecting" | "primary" | "moderator">("connecting");
  const studioRoleRef = useRef(studioRole);
  studioRoleRef.current = studioRole;
  const [studioClientId, setStudioClientId] = useState("");
  const [studioEpoch, setStudioEpoch] = useState(0);
  const [studioPrimaryOnline, setStudioPrimaryOnline] = useState(false);
  const studioPrimaryOnlineRef = useRef(false);
  studioPrimaryOnlineRef.current = studioPrimaryOnline;
  const [studioControlError, setStudioControlError] = useState("");
  const studioControlErrorRef = useRef(studioControlError);
  studioControlErrorRef.current = studioControlError;
  const [controlPollError, setControlPollError] = useState("");
  const [controlHeartbeatError, setControlHeartbeatError] = useState("");
  const controlRevisionRef = useRef(0);
  const appliedRevisionRef = useRef(0);
  const applyingControlRef = useRef(false);
  const controlRequestRef = useRef<Promise<unknown>>(Promise.resolve());
  const airRequestQueueRef = useRef<Promise<void>>(Promise.resolve());
  const qualityApplyQueueRef = useRef<Promise<void>>(Promise.resolve());
  const applyQualityRef = useRef<(fps: StudioFrameRate, bitrate: number) => Promise<void>>(async () => {});
  const onAirActionRef = useRef<(next: boolean) => Promise<void>>(async () => {});
  const pendingOnAirRef = useRef<{ revision: number; target: boolean } | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [airBusy, setAirBusy] = useState(false);
  const airBusyRef = useRef(airBusy);
  airBusyRef.current = airBusy;
  const onAirRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const [onAirStatus, setOnAirStatus] = useState("OFF AIR");
  const returnVideoRef = useRef<HTMLVideoElement>(null);
  const returnStreamRef = useRef<MediaStream | undefined>(undefined);
  const returnSourceDeviceIdsRef = useRef<{ video: string; audio: string }>({ video: "", audio: "" });
  const returnPublishedRef = useRef<{ video?: any; audio?: any }>({});
  const returnPublicationRef = useRef<{ video?: any; audio?: any }>({});
  const streamRelay = useStudioStreamRelay({ roomName, clientId: studioClientId, epoch: studioEpoch, enabled: studioRole === "primary" && onAir, audioTrack: returnPublishedRef.current.audio?.mediaStreamTrack, videoTrack: returnPublishedRef.current.video?.mediaStreamTrack, fps: returnFps, bitrateKbps: returnBitrate });

  useEffect(() => {
    returnBitrateHistoryRef.current = [];
    bitrateSampleAtRef.current = 0;
    returnPrevStats.current = { videoBytes: 0, audioBytes: 0, ts: 0 };
    localOutboundRef.current = null;
    remoteActualRef.current = null;
    setLocalOutboundSample(null);
    setRemoteActual(null);
  }, [roomName, studioEpoch, studioRole]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let meterRaf = 0;
    let stopTelemetry: (() => void) | undefined;
    let releaseClientLock: (() => void) | undefined;
    setSessionToken(undefined);
    onAirRef.current = false;
    setOnAir(false);
    setReturnActive(false);
    previewReadyRef.current = false;
    setPreviewReady(false);
    setOnAirStatus("OFF AIR");
    returnPublishedRef.current = {};
    returnPublicationRef.current = {};
    setGuests([]);
    const previous = new Map<string, { bytes: number; ts: number }>();
    const previousAudio = new Map<string, { energy: number; duration: number }>();

    let refreshBusy = false;
    const refresh = async () => {
      if (cancelled || refreshBusy) return;
      refreshBusy = true;
      try {
      const stillPrimaryOnAir = () => !cancelled && studioRoleRef.current === "primary" && onAirRef.current;
      if (studioRoleRef.current === "primary" && onAirRef.current) {
        const localPubs = Array.from(room.localParticipant.trackPublications.values()) as any[];
        const videoPubNow = returnPublicationRef.current.video || localPubs.find((p:any) => p.kind === Track.Kind.Video);
        const audioPubNow = returnPublicationRef.current.audio || localPubs.find((p:any) => p.kind === Track.Kind.Audio);
        const videoTrack = returnPublishedRef.current.video || videoPubNow?.track;
        const audioTrack = returnPublishedRef.current.audio || audioPubNow?.track;
        if (videoTrack) returnPublishedRef.current.video = videoTrack;
        if (audioTrack) returnPublishedRef.current.audio = audioTrack;
        let resolution = "—", videoKbps = 0, audioKbps = 0, videoBytes = 0, audioBytes = 0, fps = 0, packets = 0, ts = performance.now();
        if (videoTrack && "getSenderStats" in videoTrack) {
          const stats = await readTrackStats(videoTrack, "getSenderStats");
          if (!stillPrimaryOnAir()) return;
          const list = Array.isArray(stats) ? stats : stats ? [stats] : [];
          const s = list.find((x: any) => x.frameWidth && x.frameHeight) || list[0];
          if (s) { resolution = s.frameWidth && s.frameHeight ? `${s.frameWidth}×${s.frameHeight}` : resolution; fps = s.framesPerSecond || 0; }
          videoBytes = list.reduce((sum: number, x: any) => sum + (x.bytesSent || 0), 0);
          if (resolution === "—") { const ms = returnStreamRef.current?.getVideoTracks()[0]?.getSettings(); if (ms?.width && ms?.height) resolution = `${ms.width}×${ms.height}`; }
        }
        if (audioTrack && "getSenderStats" in audioTrack) {
          const s = await readTrackStats(audioTrack, "getSenderStats");
          if (!stillPrimaryOnAir()) return;
          if (s) audioBytes = s.bytesSent || 0;
        }
        if (!videoBytes && videoTrack && "getRTCStatsReport" in videoTrack) {
          const raw = await readTrackStats(videoTrack, "getRTCStatsReport");
          if (!stillPrimaryOnAir()) return;
          raw?.forEach((s: any) => {
            if (s.type === "outbound-rtp" && !s.isRemote && (s.kind === "video" || s.mediaType === "video")) {
              videoBytes += Number(s.bytesSent || 0);
              fps = Number(s.framesPerSecond || fps);
              if (s.frameWidth && s.frameHeight) resolution = String(s.frameWidth) + "×" + String(s.frameHeight);
            }
          });
        }
        if (!audioBytes && audioTrack && "getRTCStatsReport" in audioTrack) {
          const raw = await readTrackStats(audioTrack, "getRTCStatsReport");
          if (!stillPrimaryOnAir()) return;
          raw?.forEach((s: any) => {
            if (s.type === "outbound-rtp" && !s.isRemote && (s.kind === "audio" || s.mediaType === "audio")) audioBytes += Number(s.bytesSent || 0);
          });
        }
        const prev = returnPrevStats.current;
        const videoStats = videoTrack && "getSenderStats" in videoTrack ? await readTrackStats(videoTrack, "getSenderStats") : [];
        if (!stillPrimaryOnAir()) return;
        const videoList = Array.isArray(videoStats) ? videoStats : videoStats ? [videoStats] : [];
        const activeVideo = videoList.reduce((best: any, s: any) => (Number(s.frameWidth || 0) * Number(s.frameHeight || 0) > Number(best?.frameWidth || 0) * Number(best?.frameHeight || 0) || (Number(s.frameWidth || 0) * Number(s.frameHeight || 0) === Number(best?.frameWidth || 0) * Number(best?.frameHeight || 0) && Number(s.bytesSent || 0) > Number(best?.bytesSent || 0))) ? s : best, undefined);
        const audioStats = audioTrack && "getSenderStats" in audioTrack ? await readTrackStats(audioTrack, "getSenderStats") : undefined;
        if (!stillPrimaryOnAir()) return;
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
        if (stillPrimaryOnAir()) {
          const history = recordReturnBitrate(videoKbps) || returnBitrateHistoryRef.current;
          const sample = createStudioOutboundSample({ resolution, videoKbps, audioKbps, fps }, history, Date.now());
          localOutboundRef.current = sample;
          setLocalOutboundSample(sample);
          setStatsDebug(`ON AIR=${onAirRef.current}; pubs=${localPubs.length}; videoPub=${!!videoPubNow}; audioPub=${!!audioPubNow}; videoTrack=${!!videoTrack}; audioTrack=${!!audioTrack}; videoStats=${videoList.length}; videoBytes=${videoBytes}; audioBytes=${audioBytes}; ts=${Math.round(ts)}`);
        }
      } else if (!cancelled && studioRoleRef.current === "primary") {
        const history = recordReturnBitrate(0) || returnBitrateHistoryRef.current;
        const sample = createStudioOutboundSample({ resolution: "—", videoKbps: 0, audioKbps: 0, fps: 0 }, history, Date.now());
        localOutboundRef.current = sample;
        setLocalOutboundSample(sample);
        setStatsDebug(`ON AIR=${onAirRef.current}; публикация выключена`);
      }
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
          const report = await readTrackStats(cameraPub.track, "getRTCStatsReport").catch(() => undefined);
          report?.forEach((stat: any) => {
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
      if (!cancelled) {
        const unique = Array.from(
          new Map(
            rows
              .filter(row => room.remoteParticipants.has(row.identity))
              .map(row => [row.identity, row])
          ).values()
        );
        setGuests(unique);
      }
      } catch (error) {
        if (!cancelled) setStatsDebug(`Не удалось снять замер: ${error instanceof Error ? error.message : "ошибка WebRTC"}`);
      } finally { refreshBusy = false; }
    };
    refreshRef.current = refresh;

    (async () => {
      try {
        const client = await acquireStudioClientId(studioId);
        releaseClientLock = client.release;
        if (cancelled) { releaseClientLock(); return; }
        const clientId = client.clientId;
        setStudioClientId(clientId);
        const joinResponse = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", studioId, room: roomName, clientId }) });
        const joined = await readControlResponse(joinResponse, "Не удалось определить роль Studio Panel");
        if (cancelled) return;
        const joinedRole = joined.role === "moderator" ? "moderator" : "primary";
        studioRoleRef.current = joinedRole;
        setStudioRole(joinedRole);
        setStudioEpoch(Number(joined.epoch || 0));
        controlRevisionRef.current = Number(joined.revision || 0);
        appliedRevisionRef.current = Number(joined.revision || 0);
        deviceRevisionRef.current = Number(joined.desired?.deviceRevision || 0);
        setRemoteDesired(joined.desired);
        studioPrimaryOnlineRef.current = Boolean(joined.primaryOnline);
        setStudioPrimaryOnline(Boolean(joined.primaryOnline));
        if (!transferSnapshot && joined.desired && typeof joined.desired === "object") {
          if (Number.isFinite(Number(joined.desired.fps)) && STUDIO_FRAME_RATES.includes(Number(joined.desired.fps) as StudioFrameRate)) { setReturnFps(Number(joined.desired.fps) as StudioFrameRate); setPreviewFps(Number(joined.desired.fps) as StudioFrameRate); }
          if (isValidStudioVideoBitrateKbps(Number(joined.desired.bitrate))) setReturnBitrate(Number(joined.desired.bitrate));
          if (Number.isFinite(Number(joined.desired.gain))) setReturnGain(Number(joined.desired.gain));
          if (joined.role === "moderator" && typeof joined.desired.preview === "boolean") setReturnActive(joined.desired.preview);
          if (joined.role === "moderator" && typeof joined.actual?.onAir === "boolean") { setOnAir(Boolean(joined.actual.onAir)); onAirRef.current = Boolean(joined.actual.onAir); }
          else if (joined.role === "moderator" && typeof joined.desired.onAir === "boolean") setOnAir(Boolean(joined.desired.onAir));
          if (joined.role === "primary") { setReturnActive(false); setOnAir(false); onAirRef.current = false; }
        }
        const response = await fetch(`/api/token?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&role=${joined.role === "moderator" ? "studio-moderator" : "studio-panel"}&clientId=${encodeURIComponent(clientId)}${joined.role === "primary" ? `&epoch=${encodeURIComponent(String(joined.epoch || 0))}` : ""}`);
        if (!response.ok) throw new Error(await response.text());
        const { token } = await response.json();
        if (cancelled) return;
        await room.connect(getLiveKitUrl(), token);
        if (cancelled) { room.disconnect(); return; }
        setSessionToken(token);
        if (transferSnapshot?.role === "studio" && joined.role === "primary") {
          const restoreResponse = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "command", studioId, room: roomName, clientId, epoch: Number(joined.epoch || 0), patch: { fps: returnFpsRef.current, bitrate: returnBitrateRef.current, gain: returnGainRef.current, preview: false, onAir: false } }) });
          try { await readControlResponse(restoreResponse, "Не удалось передать настройки переноса основной студии"); }
          catch (error) { if (!cancelled) setStudioControlError(error instanceof Error ? error.message : "Не удалось передать настройки переноса основной студии"); }
        }
        stopTelemetry = startRoomTelemetry(room, roomName, token, { clientId, epoch: Number(joined.epoch || 0), role: joined.role === "moderator" ? "studio-moderator" : "studio-panel" });
        if (!cancelled) setStatus("Онлайн");
        timer = setInterval(() => void refresh(), 2000);
        void refresh();
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
    const onData = (payload: Uint8Array, participant?: { identity: string; metadata?: string }, _kind?: unknown, topic?: string) => {
      if (topic !== "studiolink-client-info" || !participant) return;
      const info = parseGuestClientInfo(payload, participant.identity, participant.metadata);
      if (!info) return;
      clientInfoRef.current[participant.identity] = info; void refresh();
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
      releaseClientLock?.();
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
    if (!returnActive || studioRole === "moderator") return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | undefined;
    let captured: MediaStream | undefined;
    let processed: MediaStream | undefined;
    (async () => {
      try {
        previewReadyRef.current = false; setPreviewReady(false);
        previewDeviceErrorRef.current = "";
        returnStreamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: studioVideoConstraints(returnVideoDevice, previewFps),
          audio: returnAudioDevice ? { deviceId: { exact: returnAudioDevice }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        returnSourceDeviceIdsRef.current = {
          video: stream.getVideoTracks()[0]?.getSettings().deviceId || "",
          audio: stream.getAudioTracks()[0]?.getSettings().deviceId || "",
        };
        captured = new MediaStream(stream.getTracks());
        returnStreamRef.current = stream;
        if (returnVideoRef.current) { returnVideoRef.current.srcObject = stream; await returnVideoRef.current.play().catch(() => undefined); }
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
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
        previewReadyRef.current = true; setPreviewReady(true);
      } catch (e) { console.error("Studio return preview failed", e); if (!cancelled) { previewDeviceErrorRef.current = e instanceof DOMException && e.name === "OverconstrainedError" ? "Источник не поддерживает 1920×1080. Выберите Full HD камеру или настройте выход источника на 1920×1080." : e instanceof Error ? e.message : "Не удалось открыть устройства Studio Return"; setOnAirStatus(previewDeviceErrorRef.current); } }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); captured?.getTracks().forEach((t) => t.stop()); processed?.getTracks().forEach((t) => t.stop()); returnStreamRef.current = undefined; void ctx?.close().catch(() => undefined); };
  }, [returnActive, returnVideoDevice, returnAudioDevice, previewFps, studioRole]);

  useEffect(() => { if (returnGainNodeRef.current) returnGainNodeRef.current.gain.value = returnGain / 100; }, [returnGain]);
  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.enumerateDevices().then(devices => { if (active) setReturnDevices(devices); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const video = returnVideoRef.current;
    if (video) { video.muted = studioRole === "moderator" || !returnMonitor.audio; video.volume = returnMonitor.volume / 100; }
  }, [returnMonitor, returnActive, studioRole]);
  useEffect(() => {
    if (studioRole !== "moderator") return;
    const attach = () => {
      const element = returnVideoRef.current;
      const track = room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.Camera)?.track;
      if (element && track && (returnActive || onAir)) { track.detach(element); track.attach(element); }
      else if (element) element.srcObject = null;
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackUnpublished, RoomEvent.ParticipantDisconnected];
    events.forEach(event => room.on(event, attach)); attach();
    return () => { const element = returnVideoRef.current; if (element) { room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.Camera)?.track?.detach(element); element.srcObject = null; } events.forEach(event => room.off(event, attach)); };
  }, [room, studioRole, returnActive, onAir]);

  const toggleOnAir = (nextOnAir = !onAirRef.current) => {
    const run = async () => {
    if (studioRole === "moderator") return;
    if (nextOnAir && !previewReadyRef.current) { setOnAirStatus("Дождитесь готовности выбранных устройств Studio Return"); return; }
    airBusyRef.current = true;
    setAirBusy(true);
    try {
      const stream = returnStreamRef.current;
      if (!stream) throw Error("Дождитесь готовности предпросмотра Studio Return");
      if (!nextOnAir) {
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
      const videoPub = await room.localParticipant.publishTrack(video, studioVideoPublishOptions(returnBitrate, returnFpsRef.current));
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
      setOnAirStatus(e instanceof Error ? e.message : "Ошибка публикации");
    } finally { airBusyRef.current = false; setAirBusy(false); }
    };
    const next = airRequestQueueRef.current.catch(() => undefined).then(run);
    airRequestQueueRef.current = next;
    return next;
  };
  onAirActionRef.current = toggleOnAir;

  applyQualityRef.current = (fps, bitrate) => {
    const run = async () => {
    const captureTrack = returnStreamRef.current?.getVideoTracks()[0];
    const localTrack = (returnPublicationRef.current.video as any)?.track as LocalVideoTrack | undefined;
    if (studioRole === "primary" && onAirRef.current && (!captureTrack || !localTrack)) throw new Error("Не найден опубликованный видеопоток Studio Return");
    if (studioRole === "primary" && onAirRef.current && localTrack && !localTrack.sender && !localTrack.simulcastCodecs.size) throw new Error("LiveKit не предоставил RTCRtpSender для Studio Return");
    if (studioRole === "primary" && !onAirRef.current) {
      setPreviewFps(fps);
      setReturnFps(fps);
      setReturnBitrate(bitrate);
      return;
    }
    const senders = new Set<RTCRtpSender>();
    if (localTrack?.sender) senders.add(localTrack.sender);
    localTrack?.simulcastCodecs.forEach(info => { if (info.sender) senders.add(info.sender); });
    const previousConstraints = captureTrack?.getConstraints();
    const previousEncodings = new Map<RTCRtpSender, RTCRtpSendParameters>();
    const updated: RTCRtpSender[] = [];
    const previousVideoEncoding = localTrack?.publishOptions?.videoEncoding;
    try {
      if (captureTrack) await captureTrack.applyConstraints({ ...previousConstraints, frameRate: { ideal: fps, max: fps } });
      if (localTrack) {
        if (localTrack.publishOptions) localTrack.publishOptions.videoEncoding = { ...previousVideoEncoding, maxBitrate: bitrate * 1000, maxFramerate: fps };
      }
      for (const sender of senders) {
        const params = sender.getParameters();
        previousEncodings.set(sender, params);
        await applyStudioSenderQuality(sender, bitrate, fps);
        updated.push(sender);
      }
    } catch (error) {
      for (const sender of updated.reverse()) {
        const old = previousEncodings.get(sender);
        if (old) {
          try {
            const fresh = sender.getParameters();
            await sender.setParameters({ ...fresh, encodings: old.encodings, degradationPreference: old.degradationPreference });
          } catch {}
        }
      }
      if (localTrack?.publishOptions) localTrack.publishOptions.videoEncoding = previousVideoEncoding;
      if (captureTrack && previousConstraints) { try { await captureTrack.applyConstraints(previousConstraints); } catch {} }
      throw error;
    }
    setReturnFps(fps);
    setReturnBitrate(bitrate);
    };
    const next = qualityApplyQueueRef.current.catch(() => undefined).then(run);
    qualityApplyQueueRef.current = next;
    return next;
  };

  useEffect(() => {
    if (!onAir || studioRole !== "primary") return;
    const timer = setInterval(() => {
      const track = (returnPublicationRef.current.video as any)?.track as LocalVideoTrack | undefined;
      const senders = new Set<RTCRtpSender>();
      if (track?.sender) senders.add(track.sender);
      track?.simulcastCodecs.forEach(info => { if (info.sender) senders.add(info.sender); });
      if (!track || !senders.size) return;
      qualityApplyQueueRef.current = qualityApplyQueueRef.current.catch(() => undefined).then(async () => {
        for (const sender of senders) {
          const params = sender.getParameters();
          if (!studioVideoEncodingsMatch(params.encodings || [], returnBitrateRef.current, returnFpsRef.current)) {
            await applyStudioSenderQuality(sender, returnBitrateRef.current, returnFpsRef.current);
          }
        }
      }).catch(error => setStudioControlError(error instanceof Error ? error.message : "Не удалось повторно применить лимиты видеокодировщика"));
    }, 2000);
    return () => clearInterval(timer);
  }, [onAir, studioRole]);

  const persistControlPatch = (patch: Record<string, unknown>) => {
    if (!studioClientId) return Promise.reject(new Error("Studio Panel ещё подключается"));
    const request = controlRequestRef.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "command", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch, patch }) });
      const data = await readControlResponse(response, "Не удалось отправить команду Studio Panel");
      controlRevisionRef.current = Number(data.revision || controlRevisionRef.current);
    });
    controlRequestRef.current = request.catch(() => undefined);
    return request.catch(error => { setStudioControlError(error instanceof Error ? error.message : "Ошибка общего управления"); throw error; });
  };
  const changeQuality = async (fps: StudioFrameRate, bitrate: number, fromRemote = false) => {
    if (studioRole === "moderator" && !fromRemote) {
      const previous = { fps: returnFpsRef.current, bitrate: returnBitrateRef.current };
      returnFpsRef.current = fps; returnBitrateRef.current = bitrate;
      setReturnFps(fps); setReturnBitrate(bitrate);
      try {
        await persistControlPatch({ fps, bitrate });
        setStudioControlError("");
      } catch {
        if (returnFpsRef.current === fps && returnBitrateRef.current === bitrate) {
          setReturnFps(previous.fps); setReturnBitrate(previous.bitrate);
        }
      }
      return;
    }
    try {
      await applyQualityRef.current(fps, bitrate);
      setStudioControlError("");
      if (!fromRemote) await persistControlPatch({ fps, bitrate });
    } catch (error) {
      setStudioControlError(error instanceof Error ? error.message : "Не удалось изменить качество эфира");
      if (fromRemote) throw error;
    }
  };
  const changeGain = (gain: number, fromRemote = false) => {
    setReturnGain(gain);
    if (studioRole === "primary" || fromRemote) {
      if (returnGainNodeRef.current) returnGainNodeRef.current.gain.value = gain / 100;
    }
    if (!fromRemote) void persistControlPatch({ gain }).catch(() => undefined);
  };
  const changePreview = (preview: boolean, fromRemote = false) => {
    if (!preview) { previewReadyRef.current = false; setPreviewReady(false); }
    if (studioRole === "primary" || fromRemote) setReturnActive(preview);
    else setReturnActive(preview);
    if (!fromRemote) void persistControlPatch({ preview }).catch(() => undefined);
  };
  const requestOnAir = (next: boolean, fromRemote = false) => {
    if (!next) pendingOnAirRef.current = null;
    if (studioRole === "moderator" && !fromRemote) {
      void persistControlPatch({ onAir: next }).catch(() => undefined);
      return;
    }
    void toggleOnAir(next).then(() => {
      if (!fromRemote && onAirRef.current === next) void persistControlPatch({ onAir: next }).catch(() => undefined);
    });
  };

  useEffect(() => {
    if (!studioClientId || !sessionToken) return;
    setControlPollError("");
    setControlHeartbeatError("");
    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval>;
    let heartbeatTimer: ReturnType<typeof setInterval>;
    let pollInFlight = false;
    let heartbeatInFlight = false;
    const applyDesired = async (desired: Record<string, unknown>, revision: number) => {
      applyingControlRef.current = true;
      try {
        const deviceRevision = Number(desired.deviceRevision || 0);
        if (deviceRevision > deviceRevisionRef.current) {
          // Consume each device command once; unrelated settings must never replay it.
          deviceRevisionRef.current = deviceRevision;
          deviceErrorRef.current = "";
          try {
            const changesInputs = typeof desired.videoDeviceId === "string" || typeof desired.audioDeviceId === "string";
            if (changesInputs && (onAirRef.current || airBusyRef.current || desired.onAir === true)) throw new Error("Для смены камеры или микрофона выключите эфир основной студии.");
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (stopped || studioRoleRef.current !== "primary") return;
            setReturnDevices(devices);
            for (const [key, kind] of [["videoDeviceId", "videoinput"], ["audioDeviceId", "audioinput"], ["outputDeviceId", "audiooutput"]] as const) {
              const id = desired[key];
              if (typeof id !== "string") continue;
              const systemOutput = kind === "audiooutput" && id === "default" && "setSinkId" in HTMLMediaElement.prototype;
              if (!systemOutput && !devices.some(device => device.kind === kind && device.deviceId === id)) throw new Error("Выбранное устройство отключено от основной студии. Обновите список и повторите выбор.");
            }
            // Recheck after enumeration: an ON AIR click may have happened while awaiting it.
            if (changesInputs && (onAirRef.current || airBusyRef.current)) throw new Error("Для смены камеры или микрофона выключите эфир основной студии.");
            const inputsChanged = (typeof desired.videoDeviceId === "string" && desired.videoDeviceId !== selectedDevicesRef.current.videoDeviceId) || (typeof desired.audioDeviceId === "string" && desired.audioDeviceId !== selectedDevicesRef.current.audioDeviceId);
            if (inputsChanged) { previewReadyRef.current = false; setPreviewReady(false); }
            if (typeof desired.videoDeviceId === "string") setReturnVideoDevice(desired.videoDeviceId);
            if (typeof desired.audioDeviceId === "string") setReturnAudioDevice(desired.audioDeviceId);
            if (typeof desired.outputDeviceId === "string") {
              if (!("setSinkId" in HTMLMediaElement.prototype)) throw new Error("Браузер основной студии не поддерживает выбор динамиков.");
              deviceBusyRef.current = true;
              setReturnOutputDevice(desired.outputDeviceId);
              setOutputRequestKey(key => key + 1);
            }
          } catch (error) { deviceErrorRef.current = error instanceof Error ? error.message : "Не удалось выбрать устройство основной студии"; }
        }
        if (desired.onAir === false || desired.preview === false) pendingOnAirRef.current = null;
        const nextFps = STUDIO_FRAME_RATES.includes(Number(desired.fps) as StudioFrameRate) ? Number(desired.fps) as StudioFrameRate : returnFpsRef.current;
        const nextBitrate = isValidStudioVideoBitrateKbps(Number(desired.bitrate)) ? Number(desired.bitrate) : returnBitrateRef.current;
        if (nextFps !== returnFpsRef.current || nextBitrate !== returnBitrateRef.current) await changeQuality(nextFps, nextBitrate, true);
        if (Number.isFinite(Number(desired.gain)) && Number(desired.gain) !== returnGainRef.current) changeGain(Number(desired.gain), true);
        if (typeof desired.preview === "boolean" && desired.preview !== returnActiveRef.current) changePreview(desired.preview, true);
        if (typeof desired.onAir === "boolean" && desired.onAir !== onAirRef.current) {
          if (studioRoleRef.current === "primary" && desired.onAir && !previewReadyRef.current) {
            pendingOnAirRef.current = { revision, target: true };
            window.setTimeout(() => {
              if (pendingOnAirRef.current?.revision !== revision) return;
              pendingOnAirRef.current = null;
              appliedRevisionRef.current = Math.max(appliedRevisionRef.current, revision);
              setStudioControlError("Предпросмотр Studio Return не стал готов за отведённое время. Проверьте источник перед повторным включением эфира.");
            }, 15000);
          } else if (studioRoleRef.current === "primary") {
            await toggleOnAir(desired.onAir);
            if (onAirRef.current !== desired.onAir) throw new Error("Не удалось применить команду ON AIR. Проверьте устройства и повторите действие.");
          }
          else setOnAir(desired.onAir);
        }
        appliedRevisionRef.current = Math.max(appliedRevisionRef.current, revision);
        if (!pendingOnAirRef.current) setStudioControlError("");
      } catch (error) {
        setStudioControlError(error instanceof Error ? error.message : "Не удалось применить команду эфира");
      } finally { applyingControlRef.current = false; }
    };
    const poll = async () => {
      if (stopped || applyingControlRef.current || pollInFlight) return;
      pollInFlight = true;
      try {
        const response = await fetch(`/api/studio-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&clientId=${encodeURIComponent(studioClientId)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const data = await readControlResponse(response, "Не удалось проверить управление Studio Panel");
        if (stopped) return;
        setControlPollError("");
        const primaryOnline = Boolean(data.primaryOnline);
        studioPrimaryOnlineRef.current = primaryOnline;
        setStudioPrimaryOnline(primaryOnline);
        const snapshotRole = data.role === "primary" ? "primary" : data.role === "moderator" ? "moderator" : studioRoleRef.current;
        if (snapshotRole !== studioRoleRef.current) {
          if (studioRoleRef.current === "primary" && snapshotRole === "moderator") { void toggleOnAir(false); changePreview(false, true); }
          studioRoleRef.current = snapshotRole;
          setStudioRole(snapshotRole);
        }
        const nextEpoch = Number(data.epoch || 0);
        if (Number.isSafeInteger(nextEpoch) && nextEpoch !== studioEpoch) { deviceRevisionRef.current = 0; deviceErrorRef.current = ""; setStudioEpoch(nextEpoch); }
        if (studioRoleRef.current === "moderator") {
          data.actual = receiveStudioActual(data.actual);
          remoteActualRef.current = data.actual ?? null;
          setRemoteActual(data.actual ?? null);
          const view = selectStudioOutboundView("moderator", null, data.actual, primaryOnline, Date.now());
          if (view.sample) {
            returnBitrateHistoryRef.current = view.sample.videoHistory;
          } else {
            returnBitrateHistoryRef.current = [];
          }
        }
        const revision = Number(data.revision || 0);
        setRemoteDesired(data.desired);
        controlRevisionRef.current = Math.max(controlRevisionRef.current, revision);
        if (data.actual && studioRoleRef.current === "moderator") {
          if (data.actual.error) setStudioControlError(String(data.actual.error));
          else setStudioControlError("");
          if (typeof data.actual.onAir === "boolean") { onAirRef.current = data.actual.onAir; setOnAir(data.actual.onAir); }
        }
        if (studioRoleRef.current === "primary" && revision > appliedRevisionRef.current && data.desired) await applyDesired(data.desired, revision);
        else if (studioRoleRef.current === "moderator" && data.desired) {
          if (STUDIO_FRAME_RATES.includes(Number(data.desired.fps) as StudioFrameRate)) setReturnFps(Number(data.desired.fps) as StudioFrameRate);
          if (isValidStudioVideoBitrateKbps(Number(data.desired.bitrate))) setReturnBitrate(Number(data.desired.bitrate));
          if (typeof data.desired.gain === "number") setReturnGain(data.desired.gain);
          if (typeof data.desired.preview === "boolean") setReturnActive(data.desired.preview);
        }
      } catch (error) {
        if (!stopped) {
          if (studioRoleRef.current === "moderator") {
            const view = selectStudioOutboundView("moderator", null, remoteActualRef.current, studioPrimaryOnlineRef.current, Date.now());
            if (view.status !== "live") {
              remoteActualRef.current = null;
              setRemoteActual(null);
              returnBitrateHistoryRef.current = [];
            } else if (remoteActualRef.current && typeof remoteActualRef.current === "object") {
              setRemoteActual({ ...(remoteActualRef.current as Record<string, unknown>) });
            }
          }
          setControlPollError(error instanceof Error ? error.message : "Ошибка связи с Studio Panel");
        }
      } finally {
        pollInFlight = false;
      }
    };
    const heartbeat = async () => {
      if (stopped || studioRoleRef.current !== "primary" || heartbeatInFlight) return;
      heartbeatInFlight = true;
      try {
        const outputSupported = "setSinkId" in HTMLMediaElement.prototype;
        const devices = returnDevicesRef.current.filter(device => device.deviceId && (outputSupported || device.kind !== "audiooutput"))
          .slice(0, 40).map(({ deviceId, label, kind }) => ({ deviceId, label: label.slice(0, 120), kind }));
        if (outputSupported && !devices.some(device => device.kind === "audiooutput" && device.deviceId === "default")) devices.push({ deviceId: "default", label: "Системный выход", kind: "audiooutput" });
        const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "heartbeat", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch, actual: { fps: returnFpsRef.current, bitrate: returnBitrateRef.current, gain: returnGainRef.current, onAir: onAirRef.current, airBusy: airBusyRef.current, preview: returnActiveRef.current,
          devices, ...selectedDevicesRef.current,
          videoDeviceId: selectedDevicesRef.current.videoDeviceId || returnSourceDeviceIdsRef.current.video,
          audioDeviceId: selectedDevicesRef.current.audioDeviceId || returnSourceDeviceIdsRef.current.audio,
          outputDeviceId: confirmedOutputRef.current,
          deviceRevisionApplied: deviceRevisionRef.current, deviceBusy: deviceBusyRef.current || (returnActiveRef.current && !previewReadyRef.current && !previewDeviceErrorRef.current), deviceError: deviceErrorRef.current || previewDeviceErrorRef.current,
          outbound: localOutboundRef.current, outboundAgeMs: localOutboundRef.current ? Math.max(0, Date.now() - localOutboundRef.current.measuredAt) : undefined, error: studioControlErrorRef.current || undefined } }) });
        const data = await readControlResponse(response, "Основная студия потеряла управление");
        if (stopped) return;
        setControlHeartbeatError("");
        studioPrimaryOnlineRef.current = true;
        setStudioPrimaryOnline(true);
        if (data.role === "moderator" || Number(data.epoch) !== studioEpoch) {
          studioRoleRef.current = "moderator";
          setStudioRole("moderator");
          setStudioEpoch(Number(data.epoch || 0));
        }
      } catch (error) { if (!stopped) setControlHeartbeatError(error instanceof Error ? error.message : "Не удалось продлить управление"); }
      finally { heartbeatInFlight = false; }
    };
    void poll();
    pollTimer = setInterval(() => void poll(), 2000);
    void heartbeat();
    heartbeatTimer = setInterval(() => void heartbeat(), 2000);
    return () => { stopped = true; clearInterval(pollTimer); clearInterval(heartbeatTimer); };
  }, [roomName, sessionToken, studioClientId, studioEpoch, studioRole]);

  useEffect(() => {
    const pending = pendingOnAirRef.current;
    if (studioRole !== "primary" || !previewReady || !pending) return;
    pendingOnAirRef.current = null;
    void toggleOnAir(pending.target).then(() => {
      appliedRevisionRef.current = Math.max(appliedRevisionRef.current, pending.revision);
      if (!onAirRef.current) setStudioControlError("Не удалось включить эфир после подготовки предпросмотра.");
    });
  }, [studioRole, previewReady]);

  const restoreStudioInputs = async () => {
    if (!transferSnapshot || restoreBusy || studioRole !== "primary") return;
    setRestoreBusy(true); setRestoreMessage(""); setRestoreAutoOnAir(false);
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      permission.getTracks().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setReturnDevices(devices);
      const match = (kind: MediaDeviceKind, label?: string) => label ? devices.filter(device => device.kind === kind && device.label === label) : [];
      const videoMatches = match("videoinput", pendingStudioLabels.video);
      const audioMatches = match("audioinput", pendingStudioLabels.audio);
      const outputMatches = match("audiooutput", pendingStudioLabels.output);
      const videoOk = videoMatches.length === 1;
      const audioOk = audioMatches.length === 1;
      if (videoOk) setReturnVideoDevice(videoMatches[0].deviceId);
      if (audioOk) setReturnAudioDevice(audioMatches[0].deviceId);
      if (outputMatches.length === 1) setReturnOutputDevice(outputMatches[0].deviceId);
      else if (pendingStudioLabels.output) setReturnOutputDevice("default");
      if (videoOk && audioOk) {
        const shouldPreview = transferSnapshot.settings?.returnActive === true || transferSnapshot.settings?.onAir === true;
        if (shouldPreview) setReturnActive(true);
        if (transferSnapshot.settings?.onAir === true) setRestoreAutoOnAir(true);
        const outputMessage = pendingStudioLabels.output && outputMatches.length !== 1 ? " Выход звука выбран системный; при необходимости измените его вручную." : "";
        setRestoreMessage(transferSnapshot.settings?.onAir === true ? `Камера и микрофон найдены по точным названиям. Проверяем предпросмотр перед восстановлением эфира.${outputMessage}` : shouldPreview ? `Камера и микрофон найдены по точным названиям. Предпросмотр восстановлен; публикация выключена.${outputMessage}` : `Камера и микрофон найдены по точным названиям. Выберите «Проверить Studio Return», когда будете готовы.${outputMessage}`);
      } else {
        const missing = [!videoOk ? "камеру" : "", !audioOk ? "микрофон" : ""].filter(Boolean).join(" и ");
        setRestoreMessage(`Не удалось однозначно сопоставить ${missing || "источники"}. Проверьте и выберите устройства вручную; эфир останется выключенным.`);
      }
      setPendingStudioLabels({});
    } catch (error) {
      setRestoreMessage(error instanceof Error ? `Разрешите доступ к камере и микрофону, затем повторите: ${error.message}` : "Нужен доступ к камере и микрофону для сопоставления устройств.");
    } finally { setRestoreBusy(false); }
  };

  useEffect(() => {
    if (studioRole !== "primary" || !restoreAutoOnAir || !returnActive || !previewReady || !sessionToken || onAir || airBusy) return;
    setRestoreAutoOnAir(false);
    requestOnAir(true);
  }, [studioRole, restoreAutoOnAir, returnActive, previewReady, sessionToken, onAir, airBusy]);

  useEffect(() => {
    if (studioRole !== "primary" || !transferSnapshot || transferSnapshot.role !== "studio" || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    if (pendingStudioLabels.video || pendingStudioLabels.audio) void restoreStudioInputs();
  }, [studioRole, transferSnapshot, pendingStudioLabels]);

  const base = typeof window === "undefined" ? "" : window.location.origin;
  const outputUrl = (identity: string) => `${base}/output/${encodeURIComponent(identity)}?room=${encodeURIComponent(roomName)}&bitrate=${receiveFor(identity)}${viewAccess ? `#access=${encodeURIComponent(viewAccess)}` : ""}`;
  const receiveFor = (identity: string) => receiveSettings[identity] || 2500;
  const mainStudioMonitor = monitoring.preferences["studio-panel-main"] ?? moderatorStudioMonitorDefaults["studio-panel-main"];
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
    if (studioRole === "primary") {
      const destinations = outputQualityRecipients(room.remoteParticipants.values(), identity);
      if (destinations.length) void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ target: identity, bitrateKbps })), { reliable: true, topic: "studiolink-output-quality", destinationIdentities: destinations }).catch(() => undefined);
    }
  };
  const outboundView = selectStudioOutboundView(studioRole, localOutboundSample, remoteActual, studioPrimaryOnline, Date.now());
  const displayedOutbound = outboundView.sample ?? { resolution: "—", videoKbps: 0, audioKbps: 0, fps: 0, measuredAt: 0, videoHistory: [] };
  const displayedHistory = outboundView.sample?.videoHistory ?? [];
  const returnBitratePoints = useMemo(() => displayedHistory.map((value, index) => `${40 + index / Math.max(displayedHistory.length - 1, 1) * 258},${198 - Math.min(value, 12000) / 12000 * 192}`).join(" "), [displayedHistory]);
  const outboundStatusText = outboundView.status === "live" ? "Свежие измерения основной студии" : outboundView.status === "offline" ? "Основная студия офлайн. Ожидаем повторное подключение." : outboundView.status === "stale" ? "Измерения устарели. Ожидаем новый замер от основной студии." : "Ожидание первого замера от основной студии…";
  const localRole = studioRole === "connecting" ? resolveParticipantRole(room.localParticipant) : "admin";
  const staffParticipants = [
    ...(localRole ? [{ identity: room.localParticipant.identity, name: room.localParticipant.name || room.localParticipant.identity, role: localRole, self: true }] : []),
    ...monitoring.participants.flatMap((participant) => {
      const role = resolveParticipantRole(participant);
      return role === "admin" || role === "moderator"
        ? [{ identity: participant.identity, name: participant.name || participant.identity, role, self: false }]
        : [];
    }),
  ].sort((left, right) => (left.role === right.role ? 0 : left.role === "admin" ? -1 : 1));
  void participantMetadataRevision;

  return (
    <main className="media-page studio-page studio-app-shell">
      <aside className="studio-sidebar">
        <div className="studio-brand"> <span className="studio-brand-mark">C</span><span><strong>CastLink</strong><small>LIVE PRODUCTION</small></span></div>
        <nav className="studio-tabs" aria-label="Раздел студии">
          <button aria-pressed={activeTab === "studio"} onClick={() => setActiveTab("studio")}>Студия</button>
          <button aria-pressed={activeTab === "participants"} onClick={() => setActiveTab("participants")}>Участники</button>
          <button aria-pressed={activeTab === "statistics"} onClick={() => setActiveTab("statistics")}>Статистика</button>
        </nav>
        <div className="sidebar-room-card"><small>АКТИВНАЯ КОМНАТА</small><strong>{roomName}</strong><span className="sidebar-live-status"><i />{status}</span></div>
        <div className="sidebar-footer"><span className="sidebar-avatar">CL</span><span><strong>Studio Panel</strong><small>{guests.length} гостей в комнате</small></span></div>
        <button className="sidebar-leave-button" onClick={() => { window.location.assign("/studio"); }}>Выйти из комнаты</button>
      </aside>
      <div className="studio-main-column">
      <div className="studio-header">
        <div>
          <p className="muted">CastLink · Studio Panel</p>
          <h1>{roomName}</h1>

        </div>
        <div className="status-pill"><button type="button" className="studio-room-menu-toggle" hidden={activeTab !== "studio"} aria-label="Настройки комнаты" aria-expanded={roomMenuOpen} aria-controls="studio-room-management-panel" onClick={() => setRoomMenuOpen(open => !open)}>
          <span aria-hidden="true" className="studio-room-menu-icon">☰</span><span>Комната</span><span className="studio-room-menu-count">{rooms.length}</span>
        </button><span className={`studio-role-badge studio-role-${studioRole}`}>{studioRole === "primary" ? "Основная студия" : studioRole === "moderator" ? "Администратор" : "Подключение"}</span>{studioRole === "moderator" && !studioPrimaryOnline && <button type="button" className="button-secondary" onClick={async () => {
          try {
            const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch }) });
            const data = await readControlResponse(response, "Не удалось принять управление");
            window.location.reload();
          } catch (error) { setStudioControlError(error instanceof Error ? error.message : "Не удалось принять управление"); }
        }}>Принять управление</button>}{status}</div>
      </div>
      <RoomAudioRenderer room={room} />
      <div id="studio-room-management-panel" className="studio-room-management" hidden={activeTab !== "studio" || !roomMenuOpen}>
      <div className="section-heading"><div><p className="eyebrow">УПРАВЛЕНИЕ КОМНАТОЙ</p><h2>Настройки комнаты</h2></div><span>Комнат: {rooms.length}</span></div>
          <div className="panel studio-room-controls">
            <select value={roomName} onChange={(e) => switchRoom(e.target.value)} aria-label="Активная комната">
              {rooms.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createRoom(); }} placeholder="Название новой комнаты" aria-label="Название новой комнаты" style={{minWidth:220}} />
            <input type="password" autoComplete="new-password" value={newRoomPassword} onChange={e => setNewRoomPassword(e.target.value)} placeholder="Пароль гостей (необязательно)" aria-label="Пароль новой комнаты" maxLength={256} />
            <button type="button" disabled={!newRoomName.trim() || roomBusy} onClick={createRoom}>+ Создать комнату</button>
            <a className="button-link" href="/studio" target="_blank" rel="noopener noreferrer">Открыть ещё одну студию</a>
            <button type="button" onClick={openRoomEditor}>✎ Изменить</button>
            <button type="button" onClick={deleteRoom}>Удалить комнату</button>
          </div>

      </div>
      {studioOnly && <p className="studio-only-notice room-mode-notice" role="status">Студия включила только свой просмотр</p>}
      <section className="studio-video-section" hidden={activeTab !== "studio"} aria-label="Studio Return monitor">
      <div className="studio-return-hero">
        <div className="panel studio-video-card studio-return-preview-card"><h2>Studio Return <span className={`air-state ${onAir ? "air-live" : ""}`}><i className="air-dot" />{onAir ? "ON AIR" : "OFF AIR"}</span></h2>
          {returnActive ? <video ref={returnVideoRef} muted={studioRole === "moderator" || !returnMonitor.audio} playsInline className="return-preview" style={{ opacity: (studioRole === "moderator" ? mainStudioMonitor.video : returnMonitor.video) ? 1 : 0 }} /> : <div className="studio-preview-placeholder">Проверка Studio Return остановлена</div>}
          {room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.ScreenShare) && <div className="studio-screen-share-preview"><RemoteVideoPreview room={room} identity="studio-panel-main" camera={false} enabled={mainStudioMonitor.video} /></div>}
          {returnActive && <div className="return-audio-meter studio-preview-meter">
            <div className="meter-label"><span>Studio Return</span><strong>{returnLevel.toFixed(1)} dBFS</strong></div>
            <div className="db-meter"><div className="db-meter-fill" style={{ width: `${Math.max(0, Math.min(100, (returnLevel + 60) / 60 * 100))}%` }} /></div>
            <div className="db-scale"><span>-60</span><span>-18</span><span>-10</span><span>0 dB</span></div>
          </div>}
          <section className="studio-invite-compact" aria-label="Приглашения и доступы">
            <div className="guest-invite-slot"><RoomInviteButton roomName={roomName} key={`${roomName}:${roomAccessVersion}`} /></div>
            <div className="stream-invite-slot"><StudioStreamInviteButton roomName={roomName} key={`stream:${roomName}`} /></div>
            <div className="moderator-invite-slot"><ModeratorInviteButton roomName={roomName} key={`moderator:${roomName}`} /></div>
            <div className="admin-invite-slot"><AdminInviteButton roomName={roomName} key={`admin:${roomName}`} /></div>
            {studioRole === "primary" && <small className="invite-extra" role="status">Зрителей отдельного потока: {streamRelay.viewerCount}{streamRelay.error ? ` · ${streamRelay.error}` : ""}</small>}
          </section>
        </div>
        <div className="panel return-stats">
          <div className="return-stats-heading"><strong>Исходящий поток студии</strong><div className="studio-quick-controls" hidden={activeTab !== "studio"} aria-label="Управление Studio Return">
            <button type="button" aria-pressed={studioOnly} className={`room-mode-toggle${studioOnly ? " room-mode-active" : ""}`} disabled={modeBusy} onClick={async () => {
              const next = !studioOnly; setModeBusy(true);
              try { const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mode", studioId, name: roomName, studioOnly: next }) }); if (!response.ok) throw Error("Не удалось изменить режим комнаты"); setStudioOnly(next); }
              catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка режима комнаты"); } finally { setModeBusy(false); }
            }}>Гости могут видеть только студию</button>
            <button disabled={studioRole === "connecting" || !sessionToken || onAir || airBusy} onClick={() => changePreview(!returnActive)}>{returnActive ? "Остановить проверку" : "Проверить Studio Return"}</button>
            <button className={`air-toggle ${onAir ? "air-toggle-live" : ""}`} disabled={(studioRole === "primary" && (!returnActive || !previewReady)) || studioRole === "connecting" || airBusy || !sessionToken} onClick={() => requestOnAir(!onAir)}>{onAir ? "OFF AIR" : "ON AIR"}</button>
            <ScreenShareButton room={room} compact />
          </div></div>
          {studioRole === "moderator" && <p className="muted" role="status">{outboundStatusText}</p>}
          <div className="return-stat-grid"><span><b>Разрешение</b><strong>{outboundView.sample ? displayedOutbound.resolution : "—"}</strong></span><span><b>Частота кадров</b><strong>{outboundView.sample ? `${displayedOutbound.fps} fps` : "—"}</strong></span><span><b>Видеобитрейт</b><strong>{outboundView.sample ? `${displayedOutbound.videoKbps} кбит/с` : "—"}</strong></span><span><b>Аудиобитрейт</b><strong>{outboundView.sample ? `${displayedOutbound.audioKbps} кбит/с` : "—"}</strong></span></div>
          <div className="bitrate-chart" aria-label="Видеобитрейт за последние 2 минуты, шкала до 12 000 кбит/с">
            <div><b>Видеобитрейт</b><small>обновление каждые 2 сек · последние 2 мин</small></div>
            <svg viewBox="0 0 300 210" role="img" aria-label={outboundView.sample ? `Текущий видеобитрейт ${displayedOutbound.videoKbps} килобит в секунду` : outboundStatusText} preserveAspectRatio="none">
              {[500, ...Array.from({ length: 12 }, (_, index) => (index + 1) * 1000)].map(value => {
                const y = 198 - value / 12000 * 192;
                return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString("ru-RU")}</text></g>;
              })}
              {displayedHistory.length > 1 && <polyline className="bitrate-chart-line" points={returnBitratePoints} />}
            </svg>
          </div>
          <div className="return-output-controls">
            <label>Частота кадров<select aria-label="Частота кадров студии" disabled={!studioClientId || airBusy} value={returnFps} onChange={e => void changeQuality(Number(e.target.value) as StudioFrameRate, returnBitrateRef.current)}>{STUDIO_FRAME_RATES.map(fps => <option key={fps} value={fps}>{fps} FPS</option>)}</select></label>
          <label>Общий лимит видеобитрейта (эфир и ссылка)<select aria-label="Общий лимит видеобитрейта (эфир и ссылка)" aria-describedby="studio-return-bitrate-help" disabled={!studioClientId || airBusy} value={returnBitrate} onChange={e => void changeQuality(returnFpsRef.current, Number(e.target.value))}>{videoBitrateOptions(returnBitrate).map(bitrate => <option key={bitrate} value={bitrate}>{bitrate.toLocaleString("ru-RU")} кбит/с</option>)}</select></label>
          <small id="studio-return-bitrate-help" className="muted">Ограничивает видеобитрейт Studio Return и дополнительного потока ссылки просмотра.</small>
          </div>
          {studioControlError && <p className="studio-control-error" role="alert">{studioControlError}</p>}
          {controlPollError && <p className="studio-control-error" role="alert">Связь с панелью: {controlPollError}</p>}
          {controlHeartbeatError && <p className="studio-control-error" role="alert">Продление управления: {controlHeartbeatError}</p>}
          {studioRole === "moderator" && <div className="studio-moderator-listen">
            <p className="muted">Устройства управляются основной студией. Звук опубликованного эфира слышен только у вас.</p>
            <div className="personal-monitor-controls">
              <button type="button" aria-pressed={mainStudioMonitor.audio} onClick={() => monitoring.change("studio-panel-main", { audio: !mainStudioMonitor.audio })}>
                {mainStudioMonitor.audio ? "Не слушать студию" : "Слушать студию"}
              </button>
              <button type="button" aria-label="Видео основной студии только у меня" aria-pressed={mainStudioMonitor.video} onClick={() => monitoring.change("studio-panel-main", { video: !mainStudioMonitor.video })}>
                {mainStudioMonitor.video ? "Видео вкл." : "Видео выкл."}
              </button>
              <label>Личная громкость <input aria-label="Личная громкость Studio Return" type="range" min="0" max="100" value={mainStudioMonitor.volume} onChange={event => monitoring.change("studio-panel-main", { volume: Number(event.target.value) })} />
                <output>{mainStudioMonitor.volume}%</output>
              </label>
            </div>
          </div>}

          <small className="stats-debug">Диагностика: {statsDebug}</small>
        </div>
      </div>
      </section>
      {activeTab === "studio" && transferSnapshot?.role === "studio" && <div className="transfer-notice" role="status">
        <p>{restoreMessage || "Параметры комнаты восстановлены. Проверьте источники перед эфиром."}</p>
        <button type="button" className="button-secondary" disabled={restoreBusy} onClick={() => void restoreStudioInputs()}>{restoreBusy ? "Проверяем устройства…" : "Сопоставить прежние устройства"}</button>
      </div>}
      {activeTab === "studio" && roomEditOpen && <div className="room-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRoomEditOpen(false); }}><form className="panel stack room-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="room-edit-title" onSubmit={saveRoomSettings}>
        <h2 id="room-edit-title">Настройки комнаты</h2>
        <label>Название комнаты<input required maxLength={100} value={editRoomName} onChange={event => setEditRoomName(event.target.value)} /></label>
        <div className="room-password-status"><strong>Пароль гостей: {roomPasswordSet ? "задан" : "не задан"}</strong><small>{roomPasswordSet && !currentRoomPassword ? "Старый пароль был сохранён до обновления и восстановить его нельзя. Задайте новый, чтобы студия могла его показывать." : "Здесь отображается пароль гостей. Поле можно изменить, чтобы задать новый пароль."}</small></div>
        <label>Пароль гостей<div className="password-field"><input type={showEditRoomPassword ? "text" : "password"} autoComplete="new-password" maxLength={256} value={editRoomPassword} onChange={event => setEditRoomPassword(event.target.value)} placeholder={roomPasswordSet ? "Пароль комнаты" : "Задайте пароль (необязательно)"} /><button className="button-secondary" type="button" aria-pressed={showEditRoomPassword} onClick={() => setShowEditRoomPassword(value => !value)}>{showEditRoomPassword ? "Скрыть" : "Показать"}</button></div></label>
        {roomPasswordSet && <label className="remove-room-password"><input type="checkbox" checked={removeRoomPassword} onChange={event => setRemoveRoomPassword(event.target.checked)} /> Убрать пароль — гости смогут входить без него</label>}
        <p className="muted">После смены или снятия пароля ранее выданные доступы и приглашения для этой комнаты перестанут работать.</p>
        <div className="room-edit-actions"><button type="button" className="button-secondary" onClick={() => setRoomEditOpen(false)}>Отмена</button><button className="button-primary" disabled={roomBusy || !editRoomName.trim()}>{roomBusy ? "Сохранение…" : "Сохранить"}</button></div>
      </form></div>}
      <div className="studio-settings" id="studio-settings" hidden={activeTab !== "studio"}>
      <div className="panel studio-device-panel">{studioRole === "primary" ? <MediaDevicePicker room={room} disabledInputs={onAir || airBusy} cameraId={returnVideoDevice} microphoneId={returnAudioDevice} headphonesId={returnOutputDevice} outputRequestKey={outputRequestKey} onDevicesChanged={setReturnDevices} onOutputStatus={(deviceId, error) => {
        if (deviceId !== selectedDevicesRef.current.outputDeviceId) return;
        deviceBusyRef.current = false;
        if (error) deviceErrorRef.current = `Не удалось переключить вывод: ${error}`;
        else confirmedOutputRef.current = deviceId;
      }} onChange={change => {
        deviceErrorRef.current = "";
        if (change.cameraId !== undefined) setReturnVideoDevice(change.cameraId);
        if (change.microphoneId !== undefined) setReturnAudioDevice(change.microphoneId);
        if (change.headphonesId !== undefined) setReturnOutputDevice(change.headphonesId);
      }} /> : <RemoteStudioDevices actual={remoteActual as Record<string, unknown> | null} desired={remoteDesired} online={studioPrimaryOnline} disabled={studioRole === "connecting"} onChange={patch => { void persistControlPatch(patch).catch(() => undefined); }} />}
      {transferSnapshot?.role === "studio" && restoreMessage && <p className="transfer-notice" role="status">{restoreMessage}</p>}

      </div>
      <div className="panel return-panel">
        <div className="return-title"><div><h2>Studio Return <span className={`air-state ${onAir ? "air-live" : ""}`}>{onAirStatus}</span></h2><p className="muted">Предпросмотр видео и аудио, которые отправляются гостям.</p></div></div>
        {returnActive && <div className="return-settings">
          <div className="return-controls">
            <div className="return-audio-meter">
              <div className="gain-control"><span>Gain</span><input type="range" min="0" max="200" value={returnGain} onChange={(e) => changeGain(Number(e.target.value))} /><strong>{returnGain}%</strong></div>
            </div>
            <strong>Мой Studio Return — мониторинг</strong>
            {studioRole === "primary" && <MonitoringControls name="Studio Return" value={returnMonitor} onChange={(patch) => setReturnMonitor((value) => ({ ...value, ...patch }))} />}
            <p className="muted">Эти переключатели меняют только предпросмотр. ON AIR управляет эфиром. Для прослушивания собственного микрофона используйте наушники.</p>
          </div>
        </div>}
      </div>
      <p className="muted studio-note">Входящий лимит выбирает подходящий simulcast-слой для Studio Panel; фактический битрейт зависит от содержимого кадра и сети.</p>
      </div>

      <section className="studio-video-section" hidden={activeTab !== "studio"} aria-label="Видео гостей">
      <section className="studio-video-wall" aria-label="Видео гостей">
        {guests.map(g => <div className="panel studio-video-card" key={g.identity}><div className="guest-card-heading"><h2>{g.name}</h2><span className="guest-media-state"><span title={g.camera ? "Камера включена" : "Камера выключена"}>{g.camera ? "◉" : "○"} Видео</span><span title={g.microphone ? "Микрофон включён" : "Микрофон выключен"}>{g.microphone ? "◖" : "◌"} Аудио</span></span></div><GuestPreview room={room} identity={g.identity} name={g.name} preference={monitoring.preferences[g.identity]} onChange={(patch) => monitoring.change(g.identity, patch)} /><div className="guest-preview-actions"><a className="button-link" href={outputUrl(g.identity)} target="_blank" rel="noreferrer">Открыть</a><button onClick={async () => { await navigator.clipboard.writeText(outputUrl(g.identity)); setCopied(g.identity); setTimeout(() => setCopied(undefined), 1200); }}>{copied === g.identity ? "Скопировано" : "Копировать URL"}</button><div className="guest-card-monitoring"><RotateVideoButton roomName={roomName} identity={g.identity} /><label className="guest-card-quality">Битрейт<select aria-label={`Битрейт участника ${g.name}`} value={receiveFor(g.identity)} onChange={(event) => applyReceiveQuality(g.identity, Number(event.target.value))}>{videoBitrateOptions(receiveFor(g.identity)).map(value => <option key={value} value={value}>{value.toLocaleString("ru-RU")} кбит/с</option>)}</select></label><MonitoringControls name={g.name} value={monitoring.preferences[g.identity]} onChange={(patch) => monitoring.change(g.identity, patch)} /></div></div>
          <div className="guest-card-meter"><GuestAudioMeter track={room.remoteParticipants.get(g.identity)?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined} fallbackDb={g.signalDb} compact /></div>
          <div className="guest-card-details" aria-label={`Сведения об участнике ${g.name}`}>
            <div><b>Разрешение</b><span>{g.resolution}</span></div><div><b>Факт. битрейт</b><span>{g.bitrateKbps ? `${g.bitrateKbps} кбит/с` : "—"}</span></div>
            <div><b>Сеть</b><span className={`net net-${g.stability === "Хорошая" ? "good" : g.stability === "Средняя" ? "mid" : "bad"}`}>{g.stability}</span></div>
            <div><b>Камера</b><span>{g.cameraDevice || "—"}</span></div><div><b>CPU</b><span>{g.cpu || "—"}</span></div><div><b>GPU</b><span>{g.gpu || "—"}</span></div><div><b>ОС</b><span>{g.platform || "—"}</span></div>
            <div><b>RTT / Jitter</b><span>{g.rttMs} / {g.jitterMs} мс</span></div><div><b>Потери / Аудио</b><span>{g.packetLoss} пак. / {g.sampleRate ? `${g.sampleRate} Hz` : "—"}</span></div>
          </div>
        </div>)}
      </section>
      </section>
      {activeTab === "statistics" && <StatisticsDashboard roomName={roomName} token={sessionToken} identity={room.localParticipant.identity} studioRole={studioRole === "moderator" ? "moderator" : "primary"} studioClientId={studioClientId} studioEpoch={studioEpoch} />}
      <section className="studio-participants-section" hidden={activeTab !== "participants"}>
      <div className="panel studio-staff-panel"><h2>Администраторы и модераторы</h2>
        {staffParticipants.length ? <div className="studio-staff-list">{staffParticipants.map((participant) => <div className="studio-staff-row" key={participant.identity}>
          {!participant.self && <GuestPreview room={room} identity={participant.identity} name={participant.name} preference={monitoring.preferences[participant.identity]} onChange={patch => monitoring.change(participant.identity, patch)} />}
          <span className="studio-staff-name">{participant.name}{participant.self && <small>Вы</small>}</span>
          <span className={`studio-participant-role studio-participant-role-${participant.role}`}>{participant.role === "admin" ? "Администратор" : "Модератор"}</span>
        </div>)}</div> : <p className="muted">Администраторы и модераторы пока не подключены.</p>}
      </div>
      <div className="panel studio-guests-panel">
        <h2>Гости</h2>
        <p className="muted">Мониторинг гостей меняется только в этой студии. Громкость и выключение видео не влияют на эфир, других гостей и выходы vMix.</p>
        {guests.length === 0 ? <p className="muted">Подключённых гостей пока нет.</p> : (
          <div className="guest-table-wrap">
            <table className="guest-table">
              <thead><tr><th>Гость</th><th>vMix</th></tr></thead>
              <tbody>{guests.map((g) => (
                <tr key={g.identity}>
                  <td><strong>{g.name}</strong> <span className="studio-participant-role studio-participant-role-guest">Гость</span><small>{g.identity}</small><div className="studio-guest-actions"><select value={moveTargets[g.identity] || ""} onChange={(e)=>setMoveTargets((v)=>({...v,[g.identity]:e.target.value}))}><option value="">Перевести в комнату…</option>{rooms.filter((name)=>name!==roomName).map((name)=><option key={name} value={name}>{name}</option>)}</select><button disabled={!moveTargets[g.identity]} onClick={async()=>{const targetRoom=moveTargets[g.identity];if(!targetRoom)return;const response=await fetch("/api/move-guest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studioId,room:roomName,identity:g.identity,targetRoom})});if(!response.ok)alert("Не удалось перевести гостя");}}>Перевести</button><button onClick={()=>void kick(g.identity, g.name)}>Отключить гостя</button><button onClick={async()=>{const p=room.remoteParticipants.get(g.identity);if(!p)return;for(const pub of p.trackPublications.values()){if(pub.kind===Track.Kind.Video||pub.kind===Track.Kind.Audio){pub.setSubscribed(false);}}await new Promise(r=>setTimeout(r,250));for(const pub of p.trackPublications.values()){if(pub.kind===Track.Kind.Video||pub.kind===Track.Kind.Audio){pub.setSubscribed(true);if(pub.kind===Track.Kind.Video){pub.setVideoQuality(VideoQuality.HIGH);}}}monitoring.apply();setTimeout(()=>void refreshRef.current(),500);}}>↻ Обновить</button></div></td>
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
      </section>
      {studioRole === "primary" && <section className="transfer-compact" hidden={activeTab !== "studio"} aria-label="Серверы переноса комнаты">
            <div><p className="eyebrow">ПЕРЕНОС КОМНАТЫ</p><strong>{transferInfo.current?.label || "Текущий сервер"}</strong><p className="muted">Переносит комнату вместе с подключёнными участниками.</p></div>
            <div className="transfer-server-list">
              {transferInfo.loading && <span className="muted">Загружаем серверы…</span>}
              {transferInfo.error && <span className="transfer-server-error" role="status">{transferInfo.error}</span>}
              {!transferInfo.loading && !transferInfo.error && !transferInfo.targets.length && <span className="muted">Другие серверы не настроены.</span>}
              {transferInfo.targets.map(target => <div className="transfer-server-row" key={target.id}><span><strong>{target.label}</strong><small>{target.available ? "Доступен" : target.reason || "Недоступен"}</small></span><span className={target.available ? "transfer-available" : "transfer-unavailable"}>{target.available ? "Готов" : "Недоступен"}</span></div>)}
              {!!transferInfo.targets.length && <div className="transfer-start-row"><select aria-label="Целевой сервер" value={transferTargetId} onChange={event => setTransferTargetId(event.target.value)}><option value="">Выберите сервер…</option>{transferInfo.targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}{target.available ? "" : " · недоступен"}</option>)}</select><button type="button" className="button-primary" disabled={!transferTargetId || transferBusy || transferInfo.loading} onClick={() => void startServerTransfer()}>{transferBusy ? "Подготовка…" : "Перенести"}</button></div>}
              {transferError && <span className="transfer-server-error" role="alert">{transferError}</span>}
              <button type="button" className="button-secondary" disabled={transferInfo.loading} onClick={() => setTransferRefresh(v => v + 1)}>Обновить список</button>
            </div>
          </section>}
      </div>


    </main>
  );
}

export default function StudioPage() {
  return <Suspense fallback={<main><div className="panel">Загрузка Studio Panel…</div></main>}><AccessGate kind="studio"><StudioEntry /></AccessGate></Suspense>;
}

function StudioEntry() {
  const params = useSearchParams();
  const studioId = params.get("studioId") || "studio-default";
  const [selected, setSelected] = useState<string>();
  const [transferSnapshot, setTransferSnapshot] = useState<TransferSnapshot>();
  const transferHandled = useRef(false);
  useEffect(() => {
    if (transferHandled.current || params.get("transferred") !== "1") return;
    transferHandled.current = true;
    const snapshot = readTransferSnapshot();
    if (snapshot?.role === "studio" && snapshot.room === params.get("room")) {
      setTransferSnapshot(snapshot);
      setSelected(snapshot.room);
      window.history.replaceState(null, "", `/studio?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(snapshot.room)}`);
      queueMicrotask(clearTransferSnapshot);
    }
  }, [params]);
  return selected ? <StudioContent studioId={studioId} initialRoom={selected} transferSnapshot={transferSnapshot} /> : <StudioRoomPicker studioId={studioId} initialRoom={params.get("room") || ""} onJoin={name => { window.history.replaceState(null, "", `/studio?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(name)}`); setSelected(name); }} />;
}
