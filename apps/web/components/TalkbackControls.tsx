"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useVideoRotation } from "@/lib/video-rotation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack, type LocalVideoTrack, type RemoteParticipant } from "livekit-client";
import { AudioOutputSelect } from "@/components/AudioOutputSelect";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { resolveParticipantRole } from "@/lib/participant-role";
import { TALK_TO_ROOM, talkbackPermissions, type TalkbackTarget } from "@/lib/talkback-policy";

type ActiveTalk = { room: Room; track: LocalAudioTrack; target: string; refresh: () => void };

/** Confirm actual SDK publication rather than optimistically flipping the UI. */
export async function setPanelCamera(room: Room, enabled: boolean, deviceId: string) {
  if (room.state !== "connected") throw new Error("Нет соединения с комнатой. Повторите подключение.");
  const publication = await room.localParticipant.setCameraEnabled(enabled, enabled && deviceId ? { deviceId: { exact: deviceId } } : undefined);
  if (enabled && (!publication?.track || publication.isMuted || publication.track.mediaStreamTrack.readyState !== "live")) {
    throw new Error("Камера не опубликовалась. Проверьте разрешение браузера и выбранное устройство, затем повторите.");
  }
  if (!enabled && room.localParticipant.isCameraEnabled) throw new Error("Не удалось выключить камеру. Повторите действие.");
}

export function TalkbackControls({ room, roomName, studioId = "studio-default", clientId, connected, allowStaff, visible = true }: {
  room: Room; roomName: string; studioId?: string; clientId: string; connected: boolean; allowStaff: boolean; visible?: boolean;
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
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const active = useRef<ActiveTalk | undefined>(undefined);
  const pendingRoom = useRef<Room | undefined>(undefined);
  const pendingTrack = useRef<LocalAudioTrack | undefined>(undefined);
  const stopFlight = useRef<Promise<void> | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const targetRef = useRef(target);
  targetRef.current = target;

  const recipients = useMemo<TalkbackTarget[]>(() => {
    return Array.from(room.remoteParticipants.values()).flatMap(participant => {
      if (participant.identity === room.localParticipant.identity) return [];
      if (participant.identity.startsWith("talkback-")) return [];
      const role = resolveParticipantRole(participant);
      if (role !== "guest" && role !== "admin" && role !== "moderator") return [];
      return [{ identity: participant.identity, name: participant.name || participant.identity, role }];
    });
  }, [room, allowStaff, version]);
  const targets = useMemo(() => recipients.filter(item => item.role === "guest" || allowStaff), [recipients, allowStaff]);

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
    active.current = undefined;
    pendingRoom.current = undefined;
    pendingTrack.current = undefined;
    if (mounted.current) { setActiveTarget(""); if (talkRoom) setBusy(true); }
    if (session) {
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
    const finishing = Promise.all(cleanup).then(() => undefined);
    stopFlight.current = finishing;
    await finishing;
    if (stopFlight.current === finishing) stopFlight.current = undefined;
    if (mounted.current && generation.current > 0) setBusy(false);
  }, []);

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
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged];
    events.forEach(event => room.on(event, changed));
    return () => { mounted.current = false; events.forEach(event => room.off(event, changed)); void stopRef.current(); };
  }, [room, refreshDevices]);

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
    try {
      const selectedTarget = targetRef.current;
      const chosenTargets = selectedTarget === TALK_TO_ROOM ? talkbackPermissions(selectedTarget, recipients) : talkbackPermissions(selectedTarget, targets);
      if (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget)) throw new Error("Выбранный участник уже отключился");
      const params = new URLSearchParams({ studioId, room: roomName, role: "talkback", clientId });
      const response = await fetch(`/api/token?${params}`, { cache: "no-store" });
      ensureCurrent();
      const result = await response.json().catch(() => ({}));
      ensureCurrent();
      if (!response.ok || typeof result.token !== "string") throw new Error(result.error || "Не удалось получить доступ для голосовой связи");
      talkRoom = new Room({ adaptiveStream: false, dynacast: false });
      pendingRoom.current = talkRoom;
      await talkRoom.connect(getLiveKitUrl(), result.token, { autoSubscribe: false });
      ensureCurrent();
      if (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget)) throw new Error("Выбранный участник уже отключился");
      talkRoom.localParticipant.setTrackSubscriptionPermissions(false, chosenTargets);
      track = await createLocalAudioTrack(microphoneId ? { deviceId: { exact: microphoneId } } : {});
      pendingTrack.current = track;
      ensureCurrent();
      const session: ActiveTalk = { room: talkRoom, track, target: selectedTarget, refresh: refreshPermissions };
      active.current = session;
      talkRoom.on(RoomEvent.Reconnecting, stopOnReconnect);
      talkRoom.on(RoomEvent.ParticipantDisconnected, stopOnTargetGone);
      talkRoom.on(RoomEvent.ParticipantConnected, refreshPermissions);
      talkRoom.on(RoomEvent.ParticipantDisconnected, refreshPermissions);
      if (targetRef.current !== selectedTarget || (selectedTarget !== TALK_TO_ROOM && !room.remoteParticipants.has(selectedTarget))) throw new Error("Выбранный участник изменился");
      ensureCurrent();
      await talkRoom.localParticipant.publishTrack(track, { source: Track.Source.Microphone, name: "Приватная голосовая связь", dtx: true });
      ensureCurrent();
      pendingRoom.current = undefined;
      pendingTrack.current = undefined;
      setActiveTarget(selectedTarget);
      await refreshDevices();
    } catch (cause) {
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

  useEffect(() => {
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
  }, [room, cameraEnabled, connected]);

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

  return <section className="panel talkback-controls" hidden={!visible} style={visible ? undefined : { display: "none" }}>
    <div><h3>{t("Голосовая связь")}</h3><p className="muted">{t("Микрофон передаёт звук только выбранным участникам. Камера публикуется отдельно в комнате.")}</p></div>
    <label>{t("Кому говорить")}<select aria-label={t("Кому говорить")} disabled={!connected || busy || !!activeTarget} value={target} onChange={event => changeTarget(event.target.value)}>
      <option value={TALK_TO_ROOM}>{t("Всем в комнате")}</option>
      {targets.map(item => <option key={item.identity} value={item.identity}>{item.name || item.identity} · {item.role === "guest" ? t("гость") : item.role === "admin" ? t("администратор") : t("модератор")}</option>)}
    </select></label>
    <label>{t("Микрофон")}<select aria-label={t("Микрофон голосовой связи")} disabled={!connected || busy || !!activeTarget} value={microphoneId} onChange={event => setMicrophoneId(event.target.value)}><option value="">{t("Системный микрофон")}</option>{devices.filter(device => device.kind === "audioinput").map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || t("Микрофон")}</option>)}</select></label>
    <button type="button" className={activeTarget ? "talkback-speak" : undefined} disabled={!connected || busy || (!activeTarget && target !== TALK_TO_ROOM && !room.remoteParticipants.has(target))} aria-pressed={!!activeTarget} onClick={() => activeTarget ? void stop() : void start()}>{busy ? t("Подключение…") : activeTarget ? t("Завершить разговор") : target === TALK_TO_ROOM ? t("Говорить всем") : t("Говорить приватно")}</button>
    <label>{t("Камера")}<select aria-label={t("Камера панели")} disabled={!connected || cameraBusy || cameraEnabled} value={cameraId} onChange={event => setCameraId(event.target.value)}><option value="">{t("Системная камера")}</option>{devices.filter(device => device.kind === "videoinput").map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || t("Камера")}</option>)}</select></label><button type="button" className="button-secondary" disabled={!connected || cameraBusy} aria-pressed={cameraEnabled} onClick={() => void toggleCamera()}>{cameraBusy ? t("Переключаем камеру…") : cameraEnabled ? t("Выключить камеру в комнате") : t("Включить камеру в комнате")}</button>
    <ScreenShareButton room={room} />
    <div style={{ gridColumn: "1 / -1" }} hidden={!cameraEnabled}>
      <video ref={cameraPreview} autoPlay muted playsInline aria-label={t("Моя камера в комнате")} style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", objectFit: "contain", borderRadius: 9, background: "#101116" }} />
      <p className="muted" role="status">{t("Камера включена и опубликована в комнате. Здесь показан ваш предпросмотр.")}</p>
    </div>
    <AudioOutputSelect room={room} />
    {activeTarget && <p role="status">{activeTarget === TALK_TO_ROOM ? t("Вы говорите участникам комнаты.") : t("Приватный разговор: {value0}.", { value0: targets.find(item => item.identity === activeTarget)?.name || activeTarget })}</p>}
    {error && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
  </section>;
}
