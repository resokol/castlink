"use client";

import { GuestAccessGate } from "@/components/GuestAccessGate";
import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { useRoomMode } from "@/lib/room-mode";
import { watchStudioVideo } from "@/lib/studio-video-recovery";
import { MAX_GUEST_VIDEO_BITRATE } from "@/lib/video-quality";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { usePersonalMonitoring, type MonitorPreference } from "@/lib/personal-monitoring";
import { MonitoringControls } from "@/components/MonitoringControls";
import { startRoomTelemetry } from "@/lib/rtc-telemetry";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StartAudio, VideoConference, RoomContext, useTracks, GridLayout, ParticipantTile, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
import { DisconnectReason, Room, RoomEvent, Track, VideoQuality, type RemoteTrackPublication } from "livekit-client";

function slugifyName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

function AvCheck({ name, onJoin }: { name: string; onJoin: (v: { audioDeviceId?: string; videoDeviceId?: string; audioOutputId?: string; height: 720 | 1080; micGain: number; listenGain: number }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioOutputId, setAudioOutputId] = useState("default");
  const height: 720 | 1080 = 720;
  const [level, setLevel] = useState(0);
  const [micGain, setMicGain] = useState(100);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!window.isSecureContext) {
          setError("Для камеры и микрофона откройте ссылку на комнату через HTTPS.");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Браузер не предоставляет доступ к камере и микрофону. Откройте комнату в актуальном Chrome, Firefox или Safari и проверьте разрешения сайта.");
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        await audioContextRef.current?.close().catch(() => undefined);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: { ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}), width: { ideal: 1280 }, height: { ideal: height }, frameRate: { ideal: 30 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
        const a = stream.getAudioTracks()[0]?.getSettings().deviceId || "";
        const v = stream.getVideoTracks()[0]?.getSettings().deviceId || "";
        if (!audioDeviceId && a) setAudioDeviceId(a);
        if (!videoDeviceId && v) setVideoDeviceId(v);
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(100, Math.round(avg * 1.4)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
        setError("");
      } catch (e) { setError(e instanceof Error ? e.message : "Не удалось открыть камеру/микрофон"); }
    };
    void start();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); if (rafRef.current) cancelAnimationFrame(rafRef.current); void audioContextRef.current?.close().catch(() => undefined); };
  }, [audioDeviceId, videoDeviceId, height]);

  const audioDevices = devices.filter((d) => d.kind === "audioinput");
  const videoDevices = devices.filter((d) => d.kind === "videoinput");

  return <main className="media-page"><div className="panel av-check">
    <div><p className="muted">StudioLink · проверка перед эфиром</p><h1>{name}</h1></div>
    <video ref={videoRef} muted playsInline className="av-preview" />
    <MediaDevicePicker cameraId={videoDeviceId} microphoneId={audioDeviceId} headphonesId={audioOutputId} onChange={change => {
      if (change.cameraId !== undefined) setVideoDeviceId(change.cameraId);
      if (change.microphoneId !== undefined) setAudioDeviceId(change.microphoneId);
      if (change.headphonesId !== undefined) setAudioOutputId(change.headphonesId);
    }} />
    <div className="audio-gain-row"><span>Микрофон</span><div className="gain-meter"><div className="gain-signal" style={{ width: `${Math.min(100, level * micGain / 100)}%` }} /><input aria-label="Уровень микрофона" type="range" min="0" max="200" value={micGain} onChange={(e) => setMicGain(Number(e.target.value))} /></div><strong>{micGain}%</strong></div>
    {error && <div className="av-error">{error}</div>}
    <button className="button-primary" disabled={!!error} onClick={() => onJoin({ audioDeviceId, videoDeviceId, audioOutputId, height, micGain, listenGain: 100 })}>Войти в конференцию</button>
  </div></main>;
}

function GuestConference({ studioOnly, onLeave }: { studioOnly: boolean; onLeave: () => void }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const visible = tracks.filter(t => studioOnly ? t.participant.identity.startsWith("studio-panel-") : t.participant.isLocal || t.participant.identity.startsWith("guest-") || t.participant.identity.startsWith("studio-panel-"));
  if (!studioOnly) return <VideoConference />;
  return <div className="lk-video-conference">
    {visible.length ? <GridLayout tracks={visible}><ParticipantTile /></GridLayout> : <p className="panel">Ожидание эфира студии…</p>}
    <RoomAudioRenderer />
    <ControlBar controls={{ leave: false, chat: false, screenShare: false }} />
    <button onClick={onLeave}>Выйти из комнаты</button>
  </div>;
}

function RoomContent({ initialRoomName }: { initialRoomName: string }) {
  const params = useSearchParams();
  const [roomName, setRoomName] = useState(initialRoomName);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [roomAllowed, setRoomAllowed] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<{ audioDeviceId?: string; videoDeviceId?: string; audioOutputId?: string; height: 720 | 1080; micGain: number; listenGain: number }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  useEffect(() => {
    fetch("/api/rooms?name=" + encodeURIComponent(initialRoomName), { cache: "no-store" }).then((r) => r.json()).then((d) => setRoomAllowed(!!d.exists)).catch(() => setRoomAllowed(false));
  }, [initialRoomName]);
  useEffect(() => {
    if (params.get("moved") !== "1") return;
    try {
      const saved = sessionStorage.getItem("studiolink-guest-session");
      if (saved) {
        const state = JSON.parse(saved);
        if (state.name) { setGuestName(state.name); setConfirmedName(state.name); }
        if (state.choices) setChoices(state.choices);
      }
    } catch {}
  }, [params]);
  const fallbackId = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const identity = confirmedName ? `guest-${slugifyName(confirmedName) || fallbackId}` : "";
  const [room] = useState(() => new Room({ adaptiveStream: false, dynacast: true, publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: MAX_GUEST_VIDEO_BITRATE, maxFramerate: 30 }, degradationPreference: "maintain-resolution" } }));
  const { studioOnly } = useRoomMode(roomName);
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
    if (!identity || roomAllowed !== true) return;
    fetch(`/api/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(confirmedName)}&role=guest`)
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }).then((d) => setToken(d.token)).catch((e) => setError(e.message));
  }, [roomName, identity, confirmedName, roomAllowed]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (!identity || !confirmedName || !token) return;
      try {
        const r = await fetch(`/api/guest-command?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
        if (r.ok) {
          const data = await r.json();
          if (data?.targetRoom && data.targetRoom !== roomName) {
            try { sessionStorage.setItem("studiolink-guest-session", JSON.stringify({ name: confirmedName, choices })); } catch {}
            window.location.href = `/room?name=${encodeURIComponent(data.targetRoom)}&moved=1`;
            return;
          }
        }
      } catch {}
      if (!stopped) setTimeout(poll, 1000);
    };
    void poll();
    return () => { stopped = true; };
  }, [roomName, identity, confirmedName, choices, token]);

  void remoteVersion;
  const remoteList = monitoring.participants.filter((p) => (!studioOnly || p.identity.startsWith("studio-panel-")) && (p.identity.startsWith("guest-") || p.identity.startsWith("studio-panel-") || p.trackPublications.size > 0));

  if (error) return <main><div className="panel stack"><p>{error}</p><button onClick={() => window.location.reload()}>Войти снова</button></div></main>;
  if (roomAllowed === null) return <main><div className="panel">Проверка комнаты…</div></main>;
  if (roomAllowed === false) return <main><div className="panel stack"><h1>Комната не найдена</h1><p className="muted">Такой комнаты не существует. Проверьте ссылку или обратитесь в студию.</p></div></main>;
  if (!confirmedName) return <main><div className="panel stack guest-name-card"><p className="muted">StudioLink · {roomName}</p><h1>Как вас представить в эфире?</h1><input autoFocus placeholder="Например: Алексей" value={guestName} onChange={(e) => setGuestName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && guestName.trim()) setConfirmedName(guestName.trim()); }} /><button disabled={!guestName.trim()} onClick={() => setConfirmedName(guestName.trim())}>Продолжить</button></div></main>;
  if (!choices) return <AvCheck name={confirmedName} onJoin={setChoices} />;
  if (!token) return <main><div className="panel">Подключение…</div></main>;

  return <main className="media-page guest-room-page"><h1>{roomName}</h1><div className="panel room-info"><div><strong>Гость:</strong> {confirmedName}<small className="quality-state">Камера: {choices.height}p</small></div></div>
    <div className={`guest-conference-shell${selfMonitor.video ? "" : " self-preview-hidden"}`}><div className={`guest-conference-grid${studioOnly ? " studio-only-grid" : ""}`}><RoomContext.Provider value={room}><StartAudio label="Включить звук от студии" className="guest-audio-button" /><GuestConference studioOnly={studioOnly} onLeave={() => { setError("Вы вышли из комнаты."); void room.disconnect(); }} /></RoomContext.Provider></div><button className="settings-gear guest-hover-settings" title="Настройки" aria-label="Настройки" onClick={() => setSettingsOpen((v) => !v)}>⚙</button></div>
    {settingsOpen && <div className="panel in-room-settings"><h3>Аудио</h3><div className="audio-gain-row"><span>Микрофон</span><input type="range" min="0" max="200" value={choices.micGain} onChange={(e) => setChoices({ ...choices, micGain: Number(e.target.value) })} /><strong>{choices.micGain}%</strong></div></div>}
    <div className="panel"><MediaDevicePicker headphonesId={choices.audioOutputId || "default"} onChange={change => { if (change.headphonesId !== undefined) setChoices({ ...choices, audioOutputId: change.headphonesId }); }} />{studioOnly && <p>Студия включила режим «Только студия»: вы получаете только её звук и видео.</p>}</div>
    <section className="panel personal-monitor-panel"><h2>Мониторинг у меня</h2><p className="muted">Звук, видео и громкость меняются только для вас. Другие участники и выходы vMix не затрагиваются.</p>
      <div className="personal-monitor-row"><strong>Я · самопрослушивание в наушниках</strong><MonitoringControls name="Я" value={selfMonitor} onChange={(patch) => setSelfMonitor((value) => ({ ...value, ...patch }))} /></div>
      <SelfAudioMonitor room={room} value={studioOnly ? { ...selfMonitor, audio: false } : selfMonitor} />
      {remoteList.length ? remoteList.map((p) => <div className="personal-monitor-row" key={p.identity}>
        <strong>{p.name || (p.identity.startsWith("studio-panel-") ? "Студия" : p.identity)}</strong>
        <MonitoringControls name={p.name || p.identity} value={monitoring.preferences[p.identity]} onChange={(patch) => monitoring.change(p.identity, patch)} />
      </div>) : <p className="muted">Ожидание других участников.</p>}
    </section>
    <RoomConnector room={room} token={token} choices={choices} onRemoteChange={setRemoteVersion} onRemoved={setError} videoEnabled={monitoring.videoEnabled} />
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

function RoomConnector({ room, token, choices, onRemoteChange, onRemoved, videoEnabled }: { room: Room; token: string; choices: { audioDeviceId?: string; videoDeviceId?: string; audioOutputId?: string; height: 720 | 1080; micGain: number; listenGain: number }; onRemoteChange: React.Dispatch<React.SetStateAction<number>>; onRemoved: React.Dispatch<React.SetStateAction<string | undefined>>; videoEnabled: (identity: string) => boolean }) {
  useEffect(() => {
    let active = true;
    const disconnected = (reason?: DisconnectReason) => {
      if (active && reason === DisconnectReason.PARTICIPANT_REMOVED) onRemoved("Студия отключила вас от комнаты. Чтобы войти снова, обновите страницу.");
      else if (active) onRemoved("Соединение с комнатой завершено. Обновите страницу, чтобы войти снова.");
    };
    room.on(RoomEvent.Disconnected, disconnected);
    let stopTelemetry: (() => void) | undefined;
    const stopVideoRecovery = watchStudioVideo(room, videoEnabled);
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
    (async () => {
      try {
        await room.connect(getLiveKitUrl(), token, { autoSubscribe: false });
        if (!active) return;
        await room.startAudio().catch(() => undefined);
        stopTelemetry = startRoomTelemetry(room, room.name, token);
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (participant.identity.startsWith("studio-panel-")) forceStudioHigh(publication);
          }
        }
        await room.localParticipant.setMicrophoneEnabled(true, choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : undefined);
        await room.localParticipant.setCameraEnabled(true, { ...(choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : {}), resolution: { width: choices.height === 1080 ? 1920 : 1280, height: choices.height, frameRate: 30 } });
        const devices = await navigator.mediaDevices.enumerateDevices();
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
        const info = {
          type: "guest-client-info",
          camera: cam?.label || "Неизвестная камера",
          cpu: `${navigator.hardwareConcurrency || "?"} логических потоков (модель скрыта браузером)`,
          gpu,
          platform: navigator.platform || "—",
          sampleRate: micSettings?.sampleRate || new AudioContext().sampleRate
        };
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(info)), { reliable: true, topic: "studiolink-client-info" });
      } catch (e) { console.error(e); }
    })();
    return () => { active = false; stopVideoRecovery(); room.off(RoomEvent.Disconnected, disconnected); stopTelemetry?.(); room.off(RoomEvent.TrackPublished, onPublished); room.off(RoomEvent.ParticipantConnected, refreshRemotes); room.off(RoomEvent.ParticipantDisconnected, refreshRemotes); room.off(RoomEvent.TrackSubscribed, refreshRemotes); void room.disconnect(); };
  }, [room, token, choices.audioDeviceId, choices.videoDeviceId, choices.height, onRemoteChange, onRemoved, videoEnabled]);
  return null;
}

function ProtectedRoom() {
  const params = useSearchParams();
  return <GuestAccessGate initialRoom={params.get("name") || ""} invite={params.get("invite") || ""} resume={params.get("moved") === "1"}>
    {name => <RoomContent initialRoomName={name} key={name} />}
  </GuestAccessGate>;
}
export default function RoomPage() { return <Suspense fallback={<main><div className="panel">Загрузка комнаты…</div></main>}><ProtectedRoom /></Suspense>; }
