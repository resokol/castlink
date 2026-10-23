"use client";

import { CoPresentationNavigationProvider, useCoPresentationNavigation } from './CoPresentationNavigation';
import { presentationImageContains, presentationInputDirection, presentationInteractiveSelector } from '@/lib/co-presentation-navigation';
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { exitCssFullscreen, toggleElementFullscreen } from "@/lib/fullscreen";
import { watchFullscreenChrome } from "@/lib/fullscreen-chrome";
import { ConferenceScene, type ConferenceSceneItem } from "@/components/ConferenceScene";
import { useRemotePc } from '@/lib/use-remote-pc';
import { useRemotePcTile } from '@/lib/use-remote-pc-tile';
import { remotePcHumanTracks } from '@/lib/remote-pc-sources';
import { Track } from "livekit-client";
import { isVerifiedTalkback } from "@/lib/talkback-policy";
import { useVideoRotation } from "@/lib/video-rotation";
import { ScreenShareButton } from "@/components/ScreenShareButton";
import { GuestCameraButton } from "@/components/GuestCameraButton";
import { RoomReactions } from "@/components/RoomReactions";
import { RoomChat } from "@/components/RoomChat";
import type { RoomChatSession } from "@/lib/use-persistent-room-chat";
import { useRoomContext, useEnsureTrackRef, type ParticipantTileProps, useTracks, ParticipantTile, AudioTrack, ControlBar, ChatToggle, LayoutContextProvider, useCreateLayoutContext, usePinnedTracks } from "@livekit/components-react";
function RotatedParticipantTile(props: ParticipantTileProps & {displayName?:string}) {
  const { t, locale } = useI18n();
  const room = useRoomContext(), track = useEnsureTrackRef(props.trackRef);
  const ref = useRef<HTMLDivElement>(null);
  useVideoRotation(track.source === Track.Source.Camera ? room : undefined, track.participant.identity, ref);
  const shell = useRef<HTMLDivElement>(null);
  const [remoteText,setRemoteText]=useState(''),[remoteTextError,setRemoteTextError]=useState(false);
  const remoteInput = useRemotePcTile(room,shell,track);
  const navigation = useCoPresentationNavigation();
  const grant = track.source === Track.Source.ScreenShare
    ? navigation?.grants.find(item => item.ownerIdentity === track.participant.identity && item.ownerSid === track.participant.sid && item.trackSid === track.publication?.trackSid) : undefined;
  const input = (event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const element = shell.current, target = event.target as Element;
    if (remoteInput.available || !element || !grant?.ready || !element.contains(target) || !track.publication?.track || track.publication.isMuted || track.publication.track.mediaStreamTrack.readyState !== 'live') return;
    const video = element.querySelector('video');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight || video.paused || video.ended) return;
    const click = event.type === 'click';
    // A portal, menu, camera or participant decoration is not the presentation.
    const interactive = !!target.closest(presentationInteractiveSelector) || click && target !== video;
    if (click && !interactive) element.focus({preventScroll:true});
    const direction = presentationInputDirection({ focused: document.activeElement === element, visible: document.visibilityState === 'visible', interactive, type: click ? 'click' : 'keydown', altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, key: 'key' in event ? event.key : undefined, repeat: 'repeat' in event ? event.repeat : false, button: 'button' in event ? event.button : undefined, detail: 'detail' in event ? event.detail : undefined });
    if (!direction) return;
    if (click && 'clientX' in event && !presentationImageContains(video.getBoundingClientRect(),video.videoWidth,video.videoHeight,event.clientX,event.clientY,getComputedStyle(video).objectFit)) return;
    event.preventDefault(); event.stopPropagation(); grant.navigate(direction);
  };
  useEffect(() => {
    const element = shell.current;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && element) exitCssFullscreen(element); };
    const stopChrome = element ? watchFullscreenChrome(element) : undefined;
    document.addEventListener("keydown", escape);
    return () => { stopChrome?.(); document.removeEventListener("keydown", escape); if (element) exitCssFullscreen(element); };
  }, []);
  return <div className="castlink-tile-shell" tabIndex={grant || remoteInput.available ? 0 : undefined} aria-label={grant ? (locale === 'ru' ? 'Презентация: стрелки влево/вправо, щелчок — вперёд' : locale === 'en' ? 'Presentation: left/right arrows, click for next' : '演示：左右方向键，点击下一页') : undefined} onKeyDown={input} onClick={input} data-remote-pc-alias={!!props.displayName || undefined} data-presentation-controls={!!grant || undefined} data-local-camera={track.participant.isLocal && track.source === Track.Source.Camera || undefined} ref={shell}>
    <ParticipantTile {...props} ref={ref} />
    {props.displayName && <span className="remote-pc-owner-label">{props.displayName}</span>}
    {remoteInput.available && <span className="remote-pc-input-status" role="status">{locale==='ru'?(remoteInput.paused||!remoteInput.active?'Ввод приостановлен':remoteInput.focused?'Вы управляете ПК':'Нажмите на видео для управления ПК'):locale==='en'?(remoteInput.paused||!remoteInput.active?'Input paused':remoteInput.focused?'You control this PC':'Click the video to control this PC'):(remoteInput.paused||!remoteInput.active?'输入已暂停':remoteInput.focused?'您正在控制电脑':'点击视频以控制电脑')}</span>}
    {remoteInput.available && <details className="remote-pc-commands"><summary>{locale==='ru'?'Ввод ПК':locale==='en'?'PC input':'电脑输入'}</summary><div>
      <button type="button" className="button-secondary" onClick={()=>remoteInput.userPaused?remoteInput.resume():remoteInput.stop()}>{locale==='ru'?(remoteInput.userPaused?'Возобновить управление':'Прекратить управление'):locale==='en'?(remoteInput.userPaused?'Resume control':'Stop controlling'):(remoteInput.userPaused?'恢复控制':'停止控制')}</button>
      <form onSubmit={event=>{event.preventDefault();setRemoteTextError(false);void remoteInput.text(remoteText)?.then(()=>setRemoteText('')).catch(()=>setRemoteTextError(true));}}>
        <label>{locale==='ru'?'Отправить текст на ПК':locale==='en'?'Send text to PC':'向电脑发送文本'}<textarea value={remoteText} maxLength={256} onChange={event=>setRemoteText(event.target.value)} /></label><button type="submit" className="button-secondary" disabled={!remoteInput.active||!remoteText}>{locale==='ru'?'Отправить':locale==='en'?'Send':'发送'}</button>
      </form><button type="button" className="button-secondary" disabled={!remoteInput.active} onClick={()=>void remoteInput.chord(['AltLeft','Tab'])?.catch(()=>setRemoteTextError(true))}>Alt+Tab</button><button type="button" className="button-secondary" disabled={!remoteInput.active} onClick={()=>void remoteInput.chord(['MetaLeft','KeyD'])?.catch(()=>setRemoteTextError(true))}>Win+D</button>
      {remoteTextError&&<small role="alert">{locale==='ru'?'Отпустите клавиши и повторите действие.':locale==='en'?'Release held keys and retry.':'请松开按键后重试。'}</small>}
    </div></details>}
    <button type="button" className="castlink-tile-fullscreen" title={t("На весь экран / свернуть")} aria-label={t("На весь экран: {value0}", { value0: track.participant.name || "Участник" })} onClick={event => { event.stopPropagation(); if (shell.current) void toggleElementFullscreen(shell.current); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  </div>;
}

/** Filter before AudioTrack creates any playback element; monitoring owns subscriptions. */
export function ConferenceAudioRenderer({ studioOnly, noGuestAudio = false }: { studioOnly: boolean; noGuestAudio?: boolean }) {
  const tracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown], { onlySubscribed: true });
  const room=useRoomContext(),remotePc=useRemotePc(room);
  const audible = remotePcHumanTracks(room,tracks,remotePc.sources).filter(({trackRef:track,owner}) => !owner.isLocal && track.publication?.kind === Track.Kind.Audio &&
    (!studioOnly || owner.identity.startsWith("studio-panel-") || isVerifiedTalkback(track.participant)) &&
    (!noGuestAudio || !owner.identity.startsWith("guest-")));
  return <div style={{ display: "none" }}>{audible.map(({trackRef}) => <AudioTrack key={`${trackRef.participant.identity}:${trackRef.publication.trackSid}`} trackRef={trackRef} />)}</div>;
}

function RoomConferenceContent({ chatSession, studioOnly, onLeave, readOnly = false, microphoneControl, cameraControl, controlsDisabled = false, noGuestAudio = false, showLeaveButton = true, workspaceLayout = false, extraControls, settingsControl, transportControl, selfPreviewVisible = true, onToggleSelfPreview }: { selfPreviewVisible?: boolean; onToggleSelfPreview?: () => void; workspaceLayout?: boolean; transportControl?: ReactNode; extraControls?: ReactNode; settingsControl?: ReactNode; chatSession?: RoomChatSession; showLeaveButton?: boolean; noGuestAudio?: boolean; studioOnly: boolean; onLeave: () => void; readOnly?: boolean; microphoneControl?: ReactNode; cameraControl?: ReactNode; controlsDisabled?: boolean }) {
  const { t, locale } = useI18n();
  const room = useRoomContext();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const remotePc=useRemotePc(room);
  const visible = remotePcHumanTracks(room,tracks,remotePc.sources).filter(({trackRef:t,owner}) => studioOnly ? owner.identity.startsWith("studio-panel-") || workspaceLayout && owner.isLocal && t.source === Track.Source.Camera : owner.isLocal || owner.identity.startsWith("guest-") || owner.identity.startsWith("studio-panel-") || owner.identity.startsWith("studio-moderator-"));
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [compactControls,setCompactControls] = useState(false), [moreOpen,setMoreOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width:700px), (max-height:600px) and (orientation:landscape)');
    const update = () => setCompactControls(query.matches); update();
    query.addEventListener('change',update); return () => query.removeEventListener('change',update);
  }, []);
  const focused = usePinnedTracks(layout)?.[0];
  const displayTracks = visible;
  const items: ConferenceSceneItem[] = displayTracks.map(({trackRef:track,owner}) => ({
    id: `${owner.identity}:${owner.sid}:${track.source}`,
    identity: owner.identity,
    kind: track.source === Track.Source.ScreenShare ? 'screen' : 'camera',
    node: <RotatedParticipantTile trackRef={track} displayName={owner!==track.participant ? owner.name||owner.identity : undefined} />,
    secondaryOnly: workspaceLayout && studioOnly && track.participant.isLocal && track.source === Track.Source.Camera,
    hidden: workspaceLayout && track.participant.isLocal && track.source === Track.Source.Camera && !selfPreviewVisible,
  }));
  const focusedOwner = focused ? remotePcHumanTracks(room,[focused],remotePc.sources)[0]?.owner : undefined;
  const pinnedId = focused ? items.find(item => item.identity === focusedOwner?.identity && item.kind === (focused.source === Track.Source.ScreenShare ? 'screen' : 'camera'))?.id : undefined;
  const galleryCount = items.filter(item => !item.hidden && !item.secondaryOnly).length;
  const shareActions = <div className="conference-more-actions" data-open={moreOpen} onKeyDown={event => { if (event.key === "Escape" && moreOpen) { setMoreOpen(false); event.currentTarget.querySelector<HTMLButtonElement>(".conference-more-toggle")?.focus(); } }}><button type="button" className="conference-more-toggle" aria-expanded={compactControls && moreOpen} aria-label={t("Дополнительные действия")} title={t("Дополнительные действия")} onClick={() => setMoreOpen(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button><div>
    {!readOnly && <ScreenShareButton room={room} toolbar />}{!readOnly && transportControl}
    {workspaceLayout && onToggleSelfPreview && <button type="button" className="guest-self-preview-toggle button-secondary" aria-pressed={selfPreviewVisible} aria-label={t(selfPreviewVisible ? "Скрыть свой предпросмотр" : "Показать свой предпросмотр")} title={t("Предпросмотр только для вас")} onClick={onToggleSelfPreview}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />{!selfPreviewVisible && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.7" />}</svg><span>{t(selfPreviewVisible ? "Скрыть свой предпросмотр" : "Показать свой предпросмотр")}</span></button>}
  </div></div>;
  const transport = <div className="guest-control-row">
    {!readOnly && microphoneControl}{!readOnly && (cameraControl || <GuestCameraButton onError={setDeviceError} disabled={controlsDisabled} />)}
    {!readOnly && !microphoneControl && <ControlBar controls={{ leave:false,camera:false,microphone:true,chat:false,screenShare:false }} />}
    {!studioOnly && <ChatToggle className="castlink-chat-toggle" title={t("Открыть чат")} aria-label={t("Чат")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg><span>{t("Чат")}</span></ChatToggle>}
    {!readOnly && <RoomReactions room={room} />}
    {shareActions}
  </div>;

  const footer = <footer className="castlink-conference-footer">
        {workspaceLayout ? <div className="caster-toolbar-main">{transport}{extraControls && <div className="caster-extra-controls">{extraControls}</div>}</div> : transport}
        {settingsControl && <div className="caster-settings-slot">{settingsControl}</div>}
        {deviceError && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, deviceError)}</p>}
        {!readOnly && !workspaceLayout && <p className="screen-share-hint">{t("Кнопка показа экрана позволяет выбрать экран или окно приложения. Чтобы передать звук, включите его в диалоге браузера, если такая настройка доступна.")}</p>}
        </footer>;
  return <div className={workspaceLayout ? "lk-video-conference caster-conference" : "lk-video-conference"} data-workspace-chat={workspaceLayout ? !studioOnly && showChat : undefined} data-lk-theme="default" data-studio-only={studioOnly || undefined} data-self-preview={selfPreviewVisible} data-single-participant={galleryCount === 1} data-track-count={galleryCount}>
    <LayoutContextProvider value={layout} onWidgetChange={state => setShowChat(state.showChat)}>
      <div className="lk-video-conference-inner">
        {studioOnly && <div className="studio-only-notice" role="status">{t("Студия включила только свой просмотр")}</div>}
        {workspaceLayout && studioOnly && galleryCount === 0 && visible.length > 0 && <p className="conference-waiting" role="status">{t("Ожидание эфира студии…")}</p>}
        <ConferenceScene items={items} room={room} pinnedId={pinnedId} />
        {!workspaceLayout && footer}
        {showLeaveButton && <button className="room-leave-button" onClick={onLeave}>{t("Выйти из комнаты")}</button>}
      </div>
      {!studioOnly && <RoomChat visible={showChat} persistent={false} session={chatSession} />}
      {workspaceLayout && footer}
    </LayoutContextProvider>
    <ConferenceAudioRenderer studioOnly={studioOnly} noGuestAudio={noGuestAudio} />
  </div>;
}

/** The provider changes control authority without remounting any media tile. */
export function RoomConference(props: React.ComponentProps<typeof RoomConferenceContent>) {
  return <CoPresentationNavigationProvider><RoomConferenceContent {...props} /></CoPresentationNavigationProvider>;
}
