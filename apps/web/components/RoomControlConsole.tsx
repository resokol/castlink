"use client";
import { AppFooterSlot } from "@/components/AppChrome";
import { RotateVideoButton } from "@/components/RotateVideoButton";
import { RemoteVideoPreview } from "@/components/RemoteVideoPreview";

import { ParticipantRenameButton } from "./ParticipantRenameButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteVideoTrack } from "livekit-client";
import { RoomAudioRenderer } from "@livekit/components-react";
import { MonitoringControls } from "@/components/MonitoringControls";
import { StudioStreamInviteButton } from "@/components/StudioStreamInviteButton";
import { RoomInviteButton } from "@/components/RoomInviteButton";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import { usePersonalMonitoring, defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";
import { selectStudioOutboundView, receiveStudioActual } from "@/lib/studio-outbound-stats";
import { DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, STUDIO_FRAME_RATES, videoBitrateOptions, type StudioFrameRate } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { readControlResponse } from "@/lib/control-response";
import { resolveParticipantRole } from "@/lib/participant-role";
import entryStyles from "@/components/StudioEntry.module.css";
import { ModeratorInviteButton } from "@/components/ModeratorInviteButton";
import { TalkbackControls } from "@/components/TalkbackControls";
import { ModeratorRoomTools } from "@/components/ModeratorRoomTools";
import { RemoteStudioDevices, type StudioDevicePatch } from "@/components/RemoteStudioDevices";
import type { StudioDesired } from "@/lib/studio-control";
import { initialRecoveryStatus, nextRecoveryStatus, recoveryBadge, type RecoveryStatus } from "@/lib/reconnect-status";

type Snapshot = { role?: string; epoch: number; revision: number; desired: StudioDesired; primaryOnline: boolean; actual?: Record<string, unknown> | null };
type Patch = Partial<Pick<Snapshot["desired"], "fps" | "bitrate" | "gain" | "onAir">> & StudioDevicePatch;
const adminMonitorDefaults: Record<string, MonitorPreference> = { "studio-panel-main": { audio: false, video: true, volume: 100 } };

function getAdminClientId(roomName: string, mode: string, studioId: string) {
  const key = `castlink-control:${studioId}:${mode}:${roomName}`;
  let id = sessionStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
  return id;
}

function staffDisplayNameKey(studioId: string, roomName: string, mode: string) {
  return `castlink-staff-display-name:${studioId}:${mode}:${roomName}`;
}

function ParticipantPreview({ room, identity, enabled }: { room: Room; identity: string; enabled: boolean }) {
  return <div className="control-participant-preview"><RemoteVideoPreview room={room} identity={identity} enabled={enabled} /></div>;
}

export function RoomControlConsole({ accessMode = "admin" }: { accessMode?: "admin" | "moderator" }) {
  const accessEndpoint = accessMode === "moderator" ? "/api/moderator-access" : "/api/admin-access";
  const [roomName, setRoomName] = useState("");
  const [studioId, setStudioId] = useState("studio-default");
  const [access, setAccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState("");
  const inviteRef = useRef("");
  const handleAccessLost = useCallback((message: string) => { setAccess(false); setAccessError(message); }, []);

  const verify = useCallback(async (room: string, scope = "studio-default") => {
    if (!room) { setChecking(false); setAccessError("В ссылке не указана комната."); return; }
    setChecking(true); setAccessError("");
    try {
      const response = await fetch(`${accessEndpoint}?studioId=${encodeURIComponent(scope)}&room=${encodeURIComponent(room)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.allowed !== true) throw new Error(data.error || "Нет доступа к панели этой комнаты.");
      setStudioId(scope); setRoomName(room); setAccess(true);
    } catch (error) { setAccess(false); setAccessError(error instanceof Error ? error.message : "Не удалось проверить доступ."); }
    finally { setChecking(false); }
  }, [accessEndpoint]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const room = url.searchParams.get("room") || "";
    const scope = url.searchParams.get("studioId") || "studio-default";
    setStudioId(scope);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const invite = fragment.get("invite") || "";
    if (invite) inviteRef.current = invite;
    // Remove the bearer invite from the address bar before any network request.
    if (url.hash) window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    let cancelled = false;
    const run = async () => {
      if (!room) { setChecking(false); setAccessError("В ссылке не указана комната."); return; }
      if (inviteRef.current) {
        try {
          const response = await fetch(accessEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", studioId: scope, room, invite: inviteRef.current }) });
          const data = await response.json();
          if (!response.ok || data.allowed !== true) throw new Error(data.error || "Ссылка недействительна или отозвана.");
          inviteRef.current = "";
        } catch (error) { if (!cancelled) { setChecking(false); setAccessError(error instanceof Error ? error.message : "Не удалось принять приглашение."); } return; }
      }
      if (!cancelled) await verify(room, scope);
    };
    void run();
    return () => { cancelled = true; };
  }, [verify, accessEndpoint]);

  const retryInvite = () => {
    const url = new URL(window.location.href);
    const room = url.searchParams.get("room") || "";
    const scope = url.searchParams.get("studioId") || "studio-default";
    if (inviteRef.current && room) {
      setChecking(true); setAccessError("");
      void fetch(accessEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", studioId: scope, room, invite: inviteRef.current }) })
        .then(async response => { const data = await response.json(); if (!response.ok || data.allowed !== true) throw new Error(data.error || "Ссылка недействительна или отозвана."); inviteRef.current = ""; await verify(room, scope); })
        .catch(error => { setChecking(false); setAccessError(error instanceof Error ? error.message : "Не удалось принять приглашение."); });
    } else void verify(room, scope);
  };

  if (checking) return <main className={entryStyles.entryPage}><section className={entryStyles.entryCard}><div className={entryStyles.brand}>CASTLINK</div><h1>{accessMode === "moderator" ? "Панель модератора" : "Администрирование комнаты"}</h1><p role="status">Проверяем приглашение…</p></section></main>;
  if (!access) return <main className={entryStyles.entryPage}><section className={`${entryStyles.entryCard} stack`}><div className={entryStyles.brand}>CASTLINK</div><h1>Доступ к комнате</h1><p role="alert">{accessError || "Нет доступа."}</p>{inviteRef.current && <button type="button" onClick={retryInvite}>Повторить принятие приглашения</button>}<a href="/">Вернуться в CastLink</a></section></main>;
  return <AdminRoom key={`${studioId}:${roomName}`} studioId={studioId} roomName={roomName} accessMode={accessMode} onAccessLost={handleAccessLost} />;
}

function AdminRoom({ studioId, roomName, accessMode, onAccessLost }: { studioId: string; roomName: string; accessMode: "admin" | "moderator"; onAccessLost: (message: string) => void }) {
  const limited = accessMode === "moderator";
  const accessEndpoint = limited ? "/api/moderator-access" : "/api/admin-access";
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: false }), [studioId, roomName]);
  const [clientId, setClientId] = useState("");
  useEffect(() => { setClientId(getAdminClientId(roomName, accessMode, studioId)); }, [roomName, accessMode, studioId]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const snapshotRef = useRef<Snapshot | undefined>(undefined);
  const acceptSnapshot = useCallback((next: Snapshot) => {
    const current = snapshotRef.current;
    if (current && (next.epoch < current.epoch || (next.epoch === current.epoch && next.revision < current.revision))) return;
    const normalized = { ...next, actual: receiveStudioActual(next.actual) };
    snapshotRef.current = normalized; setSnapshot(normalized);
  }, []);
  const [token, setToken] = useState("");
  const [identity, setIdentity] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RecoveryStatus>(() => initialRecoveryStatus());
  const [connectionError, setConnectionError] = useState("");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [roomSettings, setRoomSettings] = useState<{ studioOnly: boolean; passwordSet: boolean; guestPassword?: string; viewAccess?: string }>();
  const [guestPassword, setGuestPassword] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [gainDraft, setGainDraft] = useState(100);
  const [participantsVersion, setParticipantsVersion] = useState(0);
  const [rooms, setRooms] = useState<string[]>([]);
  const [moderatorScope, setModeratorScope] = useState<"studio" | "room">("room");
  useEffect(() => {
    if (!limited) return;
    const abort = new AbortController();
    void fetch(`/api/moderator-access?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}`, { cache: "no-store", signal: abort.signal }).then(response => readControlResponse(response, "Не удалось проверить область доступа")).then(data => { if (!abort.signal.aborted) setModeratorScope(data.scope === "studio" || data.owner ? "studio" : "room"); }).catch(() => undefined);
    return () => abort.abort();
  }, [limited, roomName]);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"studio" | "participants" | "statistics">("studio");
  const [guestBusy, setGuestBusy] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [copiedOutput, setCopiedOutput] = useState("");
  useEffect(() => {
    if (!limited) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await readControlResponse(await fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}`, { cache: "no-store", signal: controller.signal }), "Не удалось загрузить комнаты");
        if (!controller.signal.aborted) setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      } catch (error) { if (!controller.signal.aborted) setGuestMessage(error instanceof Error ? error.message : "Ошибка списка комнат"); }
    };
    void load(); const timer = setInterval(() => void load(), 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [limited]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const monitor = usePersonalMonitoring(room, roomName, false, adminMonitorDefaults);
  const mainPreference = monitor.preferences["studio-panel-main"] ?? adminMonitorDefaults["studio-panel-main"];

  const telemetryToken = useRef(token);
  telemetryToken.current = token;
  useEffect(() => {
    if (!telemetryToken.current || !connected || !clientId) return;
    return startRoomTelemetry(room, roomName, telemetryToken.current, { clientId, epoch: 0, role: "studio-moderator" });
  }, [room, roomName, connected, clientId]);

  useEffect(() => { if (snapshot) setGainDraft(snapshot.desired.gain); }, [snapshot?.desired.gain]);

  const loseAccess = useCallback((message: string) => {
    void room.disconnect(); setConnected(false); onAccessLost(message);
  }, [room, onAccessLost]);

  useEffect(() => {
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    let recoveredTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const start = async () => {
      if (!clientId) return;
      setConnectionError("");
      setConnectionStatus(current => nextRecoveryStatus(current, "connect-start"));
      try {
        const joinedResponse = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", studioId, room: roomName, clientId, mode: "admin" }), signal: controller.signal });
        const joined = await readControlResponse(joinedResponse, "Не удалось открыть управление эфиром");
        if (!joinedResponse.ok) throw new Error(joined.error || "Не удалось открыть эфир комнаты.");
        if (stopped) return;
        acceptSnapshot(joined as Snapshot);
        const params = new URLSearchParams({ studioId, room: roomName, role: "studio-moderator", clientId, panelMode: accessMode });
        const savedDisplayName = sessionStorage.getItem(staffDisplayNameKey(studioId, roomName, accessMode)) || "";
        if (savedDisplayName) params.set("name", savedDisplayName);
        const tokenResponse = await fetch(`/api/token?${params}`, { cache: "no-store", signal: controller.signal });
        const tokenData = await readControlResponse(tokenResponse, "Не удалось получить доступ к трансляции");
        if (!tokenResponse.ok) throw new Error(tokenData.error || "Не удалось получить доступ к трансляции.");
        if (stopped) return;
        setToken(tokenData.token); setIdentity(tokenData.identity);
        const issuedName = typeof tokenData.name === "string" ? tokenData.name : "";
        setDisplayName(issuedName); setNameDraft(issuedName);
        await room.connect(getLiveKitUrl(), tokenData.token);
        if (stopped) { await room.disconnect(); return; }
        setConnected(true);
        setConnectionStatus(current => nextRecoveryStatus(current, "connect-success"));
      } catch (cause) {
        if (!stopped && !controller.signal.aborted) {
          const message = cause instanceof Error ? cause.message : "Ошибка подключения к комнате.";
          if (/401|403|отозван|доступ администратора/i.test(message)) loseAccess("Доступ к панели отозван или истёк.");
          else { setConnected(false); setConnectionError(message); setConnectionStatus(current => nextRecoveryStatus(current, "failed", message)); }
        }
      }
    };
    void start();
    const poll = async () => {
      if (stopped || !clientId) return;
      try {
        const response = await fetch(`/api/studio-control?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&clientId=${encodeURIComponent(clientId)}&mode=admin`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) { loseAccess("Доступ к панели отозван. Подключение к комнате завершено."); return; }
        const data = await readControlResponse(response, "Не удалось обновить состояние комнаты");
        if (!response.ok) throw new Error(data.error || "Не удалось обновить состояние комнаты.");
        if (!stopped) { acceptSnapshot(data as Snapshot); setError(""); }
      } catch (cause) {
        if (!stopped && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Потеряна связь с панелью.");
      } finally { if (!stopped) pollTimer = setTimeout(() => void poll(), 2000); }
    };
    void poll();
    const updateParticipants = () => setParticipantsVersion(value => value + 1);
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged];
    events.forEach(event => room.on(event, updateParticipants));
    const disconnected = () => {
      if (!stopped) {
        setConnected(false);
        const message = "Соединение с комнатой завершилось после попыток восстановления.";
        setConnectionError(message);
        setConnectionStatus(current => nextRecoveryStatus(current, "failed", message));
      }
    };
    const reconnecting = () => {
      if (!stopped) {
        setConnected(false);
        setConnectionError("");
        setConnectionStatus(current => nextRecoveryStatus(current, "reconnecting"));
      }
    };
    const reconnected = () => {
      if (stopped) return;
      setConnected(true);
      setConnectionError("");
      setConnectionStatus(current => nextRecoveryStatus(current, "reconnected"));
      if (recoveredTimer) clearTimeout(recoveredTimer);
      recoveredTimer = setTimeout(() => {
        if (!stopped) setConnectionStatus(current => nextRecoveryStatus(current, "connect-success"));
      }, 3000);
    };
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.Reconnected, reconnected);
    return () => {
      stopped = true; controller.abort(); clearTimeout(pollTimer); if (recoveredTimer) clearTimeout(recoveredTimer);
      events.forEach(event => room.off(event, updateParticipants));
      room.off(RoomEvent.Disconnected, disconnected);
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.Reconnected, reconnected);
      void room.disconnect();
    };
  }, [room, roomName, clientId, loseAccess, acceptSnapshot, connectionAttempt]);

  // Room-admin JWTs are short-lived; refresh the dashboard bearer without reconnecting media.
  useEffect(() => {
    if (!connected || !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let retryDelay = 4 * 60_000;
    let revoked = false;
    const refresh = async () => {
      try {
        const params = new URLSearchParams({ studioId, room: roomName, role: "studio-moderator", clientId, panelMode: accessMode });
        const response = await fetch(`/api/token?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (response.status === 401 || response.status === 403) { revoked = true; loseAccess("Доступ к панели истёк или отозван."); return; }
        if (!response.ok || typeof data.token !== "string") throw new Error(data.error || "Не удалось обновить доступ к комнате.");
        retryDelay = 4 * 60_000;
        if (!stopped) setToken(data.token);
      } catch (cause) { retryDelay = 15_000; if (!stopped) setError(cause instanceof Error ? cause.message : "Не удалось обновить доступ к комнате."); }
      finally { if (!stopped && !revoked) timer = setTimeout(() => void refresh(), retryDelay); }
    };
    timer = setTimeout(() => void refresh(), 4 * 60_000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [connected, token, studioId, roomName, clientId, accessMode, loseAccess]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(roomName)}`, { cache: "no-store" });
        const data = await response.json();
        if (response.status === 401 || response.status === 403) { loseAccess("Доступ к панели отозван."); return; }
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить настройки комнаты.");
        if (!cancelled) { setRoomSettings({ studioOnly: data.studioOnly === true, passwordSet: data.passwordSet === true, guestPassword: data.guestPassword, viewAccess: typeof data.viewAccess === "string" ? data.viewAccess : undefined }); setSettingsMessage(""); }
      } catch (cause) { if (!cancelled) setSettingsMessage(cause instanceof Error ? cause.message : "Не удалось загрузить настройки."); }
    };
    void load(); const timer = setInterval(() => void load(), 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomName, loseAccess]);

  useEffect(() => {
    const element = videoRef.current;
    let attached: RemoteVideoTrack | undefined;
    const detach = () => { if (element && attached) attached.detach(element); attached = undefined; if (element) element.srcObject = null; };
    const attach = () => {
      const track = room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.Camera)?.track as RemoteVideoTrack | undefined;
      if (!element) return;
      element.muted = true;
      if (track && mainPreference.video) {
        if (attached === track) return;
        detach(); track.attach(element); attached = track;
      } else detach();
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.ParticipantDisconnected];
    events.forEach(event => room.on(event, attach)); attach();
    return () => { events.forEach(event => room.off(event, attach)); detach(); };
  }, [room, participantsVersion, mainPreference.video]);

  const command = async (patch: Patch) => {
    if (limited || busy || !connected || !snapshotRef.current?.primaryOnline || snapshotRef.current.epoch < 1) return;
    setBusy(true); setError("");
    try {
      const epoch = snapshotRef.current?.epoch;
      if (!Number.isSafeInteger(epoch)) throw new Error("Ожидаем состояние основной студии.");
      const response = await fetch("/api/studio-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "command", studioId, room: roomName, clientId, epoch, patch }) });
      if (response.status === 401 || response.status === 403) { loseAccess("Доступ к панели отозван."); return; }
      const data = await readControlResponse(response, "Не удалось передать команду основной студии");
      acceptSnapshot(data as Snapshot);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось передать команду."); }
    finally { setBusy(false); }
  };

  const saveRoomSettings = async (patch: { action: "password"; password: string } | { action: "mode"; studioOnly: boolean }) => {
    setSettingsBusy(true); setSettingsMessage("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...patch, studioId, name: roomName }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) { loseAccess("Доступ к панели отозван."); return; }
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить настройки комнаты.");
      if (patch.action === "mode") setRoomSettings(value => value ? { ...value, studioOnly: patch.studioOnly } : value);
      else setRoomSettings(value => value ? { ...value, passwordSet: !!patch.password, guestPassword: patch.password || undefined } : value);
      setGuestPassword(""); setSettingsMessage("Настройки комнаты сохранены.");
    } catch (cause) { setSettingsMessage(cause instanceof Error ? cause.message : "Ошибка сохранения."); }
    finally { setSettingsBusy(false); }
  };

  const renameSelf = async () => {
    const cleanName = nameDraft.trim().slice(0, 120);
    if (!cleanName || !identity || !clientId || !connected) return;
    setNameBusy(true); setNameMessage("");
    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "rename-self", studioId, room: roomName, identity, clientId, name: cleanName }),
      });
      if (response.status === 401 || response.status === 403) { loseAccess("Доступ к панели истёк или отозван."); return; }
      const result = await readControlResponse(response, "Не удалось изменить имя");
      const nextName = typeof result.name === "string" ? result.name : cleanName;
      setDisplayName(nextName); setNameDraft(nextName); setNameMessage("Имя обновлено");
      sessionStorage.setItem(staffDisplayNameKey(studioId, roomName, accessMode), nextName);
    } catch (error) { setNameMessage(error instanceof Error ? error.message : "Не удалось изменить имя"); }
    finally { setNameBusy(false); }
  };

  const logout = async () => {
    await room.disconnect();
    window.location.assign("/");
  };

  const guestAction = async (identity: string, action: "mute" | "kick" | "move" | "media", kind?: "audio" | "video", enabled?: boolean) => {
    setGuestBusy(identity); setGuestMessage("");
    try {
      const response = await fetch(action === "move" ? "/api/move-guest" : "/api/participants", {
        method: action === "kick" ? "DELETE" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ studioId, room: roomName, identity, ...(action === "mute" ? { action: "mute" } : {}), ...(action === "media" ? { action: "media", kind, enabled } : {}), ...(action === "move" ? { targetRoom: moveTargets[identity] } : {}) }),
      });
      if (response.status === 401) { loseAccess("Доступ к панели истёк или отозван."); return; }
      const result = await readControlResponse(response, "Не удалось выполнить действие с гостем");
      setGuestMessage(action === "media" ? (enabled ? "Запрос включения отправлен участнику. Состояние обновится после подтверждения устройства." : `${kind === "video" ? "Камера" : "Микрофон"} выключен для комнаты.`) : action === "move" ? "Команда перевода отправлена гостю." : action === "mute" ? (result.muted === false ? "У гостя нет опубликованного микрофона." : "Микрофон гостя выключен для всей комнаты.") : "Участник отключён.");
    } catch (error) { setGuestMessage(error instanceof Error ? error.message : "Не удалось выполнить действие с гостем"); }
    finally { setGuestBusy(""); }
  };

  const guests = useMemo(() => Array.from(room.remoteParticipants.values()).filter(participant => participant.identity.startsWith("guest-")), [room, participantsVersion]);
  const outputBase = typeof window === "undefined" ? "" : window.location.origin;
  const screenOutputUrl = (identity: string) => `${outputBase}/output/${encodeURIComponent(identity)}?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&source=screen${roomSettings?.viewAccess ? `#access=${encodeURIComponent(roomSettings.viewAccess)}` : ""}`;
  const outbound = selectStudioOutboundView("moderator", null, snapshot?.actual, snapshot?.primaryOnline === true);
  const displayedRole = limited ? "moderator" : (resolveParticipantRole(room.localParticipant) || "admin");
  const controlReady = !limited && connected && snapshot?.primaryOnline === true && snapshot.epoch >= 1;
  const sample = outbound.sample;
  const status = outbound.status === "live" ? "Свежие измерения основной студии" : outbound.status === "offline" ? "Основная студия офлайн. Ожидается переподключение." : outbound.status === "stale" ? "Замеры устарели. Ожидается новый замер." : "Ожидание первого замера от основной студии…";
  const history = sample?.videoHistory ?? [];
  const points = history.map((value, index) => `${38 + index * (258 / Math.max(1, history.length - 1))},${198 - Math.min(value, 12000) / 12000 * 192}`).join(" ");

  return <main className="page-shell studio-page studio-app-shell admin-room-page">
    <aside className="studio-sidebar">
      <a className="studio-brand" href="/"><span className="studio-brand-mark">CL</span><span><strong>CastLink</strong><small>{limited ? "МОДЕРАТОР" : "АДМИНИСТРАТОР"}</small></span></a>
      <div className="sidebar-room-card"><small>КОМНАТА</small><strong>{roomName}</strong></div>
      <nav className="studio-tabs" aria-label="Разделы управления">
        <button aria-pressed={activeTab === "studio"} onClick={() => setActiveTab("studio")}>Студия</button>
        <button aria-pressed={activeTab === "participants"} onClick={() => setActiveTab("participants")}>Участники</button>
        {!limited && <button aria-pressed={activeTab === "statistics"} onClick={() => setActiveTab("statistics")}>Статистика</button>}
      </nav>
      <div className="sidebar-footer"><span className={`studio-participant-role studio-participant-role-${displayedRole}`}>{displayedRole === "moderator" ? "Модератор" : "Администратор"}</span><small>{guests.length} гостей в комнате</small></div>
      <button type="button" className="button-secondary sidebar-leave-button" onClick={() => void logout()}>Выйти из комнаты</button>
    </aside>
    <div className="studio-main-column">
    <header className="panel admin-header"><div><h1>{limited ? "Панель модератора" : "Администратор"} комнаты «{roomName}»</h1><p className="muted">{limited ? "Управление комнатами и гостями. Параметры эфира меняет администратор." : "Доступ ограничен эфиром, настройками этой комнаты и гостями. Основная студия продолжает передавать эфир; здесь нельзя занять её роль."}</p></div><div className="admin-header-actions"><span className={`studio-participant-role studio-participant-role-${displayedRole}`}>{displayedRole === "moderator" ? "Модератор" : "Администратор"} · {recoveryBadge(connectionStatus.phase)}</span>{connectionStatus.phase === "failed" && <button type="button" className="button-secondary" onClick={() => { setConnectionError(""); setConnectionStatus(current => nextRecoveryStatus(current, "connect-start")); setConnectionAttempt(value => value + 1); }}>Повторить подключение</button>}</div></header>

    {connectionError && <p role="alert" className="studio-control-error">{connectionError}</p>}
    {error && <p className="studio-control-error" role="alert">{error}</p>}
    <div className="control-quick-actions" hidden={activeTab !== "studio"}>
      <button type="button" className="button-secondary" aria-expanded={roomMenuOpen} aria-controls="control-room-settings" onClick={() => setRoomMenuOpen(value => !value)}>☰ Комната</button>
      <button type="button" className={`room-mode-toggle${roomSettings?.studioOnly ? " room-mode-active" : ""}`} aria-pressed={roomSettings?.studioOnly ?? false} disabled={!roomSettings || settingsBusy} onClick={() => void saveRoomSettings({ action: "mode", studioOnly: !roomSettings?.studioOnly })}>Гости могут видеть только студию</button>
    </div>
    {roomSettings?.studioOnly && <p className="studio-only-notice room-mode-notice" role="status">Студия включила только свой просмотр</p>}
    <div id="control-room-settings" className="workspace-stack" hidden={activeTab !== "studio" || !roomMenuOpen}>
    {limited && moderatorScope === "studio" && <ModeratorRoomTools roomName={roomName} studioId={studioId} />}
    <section className="panel stack admin-room-settings"><h2>Настройки комнаты</h2>
      <form className="admin-password-form" onSubmit={event => { event.preventDefault(); if (!guestPassword.trim()) { setSettingsMessage(roomSettings?.passwordSet ? "Введите новый пароль или нажмите «Удалить пароль»." : "Введите пароль для сохранения."); return; } void saveRoomSettings({ action: "password", password: guestPassword }); }}><p>{roomSettings?.passwordSet ? `Пароль гостевого входа задан${roomSettings.guestPassword ? `: ${roomSettings.guestPassword}` : ""}.` : "Пароль гостевого входа не задан."}</p><label>Новый пароль гостей<input type="password" autoComplete="new-password" maxLength={256} value={guestPassword} onChange={event => setGuestPassword(event.target.value)} /></label><div className="admin-settings-actions"><button type="submit" disabled={settingsBusy}>{settingsBusy ? "Сохранение…" : "Сохранить пароль"}</button><button type="button" className="button-secondary" disabled={settingsBusy || !roomSettings?.passwordSet} onClick={() => void saveRoomSettings({ action: "password", password: "" })}>Удалить пароль</button></div></form>
      {settingsMessage && <p role="status">{settingsMessage}</p>}
    </section>

    </div>
    <section hidden={activeTab !== "studio"} className={`studio-return-hero admin-return-hero ${limited ? "moderator-return-hero" : ""}`} aria-label="Монитор Studio Return">
      <div className="panel studio-video-card studio-return-preview-card"><h2>Studio Return <span className={`air-state ${snapshot?.desired.onAir ? "air-live" : ""}`}><i className="air-dot" />{snapshot?.desired.onAir ? "ON AIR" : "OFF AIR"}</span></h2>
        <video ref={videoRef} autoPlay playsInline muted className="return-preview" style={{ opacity: mainPreference.video ? 1 : 0 }} />
        {room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.ScreenShare) && <div className="studio-screen-share-preview"><RemoteVideoPreview room={room} identity="studio-panel-main" camera={false} enabled={mainPreference.video} /></div>}
        {!mainPreference.video && <div className="studio-preview-placeholder">Видео выключено только у вас</div>}
        <section className="studio-invite-compact admin-invites-compact" aria-label="Приглашения и доступы">
          <div className="guest-invite-slot"><RoomInviteButton roomName={roomName} studioId={studioId} /></div>
          {!limited && <><div className="stream-invite-slot"><StudioStreamInviteButton roomName={roomName} studioId={studioId} /></div><div className="moderator-invite-slot"><ModeratorInviteButton roomName={roomName} studioId={studioId} /></div></>}
        </section>
      </div>
      <div className="panel return-stats">
        {!limited && <><strong>Исходящий поток основной студии</strong><p className="muted" role="status">{status}</p>
        <div className="return-stat-grid"><span><b>Разрешение</b><strong>{sample?.resolution ?? "—"}</strong></span><span><b>Измерено</b><strong>{sample ? `${sample.fps} fps` : "—"}</strong></span><span><b>Видео</b><strong>{sample ? `${sample.videoKbps} кбит/с` : "—"}</strong></span><span><b>Аудио</b><strong>{sample ? `${sample.audioKbps} кбит/с` : "—"}</strong></span></div>
        <div className="bitrate-chart"><div><b>Видеобитрейт</b><small>Последние измерения основной студии</small></div><svg viewBox="0 0 300 210" role="img" aria-label={sample ? `Видеобитрейт ${sample.videoKbps} килобит в секунду` : status} preserveAspectRatio="none">
          {[500, ...Array.from({ length: 12 }, (_, index) => (index + 1) * 1000)].map(value => { const y = 198 - value / 12000 * 192; return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString("ru-RU")}</text></g>; })}
          {history.length > 1 && <polyline className="bitrate-chart-line" points={points} />}
        </svg></div>
        </>}
        {!limited && <div className="return-output-controls">
          <label>Частота кадров<select disabled={busy || !controlReady} value={snapshot?.desired.fps ?? 60} onChange={event => void command({ fps: Number(event.target.value) as StudioFrameRate })}>{STUDIO_FRAME_RATES.map(fps => <option value={fps} key={fps}>{fps} FPS</option>)}</select></label>
          <label>Общий лимит видеобитрейта (эфир и ссылка)<select aria-label="Общий лимит видеобитрейта (эфир и ссылка)" aria-describedby="admin-return-bitrate-help" disabled={busy || !controlReady} value={snapshot?.desired.bitrate ?? DEFAULT_STUDIO_VIDEO_BITRATE_KBPS} onChange={event => void command({ bitrate: Number(event.target.value) })}>{videoBitrateOptions(snapshot?.desired.bitrate ?? DEFAULT_STUDIO_VIDEO_BITRATE_KBPS).map(rate => <option value={rate} key={rate}>{rate.toLocaleString("ru-RU")} кбит/с</option>)}</select></label>
          <small id="admin-return-bitrate-help" className="muted">Ограничивает видеобитрейт Studio Return и дополнительного потока ссылки просмотра.</small>
          <label>Усиление эфира<input type="range" min="0" max="200" disabled={busy || !controlReady} value={gainDraft} onChange={event => setGainDraft(Number(event.target.value))} /><output>{gainDraft}%</output></label>
          <button type="button" className="button-secondary" disabled={busy || !controlReady || gainDraft === (snapshot?.desired.gain ?? 100)} onClick={() => void command({ gain: gainDraft })}>Применить усиление</button>
          <button type="button" disabled={busy || !controlReady} className={`air-toggle ${snapshot?.desired.onAir ? "air-toggle-live" : ""}`} onClick={() => void command({ onAir: !snapshot?.desired.onAir })}>{snapshot?.desired.onAir ? "OFF AIR" : "ON AIR"}</button>
        </div>
        }
        {!limited && !snapshot?.primaryOnline && <p className="muted" role="status">Эфир и общие параметры станут доступны после подключения основной студии.</p>}
        <p className="muted">Прослушивание и громкость меняются только у вас. Для обращения используйте блок голосовой связи.</p>
        <div className="personal-monitor-controls"><button type="button" aria-pressed={mainPreference.audio} onClick={() => monitor.change("studio-panel-main", { audio: !mainPreference.audio })}>{mainPreference.audio ? "Не слушать студию" : "Слушать студию"}</button><label>Личная громкость<input type="range" min="0" max="100" value={mainPreference.volume} onChange={event => monitor.change("studio-panel-main", { volume: Number(event.target.value) })} /><output>{mainPreference.volume}%</output></label></div>
      </div>
    </section>
    {!limited && <div hidden={activeTab !== "studio"}><RemoteStudioDevices actual={snapshot?.actual} desired={snapshot?.desired} online={snapshot?.primaryOnline === true} disabled={busy || !controlReady} onChange={patch => void command(patch)} /></div>}
    <TalkbackControls room={room} roomName={roomName} studioId={studioId} clientId={clientId} connected={connected} allowStaff={!limited} visible={activeTab === "participants"} />
    <div className="workspace-stack" hidden={activeTab !== "participants"}>
    {guestMessage && <p role="status">{guestMessage}</p>}
    <section className="panel stack admin-staff"><h2>Администраторы и модераторы</h2>
      <div className="staff-self-card">
        <div className="staff-row"><strong>{displayName || (displayedRole === "moderator" ? "Модератор" : "Администратор")} <small>(вы)</small></strong><span className={`studio-participant-role studio-participant-role-${displayedRole}`}>{displayedRole === "moderator" ? "Модератор" : "Администратор"}</span></div>
        <form className="staff-rename-form" onSubmit={event => { event.preventDefault(); void renameSelf(); }}>
          <label>Ваше имя<input value={nameDraft} maxLength={120} onChange={event => setNameDraft(event.target.value)} /></label>
          <button type="submit" className="button-secondary" disabled={nameBusy || !connected || !nameDraft.trim() || nameDraft.trim() === displayName}>{nameBusy ? "Сохранение…" : "Изменить имя"}</button>
          {nameMessage && <small role="status">{nameMessage}</small>}
        </form>
      </div>
      {Array.from(room.remoteParticipants.values()).map(participant => {
        const role = resolveParticipantRole(participant);
        if (role !== "admin" && role !== "moderator") return null;
        const pref = monitor.preferences[participant.identity] ?? (participant.identity === "studio-panel-main" ? adminMonitorDefaults["studio-panel-main"] : defaultMonitor);
        return <article className="control-participant-card" key={participant.identity}>
          <div className="staff-row"><strong>{participant.name || participant.identity}</strong><span className={`studio-participant-role studio-participant-role-${role}`}>{role === "admin" ? "Администратор" : "Модератор"}</span></div>
          {!limited && <><ParticipantPreview room={room} identity={participant.identity} enabled={pref.video} /><MonitoringControls name={participant.name || participant.identity} value={pref} onChange={patch => monitor.change(participant.identity, patch)} /></>}
          {!limited && role === "moderator" && <RotateVideoButton roomName={roomName} studioId={studioId} identity={participant.identity} />}
          {!limited && role === "moderator" && <button className="button-secondary" disabled={!!guestBusy} onClick={() => void guestAction(participant.identity, "kick")}>Удалить модератора</button>}
        </article>;
      })}
    </section>
    <section className="panel stack admin-guests"><h2>Гости ({guests.length})</h2>
      <p className="muted">Общие переключатели управляют камерой и микрофоном гостя в комнате. Включение зависит от разрешений и доступности устройства у гостя.</p>
      <p className="muted">Личное прослушивание, видео и громкость меняются только в этой панели.</p>
      {guests.length === 0 ? <p className="muted">Гостей пока нет.</p> : guests.map(participant => {
        const pref = monitor.preferences[participant.identity] ?? defaultMonitor;
        const microphone = participant.getTrackPublication(Track.Source.Microphone);
        const camera = participant.getTrackPublication(Track.Source.Camera);
        const screenShare = participant.getTrackPublication(Track.Source.ScreenShare);
        return <article className="admin-guest-row control-participant-card" key={participant.identity}>
          <div><strong>{participant.name || participant.identity}</strong> <span className="studio-participant-role studio-participant-role-guest">Гость</span></div>
          <ParticipantPreview room={room} identity={participant.identity} enabled={pref.video} />
          {screenShare && !screenShare.isMuted && <div className="guest-screen-share-output"><div><strong>Экран участника</strong><small>Отдельный input для vMix / Browser Source</small></div><div className="guest-screen-share-actions"><a className="button-link" href={screenOutputUrl(participant.identity)} target="_blank" rel="noreferrer">Открыть экран</a><button type="button" onClick={() => { void navigator.clipboard.writeText(screenOutputUrl(participant.identity)).then(() => { setCopiedOutput(participant.identity); setTimeout(() => setCopiedOutput(""), 1200); }); }}>{copiedOutput === participant.identity ? "Скопировано" : "Копировать URL экрана"}</button></div></div>}
          <MonitoringControls name={participant.name || participant.identity} value={pref} onChange={patch => monitor.change(participant.identity, patch)} />
          <div className="guest-actions"><RotateVideoButton roomName={roomName} studioId={studioId} identity={participant.identity} /><ParticipantRenameButton studioId={studioId} roomName={roomName} identity={participant.identity} name={participant.name || participant.identity} />
            <button disabled={!!guestBusy} aria-pressed={!!microphone && !microphone.isMuted} onClick={() => void guestAction(participant.identity, "media", "audio", !microphone || microphone.isMuted)}>{microphone && !microphone.isMuted ? "Выключить микрофон гостя" : "Включить микрофон гостя"}</button>
            <button disabled={!!guestBusy} aria-pressed={!!camera && !camera.isMuted} onClick={() => void guestAction(participant.identity, "media", "video", !camera || camera.isMuted)}>{camera && !camera.isMuted ? "Выключить камеру гостя" : "Включить камеру гостя"}</button>
            <button className="button-secondary" disabled={!!guestBusy} onClick={() => void guestAction(participant.identity, "kick")}>Отключить гостя</button>
            {limited && moderatorScope === "studio" && <><select aria-label={`Комната для ${participant.name || participant.identity}`} value={moveTargets[participant.identity] || ""} onChange={event => setMoveTargets(current => ({ ...current, [participant.identity]: event.target.value }))}><option value="">Перевести в комнату…</option>{rooms.filter(name => name !== roomName).map(name => <option key={name}>{name}</option>)}</select><button disabled={!!guestBusy || !moveTargets[participant.identity]} onClick={() => void guestAction(participant.identity, "move")}>Перевести</button></>}
          </div>
        </article>;
      })}
    </section>
    </div>
    {!limited && activeTab === "statistics" && token && identity && <StatisticsDashboard roomName={roomName} studioId={studioId} token={token} identity={identity} studioRole="moderator" studioClientId={clientId} studioEpoch={snapshot?.epoch ?? 0} />}
    <RoomAudioRenderer room={room} />
    <AppFooterSlot />
    </div>
    <style jsx>{`
      .admin-room-page { max-width: none; }
      .admin-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .admin-header h1, .admin-header p { margin: 0 0 8px; }
      .admin-header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
      .admin-room-settings, .admin-guests, .admin-staff { margin-top: 14px; }
      .staff-row, .guest-actions { display:flex; align-items:center; flex-wrap:wrap; gap:var(--action-gap); }
      .staff-self-card { display:grid; gap:var(--action-gap); padding:12px; border:1px solid var(--panel-border); border-radius:10px; background:var(--field-bg); }
      .staff-self-card small { color:var(--muted); font-weight:400; }
      .staff-rename-form { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--action-gap); align-items:end; }
      .staff-rename-form label { display:grid; gap:6px; min-width:0; }
      .staff-rename-form > small { grid-column:1 / -1; }
      .admin-password-form { display: grid; gap: 10px; }
      .admin-password-form p { margin: 0; }
      .admin-settings-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .admin-guest-row { display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--panel-border); border-radius: 10px; }
      .admin-guest-row > span { overflow-wrap: anywhere; font-size: 12px; }
      .admin-room-page button { min-height: 42px; }
      @media (max-width: 760px) {
        .admin-header { flex-direction: column; }
        .admin-guest-row { grid-template-columns: minmax(0,1fr); }
      }
    `}</style>
  </main>;
}
