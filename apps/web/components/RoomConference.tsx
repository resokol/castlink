"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { exitCssFullscreen, toggleElementFullscreen } from "@/lib/fullscreen";
import { watchFullscreenChrome } from "@/lib/fullscreen-chrome";
import { conferenceGalleryLayout } from "@/lib/conference-gallery-layout";
import { Track } from "livekit-client";
import { isVerifiedTalkback } from "@/lib/talkback-policy";
import { useVideoRotation } from "@/lib/video-rotation";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { GuestCameraButton } from "@/components/GuestCameraButton";
import { RoomChat } from "@/components/RoomChat";
import type { RoomChatSession } from "@/lib/use-persistent-room-chat";
import { useRoomContext, useEnsureTrackRef, type ParticipantTileProps, useTracks, TrackLoop, GridLayout, ParticipantTile, AudioTrack, ControlBar, ChatToggle, LayoutContextProvider, useCreateLayoutContext, usePinnedTracks, FocusLayoutContainer, CarouselLayout } from "@livekit/components-react";
function RotatedParticipantTile(props: ParticipantTileProps) {
  const { t, locale } = useI18n();
  const room = useRoomContext(), track = useEnsureTrackRef(props.trackRef);
  const ref = useRef<HTMLDivElement>(null);
  useVideoRotation(track.source === Track.Source.Camera ? room : undefined, track.participant.identity, ref);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = shell.current;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && element) exitCssFullscreen(element); };
    const stopChrome = element ? watchFullscreenChrome(element) : undefined;
    document.addEventListener("keydown", escape);
    return () => { stopChrome?.(); document.removeEventListener("keydown", escape); if (element) exitCssFullscreen(element); };
  }, []);
  return <div className="castlink-tile-shell" data-local-camera={track.participant.isLocal && track.source === Track.Source.Camera || undefined} ref={shell}>
    <ParticipantTile {...props} ref={ref} />
    <button type="button" className="castlink-tile-fullscreen" title={t("На весь экран / свернуть")} aria-label={t("На весь экран: {value0}", { value0: track.participant.name || "Участник" })} onClick={event => { event.stopPropagation(); if (shell.current) void toggleElementFullscreen(shell.current); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  </div>;
}

/** Filter before AudioTrack creates any playback element; monitoring owns subscriptions. */
export function ConferenceAudioRenderer({ studioOnly, noGuestAudio = false }: { studioOnly: boolean; noGuestAudio?: boolean }) {
  const tracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown], { onlySubscribed: true });
  const audible = tracks.filter(track => !track.participant.isLocal && track.publication?.kind === Track.Kind.Audio &&
    (!studioOnly || track.participant.identity.startsWith("studio-panel-") || isVerifiedTalkback(track.participant)) &&
    (!noGuestAudio || !track.participant.identity.startsWith("guest-")));
  return <div style={{ display: "none" }}>{audible.map(trackRef => <AudioTrack key={`${trackRef.participant.identity}:${trackRef.publication.trackSid}`} trackRef={trackRef} />)}</div>;
}

export function RoomConference({ chatSession, studioOnly, onLeave, readOnly = false, microphoneControl, cameraControl, controlsDisabled = false, noGuestAudio = false, showLeaveButton = true, workspaceLayout = false, extraControls, settingsControl, transportControl, selfPreviewVisible = true, onToggleSelfPreview }: { selfPreviewVisible?: boolean; onToggleSelfPreview?: () => void; workspaceLayout?: boolean; transportControl?: ReactNode; extraControls?: ReactNode; settingsControl?: ReactNode; chatSession?: RoomChatSession; showLeaveButton?: boolean; noGuestAudio?: boolean; studioOnly: boolean; onLeave: () => void; readOnly?: boolean; microphoneControl?: ReactNode; cameraControl?: ReactNode; controlsDisabled?: boolean }) {
  const { t, locale } = useI18n();
  const room = useRoomContext();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const visible = tracks.filter(t => studioOnly ? t.participant.identity.startsWith("studio-panel-") || workspaceLayout && t.participant.isLocal && t.source === Track.Source.Camera : t.participant.isLocal || t.participant.identity.startsWith("guest-") || t.participant.identity.startsWith("studio-panel-") || t.participant.identity.startsWith("studio-moderator-"));
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(workspaceLayout);
  useEffect(() => { if (workspaceLayout) layout.widget.dispatch?.({ msg: "show_chat" }); }, [workspaceLayout, layout.widget.dispatch]);
  const [deviceError, setDeviceError] = useState("");
  const focused = usePinnedTracks(layout)?.[0];
  const focus = focused && visible.find(track => track.participant.identity === focused.participant.identity && track.source === focused.source && !(workspaceLayout && track.participant.isLocal && track.source === Track.Source.Camera && (!selfPreviewVisible || studioOnly)));
  const galleryCount = visible.filter(track => !track.participant.isLocal || track.source !== Track.Source.Camera || !studioOnly && selfPreviewVisible).length;
  const mobileColumns = galleryCount < 2 ? 1 : galleryCount <= 6 ? 2 : galleryCount <= 12 ? 3 : 4;
  const fallbackColumns = galleryCount <= 1 ? 1 : galleryCount <= 4 ? 2 : galleryCount <= 9 ? 3 : Math.ceil(Math.sqrt(galleryCount));
  const stage = useRef<HTMLDivElement>(null);
  const [measuredLayout, setMeasuredLayout] = useState<{ columns: number; rows: number }>();
  useEffect(() => {
    const element = stage.current;
    if (!workspaceLayout || !element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const next = conferenceGalleryLayout(galleryCount, width, height);
      setMeasuredLayout(current => current?.columns === next.columns && current.rows === next.rows ? current : next);
    };
    const observer = new ResizeObserver(update); observer.observe(element); update();
    return () => observer.disconnect();
  }, [workspaceLayout, galleryCount, !!focus]);
  const fitColumns = measuredLayout?.columns ?? fallbackColumns;
  const conferenceStyle = {
    "--conference-mobile-columns": mobileColumns,
    "--conference-mobile-rows": Math.max(1, Math.ceil(galleryCount / mobileColumns)),
    ...(workspaceLayout ? { "--conference-fit-columns": fitColumns, "--conference-fit-rows": Math.max(1, Math.ceil(galleryCount / fitColumns)) } : {}),
  } as CSSProperties;
  const transport = <div className="guest-control-row">{!readOnly && microphoneControl}{!readOnly && (cameraControl || <GuestCameraButton onError={setDeviceError} disabled={controlsDisabled} />)}{!readOnly && !microphoneControl && <ControlBar controls={{ leave: false, camera: false, microphone: true, chat: false, screenShare: false }} />}{!readOnly && <ScreenShareButton room={room} toolbar />}{!readOnly && transportControl}{workspaceLayout && onToggleSelfPreview && <button type="button" className="guest-self-preview-toggle button-secondary" aria-pressed={selfPreviewVisible} title={t("Предпросмотр только для вас")} onClick={onToggleSelfPreview}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />{!selfPreviewVisible && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.7" />}</svg><span>{t(selfPreviewVisible ? "Скрыть свой предпросмотр" : "Показать свой предпросмотр")}</span></button>}{!studioOnly && !workspaceLayout && <ChatToggle className="castlink-chat-toggle" title={t("Открыть чат")} aria-label={t("Чат")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg><span>{t("Чат")}</span></ChatToggle>}</div>;
  const footer = <footer className="castlink-conference-footer">
        {workspaceLayout ? <div className="caster-toolbar-main">{transport}{extraControls && <div className="caster-extra-controls">{extraControls}</div>}</div> : transport}
        {settingsControl && <div className="caster-settings-slot">{settingsControl}</div>}
        {deviceError && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, deviceError)}</p>}
        {!readOnly && <p className="screen-share-hint">{t("Кнопка показа экрана позволяет выбрать экран или окно приложения. Чтобы передать звук, включите его в диалоге браузера, если такая настройка доступна.")}</p>}
        </footer>;
  return <div className={workspaceLayout ? "lk-video-conference caster-conference" : "lk-video-conference"} data-workspace-chat={workspaceLayout ? !studioOnly : undefined} style={conferenceStyle} data-lk-theme="default" data-studio-only={studioOnly || undefined} data-self-preview={selfPreviewVisible} data-single-participant={galleryCount === 1} data-track-count={galleryCount}>
    <LayoutContextProvider value={layout} onWidgetChange={state => setShowChat(state.showChat)}>
      <div className="lk-video-conference-inner">
        {studioOnly && <div className="studio-only-notice" role="status">{t("Студия включила только свой просмотр")}</div>}
        {workspaceLayout && studioOnly && galleryCount === 0 && visible.length > 0 && <p className="conference-waiting" role="status">{t("Ожидание эфира студии…")}</p>}
        {visible.length ? focus ? <div className="lk-focus-layout-wrapper"><FocusLayoutContainer><CarouselLayout tracks={visible.filter(track => track !== focus)}><RotatedParticipantTile /></CarouselLayout><div className="lk-focus-layout"><RotatedParticipantTile trackRef={focus} /></div></FocusLayoutContainer></div> : readOnly ? <div className="lk-grid-layout-wrapper"><GridLayout tracks={visible}><RotatedParticipantTile /></GridLayout></div> : <div className="lk-scroll-layout-wrapper" ref={stage}><div className="lk-scroll-layout"><TrackLoop tracks={visible}><RotatedParticipantTile /></TrackLoop></div></div> : <p className="panel">{t("Ожидание эфира студии…")}</p>}
        {!workspaceLayout && footer}
        {showLeaveButton && <button className="room-leave-button" onClick={onLeave}>{t("Выйти из комнаты")}</button>}
      </div>
      {!studioOnly && <RoomChat visible={workspaceLayout || showChat} persistent={workspaceLayout} session={chatSession} />}
      {workspaceLayout && footer}
    </LayoutContextProvider>
    <ConferenceAudioRenderer studioOnly={studioOnly} noGuestAudio={noGuestAudio} />
  </div>;
}
