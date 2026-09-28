"use client";
import { useRef, useState } from "react";
import { Track } from "livekit-client";
import { useVideoRotation } from "@/lib/video-rotation";
import { useRoomContext, useEnsureTrackRef, type ParticipantTileProps, useTracks, TrackLoop, GridLayout, ParticipantTile, RoomAudioRenderer, ControlBar, LayoutContextProvider, useCreateLayoutContext, usePinnedTracks, Chat, FocusLayoutContainer, CarouselLayout } from "@livekit/components-react";
function RotatedParticipantTile(props: ParticipantTileProps) {
  const room = useRoomContext(), track = useEnsureTrackRef(props.trackRef);
  const ref = useRef<HTMLDivElement>(null);
  useVideoRotation(track.source === Track.Source.Camera ? room : undefined, track.participant.identity, ref);
  return <ParticipantTile {...props} ref={ref} />;
}

export function RoomConference({ studioOnly, onLeave, readOnly = false }: { studioOnly: boolean; onLeave: () => void; readOnly?: boolean }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const visible = tracks.filter(t => studioOnly ? t.participant.identity.startsWith("studio-panel-") : t.participant.isLocal || t.participant.identity.startsWith("guest-") || t.participant.identity.startsWith("studio-panel-") || t.participant.identity.startsWith("studio-moderator-"));
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);
  const focused = usePinnedTracks(layout)?.[0];
  const focus = focused && visible.find(track => track.participant.identity === focused.participant.identity && track.source === focused.source);
  return <div className="lk-video-conference" data-lk-theme="default">
    <LayoutContextProvider value={layout} onWidgetChange={state => setShowChat(state.showChat)}>
      <div className="lk-video-conference-inner">
        {studioOnly && <div className="studio-only-notice" role="status">Студия включила только свой просмотр</div>}
        {visible.length ? focus ? <div className="lk-focus-layout-wrapper"><FocusLayoutContainer><CarouselLayout tracks={visible.filter(track => track !== focus)}><RotatedParticipantTile /></CarouselLayout><div className="lk-focus-layout"><RotatedParticipantTile trackRef={focus} /></div></FocusLayoutContainer></div> : readOnly ? <div className="lk-grid-layout-wrapper"><GridLayout tracks={visible}><RotatedParticipantTile /></GridLayout></div> : <div className="lk-scroll-layout-wrapper"><div className="lk-scroll-layout"><TrackLoop tracks={visible}><RotatedParticipantTile /></TrackLoop></div></div> : <p className="panel">Ожидание эфира студии…</p>}
        <ControlBar controls={{ leave: false, camera: !readOnly, microphone: !readOnly, chat: !studioOnly, screenShare: !readOnly }} />
        {!readOnly && <p className="screen-share-hint">Кнопка показа экрана позволяет выбрать экран или окно приложения. Чтобы передать звук, включите его в диалоге браузера, если такая настройка доступна.</p>}
        <button className="room-leave-button" onClick={onLeave}>Выйти из комнаты</button>
      </div>
      {!studioOnly && <Chat style={{ display: showChat ? "grid" : "none" }} />}
    </LayoutContextProvider>
    <RoomAudioRenderer />
  </div>;
}
