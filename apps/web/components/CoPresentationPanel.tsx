'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useI18n } from './I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { PdfPresentationViewer } from './PdfPresentationViewer';
import { createFloatingPanelDrag } from '@/lib/floating-panel-position';
import { RecipientSlideControls, recipientSlideSessions } from './RecipientSlideControls';
import { coPresentationRequest, createCanvasPresentationCapture } from '@/lib/co-presentation-client';
import { convertPresentationFile, validPresentationFile, type PresentationFileProgress } from '@/lib/presentation-file-client';
import { createNativePresentationControl, powerPointBridge, validNativeControlledPresentation, isNativeWindowPresentation, type NativeControlledPresentation, type PreparedPresentation, type PowerPointBridge } from '@/lib/co-presentation-native';
import { createCoPresentationControls, slideControlsId, slideControlsText, type SlideControlsAction } from '@/lib/co-presentation-controls';
import { useCoPresentationNavigation, usePresentationNavigationButtonFocus, type PresentationScreenNavigation } from './CoPresentationNavigation';
import { presentationRecipientAccepted, presentationRecipientAcceptanceKey } from '@/lib/co-presentation-acceptance';
import { presentationStepMode, presentationNavigationPending, presentationPageLabel, presentationDirectionAllowed, presentationScreenGrant } from '@/lib/co-presentation-navigation';
import { createHelperPowerPointBridge, launchPresentationHelper, PRESENTER_INSTALLER_URL } from '@/lib/co-presentation-helper-client';
import type { CoPresentation } from '@/lib/co-presentation-state';
import { createDesktopStopPanel, desktopScreenBridge } from '@/lib/desktop-stop-panel';
import { createScreenShareStopPanel, documentPictureInPictureApi, type ScreenShareStopPanel, type ScreenShareStopPanelState } from '@/lib/screen-share-stop-panel';
type NativeShareBinding = { trackSid: string; track: unknown; localSid: string };
const copy = {
    ru: { drag: 'Переместить панель (стрелки клавиатуры)', floatingHint: 'Перетащите заголовок, чтобы переместить панель. Режим поверх других окон доступен в поддерживаемых Chrome и Edge.', floatingFailed: 'Не удалось открыть панель поверх окон. Управление доступно здесь.', menu: 'Совместная презентация', menuClose: 'Закрыть управление', scope: 'Только листание слайдов стрелками и щелчками.', empty: 'Подключите управление к тому окну PowerPoint или PDF, которое демонстрируете.', noCasters: 'Других кастеров пока нет. Они появятся здесь после входа в комнату.', current: 'Сейчас управляет', you: 'Вы', reclaim: 'Забрать управление', more: 'Файл и дополнительные действия', sharingState: 'Демонстрация включена', idleState: 'Показ не запущен', chooseShort: 'Выбрать PDF / PPTX', session: 'Выбрать презентацию', title: 'Презентация PDF / PowerPoint', floating: 'Поверх других окон', delegated: 'Управляет', localControls: 'Вы управляете', native: 'Управлять открытым PowerPoint', disconnect: 'Отключить управление PowerPoint', choose: 'Выбрать PDF или PPTX', hint: 'PDF и PPTX до 1,5 ГБ; PPTX преобразуется в PDF без анимации, музыки и видео. Отдельный видеопоток без звука.', uploading: 'Загружаем PowerPoint…', receiving: 'Получаем PDF…', opening: 'Открываем PDF…', cancel: 'Отменить загрузку', retry: 'Слайд уже изменился. Повторите действие после обновления.', converting: 'Преобразуем PowerPoint…', start: 'Показать презентацию', stop: 'Остановить презентацию', previous: 'Назад', next: 'Вперёд', grant: 'Передать управление', revoke: 'Отозвать управление', caster: 'Выберите кастера', page: 'Страница', rendered: 'Показано', pending: 'Ожидаем отображения', control: 'Подключить управление', panel: 'Показать панель остановки', stopTitle: 'Панель остановки презентации', stopLabel: 'ОСТАНОВИТЬ ПРЕЗЕНТАЦИЮ', stopping: 'Останавливаем…', failed: 'Не удалось выполнить действие. Повторите попытку.', size: 'Выберите PDF или PPTX до 1,5 ГБ (1 500 000 000 байт).', other: 'Презентации в комнате', unavailable: 'Управление недоступно. Повторите попытку; передача видео продолжается.', fallback: 'Остановить показ можно здесь. Плавающая панель может потребовать отдельного нажатия.', error: 'Не удалось открыть презентацию.', close: 'Закрыть файл' },
    en: { drag: 'Move controls (arrow keys)', floatingHint: 'Drag the heading to move controls. Supported Chrome and Edge browsers can show them above other windows.', floatingFailed: 'Could not open controls above other windows. Use the controls here.', menu: 'Co-presentation', menuClose: 'Close controls', scope: 'Slide navigation with arrow keys and clicks only.', empty: 'Connect controls to the PowerPoint or PDF window you are sharing.', noCasters: 'No other casters yet. They will appear here after joining the room.', current: 'Current controller', you: 'You', reclaim: 'Reclaim controls', more: 'File and more actions', sharingState: 'Sharing is on', idleState: 'Sharing has not started', chooseShort: 'Choose PDF / PPTX', session: 'Choose presentation', title: 'PDF / PowerPoint presentation', floating: 'Show above other windows', delegated: 'Controlled by', localControls: 'You control', native: 'Control open PowerPoint', disconnect: 'Disconnect PowerPoint controls', choose: 'Choose PDF or PPTX', hint: 'PDF and PPTX up to 1.5 GB; PPTX converts to PDF without animations, music or video. A separate video stream with no audio.', uploading: 'Uploading PowerPoint…', receiving: 'Receiving PDF…', opening: 'Opening PDF…', cancel: 'Cancel loading', retry: 'The slide changed. Retry after the controls refresh.', converting: 'Converting PowerPoint…', start: 'Share presentation', stop: 'Stop presentation', previous: 'Previous', next: 'Next', grant: 'Grant control', revoke: 'Revoke control', caster: 'Choose caster', page: 'Page', rendered: 'Rendered', pending: 'Waiting for render', control: 'Connect controls', panel: 'Show stop panel', stopTitle: 'Presentation stop panel', stopLabel: 'STOP PRESENTATION', stopping: 'Stopping…', failed: 'Action failed. Please retry.', size: 'Choose a PDF or PPTX up to 1.5 GB (1,500,000,000 bytes).', other: 'Room presentations', unavailable: 'Controls unavailable. Please retry; video sharing continues.', fallback: 'You can stop sharing here. Opening the floating panel may require another click.', error: 'Could not open presentation.', close: 'Close file' },
    'zh-CN': { drag: '移动面板（方向键）', floatingHint: '拖动标题可移动面板。受支持的 Chrome 和 Edge 浏览器可将其置于其他窗口上方。', floatingFailed: '无法在其他窗口上方打开面板。请使用此处的控制。', menu: '协同演示', menuClose: '关闭控制菜单', scope: '仅通过方向键和点击翻页。', empty: '请为正在共享的同一个 PowerPoint 或 PDF 窗口连接控制。', noCasters: '暂无其他参与者。加入房间后，他们将显示在此处。', current: '当前控制者', you: '您', reclaim: '收回控制权', more: '文件和更多操作', sharingState: '正在共享', idleState: '尚未开始共享', chooseShort: '选择 PDF / PPTX', session: '选择演示', title: 'PDF / PowerPoint 演示', floating: '置于其他窗口上方', delegated: '控制者', localControls: '由您控制', native: '控制已打开的 PowerPoint', disconnect: '断开 PowerPoint 控制', choose: '选择 PDF 或 PPTX', hint: 'PDF 和 PPTX 最大 1.5 GB；PPTX 将转换为不含动画、音乐或视频的 PDF。以单独的视频流共享，不包含音频。', uploading: '正在上传 PowerPoint…', receiving: '正在接收 PDF…', opening: '正在打开 PDF…', cancel: '取消加载', retry: '幻灯片已更改。请在控制刷新后重试。', converting: '正在转换 PowerPoint…', start: '共享演示', stop: '停止演示', previous: '上一页', next: '下一页', grant: '授予控制权', revoke: '撤销控制权', caster: '选择参与者', page: '页码', rendered: '已显示', pending: '等待渲染', control: '连接控制', panel: '显示停止面板', stopTitle: '演示停止面板', stopLabel: '停止演示', stopping: '正在停止…', failed: '操作失败，请重试。', size: '请选择最大 1.5 GB（1,500,000,000 字节）的 PDF 或 PPTX。', other: '房间演示', unavailable: '控制暂不可用，请重试；视频共享继续。', fallback: '可在此停止共享。浮动面板可能需要再次点击才能打开。', error: '无法打开演示。', close: '关闭文件' },
};
export function CoPresentationPanel({ room, token, studioId, roomName }: {
    room: Room;
    token: string;
    studioId: string;
    roomName: string;
}) {
    const { locale, t } = useI18n(), text = copy[locale];
    const nativeText = {
      ru: { load: 'Загрузить PPTX', show: 'Показать презентацию', share: 'Выбрать окно показа', captureHint: 'PowerPoint готов. Нажмите «Выбрать окно показа», чтобы начать демонстрацию.', preparing: 'Выбираем файл…', starting: 'Запускаем показ…', helperRequired: 'Откройте комнату в новом CastLink Presenter или в браузере и подключите помощник.', stopCurrent: 'Сначала остановите текущую демонстрацию.', continue: 'Помощник подключён — выбрать PPTX', pair: 'Код подключения помощника', helperMissing: 'Помощник ещё не подключён.', original: 'Оригинальный PPTX в PowerPoint — с анимацией, музыкой и видео.', pickWindow: 'Выберите окно показа PowerPoint. Для музыки включите передачу звука.', change: 'Выбрать другой PPTX', legacy: 'PDF / PPTX без анимации', attach: 'Подключить открытый PowerPoint' },
      en: { load: 'Load PPTX', show: 'Show presentation', share: 'Select slideshow window', captureHint: 'PowerPoint is ready. Select the slideshow window to start sharing.', preparing: 'Choosing file…', starting: 'Starting show…', helperRequired: 'Open this room in the new CastLink Presenter or in a browser and connect the helper.', stopCurrent: 'Stop the current screen share first.', continue: 'Helper connected — choose PPTX', pair: 'Helper pairing code', helperMissing: 'The helper is not connected yet.', original: 'Original PPTX in PowerPoint, with animations, music and video.', pickWindow: 'Select the PowerPoint slideshow window. Enable audio sharing for music.', change: 'Choose another PPTX', legacy: 'PDF / PPTX without animations', attach: 'Connect open PowerPoint' },
      'zh-CN': { load: '加载 PPTX', show: '显示演示文稿', share: '选择放映窗口', captureHint: 'PowerPoint 已准备就绪。请选择放映窗口开始共享。', preparing: '正在选择文件…', starting: '正在启动放映…', helperRequired: '请在新版 CastLink Presenter 或浏览器中打开房间并连接助手。', stopCurrent: '请先停止当前屏幕共享。', continue: '助手已连接 — 选择 PPTX', pair: '助手配对代码', helperMissing: '助手尚未连接。', original: '使用 PowerPoint 播放原始 PPTX，保留动画、音乐和视频。', pickWindow: '选择 PowerPoint 放映窗口。播放音乐时请启用音频共享。', change: '选择其他 PPTX', legacy: 'PDF / PPTX（无动画）', attach: '连接已打开的 PowerPoint' },
    }[locale];
    const [prepared, setPrepared] = useState<PreparedPresentation>(), [nativeBusy, setNativeBusy] = useState(false), [capturePending, setCapturePending] = useState(false);
    const [helperPair, setHelperPair] = useState<{ code: string; expiresAt: number }>();
    const navigation = useCoPresentationNavigation(), publishNavigation = navigation?.publish;
    const [windowController, setWindowController] = useState('');
    const captureNativeShare = (): NativeShareBinding | undefined => {
        const screen = room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare);
        if (room.state !== 'connected' || !screen?.track || !screen.trackSid || screen.isMuted || screen.track.mediaStreamTrack.readyState !== 'live') return;
        return {trackSid:screen.trackSid,track:screen.track,localSid:room.localParticipant.sid};
    };
    const nativeShareCurrent = (share?: NativeShareBinding) => {
        const current = captureNativeShare();
        return !!share && !!current && share.localSid === current.localSid && share.trackSid === current.trackSid && share.track === current.track;
    };
    const pendingNativeShare = useRef<NativeShareBinding | undefined>(undefined);
    const windowIntent = useRef<{identity: string; sid: string; localSid: string; token: string; share: NativeShareBinding} | undefined>(undefined);
    const requestedKind = useRef<'window' | undefined>(undefined);
    const pendingHelper = useRef<{operation: 'connect' | 'prepare'; kind?: 'window'; sid: string; token: string; generation: number; share: NativeShareBinding} | undefined>(undefined);
    const cancelWindowIntent = () => { pendingNativeShare.current = undefined; windowIntent.current = undefined; requestedKind.current = undefined; pendingHelper.current = undefined; setWindowController(''); };
    const helperDialog = useRef<HTMLDivElement>(null), prepareTrigger = useRef<HTMLButtonElement>(null), restoreHelperFocus = useRef(false);
    const closeHelperPair = () => { restoreHelperFocus.current = true; setHelperPair(undefined); cancelWindowIntent(); };
    useEffect(() => {
      const dialog = helperDialog.current;
      if (!helperPair || !dialog) return;
      restoreHelperFocus.current = false;
      dialog.showPopover();
      dialog.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      const onKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation(); closeHelperPair();
      };
      dialog.addEventListener('keydown', onKeyDown);
      return () => {
        dialog.removeEventListener('keydown', onKeyDown);
        if (dialog.matches(':popover-open')) dialog.hidePopover();
        if (restoreHelperFocus.current && prepareTrigger.current?.isConnected) prepareTrigger.current.focus({ preventScroll: true });
      };
    }, [helperPair]);
    const helperRef = useRef<ReturnType<typeof createHelperPowerPointBridge> | undefined>(undefined);
    useEffect(() => {
      const helper = createHelperPowerPointBridge({ token, studioId, room: roomName }); helperRef.current = helper;
      return () => { pendingNativeShare.current = undefined; windowIntent.current = undefined; requestedKind.current = undefined; pendingHelper.current = undefined; helper.dispose(); if (helperRef.current === helper) helperRef.current = undefined; setPrepared(undefined); setHelperPair(undefined); setCapturePending(false); };
    }, [token, studioId, roomName]);
    const getNativeBridge = () => powerPointBridge(window) || helperRef.current;
    const nativeFlight = useRef(false);
    const resumeHelper = useRef<() => void>(() => undefined);
    useEffect(() => {
      if (!helperPair) return;
      let active = true, checking = false, resumed = false;
      const check = async () => {
        if (!active || checking || resumed || nativeFlight.current || helperPair.expiresAt <= Date.now()) return;
        checking = true;
        try {
          const state = await helperRef.current?.connection();
          if (active && state?.connected && !resumed) { resumed = true; resumeHelper.current(); }
        } catch { /* The explicit retry remains available. No native operation is retried. */ }
        finally { checking = false; }
      };
      const timer = window.setInterval(() => void check(),1000);
      return () => { active = false; window.clearInterval(timer); };
    },[helperPair]);

    const menuId = useId(), fileInputId = `${menuId}-file`, recipientId = `${menuId}-recipient`;
    const [recipientReopen, setRecipientReopen] = useState(0), [recipientVisible, setRecipientVisible] = useState(false);
    const [nativeControlsReady, setNativeControlsReady] = useState(false), [nativeGrant, setNativeGrant] = useState(''), [nativeVisible, setNativeVisible] = useState(false);
    const [browserControlsReady, setBrowserControlsReady] = useState(false), [floatingFailed, setFloatingFailed] = useState(false);
    const recipientScreens = useRef(new Map<string,string>());
    const acceptedRecipients = useRef(new Set<string>()), declinedRecipients = useRef(new Set<string>()), autoAcceptAttempted = useRef(new Set<string>()), acceptanceFlights = useRef(new Set<string>());
    const [acceptanceRevision,setAcceptanceRevision] = useState(0);
    const currentControlsGrant = useRef(''), floatingRequest = useRef<object | undefined>(undefined);
    const pendingNative = useRef(''), nativeRecipientSeen = useRef(new Set<string>());
    const recipientScope = useRef({ room, token, studioId, roomName, epoch: 0 });
    const renderScope = useRef({ room, token, studioId, roomName }); renderScope.current = { room, token, studioId, roomName };
    const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), restoreMenuFocus = useRef(false);
    const heading = useRef<HTMLElement>(null), menuDrag = useRef<ReturnType<typeof createFloatingPanelDrag> | undefined>(undefined);
    useEffect(() => {
        if (!menu.current || !heading.current) return;
        const owned = createFloatingPanelDrag(menu.current,heading.current); menuDrag.current = owned;
        return () => { owned.dispose(); if (menuDrag.current === owned) menuDrag.current = undefined; };
    }, []);
    const [menuOpen, setMenuOpen] = useState(false), [stopBusy, setStopBusy] = useState(false);
    const positionMenu = () => {
        if (menuDrag.current?.clamp()) return;
        const button = trigger.current, popup = menu.current;
        if (!button || !popup) return;
        const rect = button.getBoundingClientRect(), width = Math.min(340, window.innerWidth - 24);
        const above = rect.top - 20, below = window.innerHeight - rect.bottom - 20, useAbove = above >= 220 || above >= below;
        popup.style.width = `${width}px`;
        popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
        popup.style.maxHeight = `${Math.max(100, Math.min(500, useAbove ? above : below))}px`;
        popup.style.top = useAbove ? 'auto' : `${rect.bottom + 8}px`;
        popup.style.bottom = useAbove ? `${window.innerHeight - rect.top + 8}px` : 'auto';
    };
    const rememberMenuEscape = (event: { key: string }) => { if (event.key === 'Escape') restoreMenuFocus.current = true; };
    const rememberMenuClose = () => { restoreMenuFocus.current = true; };
    const menuToggle = (event: { newState: string }) => {
        const open = event.newState === 'open'; setMenuOpen(open);
        if (open) { restoreMenuFocus.current = false; positionMenu(); }
        else { if (restoreMenuFocus.current) trigger.current?.focus(); restoreMenuFocus.current = false; }
    };
    useEffect(() => {
        if (!menuOpen) return;
        positionMenu(); window.addEventListener('resize', positionMenu); window.addEventListener('scroll', positionMenu, true);
        // Navigation can temporarily disable the focused button. Capture Escape
        // at the document so closing still returns focus from the body fallback.
        document.addEventListener('keydown', rememberMenuEscape, true);
        return () => { window.removeEventListener('resize', positionMenu); window.removeEventListener('scroll', positionMenu, true); document.removeEventListener('keydown', rememberMenuEscape, true); };
    }, [menuOpen]);
    const casterKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)')];
        if (!buttons.length) return;
        event.preventDefault();
        const index = buttons.indexOf(event.target as HTMLButtonElement), next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus(); buttons[next].scrollIntoView({ block: 'nearest' });
    };
    const labels = () => ({ locale, title: text.stopTitle, stop: text.stopLabel, stopping: text.stopping, stopError: text.failed });
    const [file, setFile] = useState<File>(), fileRef = useRef<File | undefined>(undefined);
    const [native, setNative] = useState<NativeControlledPresentation>();
    const nativeControl = useRef<ReturnType<typeof createNativePresentationControl> | undefined>(undefined);
    const [page, setPage] = useState(1), [pages, setPages] = useState(0);
    const [sessions, setSessions] = useState<CoPresentation[]>([]), [own, setOwn] = useState<CoPresentation>();
    const ownRef = useRef<CoPresentation | undefined>(undefined);
    const [painted, setPainted] = useState<{
        file: File;
        page: number;
    }>();
    const [busy, setBusy] = useState(false), [converting, setConverting] = useState(false), [sharing, setSharing] = useState(false);
    const [fileProgress, setFileProgress] = useState<PresentationFileProgress | undefined>();
    const [pdfProgress, setPdfProgress] = useState<number | undefined>();
    const [error, setError] = useState(''), [controlError, setControlError] = useState(false);
    const [connected, setConnected] = useState(room.state === 'connected');
    const [screenSharing, setScreenSharing] = useState(() => { const screen = room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare); return !!screen?.track && !screen.isMuted && screen.track.mediaStreamTrack.readyState === 'live'; });
    const stopping = useRef<object | undefined>(undefined), nativeFault = useRef(false);
    const [casters, setCasters] = useState<{
        identity: string;
        name: string;
    }[]>([]), [controller, setController] = useState('');
    const controls = useRef<ReturnType<typeof createCoPresentationControls> | undefined>(undefined);
    const controlsAction = useRef<(event: SlideControlsAction) => Promise<unknown>>(async () => undefined);
    const [selectedControls, setSelectedControls] = useState('');
    const [panelState, setPanelState] = useState<ScreenShareStopPanelState>('closed');
    const canvas = useRef<HTMLCanvasElement | undefined>(undefined), capture = useRef<ReturnType<typeof createCanvasPresentationCapture> | undefined>(undefined), panel = useRef<ScreenShareStopPanel | undefined>(undefined);
    const fileGeneration = useRef(0), ownedScreen = useRef<{id: string; generation: string; track: unknown; trackSid: string} | undefined>(undefined);
    const generation = useRef(0), epoch = useRef(0), flight = useRef(false), abort = useRef<AbortController | undefined>(undefined), mounted = useRef(false);
    const updateOwn = (session?: CoPresentation) => {
        if (!session) ownedScreen.current = undefined;
        else if (ownedScreen.current?.id !== session.id || ownedScreen.current.generation !== session.generation) {
            const screen = room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare);
            if (screen?.track) ownedScreen.current = {id:session.id,generation:session.generation,track:screen.track,trackSid:screen.trackSid};
        }
        ownRef.current = session; setOwn(session);
        if (session?.kind === 'pdf') setPage(session.page);
    };
    const request = (body: Record<string, unknown>, signal?: AbortSignal) => coPresentationRequest(token, studioId, roomName, body, signal);
    const binding = (session: CoPresentation) => ({ id: session.id, generation: session.generation, controlRevision: session.controlRevision });
    const closeSession = (session?: CoPresentation) => { if (session)
        void request({ action: 'revoke', ...binding(session), close: true }).catch(() => undefined); };
    const stopNative = () => { nativeControl.current?.stop(); nativeControl.current = undefined; setNative(undefined); };
    const failNative = () => {
        nativeFault.current = true;
        const owner = ownRef.current, screen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (owner && owner.kind !== 'pdf' && owner.owner.identity === room.localParticipant.identity && owner.owner.sid === room.localParticipant.sid && screen?.track?.mediaStreamTrack.readyState === 'live') {
            // Loss of slide authority must not discard the local media owner.
            // Disconnect only the native control grant and keep STOP available.
            nativeControl.current?.stop(); nativeControl.current = undefined;
            setControlError(true); return;
        }
        controls.current?.clear(); closeSession(owner); stopNative(); updateOwn(undefined); setControlError(true);
    };
    useEffect(() => {
        mounted.current = true;
        recipientScope.current = { room, token, studioId, roomName, epoch: recipientScope.current.epoch + 1 }; recipientScreens.current.clear(); acceptedRecipients.current.clear(); declinedRecipients.current.clear(); autoAcceptAttempted.current.clear(); acceptanceFlights.current.clear();
        const slideControls = createCoPresentationControls({ host: window, action: event => controlsAction.current(event), visibility: visible => { if (mounted.current) setNativeVisible(visible); }, browserOpened: id => {
            const current = renderScope.current;
            if (!mounted.current || controls.current !== slideControls || currentControlsGrant.current !== id || current.room !== room || current.token !== token || current.studioId !== studioId || current.roomName !== roomName) { slideControls.clear(); return; }
            setFloatingFailed(false); setNativeGrant(id); if (menu.current?.matches(':popover-open')) menu.current.hidePopover();
        }, nativeOpened: id => { if (!mounted.current) return; setNativeGrant(id); if (menu.current?.matches(':popover-open')) menu.current.hidePopover(); } });
        setNativeControlsReady(slideControls.native); setBrowserControlsReady(slideControls.browserFloating); setFloatingFailed(false); setNativeGrant(''); pendingNative.current = ''; nativeRecipientSeen.current.clear();
        controls.current = slideControls;
        setSelectedControls('');
        stopNative(); nativeFault.current = false;
        setFile(undefined);
        setPainted(undefined);
        setPages(0);
        setPage(1);
        updateOwn(undefined);
        setController('');
        setError('');
        setSessions([]);
        setBusy(false);
        setConverting(false);
        flight.current = false;
        const update = () => {
            const online = room.state === 'connected';
            setConnected(online);
            const screen = room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare);
            setScreenSharing(!!screen?.track && !screen.isMuted && screen.track.mediaStreamTrack.readyState === 'live');
            const bound = ownedScreen.current, owner = ownRef.current;
            const pendingShare = pendingNativeShare.current || windowIntent.current?.share || pendingHelper.current?.share;
            if (!bound && pendingShare && !nativeShareCurrent(pendingShare)) {
                generation.current++; epoch.current++; cancelWindowIntent(); setHelperPair(undefined); flight.current = false; setBusy(false);
            }
            if (bound && owner && !stopping.current && (!screen?.track || screen.isMuted || screen.track.mediaStreamTrack.readyState !== 'live' || screen.track !== bound.track || screen.trackSid !== bound.trackSid)) {
                generation.current++; epoch.current++; controls.current?.clear(); closeSession(owner); stopNative(); updateOwn(undefined);
                setSessions(list => list.filter(item => item.id !== owner.id || item.generation !== owner.generation));
                cancelWindowIntent(); setHelperPair(undefined); flight.current = false; setBusy(false);
                if (menu.current?.matches(':popover-open')) menu.current.hidePopover();
            }
            setCasters([...room.remoteParticipants.values()].filter(p => { try {
                return JSON.parse(p.metadata || '{}').role === 'guest';
            }
            catch {
                return false;
            } }).map(p => ({ identity: p.identity, name: p.name || p.identity })));
            if (!online) {
                windowIntent.current = undefined; requestedKind.current = undefined; setHelperPair(undefined);
                controls.current?.clear();
                generation.current++;
                epoch.current++;
                abort.current?.abort();
                stopNative();
                fileRef.current = undefined;
                canvas.current = undefined;
                setFile(undefined);
                setPainted(undefined);
                updateOwn(undefined);
                setSessions([]);
                setController('');
                setConverting(false);
                setBusy(false);
                flight.current = false;
            }
        };
        let stopPanel: ScreenShareStopPanel | undefined;
        const ownedCapture = createCanvasPresentationCapture(room, value => { if (mounted.current)
            setSharing(value); stopPanel?.sync(); });
        capture.current = ownedCapture;
        const options = { labels: labels(), isSharing: () => ownedCapture.isSharing(), stop: ownedCapture.stop, onStateChange: (value: ScreenShareStopPanelState) => { if (mounted.current)
                setPanelState(value); } };
        const desktop = desktopScreenBridge(window);
        stopPanel = desktop ? createDesktopStopPanel({ ...options, bridge: desktop }) : createScreenShareStopPanel({ ...options, api: documentPictureInPictureApi(window) });
        panel.current = stopPanel;
        const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Disconnected, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed];
        events.forEach(event => room.on(event, update));
        update();
        return () => { slideControls.dispose(); if (controls.current === slideControls) controls.current = undefined; mounted.current = false; generation.current++; epoch.current++; abort.current?.abort(); nativeControl.current?.stop(); nativeControl.current = undefined; closeSession(ownRef.current); ownRef.current = undefined; fileRef.current = undefined; canvas.current = undefined; events.forEach(event => room.off(event, update)); stopPanel?.dispose(); ownedCapture.dispose(); capture.current = undefined; panel.current = undefined; };
    }, [room, studioId, roomName, token]);
    useEffect(() => { panel.current?.setLabels(labels()); }, [locale]);
    useEffect(() => {
        if (!connected)
            return;
        let active = true, polling = false;
        const cancellation = new AbortController();
        const poll = async () => {
            if (polling || flight.current || nativeFlight.current)
                return;
            polling = true;
            const version = epoch.current;
            try {
                const response = await request({ action: 'read', ownerSessionId: ownRef.current?.id || '' }, cancellation.signal);
                if (!active || version !== epoch.current)
                    return;
                const list = response.sessions || [];
                setSessions(list);
                setControlError(nativeFault.current);
                if (ownRef.current) {
                    const local = list.find(session => session.id === ownRef.current?.id);
                    if (!local && ownRef.current.kind !== 'pdf') { failNative(); return; }
                    updateOwn(local);
                    if (nativeControl.current && local) {
                        flight.current = true;
                        setBusy(true);
                        try { await nativeControl.current.tick(local); }
                        finally { if (active && version === epoch.current) { flight.current = false; setBusy(false); } }
                    }
                }
            }
            catch (cause) {
                if (active && version === epoch.current) {
                    setControlError(true);
                    setSessions([]);
                    if (cause && typeof cause === 'object' && 'status' in cause && (cause.status === 401 || cause.status === 403) && nativeControl.current) failNative();
                }
            }
            finally {
                polling = false;
            }
        };
        void poll();
        const timer = window.setInterval(() => void poll(), 1000);
        return () => { active = false; cancellation.abort(); window.clearInterval(timer); };
    }, [room, studioId, roomName, token, connected]);
    const mutate = async (body: Record<string, unknown>) => {
        if (flight.current || !connected)
            return;
        flight.current = true;
        setBusy(true);
        epoch.current++;
        const current = generation.current;
        setError('');
        try {
            const response = await request(body);
            if (!mounted.current || current !== generation.current)
                return;
            if (response.session) {
                if (response.session.owner.identity === room.localParticipant.identity && response.session.owner.sid === room.localParticipant.sid)
                    updateOwn(response.session);
                setSessions(list => list.map(item => item.id === response.session?.id ? response.session! : item));
            }
            setControlError(false);
            return response;
        }
        catch (cause) {
            if (mounted.current && current === generation.current) {
                setControlError(true);
                if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) setError(text.retry);
                if (cause && typeof cause === 'object' && 'status' in cause && (cause.status === 401 || cause.status === 403) && nativeControl.current) failNative();
            }
        }
        finally {
            if (mounted.current && current === generation.current) {
                flight.current = false;
                setBusy(false);
            }
        }
    };
    useEffect(() => {
        if (busy || controlError || !own || own.kind !== 'pdf' || !painted || painted.file !== file || painted.page !== own.page || own.renderedRevision === own.revision)
            return;
        void mutate({ action: 'ack', ...binding(own), revision: own.revision, page: painted.page });
    }, [own, painted, file, busy, controlError]);
    const load = async (selected?: File) => {
        // A prepared file owns no room/control/media authority. Replacing or
        // deleting it must leave an unrelated shared window and grant intact.
        if (capture.current?.isSharing()) return;
        const current = ++fileGeneration.current;
        abort.current?.abort();
        const cancellation = new AbortController(); abort.current = cancellation;
        const live = () => mounted.current && fileGeneration.current === current && !cancellation.signal.aborted;
        fileRef.current = undefined; canvas.current = undefined;
        setFile(undefined); setPainted(undefined); setPages(0); setPage(1);
        setError(''); setConverting(false); setFileProgress(undefined); setPdfProgress(undefined);
        if (!selected) return;
        if (!validPresentationFile(selected)) { setError(text.size); return; }
        let failureText = text.error;
        try {
            let result = selected;
            if (/\.pptx$/i.test(selected.name)) {
                setConverting(true);
                const blob = await convertPresentationFile({ file: selected, endpoint: `/api/presentation-file?${new URLSearchParams({ studioId, room: roomName })}`, token, signal: cancellation.signal, onProgress: progress => { if (live()) setFileProgress(progress); } });
                result = new File([blob], selected.name.replace(/\.pptx$/i, '.pdf'), { type: 'application/pdf' });
            }
            if (!live()) return;
            fileRef.current = result; setFile(result);
        } catch (cause) {
            if (live()) {
                if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' && cause.message.length <= 400) failureText = translateWorkspaceMessage(t,cause.message);
                if (cause && typeof cause === 'object' && 'status' in cause && typeof cause.status === 'number') failureText += ` (HTTP ${cause.status})`;
                setError(failureText);
            }
        } finally { if (live()) { setConverting(false); setFileProgress(undefined); } }
    };
    const create = async (loaded: File, total: number) => {
        if (fileRef.current !== loaded || flight.current || !connected || !capture.current?.isSharing())
            return;
        const current = generation.current, screen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (!screen?.track || screen.isMuted || screen.track.mediaStreamTrack.readyState !== 'live') return;
        flight.current = true;
        setBusy(true);
        epoch.current++;
        try {
            const response = await request({ action: 'create', name: loaded.name.slice(0, 180), pages: total });
            if (!mounted.current || current !== generation.current || fileRef.current !== loaded || !capture.current?.isSharing() || room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track !== screen.track) {
                closeSession(response.session || undefined);
                return;
            }
            updateOwn(response.session || undefined);
            setControlError(false);
        }
        catch {
            if (mounted.current && current === generation.current)
                setControlError(true);
        }
        finally {
            if (mounted.current && current === generation.current) {
                flight.current = false;
                setBusy(false);
            }
        }
    };
    const connectNative = async (provided?: { bridge: PowerPointBridge; native: NativeControlledPresentation; current?: () => boolean }, resumePair = false, expectedShare?: NativeShareBinding) => {
        const share = expectedShare || captureNativeShare();
        const bridge = provided?.bridge || getNativeBridge();
        if (!bridge || !connected || busy || provided?.current?.() === false || !nativeShareCurrent(share)) { if (provided) void provided.bridge.disconnect(provided.native.id).catch(() => undefined); return false; }
        pendingNativeShare.current = share;
        const cancelStaleShare = () => { if (pendingNativeShare.current === share) { cancelWindowIntent(); setHelperPair(undefined); } };
        if (!provided && bridge === helperRef.current) {
            const scope = generation.current, helper = helperRef.current;
            try {
                const paired = (await helper!.connection()).connected;
                if (!mounted.current || generation.current !== scope || helperRef.current !== helper || !nativeShareCurrent(share)) { cancelStaleShare(); return false; }
                if (!paired) {
                    if (resumePair) { setError(nativeText.helperMissing); return false; }
                    const pair = await helper!.pair();
                    if (mounted.current && generation.current === scope && helperRef.current === helper && nativeShareCurrent(share)) {
                        pendingHelper.current = {operation:'connect',sid:room.localParticipant.sid,token,generation:scope,share:share!};
                        setHelperPair(pair); launchPresentationHelper(window,pair.code);
                    }
                    return false;
                }
            } catch { if (mounted.current && generation.current === scope) setError(text.failed); return false; }
        }
        if (!nativeShareCurrent(share)) { cancelStaleShare(); if (provided) void provided.bridge.disconnect(provided.native.id).catch(() => undefined); return false; }
        controls.current?.clear(); closeSession(ownRef.current); stopNative(); nativeFault.current = false; updateOwn(undefined); setController('');
        const current = ++generation.current;
        flight.current = true; setBusy(true); epoch.current++;
        let attached: NativeControlledPresentation | undefined;
        try {
            attached = provided?.native || await bridge.connect();
            if (!validNativeControlledPresentation(attached)) throw new Error('Invalid PowerPoint response');
            if (!mounted.current || generation.current !== current || !nativeShareCurrent(share) || provided?.current?.() === false) { void bridge.disconnect(attached.id).catch(() => undefined); return false; }
            const response = await request(isNativeWindowPresentation(attached)
                ? { action: 'create', kind: 'window', name: attached.name.slice(0,180), navigationMode: 'window-steps-v1' }
                : { action: 'create', kind: 'powerpoint', name: attached.name.slice(0, 180), pages: attached.pages, initialPage: attached.page, ...((bridge.version === 2 || bridge.version === 3) && bridge.step ? { navigationMode: 'powerpoint-steps-v1' } : {}) });
            if (!response.session) throw new Error('Presentation unavailable');
            if (!mounted.current || generation.current !== current || !nativeShareCurrent(share) || provided?.current?.() === false) { closeSession(response.session); void bridge.disconnect(attached.id).catch(() => undefined); return false; }
            const local = attached;
            nativeControl.current = createNativePresentationControl({ bridge, native: local,
                current: () => mounted.current && generation.current === current && nativeShareCurrent(share),
                request, changed: updateOwn, failed: failNative, unavailable: () => setControlError(true) });
            setNative(local); updateOwn(response.session); setControlError(false); if (!isNativeWindowPresentation(local)) { setHelperPair(undefined); pendingHelper.current = undefined; } return true;
        } catch {
            if (attached?.id) void bridge.disconnect(attached.id).catch(() => undefined);
            if (mounted.current && generation.current === current) { closeSession(ownRef.current); updateOwn(undefined); setError(text.failed); }
            return false;
        } finally {
            if (pendingNativeShare.current === share) pendingNativeShare.current = undefined;
            if (mounted.current && generation.current === current) { flight.current = false; setBusy(false); }
        }
    };
    const preparePptx = async (kind?: 'window', resumePair = false) => {
        if (!connected || nativeBusy || busy || (!kind && screenSharing)) return;
        requestedKind.current = kind;
        const bridge = getNativeBridge();
        if (kind === 'window' && powerPointBridge(window) && bridge?.version !== 3) { setError(windowText.upgrade); cancelWindowIntent(); return; }
        if (!bridge || (bridge.version !== 2 && bridge.version !== 3) || !bridge.prepare) { setError(nativeText.helperRequired); return; }
        nativeFlight.current = true; flight.current = true; setNativeBusy(true); setError('');
        const current = generation.current, intent = windowIntent.current, helper = helperRef.current;
        const share = kind === 'window' ? intent?.share : undefined;
        const intentCurrent = () => !!intent && windowIntent.current === intent && intent.localSid === room.localParticipant.sid && intent.token === token && nativeShareCurrent(share);
        const cancelStaleIntent = () => { if (windowIntent.current === intent) { cancelWindowIntent(); setHelperPair(undefined); } };
        let createdWindow: CoPresentation | undefined;
        try {
            if (kind === 'window' && !intentCurrent()) { cancelStaleIntent(); return; }
            if (bridge === helper && !(await helper!.connection()).connected) {
                if (!mounted.current || generation.current !== current || helperRef.current !== helper || kind === 'window' && !intentCurrent()) { cancelStaleIntent(); return; }
                if (resumePair) { setError(nativeText.helperMissing); return; }
                const pair = await helper!.pair();
                if (mounted.current && generation.current === current && (!kind || intentCurrent())) {
                    pendingHelper.current = {operation:'prepare',kind,sid:room.localParticipant.sid,token,generation:current,share:share!};
                    setHelperPair(pair);
                    launchPresentationHelper(window,pair.code);
                }
                return;
            }
            if (kind === 'window' && !intentCurrent()) { cancelStaleIntent(); return; }
            const selected = await bridge.prepare(kind ? { kind } : undefined);
            if (!mounted.current || generation.current !== current || kind === 'window' && !intentCurrent()) { cancelStaleIntent(); return; }
            if (selected && isNativeWindowPresentation(selected)) {
                if (!intent || !intentCurrent()) { cancelStaleIntent(); return; }
                const caster = intent.identity ? room.remoteParticipants.get(intent.identity) : undefined;
                if (intent.identity && caster?.sid !== intent.sid) { cancelWindowIntent(); return; }
                const attached = await bridge.start!({ preparedId: selected.preparedId });
                if (!mounted.current || !intentCurrent()) { void bridge.disconnect(attached.id).catch(() => undefined); cancelStaleIntent(); return; }
                if (!(await connectNative({ bridge, native: attached, current: intentCurrent }, false, share))) { cancelStaleIntent(); return; }
                const session = ownRef.current;
                if (session?.kind === 'window') createdWindow = session;
                if (!intentCurrent() || !session || session.kind !== 'window') { if (session?.kind === 'window') { closeSession(session); stopNative(); updateOwn(undefined); } return; }
                if (intent.identity && intentCurrent() && room.remoteParticipants.get(intent.identity)?.sid === intent.sid) {
                    const response = await request({ action: 'delegate', ...binding(session), controllerIdentity: intent.identity, controllerSid: intent.sid, requireAcceptance: true });
                    if (mounted.current && intentCurrent() && ownRef.current?.id === session.id && intent.localSid === room.localParticipant.sid && room.remoteParticipants.get(intent.identity)?.sid === intent.sid && response.session?.controller?.identity === intent.identity && response.session.controller.sid === intent.sid) { updateOwn(response.session); setControlError(false); }
                    else if (response.session) { closeSession(response.session); if (ownRef.current?.id === response.session.id) { stopNative(); updateOwn(undefined); } }
                }
                cancelWindowIntent(); setPrepared(undefined); setCapturePending(false); setHelperPair(undefined); return;
            }
            if (!selected) { cancelWindowIntent(); setHelperPair(undefined); return; }
            if (kind === 'window') throw new Error('Window navigation unavailable');
            if (selected) {
                if (nativeControl.current) {
                    const cleanup = load(), selectedGeneration = generation.current;
                    await cleanup;
                    if (!mounted.current || generation.current !== selectedGeneration) return;
                }
                setPrepared(selected); setCapturePending(false); setHelperPair(undefined);
            }
         } catch {
            if (kind === 'window') {
                if (createdWindow) {
                    closeSession(createdWindow);
                    if (ownRef.current?.id === createdWindow.id && ownRef.current.generation === createdWindow.generation) { stopNative(); updateOwn(undefined); }
                }
                cancelWindowIntent(); setHelperPair(undefined);
            }
            if (mounted.current) setError(text.failed);
        }
        finally { nativeFlight.current = false; flight.current = false; if (mounted.current) setNativeBusy(false); }
    };
    resumeHelper.current = () => {
        const intent = pendingHelper.current;
        if (!intent) return;
        if (intent.sid !== room.localParticipant.sid || intent.token !== token || intent.generation !== generation.current || !nativeShareCurrent(intent.share)) { cancelWindowIntent(); setHelperPair(undefined); return; }
        pendingHelper.current = undefined;
        if (intent.operation === 'connect') void connectNative(undefined,true,intent.share);
        else void preparePptx(intent.kind,true);
    };
    const retryHelper = () => { const pending = pendingHelper.current; if (pending && !nativeShareCurrent(pending.share)) { cancelWindowIntent(); setHelperPair(undefined); return; } if (pending?.operation === 'connect') void connectNative(undefined,false,pending.share); else void preparePptx(requestedKind.current); };
    const showPptx = async () => {
        if (!connected || nativeBusy || busy || !prepared) return;
        if (screenSharing || room.localParticipant.getTrackPublication?.(Track.Source.ScreenShare)?.track) { setError(nativeText.stopCurrent); return; }
        const bridge = getNativeBridge();
        if (!bridge || (bridge.version !== 2 && bridge.version !== 3) || !bridge.start) { setError(nativeText.helperRequired); return; }
        nativeFlight.current = true; flight.current = true; setNativeBusy(true); setError('');
        const current = generation.current;
        try {
            if (!native || ownRef.current?.kind !== 'powerpoint') {
                const attached = await bridge.start({ preparedId: prepared.preparedId });
                if (!mounted.current || generation.current !== current) { void bridge.disconnect(attached.id).catch(() => undefined); return false; }
                if (!(await connectNative({ bridge, native: attached }))) return;
                if (mounted.current) setCapturePending(true);
                return;
            }
            // A fresh owner click supplies transient activation for the picker.
            await room.localParticipant.setScreenShareEnabled(true, { audio: true });
            if (mounted.current) setCapturePending(false);
        } catch { if (mounted.current) setError(text.failed); }
        finally { nativeFlight.current = false; flight.current = false; if (mounted.current) setNativeBusy(false); }
    };
    const start = async () => {
        const visible = canvas.current, selected = fileRef.current, current = generation.current;
        if (!visible || !selected || !connected || busy || pages < 1) return;
        setError(''); setBusy(true);
        try {
            const published = await capture.current?.start(visible, () => generation.current === current && fileRef.current === selected);
            if (published && mounted.current && generation.current === current && fileRef.current === selected) await create(selected,pages);
        } catch { if (mounted.current && generation.current === current) setError(text.failed); }
        finally { if (mounted.current && generation.current === current) setBusy(false); }
    };
    const stopOwnedPresentation = async (session: CoPresentation) => {
        const current = generation.current, owner = ownRef.current;
        if (!mounted.current || !owner || owner.id !== session.id || owner.generation !== session.generation || owner.owner.identity !== room.localParticipant.identity || owner.owner.sid !== room.localParticipant.sid || stopping.current) return;
        const ownedCapture = capture.current, screen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
        const screenAudio = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
        if (session.kind === 'pdf' ? !ownedCapture?.isSharing() : !native || !screen || screen.mediaStreamTrack.readyState !== 'live') return;
        const operation = {}; stopping.current = operation; setStopBusy(true); setError('');
        let completed = current;
        try {
            if (session.kind === 'pdf') await ownedCapture!.stop();
            else {
                // Snapshot before any await. The SDK source-based toggle waits
                // for republish and could otherwise stop a replacement share.
                const tracks = [screen!, ...(screenAudio ? [screenAudio] : [])];
                tracks.forEach(track => track.stop());
                await Promise.all(tracks.map(track => room.localParticipant.unpublishTrack(track)));
            }
            if (!mounted.current || generation.current !== current || ownRef.current?.id !== session.id || ownRef.current.generation !== session.generation) return;
            if (session.kind === 'pdf' ? ownedCapture!.isSharing() : room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track === screen && screen?.mediaStreamTrack.readyState === 'live') throw new Error('Presentation stop not confirmed');
            // Media ended first. Invalidate pending navigation before closing only
            // this captured server session; the file/canvas/Room remain mounted.
            completed = ++generation.current; epoch.current++; stopNative();
            if (session.kind !== 'pdf') { setPrepared(undefined); setCapturePending(false); }
            updateOwn(undefined); setSessions(list => list.filter(item => item.id !== session.id || item.generation !== session.generation));
            flight.current = false; setBusy(false); controls.current?.clear();
            await request({ action: 'revoke', ...binding(session), close: true });
        } catch (cause) {
            if (mounted.current && generation.current === completed) setError(text.failed);
            throw cause;
        } finally { if (stopping.current === operation) { stopping.current = undefined; if (mounted.current) setStopBusy(false); } }
    };
    const presentationSharing = (session: CoPresentation) => {
        if (session.owner.identity === room.localParticipant.identity && session.owner.sid === room.localParticipant.sid) return session.kind === 'pdf' ? sharing && !!capture.current?.isSharing() : !!native && screenSharing;
        const participant = room.remoteParticipants.get(session.owner.identity);
        const screen = participant?.sid === session.owner.sid ? participant.getTrackPublication(Track.Source.ScreenShare) : undefined;
        return !!screen?.track && !screen.isMuted && screen.track.mediaStreamTrack.readyState === 'live';
    };
    const recipientScreenReady = (session: CoPresentation) => {
        const participant = room.remoteParticipants.get(session.owner.identity);
        const screen = participant?.sid === session.owner.sid ? participant.getTrackPublication(Track.Source.ScreenShare) : undefined;
        return !!screen?.track && screen.trackSid === recipientScreens.current.get(slideControlsId(session)) && !screen.isMuted && screen.track.mediaStreamTrack.readyState === 'live';
    };
    const recipientBaseKey = (session: CoPresentation) => JSON.stringify([slideControlsId(session),room.localParticipant.identity,room.localParticipant.sid]);
    const recipientAcceptanceKey = (session: CoPresentation) => presentationRecipientAcceptanceKey(session,room.localParticipant.identity,room.localParticipant.sid,recipientScreens.current.get(slideControlsId(session)) || '');
    const recipientAccepted = (session: CoPresentation) => presentationRecipientAccepted(session) && acceptedRecipients.current.has(recipientAcceptanceKey(session)) && !declinedRecipients.current.has(recipientBaseKey(session));
    const remotePresentationReady = (session: CoPresentation) => recipientScreenReady(session) && recipientAccepted(session);
    const controlledSessions = [
        ...(own ? [own] : []),
        ...sessions.filter(session => session.id !== own?.id && session.controller?.identity === room.localParticipant.identity && session.controller.sid === room.localParticipant.sid),
    ];
    const activeControls = controlledSessions.find(session => session.id === selectedControls) || controlledSessions[0];
    const isOwner = (session: CoPresentation) => session.owner.identity === room.localParticipant.identity && session.owner.sid === room.localParticipant.sid;
    const currentRecipientScope = recipientScope.current;
    const sameRecipientScope = currentRecipientScope.room === room && currentRecipientScope.token === token && currentRecipientScope.studioId === studioId && currentRecipientScope.roomName === roomName;
    const recipientSessions = connected && sameRecipientScope ? recipientSlideSessions(sessions, room.localParticipant.identity, room.localParticipant.sid) : [];
    const recipientOnly = !!recipientSessions.length && !own;
    const recipientSignature = recipientSessions.map(slideControlsId).join('|');
    useEffect(() => {
        // Do not steal the owner's selected controls when receiving another grant.
        if (!nativeControlsReady || own) return;
        const fresh = recipientSessions.find(session => !nativeRecipientSeen.current.has(slideControlsId(session)));
        for (const session of recipientSessions) nativeRecipientSeen.current.add(slideControlsId(session));
        if (fresh) setSelectedControls(fresh.id);
    }, [recipientSignature, nativeControlsReady, !!own]);
    const pending = presentationNavigationPending;
    controlsAction.current = async event => {
        if (!mounted.current) return;
        const session = controlledSessions.find(item => slideControlsId(item) === event.id);
        if (!session) return;
        if (event.action === 'stop') { if (isOwner(session)) return stopOwnedPresentation(session); return; }
        if (!connected || controlError || flight.current || !presentationSharing(session)) return;
        if (event.action === 'delegate') {
            if (!isOwner(session) || !casters.some(caster => caster.identity === event.controllerIdentity)) return;
            const controller = room.remoteParticipants.get(event.controllerIdentity);
            if (!controller) return;
            return mutate({ action: 'delegate', ...binding(session), controllerIdentity: event.controllerIdentity, controllerSid: controller.sid, requireAcceptance: true });
        }
        if (event.action === 'reclaim') {
            if (!isOwner(session) || !session.controller) return;
            return mutate({ action: 'revoke', ...binding(session) });
        }
        if (event.action !== 'previous' && event.action !== 'next' || pending(session) || !presentationDirectionAllowed(session,event.action) || !isOwner(session) && !remotePresentationReady(session)) return;
        return mutate({ action: 'navigate', ...binding(session), revision: session.revision, direction: event.action });
    };
    useEffect(() => {
        if (!publishNavigation) return;
        const grants: PresentationScreenNavigation[] = [];
        const currentGrants = new Set(recipientSessions.map(slideControlsId));
        for (const id of recipientScreens.current.keys()) if (!currentGrants.has(id)) recipientScreens.current.delete(id);
        if (connected && !controlError && sameRecipientScope) for (const session of recipientSessions) {
            const participant = room.remoteParticipants.get(session.owner.identity);
            const screen = participant?.getTrackPublication(Track.Source.ScreenShare);
            if (!participant || !presentationScreenGrant(session,room.localParticipant.identity,room.localParticipant.sid,participant.identity,participant.sid) || !screen?.track || screen.isMuted || screen.track.mediaStreamTrack.readyState !== 'live') continue;
            const id = slideControlsId(session);
            const bound = recipientScreens.current.get(id);
            if (bound && bound !== screen.trackSid) continue;
            if (!bound) recipientScreens.current.set(id,screen.trackSid);
            grants.push({ id, ownerIdentity: participant.identity, ownerSid: participant.sid, trackSid: screen.trackSid, ready: !busy && !nativeBusy && !pending(session) && recipientAccepted(session), navigate: direction => {
                const current = room.remoteParticipants.get(session.owner.identity)?.getTrackPublication(Track.Source.ScreenShare);
                if (room.state !== 'connected' || current?.trackSid !== screen.trackSid || current?.track !== screen.track || current.isMuted || !current.track || current.track.mediaStreamTrack.readyState !== 'live') return;
                void controlsAction.current({id,action:direction}).catch(() => undefined);
            } });
        }
        publishNavigation(grants);
        return () => publishNavigation([]);
    }, [publishNavigation, room, token, studioId, roomName, sessions, connected, controlError, busy, nativeBusy, sameRecipientScope, acceptanceRevision]);
    const acceptRecipient = async (session: CoPresentation, automatic = false) => {
        const key = recipientAcceptanceKey(session), base = recipientBaseKey(session), scope = recipientScope.current;
        if (!connected || controlError || !recipientScreenReady(session) || !key || declinedRecipients.current.has(base) || acceptanceFlights.current.has(key) || automatic && autoAcceptAttempted.current.has(key)) return;
        if (automatic) autoAcceptAttempted.current.add(key);
        acceptanceFlights.current.add(key);
        try {
            const response = await request({action:'accept-control',...binding(session)});
            const accepted = response.session;
            if (!mounted.current || recipientScope.current !== scope || key !== recipientAcceptanceKey(session) || declinedRecipients.current.has(base) || !accepted || slideControlsId(accepted) !== slideControlsId(session) || accepted.controller?.identity !== room.localParticipant.identity || accepted.controller.sid !== room.localParticipant.sid || !presentationRecipientAccepted(accepted)) return;
            acceptedRecipients.current.add(key); setAcceptanceRevision(value=>value+1);
            setSessions(list=>list.map(item=>slideControlsId(item)===slideControlsId(session)?accepted:item));
        } catch { if (mounted.current && recipientScope.current === scope) setError(text.failed); }
        finally { acceptanceFlights.current.delete(key); }
    };
    const releaseRecipient = async (session: CoPresentation) => {
        const base = recipientBaseKey(session), key = recipientAcceptanceKey(session), scope = recipientScope.current;
        declinedRecipients.current.add(base); acceptedRecipients.current.delete(key); setAcceptanceRevision(value=>value+1);
        try {
            const response = await request({action:'release-control',...binding(session)});
            if (mounted.current && recipientScope.current === scope && response.session) setSessions(list=>list.map(item=>slideControlsId(item)===slideControlsId(session)?response.session!:item));
        } catch { if (mounted.current && recipientScope.current === scope) setError(text.failed); }
    };
    useEffect(() => {
        let changed = false;
        if (connected && sameRecipientScope) for (const session of recipientSessions) {
            const key = recipientAcceptanceKey(session);
            if (!key || !recipientScreenReady(session) || declinedRecipients.current.has(recipientBaseKey(session))) continue;
            if (presentationRecipientAccepted(session)) {
                if (!acceptedRecipients.current.has(key)) { acceptedRecipients.current.add(key); changed = true; }
            } else if ((navigation?.preferencesReady ?? true) && (navigation?.autoAccept ?? true)) void acceptRecipient(session,true);
        }
        if (changed) setAcceptanceRevision(value=>value+1);
        for (const entries of [acceptedRecipients.current,declinedRecipients.current,autoAcceptAttempted.current]) while (entries.size>512) entries.delete(entries.values().next().value!);
    },[sessions, connected, sameRecipientScope, navigation?.autoAccept, navigation?.preferencesReady, casters]);
    const controlsState = (session: CoPresentation) => {
        const owner = isOwner(session), id = slideControlsId(session), actualSharing = presentationSharing(session);
        const controllerName = session.controller?.identity === room.localParticipant.identity ? room.localParticipant.name || room.localParticipant.identity : session.controller ? casters.find(caster => caster.identity === session.controller?.identity)?.name || session.controller.identity : '';
        return { id, title: slideControlsText(session.name, text.title), controller: slideControlsText(controllerName ? `${text.delegated}: ${controllerName}` : text.localControls, text.localControls), ...(session.kind === 'window' ? {} : { page: session.renderedPage > 0 ? session.renderedPage : session.page, pages: session.pages }), ...(session.navigationMode ? { navigationMode: session.navigationMode } : {}), canNavigate: actualSharing && !controlError && !pending(session) && (owner || remotePresentationReady(session)), canReclaim: !controlError && owner && !!session.controller, busy: busy || nativeBusy || pending(session), locale, toolbar: { canDelegate: actualSharing && !controlError && owner, canStop: owner && actualSharing, sharing: actualSharing, controllerIdentity: session.controller?.identity || null, participants: owner ? casters.filter(caster => caster.identity !== session.owner.identity && caster.identity.length <= 256 && !/[\u0000-\u001f\u007f]/.test(caster.identity)).slice(0,100).map(caster => ({ identity: caster.identity, name: slideControlsText(caster.name,caster.identity) })) : [] } };
    };
    useEffect(() => {
        const adapter = controls.current;
        if (!adapter) return;
        if (!connected || !activeControls || !presentationSharing(activeControls) || controlError && !(isOwner(activeControls) && presentationSharing(activeControls))) { adapter.clear(); return; }
        const session = activeControls, owner = isOwner(session), id = slideControlsId(session), actualSharing = presentationSharing(session);
        const nativeScope = recipientScope.current, nativeEpoch = epoch.current;

        void adapter.update(controlsState(session), pendingNative.current !== id && (owner ? actualSharing : remotePresentationReady(session))).then(() => {
            if (pendingNative.current === id && mounted.current && controls.current === adapter && recipientScope.current === nativeScope && epoch.current === nativeEpoch && currentControlsGrant.current === id) { pendingNative.current = ''; void showCurrentNative(); }
        });

    }, [own, sessions, selectedControls, connected, controlError, busy, nativeBusy, locale, casters, sharing, screenSharing, native, acceptanceRevision]);
    const openControls = (session: CoPresentation) => {
        const adapter = controls.current, grant = slideControlsId(session);
        if (!adapter || !controlledSessions.some(item => slideControlsId(item) === grant) || !connected || !presentationSharing(session) || !isOwner(session) && !remotePresentationReady(session) || controlError && !(isOwner(session) && presentationSharing(session))) return;
        if (adapter.native) {
            if (activeControls?.id === session.id) void showCurrentNative();
            else { pendingNative.current = grant; setSelectedControls(session.id); }
            return;
        }
        const scope = recipientScope.current, version = epoch.current, ticket = {}; floatingRequest.current = ticket;
        currentControlsGrant.current = grant;
        // Browser update is synchronous; requestWindow runs in this same click,
        // including when selecting a different exact recipient grant.
        void adapter.update(controlsState(session));
        setSelectedControls(session.id); setFloatingFailed(false);
        void adapter.show().then(opened => {
            if (!mounted.current || controls.current !== adapter || recipientScope.current !== scope || epoch.current !== version || floatingRequest.current !== ticket || currentControlsGrant.current !== grant) return;
            if (opened) return;
            setFloatingFailed(true); setNativeGrant('');
            if (!isOwner(session)) setRecipientReopen(value => value + 1);
            else menu.current?.showPopover();
        });
    };
    const windowText = {
      ru: { title: 'Управлять открытым PDF', choose: 'Выбрать окно PDF и подключить', controller: 'Кто будет переключать страницы', local: 'Только я', launch: 'Подключение клиента CastLink', required: 'Подтвердите открытие клиента CastLink и подключение на этом компьютере. Если клиент не установлен, установите его и повторите подключение.', retry: 'Повторить подключение', install: 'Установить клиент CastLink', upgrade: 'После установки откройте эту комнату в новом клиенте CastLink или в браузере.', foreground: 'Верните выбранное окно PDF на передний план' },
      en: { title: 'Control an open PDF', choose: 'Choose PDF window and connect', controller: 'Who will turn pages', local: 'Only me', launch: 'Connecting CastLink client', required: 'Confirm opening the CastLink client and this connection on this computer. If it is not installed, install it and retry.', retry: 'Retry connection', install: 'Install CastLink client', upgrade: 'After installing, open this room in the new CastLink client or in a browser.', foreground: 'Bring the selected PDF window to the foreground' },
      'zh-CN': { title: '控制已打开的 PDF', choose: '选择 PDF 窗口并连接', controller: '谁来翻页', local: '仅我自己', launch: '正在连接 CastLink 客户端', required: '请确认打开 CastLink 客户端并在此计算机上连接。如果尚未安装，请安装后重试。', retry: '重试连接', install: '安装 CastLink 客户端', upgrade: '安装后请在新版 CastLink 客户端或浏览器中打开此房间。', foreground: '请将选定的 PDF 窗口置于前台' },
    }[locale];
    const beginWindow = () => {
        const share = captureNativeShare(); if (!share) return;
        const controller = windowController ? room.remoteParticipants.get(windowController) : undefined;
        if (windowController && !controller) return;
        windowIntent.current = { identity: controller?.identity || '', sid: controller?.sid || '', localSid: room.localParticipant.sid, token, share };
        void preparePptx('window');
    };
    const navigationKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!activeControls || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); act(['ArrowLeft','ArrowUp','PageUp'].includes(event.key) ? 'previous' : 'next');
    };
    const controlsButton = (session: CoPresentation) => nativeControlsReady || browserControlsReady ? <button type="button" className="button-secondary" disabled={!connected || !isOwner(session) && !remotePresentationReady(session) || controlError && !(isOwner(session) && presentationSharing(session))} onClick={() => openControls(session)}>{text.floating}</button> : null;
    const currentName = activeControls?.controller
        ? activeControls.controller.identity === room.localParticipant.identity ? text.you : casters.find(caster => caster.identity === activeControls.controller?.identity)?.name || activeControls.controller.identity
        : activeControls && isOwner(activeControls) ? text.you : '';
    const canAct = !!activeControls && connected && !busy && !nativeBusy && !controlError && !pending(activeControls);
    const canNavigate = canAct && !!activeControls && presentationSharing(activeControls) && (isOwner(activeControls) || remotePresentationReady(activeControls));
    const rememberNavigationFocus = usePresentationNavigationButtonFocus(activeControls ? slideControlsId(activeControls) : '', !canNavigate || !menuOpen);
    const candidates = casters.filter(caster => caster.identity !== room.localParticipant.identity).slice(0,100);
    const act = (action: SlideControlsAction['action'], controllerIdentity?: string) => {
        if (action === 'reclaim' || action === 'stop') cancelWindowIntent();
        if (!activeControls) return;
        const id = slideControlsId(activeControls);
        void controlsAction.current(action === 'delegate' ? { id, action, controllerIdentity: controllerIdentity! } : { id, action }).catch(() => undefined);
    };
    const delegation = <details className="co-presentation-delegation co-presentation-owner-actions" open={activeControls && presentationStepMode(activeControls) ? true : undefined}>
          <summary>{locale === "ru" ? "Управление" : locale === "en" ? "Controls" : "控制"}{activeControls && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}</summary>
          {candidates.length ? <div className="co-presentation-casters" role="radiogroup" aria-label={text.caster} onKeyDown={casterKeyboard}>{candidates.map(caster => <button key={caster.identity} type="button" role="radio" aria-checked={activeControls?.controller?.identity === caster.identity} disabled={!canAct || stopBusy} onClick={() => act('delegate', caster.identity)}><span className="co-presentation-radio" aria-hidden="true" /><span>{caster.name}</span></button>)}</div> : <p className="co-presentation-empty">{text.noCasters}</p>}
          {activeControls?.controller && <button type="button" className="button-secondary co-presentation-reclaim" disabled={!canAct || stopBusy} onClick={() => act('reclaim')}>{text.reclaim}</button>}
        </details>;
    const fileMenuId = `${menuId}-prepared`, fileMenu = useRef<HTMLDivElement>(null);
    const fileText = {ru:{upload:'Загрузить PPTX или PDF',remove:'Удалить файл'},en:{upload:'Upload PPTX or PDF',remove:'Delete file'},'zh-CN':{upload:'上传 PPTX 或 PDF',remove:'删除文件'}}[locale];
    const showCoEntry = connected && (screenSharing || recipientSessions.some(presentationSharing));
    const filePopupToggle = (event: {newState:string}) => {
        if (event.newState !== 'open' || !fileMenu.current || !prepareTrigger.current) return;
        const rect = prepareTrigger.current.getBoundingClientRect(), popup = fileMenu.current, width = Math.min(300,window.innerWidth-24);
        popup.style.width = `${width}px`; popup.style.left = `${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
        const above = rect.top-20, below = window.innerHeight-rect.bottom-20, useAbove = above >= 160 || above >= below;
        popup.style.maxHeight = `${Math.max(100,useAbove ? above : below)}px`;
        popup.style.top = useAbove ? 'auto' : `${rect.bottom+8}px`; popup.style.bottom = useAbove ? `${window.innerHeight-rect.top+8}px` : 'auto';
    };
    const sourceControls = <input id={fileInputId} type="file" hidden accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={!connected || converting || sharing} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (selected) void load(selected); }} />;
    currentControlsGrant.current = activeControls ? slideControlsId(activeControls) : '';
    const showCurrentNative = async () => {
        const adapter = controls.current, scope = recipientScope.current, grant = currentControlsGrant.current, version = epoch.current;
        if (!adapter || !grant) return;
        const opened = await adapter.show();
        if (!mounted.current || controls.current !== adapter || recipientScope.current !== scope || currentControlsGrant.current !== grant || epoch.current !== version) return;
        if (opened) return;
        setNativeGrant('');
        if (recipientOnly) setRecipientReopen(value => value + 1);
        else menu.current?.showPopover();
    };
    return <div className="co-presentation-control">
      {sourceControls}
      {file ? <button ref={prepareTrigger} type="button" className="native-pptx-prepare" popoverTarget={fileMenuId} aria-haspopup="dialog" title={file.name}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5" /></svg><span>{file.name}</span><svg className="co-presentation-menu-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
        : <button ref={prepareTrigger} type="button" className="native-pptx-prepare" title={text.hint} disabled={!connected || converting || sharing} onClick={() => document.getElementById(fileInputId)?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8m-4-4v8" /></svg><span>{fileText.upload}</span></button>}
      <div ref={fileMenu} id={fileMenuId} className="presentation-file-menu" popover="auto" role="dialog" aria-label={file?.name || fileText.upload} onToggle={filePopupToggle}>
        <button type="button" disabled={!file || !connected || busy || screenSharing || !painted || painted.file !== file || pages < 1} onClick={() => { fileMenu.current?.hidePopover(); void start(); }}>{text.start}</button>
        <button type="button" className="button-secondary" disabled={sharing} onClick={() => { fileMenu.current?.hidePopover(); void load(); }}>{fileText.remove}</button>
      </div>
      {converting && <div className="co-presentation-upload"><p role="status">{fileProgress?.phase === 'uploading' ? text.uploading : fileProgress?.phase === 'receiving' ? text.receiving : text.converting}{fileProgress?.percent === undefined ? '' : ` ${fileProgress.percent}%`}</p><progress max={100} value={fileProgress?.percent} aria-label={text.uploading} /><button type="button" className="button-secondary" onClick={() => void load()}>{text.cancel}</button></div>}
      {file && pages === 0 && !error && <small role="status">{text.opening}{pdfProgress === undefined ? '' : ` ${pdfProgress}%`}</small>}
      {file && <div hidden data-prepared-presentation><PdfPresentationViewer file={file} page={page} onProgress={(percent,loaded) => { if (fileRef.current === loaded) setPdfProgress(percent); }} onLoaded={(total,loaded) => { if (fileRef.current === loaded) setPages(total); }} onRendered={(rendered,loaded) => { if (fileRef.current === loaded) setPainted({file:loaded,page:rendered}); }} onCanvasReady={(visible,loaded) => { if (fileRef.current === loaded) canvas.current = visible; }} onError={(_message,loaded) => { if (fileRef.current === loaded) { setError(translateWorkspaceMessage(t,_message)); canvas.current = undefined; void capture.current?.stop(); } }} /></div>}
      {error && !showCoEntry && <p className="co-presentation-message" role="alert">{error}</p>}
      {helperPair && <div ref={helperDialog} className="native-pptx-pair" popover="auto" role="dialog" aria-label={windowText.launch} onToggle={event => { if (event.newState === 'closed') { setHelperPair(undefined); cancelWindowIntent(); } }}><strong>{windowText.launch}</strong><p>{windowText.required}</p><a className="button-secondary" href={PRESENTER_INSTALLER_URL} target="_blank" rel="noopener noreferrer">{windowText.install}</a><button type="button" disabled={nativeBusy} onClick={retryHelper}>{windowText.retry}</button><button type="button" className="button-secondary" onClick={closeHelperPair}>{text.menuClose}</button></div>}

      {showCoEntry && <button ref={trigger} type="button" className="co-presentation-trigger" popoverTarget={recipientOnly ? undefined : menuId} aria-controls={recipientOnly ? recipientId : menuId} aria-expanded={recipientOnly ? recipientVisible : menuOpen} aria-haspopup="dialog" onClick={() => { if (recipientSessions.length && !own) { setNativeGrant(''); setRecipientReopen(value => value + 1); } }}>
        <span>{text.menu}</span><svg className="co-presentation-menu-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>}
      {capturePending && <p className="native-pptx-capture-hint" role="status">{nativeText.captureHint}</p>}
      <div ref={menu} id={menuId} data-native-steps={!!activeControls && presentationStepMode(activeControls)} className="co-presentation-popover" popover="auto" role="dialog" aria-labelledby={`${menuId}-title`} onToggle={menuToggle}>
        <header ref={heading} className="co-presentation-heading" tabIndex={0} aria-label={text.drag} title={text.drag}>
          <svg className="co-presentation-grip" viewBox="0 0 12 24" aria-hidden="true"><path d="M3 6h.1M9 6h.1M3 12h.1M9 12h.1M3 18h.1M9 18h.1" strokeWidth="3" /></svg>
          <div className="co-presentation-heading-copy"><h2 id={`${menuId}-title`} title={activeControls?.name}>{activeControls?.name || text.menu}</h2>{activeControls && <p className="co-presentation-current">{isOwner(activeControls) && !activeControls.controller ? text.localControls : `${text.delegated}: ${currentName}`}</p>}</div>
          {(nativeControlsReady || browserControlsReady) && activeControls && <button type="button" className="button-secondary co-presentation-close" aria-label={text.floating} title={text.floating} onClick={() => openControls(activeControls)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H4v16h16v-6" /></svg></button>}
          <button type="button" className="button-secondary co-presentation-close" popoverTarget={menuId} popoverTargetAction="hide" onClick={rememberMenuClose} aria-label={text.menuClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14M8 9l4-4 4 4m-4-4v9" /></svg></button>
        </header>
        {controlledSessions.length > 1 && <label className="co-presentation-session-picker">{text.session}<select value={activeControls?.id || ''} onChange={event => setSelectedControls(event.target.value)}>{controlledSessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>}
        {activeControls ? <section className="co-presentation-active" aria-label={text.title}>
          <div className="co-presentation-navigation"><button type="button" className="button-secondary" aria-label={text.previous} disabled={!canNavigate || !presentationDirectionAllowed(activeControls,'previous')} onFocus={rememberNavigationFocus} onKeyDown={navigationKey} onClick={() => act('previous')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>{activeControls.kind !== 'window' && <output aria-label={text.rendered}>{presentationPageLabel(activeControls)}</output>}<button type="button" className="button-secondary" aria-label={text.next} disabled={!canNavigate || !presentationDirectionAllowed(activeControls,'next')} onFocus={rememberNavigationFocus} onKeyDown={navigationKey} onClick={() => act('next')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
            {isOwner(activeControls) && delegation}
          </div>
          {activeControls.controller && activeControls.controllerAccepted === false && <small role="status">{locale === 'ru' ? 'Ожидаем принятия управления' : locale === 'en' ? 'Waiting for control acceptance' : '等待接受控制权'}</small>}
          {pending(activeControls) && <small role="status">{text.pending}</small>}
          <div className="co-presentation-sharing-strip"><span className="co-presentation-sharing" data-sharing={presentationSharing(activeControls)} role="status">{presentationSharing(activeControls) ? text.sharingState : text.idleState}</span>
            {isOwner(activeControls) && presentationSharing(activeControls) && <button type="button" className="co-presentation-stop" disabled={stopBusy} onClick={() => act('stop')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg>{stopBusy ? text.stopping : text.stop}</button>}
          </div>
          {isOwner(activeControls) && activeControls.kind === 'pdf' && !sharing && <button type="button" className="co-presentation-start" disabled={!connected || busy || !painted || painted.file !== file} onClick={() => void start()}>{text.start}</button>}
        </section> : <p className="co-presentation-empty">{text.empty}</p>}
        {own && activeControls?.id !== own.id && presentationSharing(own) && <button type="button" className="co-presentation-stop" disabled={stopBusy} onClick={() => void stopOwnedPresentation(own).catch(() => undefined)}>{stopBusy ? text.stopping : text.stop}</button>}
        {!activeControls && <><p className="co-presentation-empty">{locale === 'ru' ? 'Выберите тот же показ PowerPoint или окно PDF, которое демонстрируете.' : locale === 'en' ? 'Choose the same PowerPoint slideshow or PDF window that you are sharing.' : '请选择正在共享的同一个 PowerPoint 放映或 PDF 窗口。'}</p><button type="button" className="button-secondary" disabled={busy || nativeBusy} onClick={() => void connectNative()}>{nativeText.attach}</button></>}
        {!own && <details className="co-presentation-more"><summary>{windowText.title}</summary><div className="co-presentation-file-content"><label>{windowText.controller}<select value={windowController} disabled={nativeBusy || busy} onChange={event => { windowIntent.current = undefined; setWindowController(event.target.value); }}><option value="">{windowText.local}</option>{candidates.map(caster => <option key={caster.identity} value={caster.identity}>{caster.name}</option>)}</select></label><button type="button" className="button-secondary" disabled={!connected || nativeBusy || busy || !screenSharing} onClick={beginWindow}>{windowText.choose}</button></div></details>}
        {activeControls?.kind === 'window' && activeControls.lastCommand?.error === 'WINDOW_SLIDES_FOREGROUND' && <p role="status">{windowText.foreground}</p>}
        {native && <details className="co-presentation-more"><summary>{text.more}</summary><div className="co-presentation-file-content"><strong className="co-presentation-name">{native.name}</strong><button type="button" className="button-secondary" onClick={() => { generation.current++; epoch.current++; controls.current?.clear(); closeSession(ownRef.current); stopNative(); updateOwn(undefined); }}>{text.disconnect}</button><small className="co-presentation-scope">{text.scope}</small>{activeControls && controlsButton(activeControls)}</div></details>}
        {!nativeControlsReady && activeControls && <small className="co-presentation-floating-hint">{text.floatingHint}</small>}
        {capturePending && <p className="co-presentation-message" role="status">{nativeText.pickWindow}</p>}
        {floatingFailed && <p className="co-presentation-message" role="status">{text.floatingFailed}</p>}
        {controlError && <p className="co-presentation-message" role="status">{text.unavailable}</p>}{error && <p className="co-presentation-message" role="alert">{error}{(error === windowText.upgrade || error === nativeText.helperRequired) && <> <a href={PRESENTER_INSTALLER_URL} target="_blank" rel="noopener noreferrer">{windowText.install}</a></>}</p>}
      </div>
      <RecipientSlideControls key={currentRecipientScope.epoch} id={recipientId} sessions={recipientSessions} available={remotePresentationReady} requiresAcceptance={session => !recipientAccepted(session) && !declinedRecipients.current.has(recipientBaseKey(session))} acceptanceAvailable={recipientScreenReady} onAccept={session => void acceptRecipient(session)} onDecline={session => void releaseRecipient(session)} externalGrant={nativeGrant} onFloat={nativeControlsReady || browserControlsReady ? openControls : undefined} floatingFailed={floatingFailed} browser={!nativeControlsReady} locale={locale} busy={busy} unavailable={!connected || controlError} reopen={recipientReopen} action={event => controlsAction.current(event)} onVisibilityChange={setRecipientVisible} returnFocus={() => trigger.current?.focus({ preventScroll: true })} />
    </div>;
}
