"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { exitCssFullscreen, toggleElementFullscreen } from "@/lib/fullscreen";
import { Track } from "livekit-client";
import { useVideoRotation } from "@/lib/video-rotation";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { GuestCameraButton } from "@/components/GuestCameraButton";
import { RoomChat } from "@/components/RoomChat";
import { useRoomContext, useEnsureTrackRef, type ParticipantTileProps, useTracks, TrackLoop, GridLayout, ParticipantTile, RoomAudioRenderer, ControlBar, ChatToggle, LayoutContextProvider, useCreateLayoutContext, usePinnedTracks, FocusLayoutContainer, CarouselLayout } from "@livekit/components-react";
function RotatedParticipantTile(props: ParticipantTileProps) {
  const room = useRoomContext(), track = useEnsureTrackRef(props.trackRef);
  const ref = useRef<HTMLDivElement>(null);
  useVideoRotation(track.source === Track.Source.Camera ? room : undefined, track.participant.identity, ref);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = shell.current;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && element) exitCssFullscreen(element); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); if (element) exitCssFullscreen(element); };
  }, []);
  return <div className="castlink-tile-shell" ref={shell}>
    <ParticipantTile {...props} ref={ref} />
    <button type="button" className="castlink-tile-fullscreen" title="На весь экран / свернуть" aria-label={`На весь экран: ${track.participant.name || "Участник"}`} onClick={event => { event.stopPropagation(); if (shell.current) void toggleElementFullscreen(shell.current); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  </div>;
}

export function RoomConference({ studioOnly, onLeave, readOnly = false, microphoneControl, controlsDisabled = false }: { studioOnly: boolean; onLeave: () => void; readOnly?: boolean; microphoneControl?: ReactNode; controlsDisabled?: boolean }) {
  const room = useRoomContext();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const visible = tracks.filter(t => studioOnly ? t.participant.identity.startsWith("studio-panel-") : t.participant.isLocal || t.participant.identity.startsWith("guest-") || t.participant.identity.startsWith("studio-panel-") || t.participant.identity.startsWith("studio-moderator-"));
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const focused = usePinnedTracks(layout)?.[0];
  const focus = focused && visible.find(track => track.participant.identity === focused.participant.identity && track.source === focused.source);
  const mobileColumns = visible.length < 2 ? 1 : visible.length <= 6 ? 2 : visible.length <= 12 ? 3 : 4;
  const mobileStyle = { "--conference-mobile-columns": mobileColumns, "--conference-mobile-rows": Math.max(1, Math.ceil(visible.length / mobileColumns)) } as CSSProperties;
  return <div className="lk-video-conference" style={mobileStyle} data-lk-theme="default" data-single-participant={visible.length === 1} data-track-count={visible.length}>
    <LayoutContextProvider value={layout} onWidgetChange={state => setShowChat(state.showChat)}>
      <div className="lk-video-conference-inner">
        {studioOnly && <div className="studio-only-notice" role="status">Студия включила только свой просмотр</div>}
        {visible.length ? focus ? <div className="lk-focus-layout-wrapper"><FocusLayoutContainer><CarouselLayout tracks={visible.filter(track => track !== focus)}><RotatedParticipantTile /></CarouselLayout><div className="lk-focus-layout"><RotatedParticipantTile trackRef={focus} /></div></FocusLayoutContainer></div> : readOnly ? <div className="lk-grid-layout-wrapper"><GridLayout tracks={visible}><RotatedParticipantTile /></GridLayout></div> : <div className="lk-scroll-layout-wrapper"><div className="lk-scroll-layout"><TrackLoop tracks={visible}><RotatedParticipantTile /></TrackLoop></div></div> : <p className="panel">Ожидание эфира студии…</p>}
        <footer className="castlink-conference-footer">
        <div className="guest-control-row">{!readOnly && microphoneControl}{!readOnly && <GuestCameraButton onError={setDeviceError} disabled={controlsDisabled} />}{!readOnly && !microphoneControl && <ControlBar controls={{ leave: false, camera: false, microphone: true, chat: false, screenShare: false }} />}{!readOnly && <ScreenShareButton room={room} toolbar />}{!studioOnly && <ChatToggle className="castlink-chat-toggle" title="Открыть чат" aria-label="Чат"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg><span>Чат</span></ChatToggle>}</div>
        {deviceError && <p className="media-device-error" role="alert">{deviceError}</p>}
        {!readOnly && <p className="screen-share-hint">Кнопка показа экрана позволяет выбрать экран или окно приложения. Чтобы передать звук, включите его в диалоге браузера, если такая настройка доступна.</p>}
        </footer>
        <button className="room-leave-button" onClick={onLeave}>Выйти из комнаты</button>
      </div>
      {!studioOnly && <RoomChat visible={showChat} />}
    </LayoutContextProvider>
    <RoomAudioRenderer />
  </div>;
}
