"use client";

import { useRemotePc } from '@/lib/use-remote-pc';
import { beginRemotePc, remotePcRequest } from '@/lib/remote-pc-client';
import { resolveRemotePcScreen } from '@/lib/remote-pc-sources';
import type { RemotePcSession } from '@/lib/remote-pc-protocol';
import { RemotePcControls } from './RemotePcControls';
import { ScreenShareSetup } from './ScreenShareSetup';
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useId, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { ScreenShareIcon } from "@livekit/components-react";
import { enableRoomScreenShare, enableStudioScreenShare, setRoomScreenShareOutputMuted, stopStudioScreenShare } from "@/lib/screen-share";
import { createScreenShareStopPanel, documentPictureInPictureApi, type ScreenShareStopPanel, type ScreenShareStopPanelState } from "@/lib/screen-share-stop-panel";
import { useCoPresentationNavigation, ownerSurfaceMatches } from './CoPresentationNavigation';
import { isCoPresentationTrack } from "@/lib/co-presentation-client";
import { requestCoPresentationMenu } from "@/lib/co-presentation-menu";
import { createDesktopStopPanel, desktopScreenBridge } from "@/lib/desktop-stop-panel";

function hasLiveScreenShare(room: Room) {
  const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  return room.state === "connected" && !!publication?.track && !publication.isMuted && publication.track.mediaStreamTrack.readyState === "live";
}

export function ScreenShareButton({ room, compact = false, toolbar = false, outputMuted, getOutputMuted }: { room: Room; compact?: boolean; toolbar?: boolean; outputMuted?: boolean; getOutputMuted?: () => boolean }) {
  const { t, locale } = useI18n();
  const remotePc = useRemotePc(room);
  const remoteSession = remotePc.sessions.find(session => session.owner.identity === room.localParticipant.identity && session.owner.sid === room.localParticipant.sid && session.phase !== 'stopped');
  const remoteSharing = !!remoteSession?.source && !!resolveRemotePcScreen(room,room.localParticipant.identity,remotePc.sources);
  const [remoteMode,setRemoteMode]=useState(false),[viewOnly,setViewOnly]=useState(false),[pendingRemote,setPendingRemote]=useState<{ticket:string;ticketExpiresAt:number;sessionId:string;session:RemotePcSession}>();
  const remoteSessionRef=useRef(remoteSession);remoteSessionRef.current=remoteSession;
  const navigation = useCoPresentationNavigation(), ownerSurface = useRef(navigation?.ownerSurface); ownerSurface.current = navigation?.ownerSurface;
  const stopCovered = ownerSurfaceMatches(navigation?.ownerSurface,room.localParticipant.sid,room.localParticipant.getTrackPublication(Track.Source.ScreenShare));
  const controlsId = useId(), controls = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const copy = locale === "en" ? { title: "Screen sharing", manage: "Screen sharing controls", owner: "You control", close: "Close controls", sharing: "Sharing is on", idle: "Sharing has not started", scope: "Your mouse and keyboard stay under your control. Browsers cannot give another participant control of your computer. Use Co-presentation to share slide controls." }
    : locale === "zh-CN" ? { title: "屏幕共享", manage: "屏幕共享控制", owner: "由您控制", close: "关闭控制", sharing: "正在共享", idle: "尚未开始共享", scope: "鼠标和键盘仍由您控制。浏览器无法将您的电脑控制权交给其他参与者。请使用协同演示授予幻灯片控制权。" }
    : { title: "Демонстрация экрана", manage: "Управление демонстрацией экрана", owner: "Вы управляете", close: "Закрыть управление", sharing: "Демонстрация включена", idle: "Показ не запущен", scope: "Мышь и клавиатура остаются у вас. Браузер не передаёт управление компьютером другому участнику. Для переключения слайдов используйте совместную презентацию." };
  const [sharing, setSharing] = useState(false);
  const activeSharing = remoteSharing || sharing;
  const [canvasSharing, setCanvasSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setupRequested,setSetupRequested]=useState(false);
  const setupPending=remoteMode&&!viewOnly&&!remoteSharing&&!!(setupRequested||pendingRemote||remoteSession||error);
  const [connected, setConnected] = useState(room.state === "connected");
  const [supported, setSupported] = useState<boolean | null>(null);
  const getMuted = useRef(getOutputMuted); getMuted.current = getOutputMuted;
  const mounted = useRef(false);
  const generation = useRef(0);
  const flight = useRef(false);
  const currentRoom = useRef(room); currentRoom.current = room;
  const stopPanel = useRef<ScreenShareStopPanel | undefined>(undefined);
  const refreshSharing = useRef<() => void>(() => {});
  const [panelSupported, setPanelSupported] = useState(false);
  const [panelState, setPanelState] = useState<ScreenShareStopPanelState>("closed");
  const [panelOpenError, setPanelOpenError] = useState(false);
  const panelLabels = () => ({ locale, title: t("Панель остановки демонстрации"), stop: t("ОСТАНОВИТЬ ДЕМОНСТРАЦИЮ"), stopping: t("Останавливаем…"), stopError: t("Не удалось остановить демонстрацию. Повторите попытку.") });

  const stopCapture = async () => { if (getMuted.current) await stopStudioScreenShare(room); else await room.localParticipant.setScreenShareEnabled(false); };
  const stopSharing = async () => {
    if (!mounted.current || currentRoom.current !== room || !hasLiveScreenShare(room) || flight.current) return;
    flight.current = true; setBusy(true); setError("");
    try { await stopCapture(); }
    catch (cause) { if (mounted.current && currentRoom.current === room) setError("Не удалось остановить демонстрацию. Повторите попытку."); throw cause; }
    finally { if (mounted.current && currentRoom.current === room) { flight.current = false; setBusy(false); refreshSharing.current(); } }
  };

  useEffect(() => {
    mounted.current = true;
    flight.current = false;
    setSetupRequested(false);setPendingRemote(undefined);setViewOnly(false);setError('');
    controls.current?.hidePopover(); setControlsOpen(false);
    setBusy(false); setPanelOpenError(false); setPanelState("closed");
    setSupported(typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function");
    const api = documentPictureInPictureApi(window);
    const desktop = desktopScreenBridge(window);
    setPanelSupported(!!api || !!desktop);
    let observed: MediaStreamTrack | undefined;
    const options = { labels: panelLabels(), isSharing: () => mounted.current && currentRoom.current === room && hasLiveScreenShare(room) && !isCoPresentationTrack(room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track), onStateChange: (state: ScreenShareStopPanelState) => { if (mounted.current && currentRoom.current === room) setPanelState(state); }, stop: stopSharing };
    const panel = desktop ? createDesktopStopPanel({ ...options, bridge: desktop }) : createScreenShareStopPanel({ ...options, api });
    stopPanel.current = panel;
    const update = () => {
      const isConnected = room.state === "connected";
      setRemoteMode(room.localParticipant.identity.startsWith('guest-') && /Windows/i.test(navigator.userAgent));
      setConnected(isConnected);
      if (getMuted.current) setRoomScreenShareOutputMuted(room, !isConnected || getMuted.current());
      if (!isConnected) generation.current++;
      const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack;
      if (observed !== track) { observed?.removeEventListener("ended", update); observed = track; observed?.addEventListener("ended", update); }
      setSharing(hasLiveScreenShare(room));
      if (!hasLiveScreenShare(room) && !remoteSessionRef.current) { controls.current?.hidePopover(); setControlsOpen(false); }
      setCanvasSharing(isCoPresentationTrack(room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track));
      panel.setSuppressed(ownerSurfaceMatches(ownerSurface.current,room.localParticipant.sid,room.localParticipant.getTrackPublication(Track.Source.ScreenShare)));
      panel.sync();
    };
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Disconnected];
    events.forEach(event => room.on(event, update));
    refreshSharing.current = update;
    update();
    return () => { mounted.current = false; generation.current++; observed?.removeEventListener("ended", update); events.forEach(event => room.off(event, update)); panel.dispose(); if (stopPanel.current === panel) stopPanel.current = undefined; if (getMuted.current) void stopStudioScreenShare(room).catch(() => undefined); };
  }, [room]);

  useEffect(() => { stopPanel.current?.setSuppressed(ownerSurfaceMatches(navigation?.ownerSurface,room.localParticipant.sid,room.localParticipant.getTrackPublication(Track.Source.ScreenShare))); }, [navigation?.ownerSurface,room]);

  useEffect(() => { stopPanel.current?.setLabels(panelLabels()); }, [t, locale]);

  useEffect(() => { if (getMuted.current) setRoomScreenShareOutputMuted(room, getMuted.current()); }, [room, outputMuted]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const toggle = async () => {
    if (remoteMode && !viewOnly) {
      if (flight.current) return;
      flight.current=true;setBusy(true);setError('');setSetupRequested(true);
      const request=++generation.current;
      const current=()=>mounted.current&&currentRoom.current===room&&generation.current===request;
      try { const result=await beginRemotePc(room,window,current);if(!current())return;setPendingRemote({ticket:result.ticket,ticketExpiresAt:result.ticketExpiresAt,sessionId:result.session.id,session:result.session}); } catch { if(!current())return;setError(locale==='ru'?'Не удалось запустить компонент управления ПК. Проверьте установленный компонент и повторите попытку.':locale==='en'?'Could not start the PC component. Check the installed component and retry.':'无法启动电脑组件。请检查已安装的组件并重试。'); }
      finally { if(mounted.current&&currentRoom.current===room){flight.current=false;setBusy(false);} }
      return;
    }
    if (supported === false) {
      setError("Демонстрация экрана недоступна в этом браузере. На Android Chrome веб-версия не поддерживает захват экрана.");
      return;
    }
    if (flight.current) return;
    flight.current = true;
    setBusy(true); setError(""); setPanelOpenError(false);
    const request = ++generation.current;
    try {
      const current = () => mounted.current && currentRoom.current === room && generation.current === request;
      const started = getMuted.current ? await enableStudioScreenShare(room, current, () => getMuted.current?.() ?? true) : await enableRoomScreenShare(room, current);
      if (!current()) return;
      if (!started) setError("Выбор экрана отменён или браузер не разрешил захват.");
      // requestWindow consumes activation. Capture must start first; after the
      // asynchronous picker/publication this attempt may require a new click.
      else {
        const handled = requestCoPresentationMenu(room, window, trigger.current);
        if (!handled) void stopPanel.current?.open();
      }
    } catch (cause) {
      if (!mounted.current || currentRoom.current !== room || generation.current !== request) return;
      setError(cause instanceof DOMException && (cause.name === "AbortError" || cause.name === "NotAllowedError")
        ? "Выбор экрана отменён или браузер не разрешил захват."
        : cause instanceof Error ? cause.message : "Не удалось включить показ экрана");
    } finally {
      if (mounted.current && currentRoom.current === room) {
        flight.current = false;
        setBusy(false);
      }
      if (mounted.current && currentRoom.current === room && generation.current === request) refreshSharing.current();
    }
  };

  const showControls = () => {
    if (!remoteSession && hasLiveScreenShare(room) && requestCoPresentationMenu(room, window, trigger.current)) return true;
    const popup = controls.current, button = trigger.current;
    if (!popup || !setupPending && !remoteSession && !hasLiveScreenShare(room)) return;
    if (button) {
      const rect = button.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 24);
      const above = Math.max(0, Math.min(window.innerHeight - 24, rect.top - 20));
      const below = Math.max(0, Math.min(window.innerHeight - 24, window.innerHeight - rect.bottom - 20));
      const useAbove = above >= 220 || above >= below;
      popup.style.width = `${width}px`;
      popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      popup.style.maxHeight = `${Math.max(40, useAbove ? above : below)}px`;
      popup.style.top = useAbove ? "auto" : `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 52))}px`;
      popup.style.bottom = useAbove ? `${Math.max(12, Math.min(window.innerHeight - rect.top + 8, window.innerHeight - 52))}px` : "auto";
    }
    popup.showPopover();
    return false;
  };

  const useViewOnly = async () => {
    if(flight.current)return;
    const request=++generation.current;
    const current=()=>mounted.current&&currentRoom.current===room&&generation.current===request;
    flight.current=true;setBusy(true);setError('');
    try {
      // A begin response can arrive before the first room-state poll. Keep its
      // exact binding so a delayed protocol launch cannot outlive this choice.
      const pending=remoteSessionRef.current || pendingRemote?.session;
      if(pending){
        const fresh=await remotePcRequest(room,{action:'read'});
        const session=fresh.sessions?.find(item=>item.id===pending.id&&item.generation===pending.generation) || pending;
        if(session.phase!=='stopped'){
          let result=await remotePcRequest(room,{action:'stop',sessionId:session.id,generation:session.generation,revision:session.revision});
          for(let attempt=0;result.session?.phase!=='stopped'&&attempt<20;attempt++){
            await new Promise<void>(resolve=>setTimeout(resolve,150));
            const state=await remotePcRequest(room,{action:'read'});
            result={...state,session:state.sessions?.find(item=>item.id===session.id&&item.generation===session.generation)};
          }
          if(result.session?.phase!=='stopped')throw new Error('Remote PC cancellation not confirmed');
        }
      }
      if(!current())return;
      setViewOnly(true);setPendingRemote(undefined);setSetupRequested(false);
    } catch { if(!current())return;setError(locale==='ru'?'Отмена не подтверждена. Повторите попытку.':locale==='en'?'Cancellation was not confirmed. Please retry.':'取消尚未确认。请重试。'); }
    finally {if(mounted.current&&currentRoom.current===room){flight.current=false;setBusy(false);}}
  };
  useEffect(()=>{if(remoteSharing || pendingRemote && remotePc.sessions.some(session=>session.id===pendingRemote.sessionId&&session.phase==='stopped'))setPendingRemote(undefined);},[remoteSharing,remotePc.sessions,pendingRemote]);
  useEffect(()=>{if(setupPending)showControls();else if(viewOnly)controls.current?.hidePopover();},[setupPending,viewOnly]);
  useEffect(()=>{if(remoteSharing)setSetupRequested(false);},[remoteSharing]);
  const openedRemote = useRef('');
  useEffect(() => { if (remoteSession?.source && openedRemote.current !== remoteSession.id) { openedRemote.current=remoteSession.id;showControls(); } }, [remoteSession?.id,remoteSession?.source?.videoTrackSid]);

  const showStopPanel = () => {
    const panel = stopPanel.current;
    if (!panel || !hasLiveScreenShare(room)) return;
    setPanelOpenError(false);
    void panel.open().then(opened => { if (!opened && mounted.current && currentRoom.current === room && hasLiveScreenShare(room)) setPanelOpenError(true); });
  };

  const label = activeSharing ? copy.manage : supported === false
    ? t("Демонстрация экрана не поддерживается этим браузером")
    : t("Показать экран / приложение");
  return <div className={`screen-share-control${compact ? " screen-share-control-compact" : ""}${toolbar ? " screen-share-control-toolbar" : ""}`}>
    <button ref={trigger} type="button" className={toolbar ? "lk-button guest-screen-share-button studio-screen-share-button" : compact ? "studio-screen-share-button" : "button-secondary"} title={compact || toolbar ? label : undefined} aria-label={compact || toolbar ? label : undefined} aria-pressed={activeSharing} aria-haspopup={activeSharing || setupPending ? "dialog" : undefined} aria-controls={activeSharing || setupPending ? controlsId : undefined} aria-expanded={activeSharing || setupPending ? controlsOpen : undefined} disabled={busy || !connected || viewOnly && !!remoteSession || !activeSharing && (!remoteMode || viewOnly) && supported !== true} onClick={() => activeSharing || setupPending || remoteSession && !viewOnly ? showControls() : void toggle()}>
      {toolbar ? <><ScreenShareIcon /><span>{t("Демонстрация экрана")}</span></> : busy ? t("Подключаем…") : compact ? t("Демонстрация экрана") : label}
    </button>
    <div ref={controls} id={controlsId} className="screen-share-controls-popover" popover="auto" role="dialog" aria-label={setupPending ? copy.title : remoteSession ? copy.manage : undefined} aria-labelledby={setupPending || remoteSession ? undefined : `${controlsId}-title`} onToggle={event => setControlsOpen(event.newState === "open")}>
      {setupPending ? <ScreenShareSetup locale={locale} busy={busy} onRetry={()=>void toggle()} onCancel={()=>void useViewOnly()} /> : remoteSession ? <RemotePcControls room={room} session={remoteSession} onClose={() => { controls.current?.hidePopover(); trigger.current?.focus(); }} /> : <><header><div><h2 id={`${controlsId}-title`}>{copy.title}</h2><p>{copy.owner}</p></div><button type="button" className="button-secondary" aria-label={copy.close} onClick={() => { controls.current?.hidePopover(); trigger.current?.focus(); }}>×</button></header>
      <p className="screen-share-sharing-status" role="status">{sharing ? copy.sharing : copy.idle}</p>
      <p className="screen-share-controls-scope">{copy.scope}</p>
      <button type="button" className="screen-share-stop" disabled={busy || !sharing || !connected} onClick={() => void stopSharing().catch(() => undefined)}>{busy ? t("Останавливаем…") : t("Остановить показ экрана")}</button>
      {error && <small role="alert">{translateWorkspaceMessage(t, error)}</small>}
    </>}
    </div>
    {sharing && !canvasSharing && !stopCovered && panelSupported && panelState !== "open" && <button type="button" className="button-secondary screen-share-stop-panel-toggle" disabled={panelState === "opening"} onClick={showStopPanel}>{t("Показать панель остановки")}</button>}
    {sharing && !canvasSharing && !stopCovered && panelSupported && panelState === "closed" && <small role="status">{panelOpenError ? t("Не удалось открыть панель остановки. Повторите попытку или остановите демонстрацию здесь.") : t("Если панель не открылась автоматически, нажмите «Показать панель остановки».")}</small>}
    {sharing && !canvasSharing && !stopCovered && !panelSupported && <small role="status">{t("Этот браузер не поддерживает плавающую панель. Остановите демонстрацию здесь.")}</small>}
    {!remoteMode && !compact && !toolbar && <small>{supported === false ? t("Этот браузер не умеет захватывать экран через веб-страницу. На Android Chrome используйте другой способ передачи экрана; на компьютере откройте CastLink в Chrome/Edge.") : t("В диалоге браузера выберите экран, окно приложения или вкладку. Для звука включите «Поделиться звуком», если такая настройка доступна.")}</small>}
    {!remoteMode && supported === false && toolbar && <small className="guest-screen-share-unavailable" role="status">{t("Показ экрана недоступен в этом браузере")}</small>}
    {error && <small className={toolbar ? "guest-screen-share-error" : undefined} role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
}
