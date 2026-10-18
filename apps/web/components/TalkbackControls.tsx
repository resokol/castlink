"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useVideoRotation } from "@/lib/video-rotation";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack, type LocalVideoTrack, type RemoteParticipant } from "livekit-client";
import { AudioOutputSelect } from "@/components/AudioOutputSelect";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { resolveParticipantRole } from "@/lib/participant-role";
import { TALK_TO_ROOM, talkbackPermissions, type TalkbackTarget } from "@/lib/talkback-policy";
import { bindPrivateTalkbackAudio } from "@/lib/private-talkback-audio";

type ActiveTalk = { room: Room; track: LocalAudioTrack; target: string; refresh: () => void; privateSessionId?: string; disposeAudio?: () => void; heartbeat?: ReturnType<typeof setInterval> };
type TalkbackActions = { connected: boolean; busy: boolean; target: string; activeTarget: string; targets: TalkbackTarget[]; toggleTarget: (identity: string) => Promise<void> };
const TalkbackContext = createContext<TalkbackActions | null>(null);

/** A card action shares the single controller, microphone and private session. */
export function TalkbackTargetButton({ identity, name }: { identity: string; name: string }) {
  const { t } = useI18n();
  const talkback = useContext(TalkbackContext);
  const active = talkback?.activeTarget === identity;
  return <button type="button" className={active ? "talkback-speak" : "button-secondary"} aria-pressed={active} aria-label={active ? `${t("Завершить разговор")} · ${name}` : t("Шепнуть: {name}", { name })} disabled={!talkback?.connected || talkback.busy || !talkback.targets.some(target => target.identity === identity)} onClick={() => { if (talkback) void talkback.toggleTarget(identity); }}>{talkback?.busy && talkback.target === identity ? t("Подключение…") : active ? t("Завершить разговор") : t("Шепнуть")}</button>;
}

/** Confirm actual SDK publication rather than optimistically flipping the UI. */
export async function setPanelCamera(room: Room, enabled: boolean, deviceId: string) {
  if (room.state !== "connected") throw new Error("Нет соединения с комнатой. Повторите подключение.");
  const publication = await room.localParticipant.setCameraEnabled(enabled, enabled && deviceId ? { deviceId: { exact: deviceId } } : undefined);
  if (enabled && (!publication?.track || publication.isMuted || publication.track.mediaStreamTrack.readyState !== "live")) {
    throw new Error("Камера не опубликовалась. Проверьте разрешение браузера и выбранное устройство, затем повторите.");
  }
  if (!enabled && room.localParticipant.isCameraEnabled) throw new Error("Не удалось выключить камеру. Повторите действие.");
}

export function TalkbackControls({ room, roomName, studioId = "studio-default", clientId, connected, allowStaff, visible = true, mediaControls = true, token, compact = false, nameControl, children }: {
  room: Room; roomName: string; studioId?: string; clientId: string; connected: boolean; allowStaff: boolean; visible?: boolean; mediaControls?: boolean; token?: string; compact?: boolean; nameControl?: ReactNode; children?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const [target, setTarget] = useState(TALK_TO_ROOM);
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraFlight = useRef(false);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  useVideoRotation(room, room.localParticipant.identity, cameraPreview);
  const [activeTarget, setActiveTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [targetBusy, setTargetBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const active = useRef<ActiveTalk | undefined>(undefined);
  const pendingRoom = useRef<Room | undefined>(undefined);
  const pendingTrack = useRef<LocalAudioTrack | undefined>(undefined);
  const pendingPrivateSession = useRef("");
  const stopFlight = useRef<Promise<void> | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const targetRef = useRef(target);
  const targetFlight = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  targetRef.current = target;

  const recipients = useMemo<TalkbackTarget[]>(() => {
    return Array.from(room.remoteParticipants.values()).flatMap(participant => {
      if (participant.identity === room.localParticipant.identity) return [];
      if (participant.identity.startsWith("talkback-")) return [];
      const role = resolveParticipantRole(participant);
      if (role !== "guest" && role !== "admin" && role !== "moderator") return [];
      return [{ identity: participant.identity, name: participant.name || participant.identity, role }];
    });
  }, [room, connected, allowStaff, version]);
  const targets = useMemo(() => recipients.filter(item => item.role === "guest"), [recipients]);

  const stop = useCallback(async () => {
    if (stopFlight.current) {
      generation.current++;
      await stopFlight.current;
      return;
    }
    generation.current++;
    const session = active.current;
    const talkRoom = session?.room ?? pendingRoom.current;
    const track = session?.track ?? pendingTrack.current;
    const privateSessionId = session?.privateSessionId || pendingPrivateSession.current;
    pendingPrivateSession.current = "";
    active.current = undefined;
    pendingRoom.current = undefined;
    pendingTrack.current = undefined;
    if (mounted.current) { setActiveTarget(""); if (talkRoom) setBusy(true); }
    if (session) {
      session.disposeAudio?.();
      clearInterval(session.heartbeat);
      talkRoom?.off(RoomEvent.Reconnecting, stopOnReconnect);
      talkRoom?.off(RoomEvent.ParticipantDisconnected, stopOnTargetGone);
      talkRoom?.off(RoomEvent.ParticipantConnected, session.refresh);
      talkRoom?.off(RoomEvent.ParticipantDisconnected, session.refresh);
    }
    track?.mute();
    track?.stop();
    const cleanup: Promise<unknown>[] = [];
    if (talkRoom && track) cleanup.push(talkRoom.localParticipant.unpublishTrack(track, true).catch(() => undefined));
    if (talkRoom) cleanup.push(talkRoom.disconnect().catch(() => undefined));
    if (privateSessionId) cleanup.push(fetch("/api/talkback", { method: "DELETE", headers: { "Content-Type": "application/json", authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ studioId, room: roomName, clientId, sessionId: privateSessionId }), keepalive: true, signal: AbortSignal.timeout(5000) }).catch(() => undefined));
    const finishing = Promise.all(cleanup).then(() => undefined);
    stopFlight.current = finishing;
    await finishing;
    if (stopFlight.current === finishing) stopFlight.current = undefined;
    if (mounted.current && generation.current > 0) setBusy(false);
  }, [studioId, roomName, clientId, token]);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  const stopOnReconnect = useCallback(() => { void stopRef.current(); }, []);
  const stopOnTargetGone = useCallback((participant: RemoteParticipant) => {
    const session = active.current;
    if (session && session.target !== TALK_TO_ROOM && participant.identity === session.target) void stopRef.current();
  }, []);
  const refreshPermissions = useCallback(() => {
    const session = active.current;
    if (!session || session.target !== TALK_TO_ROOM) return;
    try {
      const list = Array.from(session.room.remoteParticipants.values()).flatMap(participant => {
        if (participant.identity === room.localParticipant.identity) return [];
        if (participant.identity === session.room.localParticipant.identity) return [];
        if (participant.identity.startsWith("talkback-")) return [];
        const role = resolveParticipantRole(participant);
        if (role !== "guest" && role !== "admin" && role !== "moderator") return [];
        return [{ identity: participant.identity, name: participant.name || participant.identity, role } as TalkbackTarget];
      });
      session.room.localParticipant.setTrackSubscriptionPermissions(false, talkbackPermissions(TALK_TO_ROOM, list));
    } catch { void stopRef.current(); }
  }, [room]);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices?.enumerateDevices().catch(() => []) || [];
    setDevices(all.filter(device => device.kind === "audioinput" || device.kind === "videoinput"));
  }, []);

  useEffect(() => {
    mounted.current = true;
    const changed = () => { void refreshDevices(); setVersion(value => value + 1); };
    void refreshDevices();
    // Initial/reconnected snapshots do not emit ParticipantConnected for every existing person.
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged];
    events.forEach(event => room.on(event, changed));
    room.on(RoomEvent.ParticipantDisconnected, stopOnTargetGone);
    return () => { mounted.current = false; events.forEach(event => room.off(event, changed)); room.off(RoomEvent.ParticipantDisconnected, stopOnTargetGone); void stopRef.current(); };
  }, [room, refreshDevices, stopOnTargetGone]);

  useEffect(() => {
    if (!connected || room.state !== "connected") {
      void stopRef.current();
      setCameraEnabled(false);
      return;
    }
    const blur = () => { void stopRef.current(); };
    window.addEventListener("blur", blur);
    const visibility = () => { if (document.visibilityState === "hidden") void stopRef.current(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); };
  }, [connected, room]);

  const changeTarget = (next: string) => {
    if (next !== target) void stopRef.current();
    setTarget(next);
    setError("");
  };

  const start = async () => {
    if (!connected || !clientId || busy || active.current) return;
    const ticket = ++generation.current;
    const stillCurrent = () => mounted.current && generation.current === ticket && connected && room.state === "connected";
    const ensureCurrent = () => { if (!stillCurrent()) throw new Error("Голосовая связь отменена"); };
    setBusy(true); setError("");
    let talkRoom: Room | undefined;
    let track: LocalAudioTrack | undefined;
    let createdPrivateSessionId = "";
    try {
      const selectedTarget = targetRef.current;
      const chosenTargets = selectedTarget === TALK_TO_ROOM ? talkbackPermissions(selectedTarget, recipients) : talkbackPermissions(selectedTarget, targets);
      if (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget)) throw new Error("Выбранный участник уже отключился");
      const privateTalk = selectedTarget !== TALK_TO_ROOM;
      if (privateTalk && !token) throw new Error("Нужен доступ персонала");
      const params = new URLSearchParams({ studioId, room: roomName, role: "talkback", clientId });
      const response = privateTalk ? await fetch("/api/talkback", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ studioId, room: roomName, clientId, target: selectedTarget }), cache: "no-store" }) : await fetch(`/api/token?${params}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (privateTalk && typeof result.sessionId === "string") {
        createdPrivateSessionId = result.sessionId;
        if (stillCurrent()) pendingPrivateSession.current = result.sessionId;
      }
      ensureCurrent();
      if (!response.ok || typeof result.token !== "string") throw new Error(result.error || "Не удалось получить доступ для голосовой связи");
      talkRoom = new Room({ adaptiveStream: false, dynacast: false });
      pendingRoom.current = talkRoom;
      await talkRoom.connect(getLiveKitUrl(), result.token, { autoSubscribe: privateTalk });
      ensureCurrent();
      if (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget)) throw new Error("Выбранный участник уже отключился");
      if (!privateTalk) talkRoom.localParticipant.setTrackSubscriptionPermissions(false, chosenTargets);
      track = await createLocalAudioTrack(microphoneId ? { deviceId: { exact: microphoneId } } : {});
      pendingTrack.current = track;
      ensureCurrent();
      const session: ActiveTalk = { room: talkRoom, track, target: selectedTarget, refresh: refreshPermissions, ...(privateTalk ? { privateSessionId: result.sessionId, disposeAudio: bindPrivateTalkbackAudio(talkRoom, room) } : {}) };
      active.current = session;
      talkRoom.on(RoomEvent.Reconnecting, stopOnReconnect);
      talkRoom.on(RoomEvent.ParticipantDisconnected, stopOnTargetGone);
      talkRoom.on(RoomEvent.ParticipantConnected, refreshPermissions);
      talkRoom.on(RoomEvent.ParticipantDisconnected, refreshPermissions);
      if (privateTalk) {
        const output = room.getActiveDevice("audiooutput");
        if (output) await talkRoom.switchActiveDevice("audiooutput", output);
        session.heartbeat = setInterval(() => {
          void fetch("/api/talkback", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ action: "heartbeat", studioId, room: roomName, clientId, sessionId: result.sessionId }), signal: AbortSignal.timeout(5000) }).then(response => { if (!response.ok) void stopRef.current(); }).catch(() => { void stopRef.current(); });
        }, 15000);
        talkRoom.once(RoomEvent.Disconnected, () => { if (active.current?.room === talkRoom) void stopRef.current(); });
      }
      if (targetRef.current !== selectedTarget || (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget))) throw new Error("Выбранный участник изменился");
      ensureCurrent();
      await talkRoom.localParticipant.publishTrack(track, { source: Track.Source.Microphone, name: "Приватная голосовая связь", dtx: true });
      ensureCurrent();
      pendingRoom.current = undefined;
      pendingTrack.current = undefined;
      pendingPrivateSession.current = "";
      setActiveTarget(selectedTarget);
      await refreshDevices();
    } catch (cause) {
      const failedSession = active.current?.room === talkRoom ? active.current : undefined;
      track?.mute(); track?.stop();
      failedSession?.disposeAudio?.();
      clearInterval(failedSession?.heartbeat);
      const privateSessionId = failedSession?.privateSessionId || createdPrivateSessionId;
      if (pendingPrivateSession.current === privateSessionId) pendingPrivateSession.current = "";
      if (privateSessionId) await fetch("/api/talkback", { method: "DELETE", headers: { "Content-Type": "application/json", authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ studioId, room: roomName, clientId, sessionId: privateSessionId }), signal: AbortSignal.timeout(5000) }).catch(() => undefined);
      if (generation.current === ticket) {
        active.current = undefined;
        pendingTrack.current = undefined;
        pendingRoom.current = undefined;
        track?.mute(); track?.stop();
        if (talkRoom) await talkRoom.disconnect().catch(() => undefined);
        if (mounted.current) { setActiveTarget(""); setError(cause instanceof Error ? cause.message : "Не удалось начать голосовую связь"); }
      } else {
        track?.mute(); track?.stop();
        if (talkRoom) await talkRoom.disconnect().catch(() => undefined);
      }
    } finally { if (mounted.current && generation.current === ticket) setBusy(false); }
  };

  const toggleTarget = async (next: string) => {
    if (!connected || busy || targetFlight.current) return;
    targetFlight.current = true;
    setTargetBusy(true);
    try {
      const ending = active.current?.target === next;
      const stopGeneration = generation.current + 1;
      await stopRef.current();
      if (ending || !mounted.current || !visibleRef.current || generation.current !== stopGeneration) return;
      targetRef.current = next;
      setTarget(next);
      await start();
    } finally { targetFlight.current = false; if (mounted.current) setTargetBusy(false); }
  };

  useEffect(() => {
    if (!mediaControls) return;
    const element = cameraPreview.current;
    let attached: LocalVideoTrack | undefined;
    const update = () => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track as LocalVideoTrack | undefined;
      const enabled = !!track && !publication?.isMuted && track.mediaStreamTrack.readyState === "live";
      setCameraEnabled(enabled);
      if (attached !== track || !enabled) {
        if (element && attached) attached.detach(element);
        attached = undefined;
        if (element) element.srcObject = null;
      }
      if (element && enabled && track && attached !== track) { track.attach(element); attached = track; }
    };
    const events = [RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Disconnected, RoomEvent.Reconnected];
    events.forEach(event => room.on(event, update)); update();
    return () => { events.forEach(event => room.off(event, update)); if (element && attached) attached.detach(element); if (element) element.srcObject = null; };
  }, [room, cameraEnabled, connected, mediaControls]);

  useEffect(() => { if (!visible) void stopRef.current(); }, [visible]);

  const toggleCamera = async () => {
    if (!connected || cameraFlight.current) return;
    cameraFlight.current = true; setCameraBusy(true); setError("");
    try {
      await setPanelCamera(room, !room.localParticipant.isCameraEnabled, cameraId);
      if (mounted.current) setCameraEnabled(room.localParticipant.isCameraEnabled);
      await refreshDevices();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Не удалось изменить камеру");
    } finally { cameraFlight.current = false; if (mounted.current) setCameraBusy(false); }
  };

  const inputBusy = busy || targetBusy;
  const microphoneControl = <label>{t("Микрофон")}<select aria-label={t("Микрофон голосовой связи")} disabled={!connected || inputBusy || !!activeTarget} value={microphoneId} onChange={event => setMicrophoneId(event.target.value)}><option value="">{t("Системный микрофон")}</option>{devices.filter(device => device.kind === "audioinput").map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || t("Микрофон")}</option>)}</select></label>;
  const cameraControls = mediaControls && <><label>{t("Камера")}<select aria-label={t("Камера панели")} disabled={!connected || cameraBusy || cameraEnabled} value={cameraId} onChange={event => setCameraId(event.target.value)}><option value="">{t("Системная камера")}</option>{devices.filter(device => device.kind === "videoinput").map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || t("Камера")}</option>)}</select></label><button type="button" className="button-secondary" disabled={!connected || cameraBusy} aria-pressed={cameraEnabled} onClick={() => void toggleCamera()}>{cameraBusy ? t("Переключаем камеру…") : cameraEnabled ? t("Выключить камеру в комнате") : t("Включить камеру в комнате")}</button>
    <ScreenShareButton room={room} compact={compact} />
    <div className="staff-panel-camera-preview" style={{ gridColumn: "1 / -1" }} hidden={!cameraEnabled}>
      <video ref={cameraPreview} autoPlay muted playsInline aria-label={t("Моя камера в комнате")} style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", objectFit: "contain", borderRadius: 9, background: "#101116" }} />
      <p className="muted" role="status">{t("Камера включена и опубликована в комнате. Здесь показан ваш предпросмотр.")}</p>
    </div></>;

  return <TalkbackContext.Provider value={{ connected, busy: inputBusy, target, activeTarget, targets, toggleTarget }}>
    <section className={compact ? "staff-participant-toolbar" : "panel talkback-controls"} hidden={!visible} style={visible ? undefined : { display: "none" }}>
    {compact ? <><div className="staff-participant-devices">{nameControl}{microphoneControl}<AudioOutputSelect room={room} /></div><div className="staff-participant-media">{cameraControls}<button type="button" className={activeTarget === TALK_TO_ROOM ? "talkback-speak" : "button-secondary"} disabled={!connected || inputBusy} aria-pressed={activeTarget === TALK_TO_ROOM} onClick={() => void toggleTarget(TALK_TO_ROOM)}>{inputBusy && target === TALK_TO_ROOM ? t("Подключение…") : activeTarget === TALK_TO_ROOM ? t("Завершить разговор") : t("Говорить всем")}</button></div></> : <>
    <div><h3>{t("Голосовая связь")}</h3><p className="muted">{t("Микрофон передаёт звук только выбранным участникам. Камера публикуется отдельно в комнате.")}</p></div>
    <label>{t("Кому говорить")}<select aria-label={t("Кому говорить")} disabled={!connected || busy || !!activeTarget} value={target} onChange={event => changeTarget(event.target.value)}>
      <option value={TALK_TO_ROOM}>{t("Всем в комнате")}</option>
      {targets.map(item => <option key={item.identity} value={item.identity}>{item.name || item.identity} · {item.role === "guest" ? t("гость") : item.role === "admin" ? t("администратор") : t("модератор")}</option>)}
    </select></label>
    {microphoneControl}
    <button type="button" className={activeTarget ? "talkback-speak" : undefined} disabled={!connected || busy || (!activeTarget && target !== TALK_TO_ROOM && !room.remoteParticipants.has(target))} aria-pressed={!!activeTarget} onClick={() => activeTarget ? void stop() : void start()}>{busy ? t("Подключение…") : activeTarget ? t("Завершить разговор") : target === TALK_TO_ROOM ? t("Говорить всем") : t("Говорить приватно")}</button>
    {cameraControls}
    <AudioOutputSelect room={room} /></>}
    {activeTarget && <p role="status">{activeTarget === TALK_TO_ROOM ? t("Вы говорите участникам комнаты.") : t("Приватный разговор: {value0}.", { value0: targets.find(item => item.identity === activeTarget)?.name || activeTarget })}</p>}
    {error && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
  </section>{children}</TalkbackContext.Provider>;
}
