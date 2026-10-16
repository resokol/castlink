"use client";
import { studioCaptureConstraints, createBlackStudioVideo, connectStudioOutputAudio, type StudioVideoSource } from "@/lib/studio-output-source";
import MultiviewEditor from "./multiview/MultiviewEditor";
import { setRoomScreenShareOutputMuted } from "@/lib/screen-share";
import { BrandIcon } from "./BrandIcon";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { AppFooterSlot } from "@/components/AppChrome";
import { guestVideoBitrate } from "@/lib/video-quality";
import { METER_FLOOR_DB, peakDbfs } from "@/lib/audio-meter";
import { AudioMeter } from "@/components/AudioMeter";
import { GuestAudioMeter } from "@/components/GuestAudioMeter";
import { StudioGuestMediaPanel } from "@/components/StudioGuestMediaPanel";
import { readTrackStats } from "@/lib/media-stats";
import { createStudioSenderStatsState, sampleStudioSenderStats } from "@/lib/studio-sender-stats";
import { RemoteVideoPreview } from "@/components/RemoteVideoPreview";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { RotateVideoButton } from "@/components/RotateVideoButton";

import { StudioDeviceControlPanel } from "@/components/StudioDeviceControlPanel";
import { EmergencyReservePanel } from "@/components/EmergencyReservePanel";
import { ServerConnections } from "@/components/ServerConnections";
import { useSessionTransfer, reserveStatusText } from "@/lib/use-session-transfer";
import { ServerTransferPanel, type TransferInfo } from "@/components/ServerTransferPanel";
import { RoomManagementPanel } from "@/components/RoomManagementPanel";
import { StudioReturnStatsPanel } from "@/components/StudioReturnStatsPanel";
import { StudioReturnPublishingControls } from "@/components/StudioReturnPublishingControls";
import { ModeratorStudioMonitoring } from "@/components/ModeratorStudioMonitoring";
import { GuestVideoCard } from "@/components/GuestVideoCard";
import { StaffParticipantsPanel } from "@/components/StaffParticipantsPanel";
import { GuestParticipantsTable } from "@/components/GuestParticipantsTable";
import type { StudioDesired } from "@/lib/studio-control";
import { useStudioStreamRelay } from "@/lib/studio-stream-relay";
import { StudioStreamInviteButton } from "@/components/StudioStreamInviteButton";
import { RoomInviteButton } from "@/components/RoomInviteButton";
import { useRoomMode } from "@/lib/room-mode";
import { DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, STUDIO_FRAME_RATES, applyStudioSenderQuality, assertStudioVideoCodecSupported, assertPublishedStudioVideoCodec, isStudioVideoCodec, isValidStudioVideoBitrateKbps, studioVideoEncodingsMatch, studioVideoConstraints, studioVideoPublishOptions, videoBitrateOptions, type StudioFrameRate, type StudioVideoCodec } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { createStudioOutboundSample, selectStudioOutboundView, selectStudioGraphSource, receiveStudioActual, type StudioOutboundSample, type StudioGraphSourceMode } from "@/lib/studio-outbound-stats";
import { readControlResponse } from "@/lib/control-response";
import { RoomAudioRenderer } from "@livekit/components-react";
import { clearTransferSnapshot, type TransferSnapshot } from "@/lib/client-transfer";
import { resolveParticipantRole } from "@/lib/participant-role";
import { outputQualityRecipients, parseGuestClientInfo } from "@/lib/guest-media";
import { bindStudioRoomLifecycle } from "@/lib/studio-room-lifecycle";
import { toggleElementFullscreen } from "@/lib/fullscreen";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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

function GuestPreview({ room, identity, name, preference = defaultMonitor, onChange }: {
  room: Room; identity: string; name: string; preference?: MonitorPreference; onChange: (patch: Partial<MonitorPreference>) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="guest-preview-cell">
    <div className="studio-guest-video-wrap"><RemoteVideoPreview room={room} identity={identity} enabled={preference.video} />
      <button className="preview-fullscreen" title={t("Во весь экран")} onClick={(event) => { const target = event.currentTarget.parentElement; if (target) void toggleElementFullscreen(target); }}>⛶</button>
    </div>
  </div>;
}

function StudioContent({ studioId, initialRoom, transferSnapshot, entryPath = "/studio", simpleRoom = false, onLeave }: { studioId: string; initialRoom: string; transferSnapshot?: TransferSnapshot; entryPath?: string; simpleRoom?: boolean; onLeave?: () => void }) {
  const { t, locale } = useI18n();
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
    room.on(RoomEvent.ParticipantNameChanged, refreshParticipantRoles);
    return () => { room.off(RoomEvent.ParticipantMetadataChanged, refreshParticipantRoles); room.off(RoomEvent.ParticipantNameChanged, refreshParticipantRoles); };
  }, [room]);
  const [activeTab, setActiveTab] = useState<"studio" | "participants" | "statistics" | "multiview">("studio");
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>();
  const [transferInfo, setTransferInfo] = useState<TransferInfo>({ targets: [], loading: true });
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
  }, [roomName, transferRefresh, studioId, simpleRoom]);
  useEffect(() => {
    if (!transferSnapshot || transferSnapshot.role !== "studio" || (transferSnapshot.studioId && transferSnapshot.studioId !== studioId)) return;
    setRestoreMessage("Комната перенесена. Устройства браузера нужно подтвердить на этом сервере; публикация пока выключена.");
    queueMicrotask(clearTransferSnapshot);
  }, [transferSnapshot]);
  const startServerTransfer = async () => {
    if (!transferTargetId || transferBusy) return;
    if (!sessionToken || !studioClientId) {
      setTransferError("Дождитесь подтверждения подключения основной студии, затем повторите перенос.");
      return;
    }
    setTransferBusy(true); setTransferError("");
    try {
      const response = await fetch("/api/server-transfer", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "start", studioId, room: roomName, targetId: transferTargetId, clientId: studioClientId }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.ticket || !data.targetUrl) throw new Error(data.error || "Не удалось начать перенос комнаты.");
      setRestoreMessage("Подготовлен перенос комнаты. Участники переподключатся на целевом сервере.");
      await sessionTransfer.handoff(data);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Не удалось перенести комнату. Текущая сессия продолжает работать.");
    } finally { setTransferBusy(false); }
  };
  const editRoom = async (data: Record<string, string>) => {
    const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, studioId }) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || "Ошибка изменения комнаты");
    // Room creators receive a mutation acknowledgement; reload their own scoped catalog.
    let nextRooms: string[];
    if (Array.isArray(result.rooms)) nextRooms = result.rooms;
    else {
      const catalogResponse = await fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}`, { cache: "no-store" });
      const catalog = await catalogResponse.json();
      if (!catalogResponse.ok || !Array.isArray(catalog.rooms)) throw Error("Не удалось обновить список комнат");
      nextRooms = catalog.rooms;
    }
    setRooms(nextRooms); return nextRooms;
  };
  const switchRoom = (next: string) => {
    if (!next || next === roomName) return;
    setSessionToken(undefined); setRoomName(next);
    window.history.replaceState(null, "", `${entryPath}?studioId=${encodeURIComponent(studioId)}&${simpleRoom ? "name" : "room"}=${encodeURIComponent(next)}${simpleRoom ? "&mode=studio" : ""}`);
  };
  const createRoom = async () => {
    const next = newRoomName.trim(); if (!next || roomBusy) return;
    setRoomBusy(true);
    try { await editRoom({ action: "create", name: next, password: newRoomPassword }); setNewRoomName(""); setNewRoomPassword(""); switchRoom(next); }
    catch (e) { alert(translateWorkspaceMessage(t, e instanceof Error ? e.message : "Ошибка создания")); } finally { setRoomBusy(false); }
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
        if (!simpleRoom) await Promise.all(guests.map(g => fetch("/api/move-guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, identity: g.identity, targetRoom: next }) })));
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
      alert(translateWorkspaceMessage(t, e instanceof Error ? e.message : "Не удалось изменить настройки комнаты"));
    } finally { setRoomBusy(false); }
  };
  const deleteRoom = async () => {
    if (!window.confirm(t("Удалить комнату «{roomName}» из списка Studio?", { roomName }))) return;
    try { const remaining = await editRoom({ action: "delete", name: roomName }); if (simpleRoom && !remaining.length) onLeave?.(); else switchRoom(remaining[0]); }
    catch (e) { alert(translateWorkspaceMessage(t, e instanceof Error ? e.message : "Ошибка удаления")); }
  };
  const kick = async (identity: string, name: string) => {
    if (!window.confirm(t("Отключить «{name}» от комнаты? Участник сможет войти снова.", { name }))) return;
    try {
      const response = await fetch("/api/participants", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, identity }) });
      if (!response.ok) throw Error((await response.json()).error || "Не удалось отключить участника");
    } catch (e) { alert(translateWorkspaceMessage(t, e instanceof Error ? e.message : "Ошибка отключения")); }
  };
  const [status, setStatus] = useState("Подключение…");
  const [guests, setGuests] = useState<GuestStat[]>([]);
  const [copied, setCopied] = useState<string>();
  const [receiveSettings, setReceiveSettings] = useState<Record<string, number>>({});
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const returnBitrateHistoryRef = useRef<number[]>([]);
  const localOutboundRef = useRef<StudioOutboundSample | null>(null);
  const [localOutboundSample, setLocalOutboundSample] = useState<StudioOutboundSample | null>(null);
  const [graphSourceMode, setGraphSourceMode] = useState<StudioGraphSourceMode>("auto");
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
  const returnSenderStatsRef = useRef(createStudioSenderStatsState());
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
  const [returnVideoCodec, setReturnVideoCodec] = useState<StudioVideoCodec>(() => isStudioVideoCodec(transferSnapshot?.settings?.videoCodec) ? transferSnapshot.settings.videoCodec : "vp8");
  const returnVideoCodecRef = useRef(returnVideoCodec); returnVideoCodecRef.current = returnVideoCodec;
  const [returnSimulcast, setReturnSimulcast] = useState(() => typeof transferSnapshot?.settings?.simulcast === "boolean" ? transferSnapshot.settings.simulcast : true);
  const returnSimulcastRef = useRef(returnSimulcast); returnSimulcastRef.current = returnSimulcast;
  const [videoModeBusy, setVideoModeBusy] = useState(false);
  const videoModeBusyRef = useRef(false);
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
  const [returnLevel, setReturnLevel] = useState(METER_FLOOR_DB);
  const [returnGain, setReturnGain] = useState(() => typeof transferSnapshot?.settings?.gain === "number" ? transferSnapshot.settings.gain : 100);
  const returnGainRef = useRef(returnGain);
  returnGainRef.current = returnGain;
  const returnGainNodeRef = useRef<GainNode | undefined>(undefined);
  const [outputMuted, setOutputMuted] = useState(transferSnapshot?.settings?.outputMuted === true);
  const outputMutedRef = useRef(outputMuted); outputMutedRef.current = outputMuted;
  const outputMuteGainRef = useRef<GainNode | undefined>(undefined);
  const [videoSource, setVideoSource] = useState<StudioVideoSource>(transferSnapshot?.settings?.videoSource === "black" ? "black" : "camera");
  const videoSourceRef = useRef(videoSource); videoSourceRef.current = videoSource;

  const [returnActive, setReturnActive] = useState(false);
  const returnActiveRef = useRef(returnActive);
  returnActiveRef.current = returnActive;
  const [returnMonitor, setReturnMonitor] = useState<MonitorPreference>({ audio: false, video: true, volume: 100 });
  const [studioRole, setStudioRole] = useState<"connecting" | "primary" | "moderator">("connecting");
  const studioRoleRef = useRef(studioRole);
  studioRoleRef.current = studioRole;
  const transferLeavingRef = useRef(false);
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
  const streamRelay = useStudioStreamRelay({ roomName, clientId: studioClientId, epoch: studioEpoch, enabled: studioRole === "primary" && onAir, audioTrack: returnPublishedRef.current.audio?.mediaStreamTrack, videoTrack: returnPublishedRef.current.video?.mediaStreamTrack, fps: returnFps, bitrateKbps: returnBitrate, videoCodec: returnVideoCodec });
  const streamRelayRef = useRef(streamRelay);
  streamRelayRef.current = streamRelay;
  const sessionTransfer = useSessionTransfer({
    studioId, room: roomName, token: sessionToken, clientId: studioClientId, canActivate: studioRole === "primary",
    snapshot: async () => {
      const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
      const labelFor = (kind: MediaDeviceKind, id: string) => devices.find(device => device.kind === kind && device.deviceId === id)?.label;
      return { role: "studio", studioId, room: roomName, sourceOrigin: window.location.origin, settings: {
        fps: returnFps, bitrate: returnBitrate, videoCodec: returnVideoCodec, simulcast: returnSimulcast, gain: returnGain, outputMuted, videoSource, onAir, returnActive,
        videoLabel: labelFor("videoinput", returnVideoDevice || returnSourceDeviceIdsRef.current.video),
        audioLabel: labelFor("audioinput", returnAudioDevice || returnSourceDeviceIdsRef.current.audio),
        outputLabel: returnOutputDevice === "default" ? undefined : labelFor("audiooutput", returnOutputDevice),
      } };
    },
    beforeHandoff: async () => {
      // This callback runs only after the target ticket and origin are validated.
      transferLeavingRef.current = true;
      if (studioRoleRef.current === "primary" && studioClientId) {
        try {
          await fetch("/api/studio-control", {
            method: "POST",
            headers: { "content-type": "application/json", ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}) },
            body: JSON.stringify({ action: "release", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch }),
            signal: AbortSignal.timeout(1000),
          });
        } catch { /* An unavailable source must not prevent emergency handoff. */ }
      }
      await room.disconnect();
    },
  });


  useEffect(() => {
    returnBitrateHistoryRef.current = [];
    bitrateSampleAtRef.current = 0;
    returnSenderStatsRef.current = createStudioSenderStatsState();
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
        const state = returnSenderStatsRef.current;
        const measured = await sampleStudioSenderStats(state, videoTrack, audioTrack);
        if (!stillPrimaryOnAir() || returnSenderStatsRef.current !== state) return;
        if (measured) {
          const history = recordReturnBitrate(measured.metrics.videoKbps) || returnBitrateHistoryRef.current;
          const sample = createStudioOutboundSample(measured.metrics, history, Date.now());
          localOutboundRef.current = sample;
          setLocalOutboundSample(sample);
          setStatsDebug(`ON AIR=${onAirRef.current}; pubs=${localPubs.length}; videoPub=${!!videoPubNow}; audioPub=${!!audioPubNow}; videoTrack=${!!videoTrack}; audioTrack=${!!audioTrack}; videoStats=${measured.videoStats}; videoKbps=${measured.metrics.videoKbps}; audioKbps=${measured.metrics.audioKbps}`);
        } else {
          setStatsDebug("Ожидание нового замера исходящего потока основной студии");
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
          if (isStudioVideoCodec(joined.desired.videoCodec)) { returnVideoCodecRef.current = joined.desired.videoCodec; setReturnVideoCodec(joined.desired.videoCodec); }
          if (typeof joined.desired.simulcast === "boolean") { returnSimulcastRef.current = joined.desired.simulcast; setReturnSimulcast(joined.desired.simulcast); }
          if (Number.isFinite(Number(joined.desired.gain))) setReturnGain(Number(joined.desired.gain));
          setOutputMuted(joined.desired.outputMuted === true); setVideoSource(joined.desired.videoSource === "black" ? "black" : "camera");
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
          const restoreResponse = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "command", studioId, room: roomName, clientId, epoch: Number(joined.epoch || 0), patch: { fps: returnFpsRef.current, bitrate: returnBitrateRef.current, videoCodec: returnVideoCodecRef.current, simulcast: returnSimulcastRef.current, gain: returnGainRef.current, outputMuted: outputMutedRef.current, videoSource: videoSourceRef.current, preview: false, onAir: false } }) });
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
    const updateMeterTargets = () => {
      for (const participant of room.remoteParticipants.values()) {
        if (!participant.identity.startsWith("guest-")) continue;
        guestMeterTargetsRef.current[participant.identity] = Number(participant.audioLevel || 0);
      }
    };
    const onData = (payload: Uint8Array, participant?: { identity: string; metadata?: string }, _kind?: unknown, topic?: string) => {
      if (topic !== "studiolink-client-info" || !participant) return;
      const info = parseGuestClientInfo(payload, participant.identity, participant.metadata);
      if (!info) return;
      clientInfoRef.current[participant.identity] = info; void refresh();
    };
    const debugTracks = () => {
      const next: Record<string,string> = {};
      for (const p of room.remoteParticipants.values()) {
        if (!p.identity.startsWith("guest-")) continue;
        const pubs = Array.from(p.trackPublications.values());
        next[p.identity] = pubs.map((x:any) => `${x.kind}/${x.source}/sub=${x.isSubscribed}/muted=${x.isMuted}/track=${!!x.track}`).join(" | ") || "нет publications";
      }
      setAudioDebug(next);
    };
    const unbindRoomLifecycle = bindStudioRoomLifecycle(room, {
      onUpdate: update,
      onParticipantDeparted: (identity: string) => {
        setGuests(current => current.filter(g => g.identity !== identity));
        delete clientInfoRef.current[identity];
        delete guestMeterTargetsRef.current[identity];
        delete guestMeterDisplayRef.current[identity];
        update();
      },
      onActiveSpeakersChanged: updateMeterTargets,
      onDataReceived: onData,
      onDebugTracks: debugTracks,
    });
    const debugTimer = setInterval(debugTracks, 1000);

    return () => {
      cancelled = true;
      releaseClientLock?.();
      if (timer) clearInterval(timer);
      clearInterval(debugTimer);
      stopTelemetry?.();
      cancelAnimationFrame(meterRaf);
      unbindRoomLifecycle();
    };
  }, [room, roomName]);

  useEffect(() => {
    if (!returnActive || studioRole === "moderator") return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | undefined;
    let captured: MediaStream | undefined;
    let processed: MediaStream | undefined;
    let monitorStream: MediaStream | undefined;
    let black: ReturnType<typeof createBlackStudioVideo> | undefined;
    (async () => {
      try {
        previewReadyRef.current = false; setPreviewReady(false);
        previewDeviceErrorRef.current = "";
        returnStreamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia(studioCaptureConstraints(videoSource, returnVideoDevice, returnAudioDevice, previewFps));
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        captured = new MediaStream(stream.getTracks());
        if (videoSource === "black") { black = createBlackStudioVideo(previewFps); stream.addTrack(black.track); }
        returnSourceDeviceIdsRef.current = {
          video: stream.getVideoTracks()[0]?.getSettings().deviceId || "",
          audio: stream.getAudioTracks()[0]?.getSettings().deviceId || "",
        };
        captured = new MediaStream(stream.getTracks());
        returnStreamRef.current = stream;

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
        source.connect(gain);
        const monitor = ctx.createMediaStreamDestination();
        monitorStream = monitor.stream;
        const output = connectStudioOutputAudio(ctx, gain, analyser, monitor, outputMutedRef.current);
        outputMuteGainRef.current = output.gain;
        processed = output.stream;
        const processedAudio = output.stream.getAudioTracks()[0];
        stream.removeTrack(stream.getAudioTracks()[0]); stream.addTrack(processedAudio);
        if (returnVideoRef.current) {
          returnVideoRef.current.srcObject = new MediaStream([...stream.getVideoTracks(), ...monitor.stream.getAudioTracks()]);
          await returnVideoRef.current.play().catch(() => undefined);
        }
        const data = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(data);
          setReturnLevel(Math.round(peakDbfs(data) * 10) / 10);
          raf = requestAnimationFrame(tick);
        };
        tick();
        previewReadyRef.current = true; setPreviewReady(true);
      } catch (e) { console.error("Studio return preview failed", e); if (!cancelled) { previewDeviceErrorRef.current = e instanceof DOMException && e.name === "OverconstrainedError" ? "Источник не поддерживает 1920×1080. Выберите Full HD камеру или настройте выход источника на 1920×1080." : e instanceof Error ? e.message : "Не удалось открыть устройства Studio Return"; setOnAirStatus(previewDeviceErrorRef.current); } }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); captured?.getTracks().forEach((t) => t.stop()); processed?.getTracks().forEach((t) => t.stop()); monitorStream?.getTracks().forEach(t => t.stop()); black?.stop(); outputMuteGainRef.current = undefined; returnStreamRef.current = undefined; void ctx?.close().catch(() => undefined); };
  }, [returnActive, returnVideoDevice, returnAudioDevice, previewFps, studioRole, videoSource]);

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
    if (nextOnAir && videoModeBusyRef.current) { setOnAirStatus("Дождитесь сохранения видеокодека и режима потока"); return; }
    if (nextOnAir && !previewReadyRef.current) { setOnAirStatus("Дождитесь готовности выбранных устройств Studio Return"); return; }
    airBusyRef.current = true;
    setAirBusy(true);
    try {
      if (!nextOnAir) {
        for (const publication of room.localParticipant.trackPublications.values()) {
          if (publication.track) await room.localParticipant.unpublishTrack(publication.track, false);
        }
        returnPublishedRef.current = {};
        returnPublicationRef.current = {};
        returnSenderStatsRef.current = createStudioSenderStatsState();
        onAirRef.current = false;
        setOnAir(false);
        setOnAirStatus("OFF AIR");
        return;
      }
      const stream = returnStreamRef.current;
      if (!stream) throw Error("Дождитесь готовности предпросмотра Studio Return");
      const video = stream.getVideoTracks()[0];
      const audio = stream.getAudioTracks()[0];
      if (!video || !audio || video.readyState !== "live" || audio.readyState !== "live") throw new Error("Нет видео или аудио Studio Return");
      assertStudioVideoCodecSupported(returnVideoCodecRef.current);
      // Lock the saved mode before publication; a concurrent OFF AIR mode change must win or reject this request.
      await persistControlPatch({ onAir: true, videoCodec: returnVideoCodecRef.current, simulcast: returnSimulcastRef.current });
      const videoPub = await room.localParticipant.publishTrack(video, studioVideoPublishOptions(returnBitrateRef.current, returnFpsRef.current, returnVideoCodecRef.current, returnSimulcastRef.current));
      assertPublishedStudioVideoCodec(videoPub.videoTrack, returnVideoCodecRef.current);
      const audioPub = await room.localParticipant.publishTrack(audio, { source: Track.Source.Microphone, name: "Studio Return Audio", audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: true });
      returnPublicationRef.current = { video: videoPub, audio: audioPub };
      returnPublishedRef.current = { video: videoPub.track, audio: audioPub.track };
      onAirRef.current = true;
      returnSenderStatsRef.current = createStudioSenderStatsState();
      setOnAir(true);
      void refreshRef.current();
      setOnAirStatus("ON AIR");
    } catch (e) {
      console.error("Studio Return publish failed", e);
      for (const publication of room.localParticipant.trackPublications.values()) {
        if (publication.track) await room.localParticipant.unpublishTrack(publication.track, false);
      }
      onAirRef.current = false; setOnAir(false);
      if (nextOnAir) await persistControlPatch({ onAir: false }).catch(() => undefined);
      setOnAirStatus(e instanceof Error ? e.message : "Ошибка публикации");
      setStudioControlError(e instanceof Error ? e.message : "Ошибка публикации");
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
  const changeVideoMode = async (patch: { videoCodec?: StudioVideoCodec; simulcast?: boolean }, fromRemote = false) => {
    const codec = patch.videoCodec ?? returnVideoCodecRef.current;
    const simulcast = patch.simulcast ?? returnSimulcastRef.current;
    const changing = codec !== returnVideoCodecRef.current || simulcast !== returnSimulcastRef.current;
    if (changing && (onAirRef.current || airBusyRef.current)) throw new Error("Кодек и режим видеопотока меняются только в OFF AIR.");
    if (!fromRemote && videoModeBusyRef.current) return;
    if (!fromRemote) { videoModeBusyRef.current = true; setVideoModeBusy(true); }
    try {
      if (fromRemote) {
        // Keep the server-selected value visible even when this browser cannot publish it.
        returnVideoCodecRef.current = codec; setReturnVideoCodec(codec);
        returnSimulcastRef.current = simulcast; setReturnSimulcast(simulcast);
      }
      if (studioRoleRef.current === "primary") assertStudioVideoCodecSupported(codec);
      if (!fromRemote) await persistControlPatch(patch);
      returnVideoCodecRef.current = codec; setReturnVideoCodec(codec);
      returnSimulcastRef.current = simulcast; setReturnSimulcast(simulcast);
      if (!fromRemote) setStudioControlError("");
    } finally { if (!fromRemote) { videoModeBusyRef.current = false; setVideoModeBusy(false); } }
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
  const changeOutputMuted = async (muted: boolean, fromRemote = false) => {
    if (!fromRemote) await persistControlPatch({ outputMuted: muted });
    outputMutedRef.current = muted; setOutputMuted(muted);
    setRoomScreenShareOutputMuted(room, muted);
    if (outputMuteGainRef.current) outputMuteGainRef.current.gain.value = muted ? 0 : 1;
  };
  const changeVideoSource = async (source: StudioVideoSource, fromRemote = false) => {
    if (onAirRef.current || airBusyRef.current) throw new Error("Для смены источника выключите эфир основной студии.");
    if (!fromRemote && videoModeBusyRef.current) return;
    if (!fromRemote) { videoModeBusyRef.current = true; setVideoModeBusy(true); }
    try {
      if (!fromRemote) await persistControlPatch({ videoSource: source });
      if (studioRoleRef.current === "primary" && source !== videoSourceRef.current) { previewReadyRef.current = false; setPreviewReady(false); }
      videoSourceRef.current = source; setVideoSource(source);
    } finally { if (!fromRemote) { videoModeBusyRef.current = false; setVideoModeBusy(false); } }
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
      if (!fromRemote && !next && !onAirRef.current) void persistControlPatch({ onAir: false }).catch(() => undefined);
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
      if (videoModeBusyRef.current) return;
      applyingControlRef.current = true;
      try {
        // Apply OFF AIR before a saved mode or device change, including commands accepted during publication.
        if (desired.onAir === false && onAirRef.current) await toggleOnAir(false);
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
        await changeVideoMode({ videoCodec: isStudioVideoCodec(desired.videoCodec) ? desired.videoCodec : "vp8", simulcast: typeof desired.simulcast === "boolean" ? desired.simulcast : true }, true);
        const nextFps = STUDIO_FRAME_RATES.includes(Number(desired.fps) as StudioFrameRate) ? Number(desired.fps) as StudioFrameRate : returnFpsRef.current;
        const nextBitrate = isValidStudioVideoBitrateKbps(Number(desired.bitrate)) ? Number(desired.bitrate) : returnBitrateRef.current;
        if (nextFps !== returnFpsRef.current || nextBitrate !== returnBitrateRef.current) await changeQuality(nextFps, nextBitrate, true);
        if (Number.isFinite(Number(desired.gain)) && Number(desired.gain) !== returnGainRef.current) changeGain(Number(desired.gain), true);
        if (typeof desired.outputMuted === "boolean" && desired.outputMuted !== outputMutedRef.current) await changeOutputMuted(desired.outputMuted, true);
        if ((desired.videoSource === "camera" || desired.videoSource === "black") && desired.videoSource !== videoSourceRef.current) await changeVideoSource(desired.videoSource, true);
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
      if (stopped || transferLeavingRef.current || applyingControlRef.current || pollInFlight) return;
      pollInFlight = true;
      try {
        const response = await fetch(`/api/studio-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&clientId=${encodeURIComponent(studioClientId)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const data = await readControlResponse(response, "Не удалось проверить управление Studio Panel");
        if (stopped || transferLeavingRef.current) return;
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
          if (isStudioVideoCodec(data.desired.videoCodec)) { returnVideoCodecRef.current = data.desired.videoCodec; setReturnVideoCodec(data.desired.videoCodec); }
          if (typeof data.desired.simulcast === "boolean") { returnSimulcastRef.current = data.desired.simulcast; setReturnSimulcast(data.desired.simulcast); }
          if (typeof data.desired.gain === "number") setReturnGain(data.desired.gain);
          setOutputMuted(data.desired.outputMuted === true); setVideoSource(data.desired.videoSource === "black" ? "black" : "camera");
          if (typeof data.desired.preview === "boolean") setReturnActive(data.desired.preview);
        }
      } catch (error) {
        if (!stopped) {
          if (studioRoleRef.current === "moderator") {
            if (remoteActualRef.current && typeof remoteActualRef.current === "object") {
              // Re-evaluate each publication's freshness independently; a stale main sample must not erase fresh /watch telemetry.
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
      if (stopped || transferLeavingRef.current || studioRoleRef.current !== "primary" || heartbeatInFlight) return;
      heartbeatInFlight = true;
      try {
        const outputSupported = "setSinkId" in HTMLMediaElement.prototype;
        const devices = returnDevicesRef.current.filter(device => device.deviceId && (outputSupported || device.kind !== "audiooutput"))
          .slice(0, 40).map(({ deviceId, label, kind }) => ({ deviceId, label: label.slice(0, 120), kind }));
        if (outputSupported && !devices.some(device => device.kind === "audiooutput" && device.deviceId === "default")) devices.push({ deviceId: "default", label: "Системный выход", kind: "audiooutput" });
        const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "heartbeat", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch, actual: { fps: returnFpsRef.current, bitrate: returnBitrateRef.current, gain: returnGainRef.current, outputMuted: outputMutedRef.current, videoSource: videoSourceRef.current, onAir: onAirRef.current, airBusy: airBusyRef.current, preview: returnActiveRef.current,
          devices, ...selectedDevicesRef.current,
          videoDeviceId: selectedDevicesRef.current.videoDeviceId || returnSourceDeviceIdsRef.current.video,
          audioDeviceId: selectedDevicesRef.current.audioDeviceId || returnSourceDeviceIdsRef.current.audio,
          outputDeviceId: confirmedOutputRef.current,
          deviceRevisionApplied: deviceRevisionRef.current, deviceBusy: deviceBusyRef.current || (returnActiveRef.current && !previewReadyRef.current && !previewDeviceErrorRef.current), deviceError: deviceErrorRef.current || previewDeviceErrorRef.current,
          outbound: localOutboundRef.current, outboundAgeMs: localOutboundRef.current ? Math.max(0, Date.now() - localOutboundRef.current.measuredAt) : undefined,
          watchOutbound: streamRelayRef.current.outbound, watchOutboundAgeMs: streamRelayRef.current.outbound ? Math.max(0, Date.now() - streamRelayRef.current.outbound.measuredAt) : undefined,
          error: studioControlErrorRef.current || undefined } }) });
        const data = await readControlResponse(response, "Основная студия потеряла управление");
        if (stopped || transferLeavingRef.current) return;
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
    let permission: MediaStream | undefined;
    try {
      permission = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoSourceRef.current !== "black" });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setReturnDevices(devices);
      const match = (kind: MediaDeviceKind, label?: string) => label ? devices.filter(device => device.kind === kind && device.label === label) : [];
      const videoMatches = match("videoinput", pendingStudioLabels.video);
      const audioMatches = match("audioinput", pendingStudioLabels.audio);
      const outputMatches = match("audiooutput", pendingStudioLabels.output);
      const videoOk = videoSourceRef.current === "black" || videoMatches.length === 1;
      const audioOk = audioMatches.length === 1;
      if (videoSourceRef.current !== "black" && videoMatches.length === 1) setReturnVideoDevice(videoMatches[0].deviceId);
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
    } catch (error) {
      setRestoreMessage(error instanceof Error ? `Разрешите доступ к камере и микрофону, затем повторите: ${error.message}` : "Нужен доступ к камере и микрофону для сопоставления устройств.");
    } finally { permission?.getTracks().forEach(track => track.stop()); setRestoreBusy(false); }
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
  const outputUrl = (identity: string, source: "camera" | "screen" = "camera") => `${base}/output/${encodeURIComponent(identity)}?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&bitrate=${receiveFor(identity)}${source === "screen" ? "&source=screen" : ""}${viewAccess ? `#access=${encodeURIComponent(viewAccess)}` : ""}`;
  const receiveFor = (identity: string) => guestVideoBitrate(room.remoteParticipants.get(identity)?.metadata);
  const mainStudioMonitor = monitoring.preferences["studio-panel-main"] ?? moderatorStudioMonitorDefaults["studio-panel-main"];
  const applyReceiveQuality = async (identity: string, bitrateKbps: number) => {
    try {
      const response = await fetch("/api/participants", {
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({ action:"video-bitrate",studioId,room:roomName,identity,bitrateKbps }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось задать лимит камеры");
      // Metadata is the source of truth; no optimistic substitution of measured bitrate.
      setReceiveSettings(current => ({ ...current,[identity]:bitrateKbps }));
    } catch (error) { window.alert(translateWorkspaceMessage(t, error instanceof Error ? error.message : "Лимит камеры не применён")); }
  };
  const moveGuest = async (identity: string, targetRoom: string) => {
    if (simpleRoom || !targetRoom || !rooms.includes(targetRoom)) return;
    const response = await fetch("/api/move-guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studioId, room: roomName, identity, targetRoom }),
    });
    if (!response.ok) alert(t("Не удалось перевести гостя"));
  };
  const refreshGuest = async (identity: string) => {
    const participant = room.remoteParticipants.get(identity);
    if (!participant) return;
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio) publication.setSubscribed(false);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio) {
        publication.setSubscribed(true);
        if (publication.kind === Track.Kind.Video) publication.setVideoQuality(VideoQuality.HIGH);
      }
    }
    monitoring.apply();
    setTimeout(() => void refreshRef.current(), 500);
  };
  const copyGuestOutput = async (identity: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(identity);
    setTimeout(() => setCopied(undefined), 1200);
  };
  const mainOutboundView = selectStudioOutboundView(studioRole, localOutboundSample, remoteActual, studioPrimaryOnline, Date.now());
  const watchOutboundView = selectStudioOutboundView(studioRole, streamRelay.outbound, remoteActual, studioPrimaryOnline, Date.now(), "watch");
  const graphSource = selectStudioGraphSource(graphSourceMode, mainOutboundView, watchOutboundView);
  const outboundView = graphSource === "watch" ? watchOutboundView : mainOutboundView;
  const displayedOutbound = outboundView.sample ?? { resolution: "—", videoKbps: 0, audioKbps: 0, fps: 0, measuredAt: 0, videoHistory: [] };
  const displayedHistory = outboundView.sample?.videoHistory ?? [];
  const returnBitratePoints = useMemo(() => displayedHistory.map((value, index) => `${40 + index / Math.max(displayedHistory.length - 1, 1) * 258},${198 - Math.min(value, 25000) / 25000 * 192}`).join(" "), [displayedHistory]);
  const outboundStatusText = outboundView.status === "live" ? "Свежие измерения" : outboundView.status === "offline" ? "Основная студия офлайн. Ожидаем повторное подключение." : outboundView.status === "stale" ? "Измерения устарели. Ожидаем новый замер." : "Ожидание первого замера…";
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
    <main className="media-page studio-page studio-app-shell graphite-workspace">
      <aside className="studio-sidebar">
        <div className="studio-brand"> <BrandIcon className="studio-brand-mark" /><span><strong>CastLink</strong><small>LIVE PRODUCTION</small></span></div>
        <nav className="studio-tabs" aria-label={t("Раздел студии")}>
          <button aria-pressed={activeTab === "studio"} onClick={() => setActiveTab("studio")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>{t("Студия")}</button>
          <button aria-pressed={activeTab === "participants"} onClick={() => setActiveTab("participants")}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 21v-4a6 6 0 0112 0v4M17 5a3 3 0 010 6m1 3a5 5 0 013 5v2" /></svg>{t("Участники")}</button>
          <button aria-pressed={activeTab === "statistics"} onClick={() => setActiveTab("statistics")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v18h17M7 16l4-6 4 3 5-8" /></svg>{t("Статистика")}</button>
        </nav>
        <div className="sidebar-room-card"><small>{t("АКТИВНАЯ КОМНАТА")}</small><strong>{roomName}</strong><span className="sidebar-live-status"><i />{translateWorkspaceMessage(t, status)}</span></div>
        <div className="sidebar-footer"><BrandIcon className="studio-brand-mark" /><span><strong>Studio Panel</strong><small>{guests.length} {t("гостей в комнате")}</small></span></div>
        <button className="sidebar-leave-button" onClick={() => { if (onLeave) onLeave(); else window.location.assign(entryPath); }}>{t("Выйти из комнаты")}</button>
      </aside>
      <div className="studio-main-column">
      <div className="studio-header">
        <div>
          <p className="muted">{t("РАБОЧАЯ СТУДИЯ")}</p>
          <h1>{roomName}</h1>

        </div>
        <div className="status-pill"><button type="button" className="button-secondary" aria-pressed={activeTab === "multiview"} onClick={() => setActiveTab(activeTab === "multiview" ? "studio" : "multiview")}>{t("Мультивью")}</button><button type="button" className="studio-room-menu-toggle" hidden={activeTab !== "studio"} aria-label={t("Настройки комнаты")} aria-expanded={roomMenuOpen} aria-controls="studio-room-management-panel" onClick={() => setRoomMenuOpen(open => !open)}>
          <span aria-hidden="true" className="studio-room-menu-icon">☰</span><span>{t("Комната")}</span><span className="studio-room-menu-count">{rooms.length}</span>
        </button><span className={`studio-role-badge studio-role-${studioRole}`}>{studioRole === "primary" ? t("Основная студия") : studioRole === "moderator" ? t("Администратор") : t("Подключение")}</span>{studioRole === "moderator" && !studioPrimaryOnline && <button type="button" className="button-secondary" onClick={async () => {
          try {
            const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", studioId, room: roomName, clientId: studioClientId, epoch: studioEpoch }) });
            const data = await readControlResponse(response, "Не удалось принять управление");
            window.location.reload();
          } catch (error) { setStudioControlError(error instanceof Error ? error.message : "Не удалось принять управление"); }
        }}>{t("Принять управление")}</button>}{translateWorkspaceMessage(t, status)}</div>
      </div>
      <RoomAudioRenderer room={room} />
      {activeTab === "multiview" && <MultiviewEditor key={`${studioId}:${roomName}`} room={room} studioId={studioId} roomName={roomName} viewAccess={viewAccess} onClose={() => setActiveTab("studio")} />}
      <RoomManagementPanel
        studioId={studioId}
        hidden={activeTab !== "studio" || !roomMenuOpen}
        simpleRoom={simpleRoom}
        entryPath={entryPath}
        rooms={rooms}
        roomName={roomName}
        newRoomName={newRoomName}
        newRoomPassword={newRoomPassword}
        roomBusy={roomBusy}
        editOpen={activeTab === "studio" && roomEditOpen}
        editRoomName={editRoomName}
        editRoomPassword={editRoomPassword}
        currentRoomPassword={currentRoomPassword}
        roomPasswordSet={roomPasswordSet}
        showEditRoomPassword={showEditRoomPassword}
        removeRoomPassword={removeRoomPassword}
        onSwitchRoom={switchRoom}
        onNewRoomNameChange={setNewRoomName}
        onNewRoomPasswordChange={setNewRoomPassword}
        onCreateRoom={() => void createRoom()}
        onOpenEditor={openRoomEditor}
        onDeleteRoom={() => void deleteRoom()}
        onCloseEditor={() => setRoomEditOpen(false)}
        onEditRoomNameChange={setEditRoomName}
        onEditRoomPasswordChange={setEditRoomPassword}
        onTogglePasswordVisibility={() => setShowEditRoomPassword(value => !value)}
        onRemovePasswordChange={setRemoveRoomPassword}
        onSaveSettings={saveRoomSettings}
      />
      {studioOnly && <p className="studio-only-notice room-mode-notice" role="status">{t("Студия включила только свой просмотр")}</p>}
      <section className="studio-video-section" hidden={activeTab !== "studio"} aria-label="Studio Return monitor">
      <div className="studio-return-hero">
        <div className="panel studio-video-card studio-return-preview-card"><h2>Studio Return <span className={`air-state ${onAir ? "air-live" : ""}`}><i className="air-dot" />{onAir ? "ON AIR" : "OFF AIR"}</span></h2>
          {returnActive ? <video ref={returnVideoRef} muted={studioRole === "moderator" || !returnMonitor.audio} playsInline className="return-preview" style={{ opacity: (studioRole === "moderator" ? mainStudioMonitor.video : returnMonitor.video) ? 1 : 0 }} /> : <div className="studio-preview-placeholder">{t("Проверка Studio Return остановлена")}</div>}
          {room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.ScreenShare) && <div className="studio-screen-share-preview"><RemoteVideoPreview room={room} identity="studio-panel-main" camera={false} enabled={mainStudioMonitor.video} /></div>}
          {returnActive && <div className="return-audio-meter studio-preview-meter">
            <AudioMeter db={returnLevel} label="Studio Return" />
          </div>}
          <section className="studio-invite-compact" aria-label={t("Приглашения и доступы")}>
            <div className="guest-invite-slot"><RoomInviteButton studioId={studioId} roomName={roomName} entryPath={simpleRoom ? entryPath : undefined} key={`${roomName}:${roomAccessVersion}`} /></div>
            <div className="stream-invite-slot"><StudioStreamInviteButton studioId={studioId} roomName={roomName} key={`stream:${roomName}`} /></div>
            {studioRole === "primary" && <small className="invite-extra" role="status">{t("Зрителей отдельного потока:")} {streamRelay.viewerCount}{streamRelay.error ? ` · ${streamRelay.error}` : ""}</small>}
          </section>
        </div>
        <StudioReturnStatsPanel
          role={studioRole}
          statusText={outboundStatusText}
          hasSample={Boolean(outboundView.sample)}
          stats={displayedOutbound}
          bitratePoints={returnBitratePoints}
          historyLength={displayedHistory.length}
          mainView={mainOutboundView}
          watchView={watchOutboundView}
          graphSourceMode={graphSourceMode}
          graphSource={graphSource}
          onGraphSourceChange={setGraphSourceMode}
          clientReady={Boolean(studioClientId)}
          airBusy={airBusy || videoModeBusy}
          fps={returnFps}
          bitrate={returnBitrate}
          videoCodec={returnVideoCodec}
          simulcast={returnSimulcast}
          onAir={onAir}
          onVideoModeChange={patch => void changeVideoMode(patch).catch(error => setStudioControlError(error instanceof Error ? error.message : "Не удалось изменить режим видео."))}
          studioControlError={studioControlError}
          controlPollError={controlPollError}
          controlHeartbeatError={controlHeartbeatError}
          onQualityChange={(fps, bitrate) => void changeQuality(fps, bitrate)}
          headerActions={activeTab === "studio" ? <StudioReturnPublishingControls
            outputMuted={outputMuted}
            onToggleOutputMuted={() => void changeOutputMuted(!outputMuted).catch(error => setStudioControlError(error.message))}
            studioOnly={studioOnly}
            modeBusy={modeBusy}
            role={studioRole}
            hasSession={Boolean(sessionToken)}
            onAir={onAir}
            airBusy={airBusy || videoModeBusy}
            returnActive={returnActive}
            previewReady={previewReady}
            screenShare={<ScreenShareButton room={room} compact outputMuted={outputMuted} getOutputMuted={() => outputMutedRef.current} />}
            onToggleStudioOnly={() => {
              const next = !studioOnly;
              setModeBusy(true);
              void fetch("/api/rooms", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "mode", studioId, name: roomName, studioOnly: next }),
              }).then(response => {
                if (!response.ok) throw Error("Не удалось изменить режим комнаты");
                setStudioOnly(next);
              }).catch(error => {
                setStatus(error instanceof Error ? error.message : "Ошибка режима комнаты");
              }).finally(() => setModeBusy(false));
            }}
            onTogglePreview={() => changePreview(!returnActive)}
            onToggleOnAir={() => requestOnAir(!onAir)}
          /> : undefined}
        />
          {studioRole === "moderator" && <ModeratorStudioMonitoring
            value={mainStudioMonitor}
            onChange={patch => monitoring.change("studio-panel-main", patch)}
          />}

          <small className="stats-debug">{t("Диагностика:")} {translateWorkspaceMessage(t, statsDebug)}</small>
      </div>
      </section>
      {activeTab === "studio" && transferSnapshot?.role === "studio" && <div className="transfer-notice" role="status">
        <p>{translateWorkspaceMessage(t, restoreMessage) || t("Параметры комнаты восстановлены. Проверьте источники перед эфиром.")}</p>
        <button type="button" className="button-secondary" disabled={restoreBusy} onClick={() => void restoreStudioInputs()}>{restoreBusy ? t("Проверяем устройства…") : t("Сопоставить прежние устройства")}</button>
      </div>}
      <div className="studio-settings" id="studio-settings" hidden={activeTab !== "studio"}>
      <div className="panel studio-device-panel">
      <label>{t("Источник видео студии")}<select value={videoSource} disabled={onAir || airBusy || videoModeBusy || studioRole === "connecting"} onChange={event => void changeVideoSource(event.target.value as StudioVideoSource).catch(error => setStudioControlError(error.message))}>
        <option value="camera">{t("Камера / видеоустройство")}</option><option value="black">{t("Чёрный фон")}</option>
      </select></label>
      <StudioDeviceControlPanel
        videoSource={videoSource}
        role={studioRole}
        room={room}
        disabledInputs={onAir || airBusy}
        cameraId={returnVideoDevice}
        microphoneId={returnAudioDevice}
        headphonesId={returnOutputDevice}
        outputRequestKey={outputRequestKey}
        remoteActual={remoteActual as Record<string, unknown> | null}
        remoteDesired={remoteDesired}
        remoteOnline={studioPrimaryOnline}
        remoteDisabled={studioRole === "connecting"}
        onDevicesChanged={setReturnDevices}
        onOutputStatus={(deviceId, error) => {
          if (deviceId !== selectedDevicesRef.current.outputDeviceId) return;
          deviceBusyRef.current = false;
          if (error) deviceErrorRef.current = `Не удалось переключить вывод: ${error}`;
          else {
            deviceErrorRef.current = "";
            confirmedOutputRef.current = deviceId;
          }
        }}
        onLocalChange={change => {
          deviceErrorRef.current = "";
          if (change.cameraId !== undefined) setReturnVideoDevice(change.cameraId);
          if (change.microphoneId !== undefined) setReturnAudioDevice(change.microphoneId);
          if (change.headphonesId !== undefined) setReturnOutputDevice(change.headphonesId);
        }}
        onRemoteChange={patch => { void persistControlPatch(patch).catch(() => undefined); }}
      />
      {transferSnapshot?.role === "studio" && restoreMessage && <p className="transfer-notice" role="status">{restoreMessage}</p>}

      </div>
      <div className="panel return-panel">
        <div className="return-title"><div><h2>Studio Return <span className={`air-state ${onAir ? "air-live" : ""}`}>{translateWorkspaceMessage(t, onAirStatus)}</span></h2><p className="muted">{t("Предпросмотр видео и аудио, которые отправляются гостям.")}</p></div></div>
        {returnActive && <div className="return-settings">
          <div className="return-controls">
            <div className="return-audio-meter">
              <div className="gain-control"><span>Gain</span><input type="range" min="0" max="200" value={returnGain} onChange={(e) => changeGain(Number(e.target.value))} /><strong>{returnGain}%</strong></div>
            </div>
            <strong>{t("Мой Studio Return — мониторинг")}</strong>
            {studioRole === "primary" && <MonitoringControls name="Studio Return" value={returnMonitor} onChange={(patch) => setReturnMonitor((value) => ({ ...value, ...patch }))} />}
            <p className="muted">{t("Эти переключатели меняют только предпросмотр. ON AIR управляет эфиром. Для прослушивания собственного микрофона используйте наушники.")}</p>
          </div>
        </div>}
      </div>
      <p className="muted studio-note">{t("Лимит камеры задаёт общий бюджет кодировщика гостя и выбор слоя для предпросмотра. Это не CBR; фактический битрейт зависит от кадра и сети.")}</p>
      </div>

      <section className="studio-video-section" hidden={activeTab !== "studio"} aria-label={t("Видео гостей")}>
      <div className="workspace-section-heading"><h2>{t("Участники")} <span>{guests.length}</span></h2><span>{t("Индивидуальные выходы · видео + аудио")}</span></div>
      <section className="studio-video-wall" aria-label={t("Видео гостей")}>
        <StudioGuestMediaPanel key={`${studioId}:${roomName}`} studioId={studioId} roomName={roomName} guests={guests} allowDeviceControl={studioRole !== "moderator"} renderGuest={(g, controls) => <GuestVideoCard
          mediaControls={controls}
          guest={g}
          studioId={studioId}
          roomName={roomName}
          outputUrl={outputUrl(g.identity)}
          screenShareUrl={outputUrl(g.identity, "screen")}
          screenShareActive={Boolean(room.remoteParticipants.get(g.identity)?.getTrackPublication(Track.Source.ScreenShare) && !room.remoteParticipants.get(g.identity)?.getTrackPublication(Track.Source.ScreenShare)?.isMuted)}
          copied={copied === g.identity}
          screenShareCopied={copied === `${g.identity}:screen`}
          receiveBitrate={receiveFor(g.identity)}
          preference={monitoring.preferences[g.identity]}
          preview={<GuestPreview room={room} identity={g.identity} name={g.name} preference={monitoring.preferences[g.identity]} onChange={patch => monitoring.change(g.identity, patch)} />}
          meter={<GuestAudioMeter track={room.remoteParticipants.get(g.identity)?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined} fallbackDb={g.signalDb} compact />}
          onCopy={() => { void navigator.clipboard.writeText(outputUrl(g.identity)).then(() => { setCopied(g.identity); setTimeout(() => setCopied(undefined), 1200); }); }}
          onCopyScreenShare={() => { void navigator.clipboard.writeText(outputUrl(g.identity, "screen")).then(() => { setCopied(`${g.identity}:screen`); setTimeout(() => setCopied(undefined), 1200); }); }}
          onQualityChange={bitrateKbps => applyReceiveQuality(g.identity, bitrateKbps)}
          onMonitoringChange={patch => monitoring.change(g.identity, patch)}
        />} />
      </section>
      </section>
      {activeTab === "statistics" && <StatisticsDashboard studioId={studioId} roomName={roomName} token={sessionToken} identity={room.localParticipant.identity} studioRole={studioRole === "moderator" ? "moderator" : "primary"} studioClientId={studioClientId} studioEpoch={studioEpoch} />}
      <section className="studio-participants-section" hidden={activeTab !== "participants"}>
      <StaffParticipantsPanel participants={staffParticipants.map(participant => ({
        ...participant,
        preview: participant.self ? undefined : <GuestPreview
          room={room}
          identity={participant.identity}
          name={participant.name}
          preference={monitoring.preferences[participant.identity]}
          onChange={patch => monitoring.change(participant.identity, patch)}
        />,
      }))} />
      <GuestParticipantsTable
        guests={guests.map(guest => ({
          identity: guest.identity,
          name: guest.name,
          moveTarget: moveTargets[guest.identity] || "",
          outputUrl: outputUrl(guest.identity),
          copied: copied === guest.identity,
        }))}
        rooms={rooms}
        roomName={roomName}
        canMove={!simpleRoom}
        onMoveTargetChange={(identity, targetRoom) => setMoveTargets(value => ({ ...value, [identity]: targetRoom }))}
        onMove={(identity, targetRoom) => void moveGuest(identity, targetRoom)}
        onKick={(identity, name) => void kick(identity, name)}
        onRefresh={identity => void refreshGuest(identity)}
        onCopy={(identity, url) => void copyGuestOutput(identity, url)}
      />
      </section>
      {studioRole === "primary" && activeTab === "studio" && <ServerTransferPanel
        info={transferInfo}
        targetId={transferTargetId}
        busy={transferBusy}
        error={transferError}
        onTargetChange={setTransferTargetId}
        onStart={() => void startServerTransfer()}
        onRefresh={() => setTransferRefresh(v => v + 1)}
      />}
      {studioRole === "primary" && activeTab === "studio" && <>
        <EmergencyReservePanel view={sessionTransfer.view} targets={transferInfo.targets} onSelect={targetId => void sessionTransfer.select(targetId)} onAutomatic={enabled => void sessionTransfer.setAutomatic(enabled)?.catch(error => setTransferError(error instanceof Error ? error.message : "Не удалось изменить автоматику."))} onActivate={() => void sessionTransfer.activate()?.catch(error => setTransferError(error instanceof Error ? error.message : "Не удалось активировать резерв."))} />
        <ServerConnections room={roomName} studioId={studioId} onChange={() => setTransferRefresh(value => value + 1)} />
      </>}
      {studioRole === "moderator" && activeTab === "studio" && <p className="transfer-notice" role="status">{translateWorkspaceMessage(t, reserveStatusText(sessionTransfer.view))}</p>}
      <AppFooterSlot />
      </div>


    </main>
  );
}

export { StudioContent as StudioWorkspace };
