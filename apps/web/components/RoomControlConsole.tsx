"use client";
import { BrandIcon } from "./BrandIcon";
import { StaffChatPanel, StaffChatTab } from "./StaffChatPanel";
import { useStaffRoomChat } from "@/lib/use-staff-room-chat";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import { AppFooterSlot } from "@/components/AppChrome";
import { RotateVideoButton } from "@/components/RotateVideoButton";
import { RemoteVideoPreview } from "@/components/RemoteVideoPreview";
import { SourceRoster, type SourceRosterItem } from "@/components/SourceRoster";
import { ParticipantSourceCard } from "@/components/ParticipantSourceCard";
import { GuestAudioMeter } from "@/components/GuestAudioMeter";

import { GuestCameraResolutionControl } from "./GuestCameraResolutionControl";
import { StudioGuestRoleControls } from "@/components/StudioGuestRoleControls";
import { ParticipantRenameButton } from "./ParticipantRenameButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteVideoTrack, type RemoteAudioTrack } from "livekit-client";
import { RoomAudioRenderer } from "@livekit/components-react";
import { MonitoringControls } from "@/components/MonitoringControls";
import { StudioVideoModeControls } from "@/components/StudioVideoModeControls";
import { StudioStreamInviteButton } from "@/components/StudioStreamInviteButton";
import { ModeratorInviteButton } from "@/components/ModeratorInviteButton";
import { CasterSlotsPanel } from "./CasterSlotsPanel";
import { RoomInviteButton } from "@/components/RoomInviteButton";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import { usePersonalMonitoring, defaultMonitor, type MonitorPreference } from "@/lib/personal-monitoring";
import { selectStudioOutboundView, receiveStudioActual } from "@/lib/studio-outbound-stats";
import { DEFAULT_STUDIO_VIDEO_BITRATE_KBPS, STUDIO_FRAME_RATES, studioVideoBitrateOptions as videoBitrateOptions, type StudioFrameRate } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { readControlResponse } from "@/lib/control-response";
import { resolveParticipantRole } from "@/lib/participant-role";
import entryStyles from "@/components/StudioEntry.module.css";
import { TalkbackControls, TalkbackTargetButton } from "@/components/TalkbackControls";
import { ModeratorRoomTools } from "@/components/ModeratorRoomTools";
import { RemoteStudioDevices, type StudioDevicePatch } from "@/components/RemoteStudioDevices";
import type { StudioDesired } from "@/lib/studio-control";
import { useSessionTransfer, reserveStatusText } from "@/lib/use-session-transfer";
import { readTransferSnapshot, clearTransferSnapshot } from "@/lib/client-transfer";
import { initialRecoveryStatus, nextRecoveryStatus, recoveryBadge, type RecoveryStatus } from "@/lib/reconnect-status";

type Snapshot = { role?: string; epoch: number; revision: number; desired: StudioDesired; primaryOnline: boolean; actual?: Record<string, unknown> | null };
type Patch = Partial<Pick<Snapshot["desired"], "fps" | "bitrate" | "videoCodec" | "simulcast" | "gain" | "onAir">> & StudioDevicePatch;
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

function ParticipantPreview({ room, identity, enabled, screen = false }: { room: Room; identity: string; enabled: boolean; screen?: boolean }) {
  return <div className="control-participant-preview source-preview"><RemoteVideoPreview room={room} identity={identity} camera={!screen} screen={screen} enabled={enabled} /></div>;
}

export function RoomControlConsole({ accessMode = "admin" }: { accessMode?: "admin" | "moderator" }) {
  const { t } = useI18n();
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

  if (checking) return <main className={entryStyles.entryPage}><section className={entryStyles.entryCard}><div className={entryStyles.brand}><BrandIcon className={entryStyles.brandMark} /><span>CASTLINK</span></div><h1>{accessMode === "moderator" ? t("Панель модератора") : t("Администрирование комнаты")}</h1><p role="status">{t("Проверяем приглашение…")}</p></section></main>;
  if (!access) return <main className={entryStyles.entryPage}><section className={`${entryStyles.entryCard} stack`}><div className={entryStyles.brand}><BrandIcon className={entryStyles.brandMark} /><span>CASTLINK</span></div><h1>{t("Доступ к комнате")}</h1><p role="alert">{translateManagementMessage(accessError, t) || t("Нет доступа.")}</p>{inviteRef.current && <button type="button" onClick={retryInvite}>{t("Повторить принятие приглашения")}</button>}<a href="/">{t("Вернуться в CastLink")}</a></section></main>;
  return <AdminRoom key={`${studioId}:${roomName}`} studioId={studioId} roomName={roomName} accessMode={accessMode} onAccessLost={handleAccessLost} />;
}

function AdminRoom({ studioId, roomName, accessMode, onAccessLost }: { studioId: string; roomName: string; accessMode: "admin" | "moderator"; onAccessLost: (message: string) => void }) {
  const { t, locale } = useI18n();
  const limited = accessMode === "moderator";
  const accessEndpoint = limited ? "/api/moderator-access" : "/api/admin-access";
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: false }), [studioId, roomName]);
  const [clientId, setClientId] = useState("");
  useEffect(() => {
    setClientId(getAdminClientId(roomName, accessMode, studioId));
    const moved = readTransferSnapshot();
    if (moved?.role === accessMode && moved.room === roomName && moved.studioId === studioId) {
      if (moved.name) sessionStorage.setItem(staffDisplayNameKey(studioId, roomName, accessMode), moved.name);
      clearTransferSnapshot();
    }
  }, [roomName, accessMode, studioId]);
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
  const [selectedGuestIdentity, setSelectedGuestIdentity] = useState("");
  const [activeTab, setActiveTab] = useState<"studio" | "participants" | "statistics" | "chat">("studio");
  const staffChat = useStaffRoomChat({ room, scope: JSON.stringify([studioId, roomName]), visible: activeTab === "chat", session: { token, studioId, roomName } });
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

  const sessionTransfer = useSessionTransfer({
    studioId, room: roomName, token, clientId,
    snapshot: async () => ({ role: accessMode, studioId, room: roomName, sourceOrigin: window.location.origin }),
    beforeHandoff: async () => { await room.disconnect(); },
  });

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
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged];
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

  const guests = useMemo(() => Array.from(room.remoteParticipants.values()).filter(participant => participant.identity.startsWith("guest-")), [room, participantsVersion, connected]);
  const remoteParticipants = Array.from(room.remoteParticipants.values());
  const staff = remoteParticipants.filter(participant => participant.identity !== "studio-panel-main" && ["admin", "moderator"].includes(resolveParticipantRole(participant) || ""));
  const screens = remoteParticipants.filter(participant => resolveParticipantRole(participant) && participant.getTrackPublication(Track.Source.ScreenShare));
  const sourceRoster: SourceRosterItem[] = [
    ...guests.map(participant => ({ key: `camera:${participant.identity}`, identity: participant.identity, name: participant.name || participant.identity, kind: "camera" as const, role: t("Гость") })),
    ...staff.map(participant => ({ key: `camera:${participant.identity}`, identity: participant.identity, name: participant.name || participant.identity, kind: "camera" as const, role: resolveParticipantRole(participant) === "admin" ? t("Администратор") : t("Модератор") })),
    ...screens.map(participant => ({ key: `screen:${participant.identity}`, identity: participant.identity, name: participant.name || participant.identity, kind: "screen" as const })),
  ];
  const selectedSource = sourceRoster.some(source => source.key === selectedGuestIdentity) ? selectedGuestIdentity : sourceRoster[0]?.key || "";
  const outputBase = typeof window === "undefined" ? "" : window.location.origin;
  const screenOutputUrl = (identity: string) => `${outputBase}/output/${encodeURIComponent(identity)}?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&source=screen${roomSettings?.viewAccess ? `#access=${encodeURIComponent(roomSettings.viewAccess)}` : ""}`;
  const outbound = selectStudioOutboundView("moderator", null, snapshot?.actual, snapshot?.primaryOnline === true);
  const displayedRole = limited ? "moderator" : (resolveParticipantRole(room.localParticipant) || "admin");
  const controlReady = !limited && connected && snapshot?.primaryOnline === true && snapshot.epoch >= 1;
  const sample = outbound.sample;
  const status = outbound.status === "live" ? "Свежие измерения основной студии" : outbound.status === "offline" ? "Основная студия офлайн. Ожидается переподключение." : outbound.status === "stale" ? "Замеры устарели. Ожидается новый замер." : "Ожидание первого замера от основной студии…";
  const history = sample?.videoHistory ?? [];
  const points = history.map((value, index) => `${38 + index * (258 / Math.max(1, history.length - 1))},${198 - Math.min(value, 25000) / 25000 * 192}`).join(" ");

  const conferenceItems = [
    ...guests.map(participant => {
        const pref = monitor.preferences[participant.identity] ?? defaultMonitor;
        const microphone = participant.getTrackPublication(Track.Source.Microphone);
        const camera = participant.getTrackPublication(Track.Source.Camera);
        return { id: `camera:${participant.identity}`, identity: participant.identity, kind: "camera" as const, node: <ParticipantSourceCard key={`camera:${participant.identity}`} sourceKey={`camera:${participant.identity}`} name={participant.name || participant.identity} kind="camera" selected={selectedSource === `camera:${participant.identity}`}
          preview={<ParticipantPreview room={room} identity={participant.identity} enabled={pref.video} />}
          meter={<GuestAudioMeter track={microphone?.track as RemoteAudioTrack | undefined} />}
          monitoring={<MonitoringControls name={participant.name || participant.identity} value={pref} onChange={patch => monitor.change(participant.identity, patch)} />}
          actions={<><TalkbackTargetButton identity={participant.identity} name={participant.name || participant.identity} /><button disabled={!!guestBusy} aria-pressed={!!microphone && !microphone.isMuted} onClick={() => void guestAction(participant.identity, "media", "audio", !microphone || microphone.isMuted)}>{microphone && !microphone.isMuted ? t("Выключить микрофон гостя") : t("Включить микрофон гостя")}</button><button disabled={!!guestBusy} aria-pressed={!!camera && !camera.isMuted} onClick={() => void guestAction(participant.identity, "media", "video", !camera || camera.isMuted)}>{camera && !camera.isMuted ? t("Выключить камеру гостя") : t("Включить камеру гостя")}</button></>}
          advanced={<><GuestCameraResolutionControl room={room} studioId={studioId} roomName={roomName} identity={participant.identity} /><div className="source-card-actions"><RotateVideoButton roomName={roomName} studioId={studioId} identity={participant.identity} /><ParticipantRenameButton studioId={studioId} roomName={roomName} identity={participant.identity} name={participant.name || participant.identity} /><button className="button-secondary" disabled={!!guestBusy} onClick={() => void guestAction(participant.identity, "kick")}>{t("Отключить гостя")}</button>{limited && moderatorScope === "studio" && <><select aria-label={t("Комната для {name}", { name: participant.name || participant.identity })} value={moveTargets[participant.identity] || ""} onChange={event => setMoveTargets(current => ({ ...current, [participant.identity]: event.target.value }))}><option value="">{t("Перевести в комнату…")}</option>{rooms.filter(name => name !== roomName).map(name => <option key={name}>{name}</option>)}</select><button disabled={!!guestBusy || !moveTargets[participant.identity]} onClick={() => void guestAction(participant.identity, "move")}>{t("Перевести")}</button></>}</div>{!limited && <StudioGuestRoleControls studioId={studioId} roomName={roomName} identity={participant.identity} participantSid={participant.sid} disabled={!connected} />}<p className="muted">{t("Общие переключатели управляют камерой и микрофоном гостя в комнате. Включение зависит от разрешений и доступности устройства у гостя.")}</p><p className="muted">{t("Личное прослушивание, видео и громкость меняются только в этой панели.")}</p></>} /> };
      }),
    ...staff.map(participant => {
        const role = resolveParticipantRole(participant);
        const pref = monitor.preferences[participant.identity] ?? (participant.identity === "studio-panel-main" ? adminMonitorDefaults["studio-panel-main"] : defaultMonitor);
        return { id: `camera:${participant.identity}`, identity: participant.identity, kind: "camera" as const, node: <ParticipantSourceCard key={`camera:${participant.identity}`} sourceKey={`camera:${participant.identity}`} name={participant.name || participant.identity} kind="camera" selected={selectedSource === `camera:${participant.identity}`}
          preview={!limited || participant.identity === "studio-panel-main" ? <ParticipantPreview room={room} identity={participant.identity} enabled={pref.video} /> : <span className="studio-participant-role">{role === "admin" ? t("Администратор") : t("Модератор")}</span>}
          monitoring={!limited ? <MonitoringControls name={participant.name || participant.identity} value={pref} onChange={patch => monitor.change(participant.identity, patch)} /> : undefined}
          actions={!limited && role === "moderator" ? <><RotateVideoButton roomName={roomName} studioId={studioId} identity={participant.identity} /><button className="button-secondary" disabled={!!guestBusy} onClick={() => void guestAction(participant.identity, "kick")}>{t("Удалить модератора")}</button></> : undefined} /> };
      }),
    ...screens.map(participant => {
        const pref = monitor.preferences[participant.identity] ?? (participant.identity === "studio-panel-main" ? adminMonitorDefaults["studio-panel-main"] : defaultMonitor);
        return { id: `screen:${participant.identity}`, identity: participant.identity, kind: "screen" as const, node: <ParticipantSourceCard key={`screen:${participant.identity}`} sourceKey={`screen:${participant.identity}`} name={participant.name || participant.identity} kind="screen" selected={selectedSource === `screen:${participant.identity}`}
          preview={<ParticipantPreview room={room} identity={participant.identity} enabled={pref.video} screen />}
          monitoring={<MonitoringControls name={participant.name || participant.identity} value={pref} onChange={patch => monitor.change(participant.identity, patch)} />}
          actions={<>{participant.identity.startsWith("guest-") && <TalkbackTargetButton identity={participant.identity} name={participant.name || participant.identity} />}<a className="button-link" href={screenOutputUrl(participant.identity)} target="_blank" rel="noreferrer">{t("Открыть экран")}</a><button type="button" onClick={() => { void navigator.clipboard.writeText(screenOutputUrl(participant.identity)).then(() => { setCopiedOutput(participant.identity); setTimeout(() => setCopiedOutput(""), 1200); }); }}>{copiedOutput === participant.identity ? t("Скопировано") : t("Копировать URL экрана")}</button></>} /> };
      })
  ];

  return <main className="page-shell studio-page studio-app-shell admin-room-page graphite-workspace">
    <aside className="studio-sidebar">
      <a className="studio-brand" href="/"><BrandIcon className="studio-brand-mark" /><span><strong>CastLink</strong><small>{limited ? t("МОДЕРАТОР") : t("АДМИНИСТРАТОР")}</small></span></a>
      <div className="sidebar-room-card"><small>{t("КОМНАТА")}</small><strong>{roomName}</strong></div>
      <nav className="studio-tabs" aria-label={t("Разделы управления")}>
        <button aria-pressed={activeTab === "studio"} onClick={() => setActiveTab("studio")}>{t("Студия")}</button>
        <button aria-pressed={activeTab === "participants"} onClick={() => setActiveTab("participants")}>{t("Участники")}</button>
        <StaffChatTab chat={staffChat} active={activeTab === "chat"} onOpen={() => setActiveTab("chat")} />
        {!limited && <button aria-pressed={activeTab === "statistics"} onClick={() => setActiveTab("statistics")}>{t("Статистика")}</button>}
      </nav>
      <div className="sidebar-footer"><span className={`studio-participant-role studio-participant-role-${displayedRole}`}>{displayedRole === "moderator" ? t("Модератор") : t("Администратор")}</span><small>{guests.length} {t("гостей в комнате")}</small></div>
      <button type="button" className="button-secondary sidebar-leave-button" onClick={() => void logout()}>{t("Выйти из комнаты")}</button>
    </aside>
    <div className="studio-main-column">
    <header className="panel admin-header"><div><h1>{limited ? t("Панель модератора комнаты «{room}»", { room: roomName }) : t("Администратор комнаты «{room}»", { room: roomName })}</h1><p className="muted">{limited ? t("Управление комнатами и гостями. Параметры эфира меняет администратор.") : t("Доступ ограничен эфиром, настройками этой комнаты и гостями. Основная студия продолжает передавать эфир; здесь нельзя занять её роль.")}</p></div><div className="admin-header-actions"><span className={`studio-participant-role studio-participant-role-${displayedRole}`}>{displayedRole === "moderator" ? t("Модератор") : t("Администратор")} · {t(recoveryBadge(connectionStatus.phase))}</span>{connectionStatus.phase === "failed" && <button type="button" className="button-secondary" onClick={() => { setConnectionError(""); setConnectionStatus(current => nextRecoveryStatus(current, "connect-start")); setConnectionAttempt(value => value + 1); }}>{t("Повторить подключение")}</button>}</div></header>

    <p className="transfer-notice" role="status">{t(reserveStatusText(sessionTransfer.view))}</p>
    {connectionError && <p role="alert" className="studio-control-error">{translateManagementMessage(connectionError, t)}</p>}
    {error && <p className="studio-control-error" role="alert">{translateManagementMessage(error, t)}</p>}
    <StaffChatPanel chat={staffChat} visible={activeTab === "chat"} onClose={() => setActiveTab("studio")} />
    <div className="control-quick-actions" hidden={activeTab !== "studio"}>
      <button type="button" className="button-secondary" aria-expanded={roomMenuOpen} aria-controls="control-room-settings" onClick={() => setRoomMenuOpen(value => !value)}>{t("☰ Комната")}</button>
      <button type="button" className={`room-mode-toggle${roomSettings?.studioOnly ? " room-mode-active" : ""}`} aria-pressed={roomSettings?.studioOnly ?? false} disabled={!roomSettings || settingsBusy} onClick={() => void saveRoomSettings({ action: "mode", studioOnly: !roomSettings?.studioOnly })}>{t("Гости могут видеть только студию")}</button>
    </div>
    {roomSettings?.studioOnly && <p className="studio-only-notice room-mode-notice" role="status">{t("Студия включила только свой просмотр")}</p>}
    <div id="control-room-settings" className="workspace-stack" hidden={activeTab !== "studio" || !roomMenuOpen}>
    {limited && moderatorScope === "studio" && <ModeratorRoomTools roomName={roomName} studioId={studioId} />}
    <section className="panel stack admin-room-settings"><h2>{t("Настройки комнаты")}</h2>
      <form className="admin-password-form" onSubmit={event => { event.preventDefault(); if (!guestPassword.trim()) { setSettingsMessage(roomSettings?.passwordSet ? "Введите новый пароль или нажмите «Удалить пароль»." : "Введите пароль для сохранения."); return; } void saveRoomSettings({ action: "password", password: guestPassword }); }}><p>{roomSettings?.passwordSet ? t("Пароль гостевого входа задан{password}.", { password: roomSettings.guestPassword ? `: ${roomSettings.guestPassword}` : "" }) : t("Пароль гостевого входа не задан.")}</p><label>{t("Новый пароль гостей")}<input type="password" autoComplete="new-password" maxLength={256} value={guestPassword} onChange={event => setGuestPassword(event.target.value)} /></label><div className="admin-settings-actions"><button type="submit" disabled={settingsBusy}>{settingsBusy ? t("Сохранение…") : t("Сохранить пароль")}</button><button type="button" className="button-secondary" disabled={settingsBusy || !roomSettings?.passwordSet} onClick={() => void saveRoomSettings({ action: "password", password: "" })}>{t("Удалить пароль")}</button></div></form>
      <div className="staff-invite-grid">{!limited && <ModeratorInviteButton roomName={roomName} studioId={studioId} scope="room" />}</div>
      {settingsMessage && <p role="status">{translateManagementMessage(settingsMessage, t)}</p>}
    </section>

    </div>
    <section hidden={activeTab !== "studio"} className={`studio-return-hero admin-return-hero ${limited ? "moderator-return-hero" : ""}`} aria-label={t("Монитор Studio Return")}>
      <h2 className="studio-return-heading">Studio Return <span className={`air-state ${snapshot?.actual?.onAir === true ? "air-live" : ""}`}><i className="air-dot" />{snapshot?.actual?.onAir === true ? "ON AIR" : "OFF AIR"}</span></h2>
      <div className="panel studio-video-card studio-return-preview-card">
        <video ref={videoRef} autoPlay playsInline muted className="return-preview" style={{ opacity: mainPreference.video ? 1 : 0 }} />
        {room.remoteParticipants.get("studio-panel-main")?.getTrackPublication(Track.Source.ScreenShare) && <div className="studio-screen-share-preview"><RemoteVideoPreview room={room} identity="studio-panel-main" camera={false} enabled={mainPreference.video} /></div>}
        {!mainPreference.video && <div className="studio-preview-placeholder">{t("Видео выключено только у вас")}</div>}
        <section className="studio-invite-compact admin-invites-compact" aria-label={t("Приглашения и доступы")}>
          <div className="guest-invite-slot"><RoomInviteButton roomName={roomName} studioId={studioId} /></div>
          {!limited && <div className="stream-invite-slot"><StudioStreamInviteButton roomName={roomName} studioId={studioId} /></div>}
        </section>
      </div>
      <div className="panel return-stats">
        {!limited && <><strong>{t("Исходящий поток основной студии")}</strong><p className="muted" role="status">{translateManagementMessage(status, t)}</p>
        <div className="return-stat-grid"><span><b>{t("Разрешение")}</b><strong>{sample?.resolution ?? "—"}</strong></span><span><b>{t("Измерено")}</b><strong>{sample ? `${sample.fps} fps` : "—"}</strong></span><span><b>{t("Видео")}</b><strong>{sample ? t("{value} кбит/с", { value: sample.videoKbps }) : "—"}</strong></span><span><b>{t("Аудио")}</b><strong>{sample ? t("{value} кбит/с", { value: sample.audioKbps }) : "—"}</strong></span></div>
        <div className="bitrate-chart"><div><b>{t("Видеобитрейт")}</b><small>{t("Последние измерения основной студии")}</small></div><svg viewBox="0 0 300 210" role="img" aria-label={sample ? t("Видеобитрейт {value} килобит в секунду", { value: sample.videoKbps }) : t(status)} preserveAspectRatio="none">
          {[500, 5000, 10000, 15000, 20000, 25000].map(value => { const y = 198 - value / 25000 * 192; return <g key={value}><path className="bitrate-chart-grid" d={`M38 ${y}H299`} /><text className="bitrate-chart-tick" x="2" y={y + 3}>{value.toLocaleString(locale)}</text></g>; })}
          {history.length > 1 && <polyline className="bitrate-chart-line" points={points} />}
        </svg></div>
        </>}
        {!limited && <div className="return-output-controls">
          <label>{t("Частота кадров")}<select disabled={busy || !controlReady} value={snapshot?.desired.fps ?? 60} onChange={event => void command({ fps: Number(event.target.value) as StudioFrameRate })}>{STUDIO_FRAME_RATES.map(fps => <option value={fps} key={fps}>{fps} FPS</option>)}</select></label>
          <label>{t("Общий лимит видеобитрейта (эфир и ссылка)")}<select aria-label={t("Общий лимит видеобитрейта (эфир и ссылка)")} aria-describedby="admin-return-bitrate-help" disabled={busy || !controlReady} value={snapshot?.desired.bitrate ?? DEFAULT_STUDIO_VIDEO_BITRATE_KBPS} onChange={event => void command({ bitrate: Number(event.target.value) })}>{videoBitrateOptions(snapshot?.desired.bitrate ?? DEFAULT_STUDIO_VIDEO_BITRATE_KBPS).map(rate => <option value={rate} key={rate}>{rate.toLocaleString(locale)} {t("кбит/с")}</option>)}</select></label>
          <StudioVideoModeControls videoCodec={snapshot?.desired.videoCodec} simulcast={snapshot?.desired.simulcast} disabled={busy || !controlReady || snapshot?.desired.onAir === true || snapshot?.actual?.onAir === true || snapshot?.actual?.airBusy === true} onChange={patch => void command(patch)} />
          <small id="admin-return-bitrate-help" className="muted">{t("Лимит каждого потока отдельно: Studio Return и /watch. При зрителях суммарный видеотрафик может достигать удвоенного лимита.")}</small>
          <label>{t("Усиление эфира")}<input type="range" min="0" max="200" disabled={busy || !controlReady} value={gainDraft} onChange={event => setGainDraft(Number(event.target.value))} /><output>{gainDraft}%</output></label>
          <button type="button" className="button-secondary" disabled={busy || !controlReady || gainDraft === (snapshot?.desired.gain ?? 100)} onClick={() => void command({ gain: gainDraft })}>{t("Применить усиление")}</button>
          <button type="button" disabled={busy || !controlReady || snapshot?.actual?.airBusy === true || (!!snapshot && snapshot.desired.onAir !== (snapshot.actual?.onAir === true) && !snapshot.actual?.error)} aria-pressed={snapshot?.actual?.onAir === true} aria-label={snapshot?.actual?.onAir === true ? t("Завершить эфир") : t("Начать эфир")} className={`air-toggle ${snapshot?.actual?.onAir === true ? "air-toggle-live" : ""}`} onClick={() => void command({ onAir: snapshot?.actual?.onAir !== true })}>{snapshot?.actual?.onAir === true ? "ON AIR" : "OFF AIR"}</button>
        </div>
        }
        {typeof snapshot?.actual?.error === "string" && snapshot.actual.error && <p className="studio-control-error" role="alert">{translateManagementMessage(snapshot.actual.error, t)}</p>}
        {!limited && !snapshot?.primaryOnline && <p className="muted" role="status">{t("Эфир и общие параметры станут доступны после подключения основной студии.")}</p>}
        <p className="muted">{t("Прослушивание и громкость меняются только у вас. Для обращения используйте блок голосовой связи.")}</p>
        <div className="personal-monitor-controls"><button type="button" aria-pressed={mainPreference.audio} onClick={() => monitor.change("studio-panel-main", { audio: !mainPreference.audio })}>{mainPreference.audio ? t("Не слушать студию") : t("Слушать студию")}</button><label>{t("Личная громкость")}<input type="range" min="0" max="100" value={mainPreference.volume} onChange={event => monitor.change("studio-panel-main", { volume: Number(event.target.value) })} /><output>{mainPreference.volume}%</output></label></div>
      </div>
    </section>
    {!limited && <div hidden={activeTab !== "studio"}><RemoteStudioDevices actual={snapshot?.actual} desired={snapshot?.desired} online={snapshot?.primaryOnline === true} disabled={busy || !controlReady} onChange={patch => void command(patch)} /></div>}
    <div className="staff-participants-workspace" style={{ display: "contents" }}>
    <TalkbackControls compact token={token} room={room} roomName={roomName} studioId={studioId} clientId={clientId} connected={connected} allowStaff={!limited} visible={activeTab === "participants"}
      nameControl={<form className="staff-rename-form" onSubmit={event => { event.preventDefault(); void renameSelf(); }}>
        <label>{t("Ваше имя")}<input value={nameDraft} maxLength={120} onChange={event => setNameDraft(event.target.value)} /></label>
        <button type="submit" className="button-secondary" disabled={nameBusy || !connected || !nameDraft.trim() || nameDraft.trim() === displayName}>{nameBusy ? t("Сохранение…") : t("Изменить имя")}</button>
        {nameMessage && <small role="status">{translateManagementMessage(nameMessage, t)}</small>}
      </form>}>
    <CasterSlotsPanel studioId={studioId} roomName={roomName} active={activeTab === "participants"}/>
    <div className="workspace-stack staff-participant-content" hidden={activeTab !== "participants"}>
    {guestMessage && <p role="status">{translateManagementMessage(guestMessage, t)}</p>}
    <div className="source-browser" data-view="participants">
      <SourceRoster sources={sourceRoster} selected={selectedSource} onSelect={setSelectedGuestIdentity} />
      <section className="source-deck" aria-label={t("Участники")}>
        {conferenceItems.map(item => item.node)}
      </section>
      {!sourceRoster.length && <p className="panel muted">{t("Гостей пока нет.")}</p>}
    </div>
    </div>
    </TalkbackControls>
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
