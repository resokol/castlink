"use client";
import { RoomConference } from "@/components/RoomConference";

import { GuestAvCheck as AvCheck } from "@/components/GuestAvCheck";
import { guestClientInfoRecipients, type GuestChoices } from "@/lib/guest-media";
import { GuestAccessGate } from "@/components/GuestAccessGate";
import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { useRoomMode } from "@/lib/room-mode";
import { watchStudioVideo } from "@/lib/studio-video-recovery";
import { MAX_GUEST_VIDEO_BITRATE } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";
import { clearTransferSnapshot, readTransferSnapshot, transferDestination, type TransferSnapshot } from "@/lib/client-transfer";
import { parseGuestMediaCommand } from "@/lib/talkback-policy";
import { initialRecoveryStatus, nextRecoveryStatus, recoveryBadge, type RecoveryStatus } from "@/lib/reconnect-status";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StartAudio, RoomContext } from "@livekit/components-react";
import { DisconnectReason, Room, RoomEvent, Track, VideoQuality, type RemoteTrackPublication } from "livekit-client";


function RoomContent({ initialRoomName, initialStudioId }: { initialRoomName: string; initialStudioId: string }) {
  const params = useSearchParams();
  const studioId = initialStudioId;
  const [roomName, setRoomName] = useState(initialRoomName);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [roomAllowed, setRoomAllowed] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<GuestChoices>();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      const snapshot = storedSnapshot?.role === "guest" && storedSnapshot.room === roomName ? storedSnapshot : undefined;
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
  const [room] = useState(() => new Room({ adaptiveStream: false, dynacast: true, publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: MAX_GUEST_VIDEO_BITRATE, maxFramerate: 30 }, degradationPreference: "maintain-resolution" } }));
  const { studioOnly } = useRoomMode(roomName, studioId);
  const monitoring = usePersonalMonitoring(room, roomName, studioOnly);
  const [selfMonitor, setSelfMonitor] = useState<MonitorPreference>({ audio: false, video: true, volume: 100 });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const focus = target.closest(".lk-focus-toggle-button") as HTMLButtonElement | null;
      if (!focus) return;
      const tile = focus.closest(".lk-participant-tile") as HTMLElement | null;
      if (!tile) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement === tile) void document.exitFullscreen();
      else void tile.requestFullscreen().catch(() => undefined);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!confirmedName || roomAllowed !== true || identity) return;
    const controller = new AbortController();
    let active = true;
    fetch(`/api/token?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&name=${encodeURIComponent(confirmedName)}&role=guest`, { signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }).then((d) => {
        if (!active) return;
        if (typeof d.token !== "string" || typeof d.identity !== "string" || !d.identity.startsWith("guest-")) throw new Error("Сервер не выдал идентификатор участника");
        setIdentity(d.identity); setToken(d.token);
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
            window.location.href = `/room?studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(data.targetRoom)}&moved=1`;
            return;
          }
        }
      } catch {}
      try {
        const response = await fetch(`/api/server-transfer?studioId=${encodeURIComponent(studioId)}&room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const transfer = await response.json();
          if (transfer?.ticket && transfer?.targetUrl) {
            const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
            const cameraId = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.getSettings().deviceId || choices.videoDeviceId || "";
            const microphoneId = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.getSettings().deviceId || choices.audioDeviceId || "";
            const deviceLabels = Object.fromEntries(devices.filter(d => d.label).map(d => [d.deviceId, d.label]));
            const savedChoices = { ...choices, videoDeviceId: cameraId, audioDeviceId: microphoneId, audioEnabled: room.localParticipant.isMicrophoneEnabled, videoEnabled: room.localParticipant.isCameraEnabled };
            const snapshot: TransferSnapshot = { role: "guest", studioId, room: transfer.room || roomName, sourceOrigin: window.location.origin, name: transfer.name || confirmedName, identity: transfer.identity || identity, settings: { choices: savedChoices, deviceLabels } };
            setTransferStatus("Перенос комнаты: подключение переподключится на новом сервере, участие может прерваться на несколько секунд.");
            window.location.href = transferDestination(transfer.targetUrl, transfer.ticket, snapshot, transfer.clientTargetUrl);
            return;
          }
        }
      } catch {}
      if (!stopped) setTimeout(poll, 1000);
    };
    void poll();
    return () => { stopped = true; };
  }, [roomName, studioId, identity, confirmedName, choices, token]);

  void remoteVersion;
  const remoteList = monitoring.participants.filter((p) => (!studioOnly || p.identity.startsWith("studio-panel-")) && (p.identity.startsWith("guest-") || p.identity.startsWith("studio-panel-") || p.trackPublications.size > 0));

  if (error) return <main className="guest-entry-page"><div className="panel stack"><p>{error}</p><button onClick={() => window.location.reload()}>Войти снова</button></div></main>;
  if (roomAllowed === null) return <main className="guest-entry-page"><div className="panel">Проверка комнаты…</div></main>;
  if (roomAllowed === false) return <main className="guest-entry-page"><div className="panel stack"><h1>Комната не найдена</h1><p className="muted">Такой комнаты не существует. Проверьте ссылку или обратитесь в студию.</p></div></main>;
  if (!confirmedName) return <main className="guest-entry-page"><div className="panel stack guest-name-card"><p className="muted">CastLink · {roomName}</p><h1>Как вас представить в эфире?</h1><input autoFocus placeholder="Например: Алексей" value={guestName} onChange={(e) => setGuestName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && guestName.trim()) setConfirmedName(guestName.trim()); }} /><button disabled={!guestName.trim()} onClick={() => setConfirmedName(guestName.trim())}>Продолжить</button></div></main>;
  if (!choices) return <AvCheck name={confirmedName} onJoin={setChoices} preferredLabels={preferredGuestLabels} initialChoices={pendingGuestChoices} />;
  if (!token) return <main className="guest-entry-page"><div className="panel">Подключение…</div></main>;

  return <main className="media-page guest-room-page guest-app-shell">
    <aside className="guest-sidebar"><div className="studio-brand"><span className="studio-brand-mark">C</span><span><strong>CastLink</strong><small>УЧАСТНИК ЭФИРА</small></span></div>
      <div className="sidebar-room-card"><small>КОМНАТА</small><strong>{roomName}</strong><span className="guest-name-chip"><i />{confirmedName}</span></div>
      <div className="guest-participant-list"><small>В КОМНАТЕ · {remoteList.length + 1}</small><div><span className="participant-dot self" />{confirmedName}<em>Вы</em></div>{remoteList.map(p => <div key={p.identity}><span className="participant-dot" />{p.name || (p.identity.startsWith("studio-panel-") ? "Студия" : p.identity)}</div>)}</div>
      <a href="#guest-settings" className="sidebar-settings-link">Настройки</a>
      <div className="sidebar-footer"><span className="sidebar-avatar">{confirmedName.slice(0, 2).toUpperCase()}</span><span><strong>{confirmedName}</strong><small>Гость комнаты</small></span></div>
    </aside>
    <div className="guest-main-column"><header className="guest-page-header"><div><p className="eyebrow">КОМНАТА В ЭФИРЕ</p><h1>{roomName}</h1></div><div className="guest-identity-pill"><span className="participant-dot self" />{confirmedName}</div></header>
    {transferStatus && <div className="transfer-notice" role="status">{transferStatus}</div>}
    {connectionStatus.phase !== "connected" && <div className={`transfer-notice connection-${connectionStatus.phase}`} role="status"><strong>{recoveryBadge(connectionStatus.phase)}</strong>{connectionStatus.message && <> · {connectionStatus.message}</>}{connectionStatus.phase === "failed" && <button type="button" className="button-secondary" onClick={() => { setConnectionStatus(current => nextRecoveryStatus(current, "connect-start")); setConnectionAttempt(value => value + 1); }}>Повторить подключение</button>}</div>}
    <div className={`guest-conference-shell${selfMonitor.video ? "" : " self-preview-hidden"}`}><div className={`guest-conference-grid${studioOnly ? " studio-only-grid" : ""}`}><RoomContext.Provider value={room}><StartAudio label="Включить звук от студии" className="guest-audio-button" /><RoomConference studioOnly={studioOnly} onLeave={() => { setError("Вы вышли из комнаты."); void room.disconnect(); }} /></RoomContext.Provider></div><button className="settings-gear guest-hover-settings" title="Настройки" aria-label="Настройки" onClick={() => setSettingsOpen((v) => !v)}>⚙</button></div>
    <div className="section-heading guest-settings-heading" id="guest-settings"><div><p className="eyebrow">ЛИЧНЫЕ ПАРАМЕТРЫ</p><h2>Настройки звука и мониторинга</h2></div></div>
    {settingsOpen && <div className="panel in-room-settings"><h3>Аудио</h3><div className="audio-gain-row"><span>Микрофон</span><input type="range" min="0" max="200" value={choices.micGain} onChange={(e) => setChoices({ ...choices, micGain: Number(e.target.value) })} /><strong>{choices.micGain}%</strong></div></div>}
    <div className="panel"><MediaDevicePicker autoRequestPermissions={false} permissionInputs={{ audio: room.localParticipant.isMicrophoneEnabled, video: room.localParticipant.isCameraEnabled }} room={room} cameraId={choices.videoDeviceId} microphoneId={choices.audioDeviceId} headphonesId={choices.audioOutputId || "default"} onChange={change => { setDeviceError(""); setChoices(current => current ? { ...current, ...(change.cameraId !== undefined ? { videoDeviceId: change.cameraId } : {}), ...(change.microphoneId !== undefined ? { audioDeviceId: change.microphoneId } : {}), ...(change.headphonesId !== undefined ? { audioOutputId: change.headphonesId } : {}) } : current); }} />{deviceError && <small className="media-device-error" role="alert">{deviceError}</small>}</div>
    <section className="panel personal-monitor-panel"><h2>Мониторинг у меня</h2><p className="muted">Звук, видео и громкость меняются только для вас. Другие участники и выходы vMix не затрагиваются.</p>
      <div className="personal-monitor-row"><strong>Я · самопрослушивание в наушниках</strong><MonitoringControls name="Я" value={selfMonitor} onChange={(patch) => setSelfMonitor((value) => ({ ...value, ...patch }))} /></div>
      <SelfAudioMonitor room={room} value={studioOnly ? { ...selfMonitor, audio: false } : selfMonitor} />
      {remoteList.length ? remoteList.map((p) => <div className="personal-monitor-row" key={p.identity}>
        <strong>{p.name || (p.identity.startsWith("studio-panel-") ? "Студия" : p.identity)}</strong>
        <MonitoringControls name={p.name || p.identity} value={monitoring.preferences[p.identity]} onChange={(patch) => monitoring.change(p.identity, patch)} />
      </div>) : <p className="muted">Ожидание других участников.</p>}
    </section></div>
    <RoomConnector room={room} token={token} choices={choices} attempt={connectionAttempt} onConnectionStatus={setConnectionStatus} onRemoteChange={setRemoteVersion} onRemoved={setError} onDeviceError={setDeviceError} videoEnabled={monitoring.videoEnabled} />
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

function RoomConnector({ room, token, choices, attempt, onConnectionStatus, onRemoteChange, onRemoved, onDeviceError, videoEnabled }: { room: Room; token: string; choices: GuestChoices; attempt: number; onConnectionStatus: React.Dispatch<React.SetStateAction<RecoveryStatus>>; onRemoteChange: React.Dispatch<React.SetStateAction<number>>; onRemoved: React.Dispatch<React.SetStateAction<string | undefined>>; onDeviceError: React.Dispatch<React.SetStateAction<string>>; videoEnabled: (identity: string) => boolean }) {
  const [connected, setConnected] = useState(false);
  const publishedDevices = useRef({ audio: "", video: "" });
  const videoEnabledRef = useRef(videoEnabled);
  const choicesRef = useRef(choices);
  videoEnabledRef.current = videoEnabled;
  choicesRef.current = choices;

  useEffect(() => {
    const onData = (payload: Uint8Array, participant: unknown, _kind: unknown, topic?: string) => {
      const command = parseGuestMediaCommand(payload, participant, topic);
      if (!command) return;
      const current = choicesRef.current;
      const action = command.source === "microphone"
        ? room.localParticipant.setMicrophoneEnabled(command.enabled, command.enabled && current.audioDeviceId ? { deviceId: current.audioDeviceId } : undefined)
        : room.localParticipant.setCameraEnabled(command.enabled, command.enabled ? {
          ...(current.videoDeviceId ? { deviceId: current.videoDeviceId } : {}),
          resolution: { width: current.height === 1080 ? 1920 : 1280, height: current.height, frameRate: 30 },
        } : undefined);
      void action.then(() => {
        if (command.enabled) publishedDevices.current[command.source === "microphone" ? "audio" : "video"] = command.source === "microphone" ? current.audioDeviceId || "" : current.videoDeviceId || "";
        onDeviceError("");
      }).catch(cause => onDeviceError(`Не удалось выполнить команду студии: ${cause instanceof Error ? cause.message : "ошибка устройства"}`));
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, onDeviceError]);

  useEffect(() => {
    let active = true;
    let recoveredTimer: ReturnType<typeof setTimeout> | undefined;
    onConnectionStatus(current => nextRecoveryStatus(current, "connect-start"));
    const disconnected = (reason?: DisconnectReason) => {
      if (!active) return;
      setConnected(false);
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        onRemoved("Студия отключила вас от комнаты.");
        return;
      }
      onConnectionStatus(current => nextRecoveryStatus(current, "failed", "Соединение завершилось после попыток восстановления. Можно подключиться снова без обновления страницы."));
    };
    const reconnecting = () => {
      if (active) onConnectionStatus(current => nextRecoveryStatus(current, "reconnecting"));
    };
    const reconnected = () => {
      if (!active) return;
      setConnected(true);
      onConnectionStatus(current => nextRecoveryStatus(current, "reconnected"));
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
      void (async () => {
      let mediaConnected = false;
      try {
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        mediaConnected = true;
        if (!active) { await room.disconnect(); return; }
        setConnected(true);
        onConnectionStatus(current => nextRecoveryStatus(current, "connect-success"));
        await room.startAudio().catch(() => undefined);
        stopTelemetry = startRoomTelemetry(room, room.name, token);
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (participant.identity.startsWith("studio-panel-")) forceStudioHigh(publication);
          }
        }
        if (choices.audioEnabled !== false) await room.localParticipant.setMicrophoneEnabled(true, choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : undefined);
        if (!active) return;
        if (choices.videoEnabled !== false) await room.localParticipant.setCameraEnabled(true, { ...(choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : {}), resolution: { width: choices.height === 1080 ? 1920 : 1280, height: choices.height, frameRate: 30 } });
        if (!active) { await room.disconnect(); return; }
        publishedDevices.current = { audio: choices.audioDeviceId || "", video: choices.videoDeviceId || "" };
        const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) || [];
        const cam = devices.find((d) => d.kind === "videoinput" && d.deviceId === choices.videoDeviceId);
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
        console.error(e);
        if (!active) return;
        const message = e instanceof Error ? e.message : "Не удалось подключиться";
        if (!mediaConnected) {
          setConnected(false);
          onConnectionStatus(current => nextRecoveryStatus(current, "failed", message));
        } else onDeviceError(message);
      }
      })();
    }, 0);
    return () => { active = false; window.clearTimeout(connectTimer); if (recoveredTimer) clearTimeout(recoveredTimer); stopVideoRecovery(); room.off(RoomEvent.Disconnected, disconnected); room.off(RoomEvent.Reconnecting, reconnecting); room.off(RoomEvent.Reconnected, reconnected); stopTelemetry?.(); room.off(RoomEvent.TrackPublished, onPublished); room.off(RoomEvent.ParticipantConnected, refreshRemotes); room.off(RoomEvent.ParticipantDisconnected, refreshRemotes); room.off(RoomEvent.TrackSubscribed, refreshRemotes); if (started) void room.disconnect(); };
  }, [room, token, choices.height, attempt, onConnectionStatus, onRemoteChange, onRemoved]);
  useEffect(() => {
    if (!connected || room.state !== "connected") return;
    let active = true;
    const switchInputDevices = async () => {
      try {
        const audio = choices.audioDeviceId || "";
        const video = choices.videoDeviceId || "";
        if (audio !== publishedDevices.current.audio && room.localParticipant.isMicrophoneEnabled) {
          const switched = await room.switchActiveDevice("audioinput", audio || "default");
          if (!switched) throw new Error("Браузер не смог переключить микрофон");
          publishedDevices.current.audio = audio;
        }
        if (video !== publishedDevices.current.video && room.localParticipant.isCameraEnabled) {
          const videoInput = video || (await navigator.mediaDevices.enumerateDevices()).find(device => device.kind === "videoinput")?.deviceId;
          if (!videoInput) throw new Error("Не найдена системная камера");
          const switched = await room.switchActiveDevice("videoinput", videoInput);
          if (!switched) throw new Error("Браузер не смог переключить камеру");
          publishedDevices.current.video = video;
        }
        if (active) onDeviceError("");
      } catch (e) { if (active) onDeviceError(e instanceof Error ? `Не удалось переключить устройство: ${e.message}` : "Не удалось переключить устройство"); }
    };
    void switchInputDevices();
    return () => { active = false; };
  }, [room, connected, choices.audioDeviceId, choices.videoDeviceId, choices.height, onDeviceError]);

  useEffect(() => {
    if (!connected || !navigator.mediaDevices) return;
    let stopped = false;
    let running = false;
    const reconcile = async () => {
      if (running || stopped || room.state !== "connected") return;
      running = true;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const current = choicesRef.current;
        const audioInputs = devices.filter(device => device.kind === "audioinput");
        const videoInputs = devices.filter(device => device.kind === "videoinput");
        const requestedAudio = current.audioDeviceId || "";
        const requestedVideo = current.videoDeviceId || "";
        let message = "";

        if (room.localParticipant.isMicrophoneEnabled && requestedAudio) {
          const requestedExists = audioInputs.some(device => device.deviceId === requestedAudio);
          if (requestedExists && publishedDevices.current.audio !== requestedAudio) {
            if (await room.switchActiveDevice("audioinput", requestedAudio)) publishedDevices.current.audio = requestedAudio;
          } else if (!requestedExists && publishedDevices.current.audio === requestedAudio) {
            const fallback = audioInputs.find(device => device.deviceId !== requestedAudio)?.deviceId || "default";
            if (await room.switchActiveDevice("audioinput", fallback)) {
              publishedDevices.current.audio = fallback;
              message = "Выбранный микрофон отключён. Временно используется системный микрофон.";
            }
          }
        }

        if (room.localParticipant.isCameraEnabled && requestedVideo) {
          const requestedExists = videoInputs.some(device => device.deviceId === requestedVideo);
          if (requestedExists && publishedDevices.current.video !== requestedVideo) {
            if (await room.switchActiveDevice("videoinput", requestedVideo)) publishedDevices.current.video = requestedVideo;
          } else if (!requestedExists && publishedDevices.current.video === requestedVideo) {
            const fallback = videoInputs.find(device => device.deviceId !== requestedVideo)?.deviceId;
            if (fallback && await room.switchActiveDevice("videoinput", fallback)) {
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
  }, [room, connected, onDeviceError]);
  return null;
}

function ProtectedRoom() {
  const params = useSearchParams();
  const [inviteState, setInviteState] = useState({ ready: false, invite: "" });
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragmentInvite = new URLSearchParams(url.hash.slice(1)).get("invite") || "";
    const legacyInvite = params.get("invite") || "";
    setInviteState({ ready: true, invite: fragmentInvite || legacyInvite });
    if (fragmentInvite || legacyInvite) {
      url.hash = "";
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [params]);
  if (!inviteState.ready) return <main><div className="panel">Проверка приглашения…</div></main>;
  const studioId = params.get("studioId") || "studio-default";
  return <GuestAccessGate initialRoom={params.get("name") || ""} studioId={studioId} invite={inviteState.invite} resume={params.get("moved") === "1"}>
    {name => <RoomContent initialRoomName={name} initialStudioId={studioId} key={`${studioId}:${name}`} />}
  </GuestAccessGate>;
}
export default function RoomPage() { return <Suspense fallback={<main><div className="panel">Загрузка комнаты…</div></main>}><ProtectedRoom /></Suspense>; }
