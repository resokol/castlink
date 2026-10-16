"use client";
import { requestGuestSession, claimGuestResumeIdentity, guestResumeKey } from "@/lib/guest-resume";
import { BrandIcon } from "./BrandIcon";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { AppFooterSlot } from "@/components/AppChrome";
import { RoomConference } from "@/components/RoomConference";

import { GuestAvCheck as AvCheck } from "@/components/GuestAvCheck";
import { GuestDeviceRequests } from "@/components/GuestDeviceRequests";
import { switchGuestCameraDevice } from "@/lib/guest-device-switch";
import { GuestCodecCameraButton } from "@/components/GuestCodecCameraButton";
import { enqueueGuestCameraTask, guestCameraCodecState, setGuestCameraEnabled, switchGuestCameraCodec } from "@/lib/guest-video-codec";
import type { StudioVideoCodec } from "@/lib/video-quality";
import { GuestMicrophoneButton } from "@/components/GuestMicrophoneButton";
import { enqueueGuestMicrophoneTask, guestAudioProfile, guestNoiseSuppressionState, setGuestMicrophoneEnabled, switchGuestMicrophoneProfile, type GuestAudioProfile } from "@/lib/guest-audio";
import { connectGuestRoom, type GuestConnectionRoute, type GuestConnectionRoutes } from "@/lib/connection-route";
import { watchGuestMediaSettings } from "@/lib/guest-media-control-client";
import type { GuestMediaSettingsPatch } from "@/lib/guest-media-control";
import { guestClientInfoRecipients, type GuestChoices } from "@/lib/guest-media";
import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { useRoomMode } from "@/lib/room-mode";
import { toggleElementFullscreen } from "@/lib/fullscreen";
import { watchStudioVideo } from "@/lib/studio-video-recovery";
import { DEFAULT_GUEST_VIDEO_BITRATE_KBPS } from "@/lib/video-quality";
import { watchGuestVideoBitrate } from "@/lib/guest-video-bitrate";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { clearTransferSnapshot, readTransferSnapshot } from "@/lib/client-transfer";
import { useSessionTransfer, guestReserveStatusText } from "@/lib/use-session-transfer";
import { parseGuestMediaCommand } from "@/lib/talkback-policy";
import { initialRecoveryStatus, nextRecoveryStatus, recoveryBadge, type RecoveryStatus } from "@/lib/reconnect-status";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StartAudio, RoomContext } from "@livekit/components-react";
import { DisconnectReason, Room, RoomEvent, Track, VideoQuality, type RemoteTrackPublication } from "livekit-client";


export function GuestWorkspace({ initialRoomName, initialStudioId, entryPath = "/room", onLeave }: { initialRoomName: string; initialStudioId: string; entryPath?: string; onLeave?: () => void }) {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const studioId = initialStudioId;
  const [roomName, setRoomName] = useState(initialRoomName);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [roomAllowed, setRoomAllowed] = useState<boolean | null>(null);
  const [choices, storeChoices] = useState<GuestChoices>();
  const choicesRef = useRef<GuestChoices | undefined>(undefined);
  const setChoices = (value: React.SetStateAction<GuestChoices | undefined>) => {
    const next = typeof value === "function" ? value(choicesRef.current) : value;
    choicesRef.current = next;
    storeChoices(next);
  };
  const [connectionRoutes, setConnectionRoutes] = useState<GuestConnectionRoutes>({ relay: { configured: false } });
  const [profileBusy, setProfileBusy] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [codecBusy, setCodecBusy] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceBusyRef = useRef(false);
  const setDeviceBusyState = (busy: boolean) => { deviceBusyRef.current = busy; setDeviceBusy(busy); };
  const mediaGeneration = useRef(0);
  const profileAttempt = useRef(0);
  const confirmedRoute = useRef<GuestConnectionRoute>("auto");
  const activeRoute = useRef<"normal" | "relay" | undefined>(undefined);
  const settingsReporter = useRef<ReturnType<typeof watchGuestMediaSettings> | undefined>(undefined);
  const applySettings = useRef<(patch: GuestMediaSettingsPatch) => Promise<void>>(async () => {});
  const routeCompletion = useRef<{ attempt: number; resolve: () => void; reject: (cause: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const sessionStopping = useRef(false);
  const removedByStudio = useRef((message: string) => {
    sessionStopping.current = true;
    try { sessionStorage.removeItem(guestResumeKey(studioId, roomName)); } catch {}
    const waiting = routeCompletion.current;
    if (waiting) { clearTimeout(waiting.timer); routeCompletion.current = undefined; waiting.reject(new Error(message)); }
    setError(message);
  });
  const [remoteVersion, setRemoteVersion] = useState(0);
  const [deviceError, setDeviceError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [identity, setIdentity] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<RecoveryStatus>(() => initialRecoveryStatus());
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [preferredGuestLabels, setPreferredGuestLabels] = useState<{ audio?: string; video?: string; output?: string }>();
  const [pendingGuestChoices, setPendingGuestChoices] = useState<GuestChoices>();
  useEffect(() => {
    fetch(`/api/rooms?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(initialRoomName)}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setRoomAllowed(!!d.exists)).catch(() => setRoomAllowed(false));
  }, [initialRoomName, studioId]);
  useEffect(() => {
    if (params.get("moved") !== "1") return;
    try {
      const storedSnapshot = readTransferSnapshot();
      const snapshot = storedSnapshot?.role === "guest" && storedSnapshot.room === roomName && (!storedSnapshot.studioId || storedSnapshot.studioId === studioId) ? storedSnapshot : undefined;
      if (snapshot) {
        const state = snapshot.settings || {};
        if (snapshot.name) { setGuestName(snapshot.name); setConfirmedName(snapshot.name); }
        const priorChoices = state.choices as GuestChoices | undefined;
        const labels = state.deviceLabels as Record<string, string> | undefined;
        if (priorChoices) {
          setPendingGuestChoices(priorChoices);
          setPreferredGuestLabels({ audio: labels?.[priorChoices.audioDeviceId || ""], video: labels?.[priorChoices.videoDeviceId || ""], output: labels?.[priorChoices.audioOutputId || ""] });
        }
      }
      const saved = sessionStorage.getItem("studiolink-guest-session");
      if (saved) {
        const state = JSON.parse(saved);
        if (!snapshot?.name && state.room === roomName && state.name) { setGuestName(state.name); setConfirmedName(state.name); }
        if (!snapshot?.settings?.choices && state.room === roomName && state.choices) setChoices(state.choices);
      }
      if (snapshot) queueMicrotask(clearTransferSnapshot);
    } catch {}
  }, [params]);
  const [room] = useState(() => new Room({ adaptiveStream: false, dynacast: true, publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: DEFAULT_GUEST_VIDEO_BITRATE_KBPS * 1000, maxFramerate: 30 }, degradationPreference: "maintain-resolution" } }));
  useEffect(() => {
    const invalidate = () => { mediaGeneration.current++; profileAttempt.current++; };
    const rememberMediaState = (track: { source: Track.Source }) => {
      if (room.state !== "connected") return;
      if (track.source === Track.Source.Microphone) setChoices(current => current ? { ...current, audioEnabled: room.localParticipant.isMicrophoneEnabled } : current);
      if (track.source === Track.Source.Camera) setChoices(current => current ? { ...current, videoEnabled: room.localParticipant.isCameraEnabled } : current);
    };
    const rememberPublication = (publication: { track?: { source: Track.Source } }) => {
      // Mute events include remote participants. During a local republish gap,
      // their source must not replace our saved on state with an absent track.
      if (publication.track && room.localParticipant.getTrackPublication(publication.track.source) === publication) rememberMediaState(publication.track);
    };
    room.on(RoomEvent.Disconnected, invalidate).on(RoomEvent.Reconnecting, invalidate);
    room.on(RoomEvent.TrackMuted, rememberPublication).on(RoomEvent.TrackUnmuted, rememberPublication).on(RoomEvent.LocalTrackPublished, rememberPublication);
    return () => { invalidate(); room.off(RoomEvent.Disconnected, invalidate).off(RoomEvent.Reconnecting, invalidate); room.off(RoomEvent.TrackMuted, rememberPublication).off(RoomEvent.TrackUnmuted, rememberPublication).off(RoomEvent.LocalTrackPublished, rememberPublication); };
  }, [room]);
  const { studioOnly } = useRoomMode(roomName, studioId);
  const monitoring = usePersonalMonitoring(room, roomName, studioOnly);
  const [selfMonitor, setSelfMonitor] = useState<MonitorPreference>({ audio: false, video: true, volume: 100 });
  const sessionTransfer = useSessionTransfer({
    studioId, room: roomName, token: choices ? token : undefined,
    snapshot: async () => {
      const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
      const deviceLabels = Object.fromEntries(devices.filter(device => device.label).map(device => [device.deviceId, device.label]));
      const savedChoices = await enqueueGuestMicrophoneTask(room, async () => ({ ...choicesRef.current, videoDeviceId: room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.getSettings().deviceId || choicesRef.current?.videoDeviceId || "", audioDeviceId: room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.getSettings().deviceId || choicesRef.current?.audioDeviceId || "", audioEnabled: room.localParticipant.isMicrophoneEnabled, videoEnabled: room.localParticipant.isCameraEnabled }));
      setTransferStatus("Студия запустила перенос. Подключаемся на другом сервере…");
      return { role: "guest", studioId, room: roomName, sourceOrigin: window.location.origin, settings: { choices: savedChoices, deviceLabels } };
    },
    beforeHandoff: async () => { sessionStopping.current = true; mediaGeneration.current++; profileAttempt.current++; await enqueueGuestMicrophoneTask(room, async () => { await room.disconnect(); }); },
  });


  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const focus = target.closest(".lk-focus-toggle-button") as HTMLButtonElement | null;
      if (!focus) return;
      const tile = focus.closest(".lk-participant-tile") as HTMLElement | null;
      if (!tile) return;
      event.preventDefault();
      event.stopPropagation();
      void toggleElementFullscreen(tile);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!confirmedName || roomAllowed !== true || identity) return;
    const controller = new AbortController();
    let active = true;
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch {}
    requestGuestSession({ studioId, room: roomName, name: confirmedName, storage, signal: controller.signal, claim: claimGuestResumeIdentity, fresh: params.get("moved") === "1" }).then((d) => {
        if (!active) return;
        if (typeof d.token !== "string" || typeof d.identity !== "string" || !d.identity.startsWith("guest-")) throw new Error("Сервер не выдал идентификатор участника");
        setConnectionRoutes({ relay: { configured: d.connectionRoutes?.relay?.configured === true, ...(d.connectionRoutes?.relay?.transport === "udp" || d.connectionRoutes?.relay?.transport === "tls443" ? { transport: d.connectionRoutes.relay.transport } : {}) } });
        setIdentity(d.identity); setToken(d.token);
        // The accepted handoff is now a normal same-tab session. Future reloads may resume it.
        if (params.get("moved") === "1") {
          const url = new URL(window.location.href); url.searchParams.delete("moved");
          window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      }).catch((e) => { if (active && e?.name !== "AbortError") setError(e.message); });
    return () => { active = false; controller.abort(); };
  }, [roomName, studioId, identity, confirmedName, roomAllowed]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (!identity || !confirmedName || !token || !choices) return;
      try {
        const r = await fetch(`/api/guest-command?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
        if (r.ok) {
          const data = await r.json();
          if (data?.targetRoom && data.targetRoom !== roomName) {
            try { sessionStorage.setItem("studiolink-guest-session", JSON.stringify({ name: confirmedName, choices: { ...choices, audioEnabled: room.localParticipant.isMicrophoneEnabled, videoEnabled: room.localParticipant.isCameraEnabled }, room: data.targetRoom })); } catch {}
            window.location.href = `${entryPath}?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(data.targetRoom)}&moved=1${entryPath === "/" ? "&mode=guest" : ""}`;
            return;
          }
        }
      } catch {}

    };
    void poll();
    return () => { stopped = true; };
  }, [roomName, studioId, identity, confirmedName, choices, token]);

  void remoteVersion;
  const remoteList = monitoring.participants.filter((p) => (!studioOnly || p.identity.startsWith("studio-panel-")) && (p.identity.startsWith("guest-") || p.identity.startsWith("studio-panel-") || p.trackPublications.size > 0));
  const reserveMessage = guestReserveStatusText(sessionTransfer.view);

  const changeProfile = async (audioProfile: GuestAudioProfile) => {
    const prior = choicesRef.current;
    if (!prior || profileBusy || routeBusy || codecBusy || deviceBusyRef.current) throw new Error("Настройки гостя сейчас заняты");
    if (guestAudioProfile(prior.audioProfile) === audioProfile && guestNoiseSuppressionState(room) === (audioProfile === "speech" ? "on" : "off")) return;
    const request = ++profileAttempt.current;
    const generation = mediaGeneration.current;
    setProfileBusy(true); setDeviceError("");
    try {
      const changed = await switchGuestMicrophoneProfile(room, prior, { ...prior, audioProfile }, { isCurrent: () => request === profileAttempt.current && generation === mediaGeneration.current });
      if (!changed || request !== profileAttempt.current || generation !== mediaGeneration.current) throw new Error("Смена режима отменена из-за переподключения");
      setChoices(current => current ? { ...current, audioProfile } : current);
    } catch (cause) {
      if (generation === mediaGeneration.current) setDeviceError(cause instanceof Error ? cause.message : "Не удалось сменить режим микрофона");
      throw cause;
    } finally { setProfileBusy(false); }
  };
  const changeRoute = async (connectionRoute: GuestConnectionRoute) => {
    if (!choicesRef.current || profileBusy || routeBusy || codecBusy || deviceBusyRef.current) throw new Error("Настройки гостя сейчас заняты");
    if (connectionRoute === "relay" && !connectionRoutes.relay.configured) throw new Error("Запасной маршрут TURN не настроен");
    if (connectionRoute === confirmedRoute.current && room.state === "connected") return;
    const previousRoute = confirmedRoute.current;
    setRouteBusy(true); setDeviceError("");
    mediaGeneration.current++; profileAttempt.current++;
    try {
      await enqueueGuestMicrophoneTask(room, async () => {
        setChoices(current => current ? { ...current, connectionRoute,
          audioDeviceId: room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack.getSettings().deviceId || current.audioDeviceId,
          videoDeviceId: room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack.getSettings().deviceId || current.videoDeviceId,
          audioEnabled: room.state === "connected" ? room.localParticipant.isMicrophoneEnabled : current.audioEnabled,
          videoEnabled: room.state === "connected" ? room.localParticipant.isCameraEnabled : current.videoEnabled,
        } : current);
      });
      setConnectionStatus(current => nextRecoveryStatus(current, "connect-start"));
      const completion = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { routeCompletion.current = undefined; reject(new Error("Не удалось подтвердить подключение по новому маршруту")); }, 45_000);
        routeCompletion.current = { attempt: connectionAttempt + 1, resolve, reject, timer };
      });
      setConnectionAttempt(value => value + 1);
      await completion;
    } catch (cause) {
      setDeviceError(cause instanceof Error ? cause.message : "Не удалось сменить маршрут");
      // A failed requested route must not strand a guest without route controls.
      // Restore the prior working choice and make one bounded same-token join.
      if (!sessionStopping.current) {
        setChoices(current => current ? { ...current, connectionRoute: previousRoute } : current);
        setConnectionStatus(current => nextRecoveryStatus(current, "connect-start"));
        setConnectionAttempt(value => value + 1);
      }
      throw cause;
    }
    finally { setRouteBusy(false); }
  };
  const changeCodec = async (videoCodec: StudioVideoCodec) => {
    if (!choicesRef.current || profileBusy || routeBusy || codecBusy || deviceBusyRef.current) throw new Error("Настройки гостя сейчас заняты");
    const generation = mediaGeneration.current;
    setCodecBusy(true); setDeviceError("");
    try {
      const changed = await switchGuestCameraCodec(room, videoCodec, () => !sessionStopping.current && generation === mediaGeneration.current);
      if (!changed || generation !== mediaGeneration.current) throw new Error("Смена кодека отменена из-за переподключения");
      setChoices(current => current ? { ...current, videoCodec } : current);
    } finally { setCodecBusy(false); }
  };
  applySettings.current = async patch => {
    if (patch.videoCodec) await changeCodec(patch.videoCodec);
    if (patch.audioProfile) await changeProfile(patch.audioProfile);
    if (patch.connectionRoute) await changeRoute(patch.connectionRoute);
  };
  useEffect(() => {
    if (!token || !identity) return;
    sessionStopping.current = false;
    const reporter = watchGuestMediaSettings(room, { studioId, roomName, identity, token,
      state: () => ({ ...guestCameraCodecState(room, choicesRef.current), audioProfile: guestAudioProfile(choicesRef.current?.audioProfile), noiseSuppressionState: guestNoiseSuppressionState(room), connectionRoute: confirmedRoute.current, ...(activeRoute.current ? { activeRoute: activeRoute.current } : {}) }),
      apply: patch => applySettings.current(patch), onError: setDeviceError,
    });
    settingsReporter.current = reporter;
    return () => {
      reporter.stop(); settingsReporter.current = undefined;
      sessionStopping.current = true;
      const waiting = routeCompletion.current;
      if (waiting) { clearTimeout(waiting.timer); routeCompletion.current = undefined; waiting.reject(new Error("Перенос или выход отменил команду")); }
    };
  }, [room, studioId, roomName, identity, token]);
  const connectedSettings = (selected: GuestConnectionRoute, active: "normal" | "relay", attempt: number, error?: string) => {
    confirmedRoute.current = selected; activeRoute.current = active;
    const waiting = routeCompletion.current;
    if (waiting?.attempt === attempt) { clearTimeout(waiting.timer); routeCompletion.current = undefined; if (error) waiting.reject(new Error(error)); else waiting.resolve(); }
    settingsReporter.current?.report();
  };
  const failedSettings = (message: string, attempt: number) => {
    const waiting = routeCompletion.current;
    if (waiting?.attempt === attempt) { clearTimeout(waiting.timer); routeCompletion.current = undefined; waiting.reject(new Error(message)); }
  };

  if (error) return <main className="guest-entry-page graphite-entry"><div className="panel stack"><p>{translateWorkspaceMessage(t, error)}</p><button onClick={() => onLeave ? onLeave() : window.location.reload()}>{onLeave ? t("На главную") : t("Войти снова")}</button></div></main>;
  if (roomAllowed === null) return <main className="guest-entry-page graphite-entry"><div className="panel">{t("Проверка комнаты…")}</div></main>;
  if (roomAllowed === false) return <main className="guest-entry-page graphite-entry"><div className="panel stack"><h1>{t("Комната не найдена")}</h1><p className="muted">{t("Такой комнаты не существует. Проверьте ссылку или обратитесь в студию.")}</p>{onLeave && <button className="button-secondary" onClick={onLeave}>{t("На главную")}</button>}</div></main>;
  if (!confirmedName) return <main className="guest-entry-page graphite-entry"><div className="panel stack guest-name-card"><p className="muted">CastLink · {roomName}</p><h1>{t("Как вас представить в эфире?")}</h1><input autoFocus placeholder={t("Например: Алексей")} value={guestName} onChange={(e) => setGuestName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && guestName.trim()) setConfirmedName(guestName.trim()); }} /><button disabled={!guestName.trim()} onClick={() => setConfirmedName(guestName.trim())}>{t("Продолжить")}</button>{onLeave && <button className="button-secondary" onClick={onLeave}>{t("На главную")}</button>}</div></main>;
  if (!choices) return <AvCheck name={confirmedName} onJoin={setChoices} preferredLabels={preferredGuestLabels} initialChoices={pendingGuestChoices} />;
  if (!token) return <main className="guest-entry-page graphite-entry"><div className="panel">{t("Подключение…")}</div></main>;

  return <main className="media-page guest-room-page guest-app-shell graphite-workspace">
    <aside className="guest-sidebar"><div className="studio-brand"><BrandIcon className="studio-brand-mark" /><span><strong>CastLink</strong><small>{t("УЧАСТНИК ЭФИРА")}</small></span></div>
      <div className="sidebar-room-card"><small>{t("КОМНАТА")}</small><strong>{roomName}</strong><span className="guest-name-chip"><i />{confirmedName}</span></div>
      <div className="guest-participant-list"><small>{t("В КОМНАТЕ ·")} {remoteList.length + 1}</small><div><span className="participant-dot self" />{confirmedName}<em>{t("Вы")}</em></div>{remoteList.map(p => <div key={p.identity}><span className="participant-dot" />{p.name || (p.identity.startsWith("studio-panel-") ? t("Студия") : p.identity)}</div>)}</div>
      <div className="sidebar-footer"><span className="sidebar-avatar">{confirmedName.slice(0, 2).toUpperCase()}</span><span><strong>{confirmedName}</strong><small>{t("Гость комнаты")}</small></span></div>
    </aside>
    <div className="guest-main-column"><header className="guest-page-header"><div><p className="eyebrow">{t("КОМНАТА В ЭФИРЕ")}</p><h1>{roomName}</h1></div><div className="guest-identity-pill"><span className="participant-dot self" />{confirmedName}</div></header>
    {reserveMessage && <p className="transfer-notice" role="status">{translateWorkspaceMessage(t, reserveMessage)}</p>}
    {transferStatus && <div className="transfer-notice" role="status">{translateWorkspaceMessage(t, transferStatus)}</div>}
    {connectionStatus.phase !== "connected" && <div className={`transfer-notice connection-${connectionStatus.phase}`} role="status"><strong>{t(recoveryBadge(connectionStatus.phase))}</strong>{connectionStatus.message && <> · {translateWorkspaceMessage(t, connectionStatus.message)}</>}{connectionStatus.phase === "failed" && <button type="button" className="button-secondary" onClick={() => { setConnectionStatus(current => nextRecoveryStatus(current, "connect-start")); setConnectionAttempt(value => value + 1); }}>{t("Повторить подключение")}</button>}</div>}
    <div className={`guest-conference-shell${selfMonitor.video ? "" : " self-preview-hidden"}`}><div className={`guest-conference-grid${studioOnly ? " studio-only-grid" : ""}`}><RoomContext.Provider value={room}><StartAudio label={t("Включить звук от студии")} className="guest-audio-button" /><RoomConference studioOnly={studioOnly} controlsDisabled={profileBusy || routeBusy || codecBusy || (connectionStatus.phase !== "connected" && connectionStatus.phase !== "recovered")} cameraControl={<GuestCodecCameraButton room={room} choicesRef={choicesRef} generation={mediaGeneration} disabled={profileBusy || routeBusy || codecBusy || deviceBusy || (connectionStatus.phase !== "connected" && connectionStatus.phase !== "recovered")} onError={setDeviceError} />} microphoneControl={<GuestMicrophoneButton room={room} choicesRef={choicesRef} generation={mediaGeneration} disabled={profileBusy || routeBusy || codecBusy || deviceBusy || (connectionStatus.phase !== "connected" && connectionStatus.phase !== "recovered")} onError={setDeviceError} />} onLeave={() => { sessionStopping.current = true; mediaGeneration.current++; profileAttempt.current++; void enqueueGuestMicrophoneTask(room, async () => { await room.disconnect(); }); if (onLeave) onLeave(); else setError("Вы вышли из комнаты."); }} /></RoomContext.Provider></div></div>
    <div className="section-heading guest-settings-heading"><div><p className="eyebrow">{t("ЛИЧНЫЕ ПАРАМЕТРЫ")}</p><h2>{t("Устройства и мониторинг")}</h2></div></div>
    <div className="panel guest-device-panel">
      <MediaDevicePicker disabledInputs={profileBusy || routeBusy || codecBusy || deviceBusy} disabledOutput={deviceBusy} autoRequestPermissions={false} permissionInputs={{ audio: room.localParticipant.isMicrophoneEnabled, video: room.localParticipant.isCameraEnabled }} room={room} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId || "default"} onChange={change => { if (deviceBusyRef.current) return; setDeviceError(""); setChoices(current => current ? { ...current, ...(change.cameraId !== undefined ? { videoDeviceId: change.cameraId } : {}), ...(change.microphoneId !== undefined ? { audioDeviceId: change.microphoneId } : {}), ...(change.headphonesId !== undefined ? { audioOutputId: change.headphonesId } : {}) } : current); }} />{deviceError && <small className="media-device-error" role="alert">{translateWorkspaceMessage(t, deviceError)}</small>}</div>
    <section className="panel personal-monitor-panel"><h2>{t("Собственный мониторинг")}</h2><p className="muted">{t("Звук, видео и громкость меняются только для вас. Другие участники и выходы vMix не затрагиваются.")}</p>
      <div className="personal-monitor-row"><strong>{t("Собственный мониторинг")}</strong><MonitoringControls name={t("Я")} value={selfMonitor} onChange={(patch) => setSelfMonitor((value) => ({ ...value, ...patch }))} /></div>
      <SelfAudioMonitor room={room} value={studioOnly ? { ...selfMonitor, audio: false } : selfMonitor} />
      {remoteList.length ? remoteList.map((p) => <div className="personal-monitor-row" key={p.identity}>
        <strong>{p.name || (p.identity.startsWith("studio-panel-") ? t("Студия") : p.identity)}</strong>
        <MonitoringControls name={p.name || p.identity} value={monitoring.preferences[p.identity]} onChange={(patch) => monitoring.change(p.identity, patch)} />
      </div>) : <p className="muted">{t("Ожидание других участников.")}</p>}
    </section>
    <AppFooterSlot />
    </div>
    <GuestDeviceRequests room={room} token={token} studioId={studioId} roomName={roomName} identity={identity}
      choicesRef={choicesRef} mediaGeneration={mediaGeneration} disabled={profileBusy || routeBusy || codecBusy}
      onApplyingChange={setDeviceBusyState} onError={setDeviceError}
      onChoices={patch => setChoices(current => current ? { ...current, ...patch } : current)}
      applyCamera={(deviceId, isCurrent) => switchGuestCameraDevice(room, () => choicesRef.current!, deviceId, isCurrent)} />
    <RoomConnector room={room} token={token} choices={choices} choicesRef={choicesRef} mediaGeneration={mediaGeneration} connectionRoutes={connectionRoutes} attempt={connectionAttempt} onConnectedSettings={connectedSettings} onFailedSettings={failedSettings} onConnectionStatus={setConnectionStatus} onRemoteChange={setRemoteVersion} onRemoved={removedByStudio.current} onDeviceError={setDeviceError} videoEnabled={monitoring.videoEnabled} />
  </main>;
}

function SelfAudioMonitor({ room, value }: { room: Room; value: MonitorPreference }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const update = () => {
      const audio = ref.current;
      if (!audio) return;
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const track = publication?.track?.mediaStreamTrack;
      audio.srcObject = value.audio && track && !publication?.isMuted ? new MediaStream([track]) : null;
      audio.volume = value.volume / 100;
      if (audio.srcObject) void audio.play().catch(() => undefined);
    };
    update();
    room.on(RoomEvent.LocalTrackPublished, update).on(RoomEvent.LocalTrackUnpublished, update)
      .on(RoomEvent.TrackMuted, update).on(RoomEvent.TrackUnmuted, update);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, update).off(RoomEvent.LocalTrackUnpublished, update)
        .off(RoomEvent.TrackMuted, update).off(RoomEvent.TrackUnmuted, update);
      if (ref.current) ref.current.srcObject = null;
    };
  }, [room, value.audio, value.volume]);
  return <audio ref={ref} autoPlay />;
}

async function applyGuestCameraConstraints(room: Room, choices: GuestChoices) {
  const mediaTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
  if (!mediaTrack) return;
  const base: MediaTrackConstraints = { height: { ideal: choices.height }, frameRate: { ideal: 30 } };
  try {
    await mediaTrack.applyConstraints({ ...base, resizeMode: { ideal: "none" } } as MediaTrackConstraints);
  } catch {
    await mediaTrack.applyConstraints(base).catch(() => undefined);
  }
}

async function setGuestCamera(room: Room, choices: GuestChoices, enabled: boolean, isCurrent: () => boolean = () => true) {
  if (await setGuestCameraEnabled(room, enabled, () => choices, isCurrent) && enabled) await applyGuestCameraConstraints(room, choices);
}

function RoomConnector({ room, token, choices, choicesRef, mediaGeneration, connectionRoutes, attempt, onConnectedSettings, onFailedSettings, onConnectionStatus, onRemoteChange, onRemoved, onDeviceError, videoEnabled }: { room: Room; token: string; choices: GuestChoices; choicesRef: React.RefObject<GuestChoices | undefined>; mediaGeneration: React.RefObject<number>; connectionRoutes: GuestConnectionRoutes; attempt: number; onConnectedSettings?: (selected: GuestConnectionRoute, active: "normal" | "relay", attempt: number, error?: string) => void; onFailedSettings?: (message: string, attempt: number) => void; onConnectionStatus: React.Dispatch<React.SetStateAction<RecoveryStatus>>; onRemoteChange: React.Dispatch<React.SetStateAction<number>>; onRemoved: (message: string) => void; onDeviceError: React.Dispatch<React.SetStateAction<string>>; videoEnabled: (identity: string) => boolean }) {
  const [connected, setConnected] = useState(false);
  const publishedDevices = useRef({ audio: "", video: "" });
  const videoEnabledRef = useRef(videoEnabled);
  const connectionTasks = useRef<Promise<unknown>>(Promise.resolve());
  const settingsCallbacks = useRef({ onConnectedSettings, onFailedSettings });
  settingsCallbacks.current = { onConnectedSettings, onFailedSettings };
  const joinedRoute = useRef<{ selected: GuestConnectionRoute; active: "normal" | "relay" }>({ selected: "auto", active: "normal" });
  videoEnabledRef.current = videoEnabled;
  useEffect(() => watchGuestVideoBitrate(room,onDeviceError),[room,onDeviceError]);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant: unknown, _kind: unknown, topic?: string) => {
      const command = parseGuestMediaCommand(payload, participant, topic);
      if (!command || room.state !== "connected") return;
      const generation = mediaGeneration.current;
      const current = choicesRef.current!;
      const action = command.source === "microphone"
        ? setGuestMicrophoneEnabled(room, command.enabled, () => choicesRef.current || {}, () => generation === mediaGeneration.current)
        : setGuestCameraEnabled(room, command.enabled, () => choicesRef.current!, () => generation === mediaGeneration.current);
      void action.then(changed => {
        if (!changed || generation !== mediaGeneration.current) return;
        if (command.enabled) publishedDevices.current[command.source === "microphone" ? "audio" : "video"] = command.source === "microphone" ? choicesRef.current?.audioDeviceId || "" : current.videoDeviceId || "";
        onDeviceError("");
      }).catch(cause => { if (generation === mediaGeneration.current) onDeviceError(`Не удалось выполнить команду студии: ${cause instanceof Error ? cause.message : "ошибка устройства"}`); });
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, choicesRef, mediaGeneration, onDeviceError]);

  useEffect(() => {
    let active = true;
    let joining = true;
    let participantRemoved = false;
    let recoveredTimer: ReturnType<typeof setTimeout> | undefined;
    onConnectionStatus(current => nextRecoveryStatus(current, "connect-start"));
    const disconnected = (reason?: DisconnectReason) => {
      if (!active) return;
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        participantRemoved = true;
        setConnected(false);
        onRemoved("Студия отключила вас от комнаты.");
        return;
      }
      if (joining) return;
      setConnected(false);
      onConnectionStatus(current => nextRecoveryStatus(current, "failed", "Соединение завершилось после попыток восстановления. Можно подключиться снова без обновления страницы."));
    };
    const reconnecting = () => {
      if (active) { setConnected(false); onConnectionStatus(current => nextRecoveryStatus(current, "reconnecting")); }
    };
    const reconnected = () => {
      if (!active) return;
      setConnected(true);
      onConnectionStatus(current => nextRecoveryStatus(current, "reconnected"));
      settingsCallbacks.current.onConnectedSettings?.(joinedRoute.current.selected, joinedRoute.current.active, attempt);
      // A profile switch can be interrupted in its short unpublish gap. The SDK
      // cannot republish a track absent from its map; restore only that missing mic.
      const generation = mediaGeneration.current;
      if (choicesRef.current?.audioEnabled !== false && !room.localParticipant.getTrackPublication(Track.Source.Microphone)) {
        void setGuestMicrophoneEnabled(room, true, () => choicesRef.current || {}, () => active && generation === mediaGeneration.current).catch(cause => {
          if (active && generation === mediaGeneration.current) onDeviceError(cause instanceof Error ? cause.message : "Не удалось восстановить микрофон");
        });
      }
      void (async () => {
        const current = choicesRef.current;
        if (!current) return;
        const isCurrent = () => active && generation === mediaGeneration.current;
        if (!room.localParticipant.getTrackPublication(Track.Source.Camera) && current.videoEnabled !== false) await setGuestCamera(room, current, true, isCurrent);
        else if (current.videoCodec) await switchGuestCameraCodec(room, current.videoCodec, isCurrent);
        if (isCurrent()) settingsCallbacks.current.onConnectedSettings?.(joinedRoute.current.selected, joinedRoute.current.active, attempt);
      })().catch(cause => { if (active && generation === mediaGeneration.current) onDeviceError(cause instanceof Error ? cause.message : "Не удалось восстановить камеру"); });
      if (recoveredTimer) clearTimeout(recoveredTimer);
      recoveredTimer = setTimeout(() => {
        if (active) onConnectionStatus(current => nextRecoveryStatus(current, "connect-success"));
      }, 3000);
    };
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.Reconnected, reconnected);
    let stopTelemetry: (() => void) | undefined;
    const stopVideoRecovery = watchStudioVideo(room, identity => videoEnabledRef.current(identity));
    const forceStudioHigh = (publication: RemoteTrackPublication) => {
      if (publication.kind !== Track.Kind.Video) return;
      publication.setVideoQuality(VideoQuality.HIGH);
      publication.setVideoDimensions({ width: 1920, height: 1080 });
    };
    const onPublished = (publication: RemoteTrackPublication, participant: { identity: string }) => {
      if (participant.identity.startsWith("studio-panel-")) forceStudioHigh(publication);
    };
    room.on(RoomEvent.TrackPublished, onPublished);
    const refreshRemotes = () => onRemoteChange((v) => v + 1);
    room.on(RoomEvent.ParticipantConnected, refreshRemotes);
    room.on(RoomEvent.ParticipantDisconnected, refreshRemotes);
    room.on(RoomEvent.TrackSubscribed, refreshRemotes);
    let started = false;
    const connectTimer = window.setTimeout(() => {
      if (!active) return;
      started = true;
      const previousTask = connectionTasks.current;
      connectionTasks.current = previousTask.catch(() => undefined).then(async () => {
      if (!active) return;
      let mediaConnected = false;
      try {
        const selected = choicesRef.current?.connectionRoute || "auto";
        const activeRoute = await connectGuestRoom(room, getLiveKitUrl(), token, {
          route: selected, relay: connectionRoutes.relay, isActive: () => active && !participantRemoved,
          onAttempt: route => { if (active && route === "relay") onConnectionStatus(current => ({ ...nextRecoveryStatus(current, "connect-start"), message: "Подключение через запасной маршрут TURN…" })); },
        });
        mediaConnected = true;
        joining = false;
        if (!active) return;
        joinedRoute.current = { selected, active: activeRoute };
        await room.startAudio().catch(() => undefined);
        stopTelemetry = startRoomTelemetry(room, room.name, token);
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (participant.identity.startsWith("studio-panel-")) forceStudioHigh(publication);
          }
        }
        const generation = mediaGeneration.current;
        await enqueueGuestMicrophoneTask(room, async () => {
          if (!active || generation !== mediaGeneration.current) return;
          await room.switchActiveDevice("audioinput", choicesRef.current?.audioDeviceId || "default");
        });
        if (!active) return;
        const videoDeviceId = choicesRef.current?.videoDeviceId;
        // Video inputs have no "default" pseudo-device. An empty choice leaves
        // the browser's system-camera selection available for later enable.
        if (videoDeviceId) await room.switchActiveDevice("videoinput", videoDeviceId);
        if (!active) return;
        let microphoneError = "";
        if (choicesRef.current?.audioEnabled !== false) {
          try {
            await setGuestMicrophoneEnabled(room, true, () => choicesRef.current || {}, () => active && generation === mediaGeneration.current);
          } catch (error) {
            // Capture can succeed before native processing verification fails.
            // Keep that error explicit without blocking the independent camera.
            microphoneError = error instanceof Error ? error.message : "Не удалось включить микрофон";
          }
        }
        if (!active) return;
        const current = choicesRef.current!;
        if (current.videoEnabled !== false) await setGuestCamera(room, current, true, () => active && generation === mediaGeneration.current);
        if (!active) return;
        publishedDevices.current = { audio: current.audioDeviceId || "", video: current.videoDeviceId || "" };
        setConnected(true);
        onConnectionStatus(current => nextRecoveryStatus(current, "connect-success"));
        if (microphoneError) onDeviceError(microphoneError);
        settingsCallbacks.current.onConnectedSettings?.(joinedRoute.current.selected, joinedRoute.current.active, attempt, microphoneError || undefined);
        const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
        const cam = devices.find((d) => d.kind === "videoinput" && d.deviceId === current.videoDeviceId);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const micSettings = micPub?.track?.mediaStreamTrack?.getSettings();
        let gpu = "Недоступно браузеру";
        try {
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl");
          const ext = gl?.getExtension("WEBGL_debug_renderer_info");
          if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
        } catch {}
        const bounded = (value: unknown) => typeof value === "string" ? value.slice(0, 160) : "";
        const info = {
          type: "guest-client-info",
          camera: bounded(cam?.label || "Неизвестная камера"),
          cpu: bounded(`${navigator.hardwareConcurrency || "?"} логических потоков (модель скрыта браузером)`),
          gpu: bounded(gpu),
          platform: bounded(navigator.platform || "—"),
          sampleRate: Number.isSafeInteger(micSettings?.sampleRate) ? micSettings!.sampleRate! : 0,
        };
        const destinations = guestClientInfoRecipients(room.remoteParticipants.values());
        if (destinations.length) await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(info)), { reliable: true, topic: "studiolink-client-info", destinationIdentities: destinations });
      } catch (e) {
        joining = false;
        console.error(e);
        if (!active) return;
        const message = e instanceof Error ? e.message : "Не удалось подключиться";
        if (!mediaConnected) {
          setConnected(false);
          onConnectionStatus(current => nextRecoveryStatus(current, "failed", message));
          settingsCallbacks.current.onFailedSettings?.(message, attempt);
        } else { setConnected(true); onConnectionStatus(current => nextRecoveryStatus(current, "connect-success")); onDeviceError(message); settingsCallbacks.current.onConnectedSettings?.(joinedRoute.current.selected, joinedRoute.current.active, attempt, message); }
      }
      });
    }, 0);
    return () => { active = false; mediaGeneration.current++; window.clearTimeout(connectTimer); if (recoveredTimer) clearTimeout(recoveredTimer); stopVideoRecovery(); room.off(RoomEvent.Disconnected, disconnected); room.off(RoomEvent.Reconnecting, reconnecting); room.off(RoomEvent.Reconnected, reconnected); stopTelemetry?.(); room.off(RoomEvent.TrackPublished, onPublished); room.off(RoomEvent.ParticipantConnected, refreshRemotes); room.off(RoomEvent.ParticipantDisconnected, refreshRemotes); room.off(RoomEvent.TrackSubscribed, refreshRemotes); if (started) connectionTasks.current = connectionTasks.current.catch(() => undefined).then(() => enqueueGuestMicrophoneTask(room, async () => { await room.disconnect(); })); };
  }, [room, token, attempt, connectionRoutes, choicesRef, mediaGeneration, onConnectionStatus, onRemoteChange, onRemoved]);
  useEffect(() => {
    if (!connected || room.state !== "connected") return;
    let active = true;
    const generation = mediaGeneration.current;
    const switchInputDevices = async () => {
      try {
        await enqueueGuestMicrophoneTask(room, async () => {
          if (!active || generation !== mediaGeneration.current || room.state !== "connected") return;
          const current = choicesRef.current;
          if (!current) return;
          const audio = current.audioDeviceId || "";
          if (audio !== publishedDevices.current.audio) {
            const nativeDevice = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack.getSettings().deviceId;
            const switched = !!audio && nativeDevice === audio || await room.switchActiveDevice("audioinput", audio || "default");
            if (!switched) throw new Error("Браузер не смог переключить микрофон");
            if (generation === mediaGeneration.current) publishedDevices.current.audio = audio;
          }
        });
        if (!active || generation !== mediaGeneration.current || room.state !== "connected") return;
        const current = choicesRef.current;
        if (!current) return;
        await enqueueGuestCameraTask(room, async () => {
        if (!active || generation !== mediaGeneration.current || room.state !== "connected") return;
        const video = current.videoDeviceId || "";
        if (video !== publishedDevices.current.video) {
          const videoInput = video || (await navigator.mediaDevices.enumerateDevices()).find(device => device.kind === "videoinput")?.deviceId;
          if (!videoInput) throw new Error("Не найдена системная камера");
          const alreadySelected = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack.getSettings().deviceId === videoInput;
          const switched = alreadySelected || await room.switchActiveDevice("videoinput", videoInput);
          if (!switched) throw new Error("Браузер не смог переключить камеру");
          await applyGuestCameraConstraints(room, current);
          publishedDevices.current.video = video;
        } else if (room.localParticipant.isCameraEnabled) await applyGuestCameraConstraints(room, current);
        });
        // A successful camera/device update does not confirm microphone DSP.
        const expectedNoiseSuppression = current.audioProfile === "raw" ? "off" : "on";
        if (active && (!room.localParticipant.isMicrophoneEnabled || guestNoiseSuppressionState(room) === expectedNoiseSuppression)) onDeviceError("");
      } catch (e) { if (active) onDeviceError(e instanceof Error ? `Не удалось переключить устройство: ${e.message}` : "Не удалось переключить устройство"); }
    };
    void switchInputDevices();
    return () => { active = false; };
  }, [room, connected, choices.audioDeviceId, choices.videoDeviceId, choices.height, choicesRef, mediaGeneration, onDeviceError]);

  useEffect(() => {
    if (!connected || !navigator.mediaDevices) return;
    let stopped = false;
    let running = false;
    const reconcile = async () => {
      if (running || stopped || room.state !== "connected") return;
      running = true;
      try {
        const generation = mediaGeneration.current;
        let message = await enqueueGuestMicrophoneTask(room, async () => {
          if (stopped || generation !== mediaGeneration.current || room.state !== "connected") return "";
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (stopped || generation !== mediaGeneration.current || room.state !== "connected") return "";
          const requestedAudio = choicesRef.current?.audioDeviceId || "";
          const audioInputs = devices.filter(device => device.kind === "audioinput");
          if (room.localParticipant.isMicrophoneEnabled && requestedAudio) {
            const requestedExists = audioInputs.some(device => device.deviceId === requestedAudio);
            if (requestedExists && publishedDevices.current.audio !== requestedAudio) {
              if (await room.switchActiveDevice("audioinput", requestedAudio)) publishedDevices.current.audio = requestedAudio;
            } else if (!requestedExists && publishedDevices.current.audio === requestedAudio) {
              const fallback = audioInputs.find(device => device.deviceId !== requestedAudio)?.deviceId || "default";
              if (await room.switchActiveDevice("audioinput", fallback)) { publishedDevices.current.audio = fallback; return "Выбранный микрофон отключён. Временно используется системный микрофон."; }
            }
          }
          return "";
        });
        if (stopped || generation !== mediaGeneration.current || room.state !== "connected") return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const current = choicesRef.current;
        if (!current || stopped) return;
        const videoInputs = devices.filter(device => device.kind === "videoinput");
        const requestedVideo = current.videoDeviceId || "";

        if (room.localParticipant.isCameraEnabled && requestedVideo) {
          const requestedExists = videoInputs.some(device => device.deviceId === requestedVideo);
          if (requestedExists && publishedDevices.current.video !== requestedVideo) {
            if (await room.switchActiveDevice("videoinput", requestedVideo)) {
              await applyGuestCameraConstraints(room, current);
              publishedDevices.current.video = requestedVideo;
            }
          } else if (!requestedExists && publishedDevices.current.video === requestedVideo) {
            const fallback = videoInputs.find(device => device.deviceId !== requestedVideo)?.deviceId;
            if (fallback && await room.switchActiveDevice("videoinput", fallback)) {
              await applyGuestCameraConstraints(room, current);
              publishedDevices.current.video = fallback;
              message = message || "Выбранная камера отключена. Временно используется другая доступная камера.";
            }
          }
        }

        if (!stopped) onDeviceError(message);
      } catch (error) {
        if (!stopped) onDeviceError(error instanceof Error ? `Не удалось восстановить устройство: ${error.message}` : "Не удалось восстановить устройство");
      } finally {
        running = false;
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", reconcile);
    return () => { stopped = true; navigator.mediaDevices.removeEventListener("devicechange", reconcile); };
  }, [room, connected, choicesRef, mediaGeneration, onDeviceError]);
  return null;
}
