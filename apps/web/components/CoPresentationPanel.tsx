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
import { createNativePresentationControl, powerPointBridge, validNativePresentation, type NativePresentation } from '@/lib/co-presentation-native';
import { createCoPresentationControls, slideControlsId, slideControlsText, type SlideControlsAction } from '@/lib/co-presentation-controls';
import type { CoPresentation } from '@/lib/co-presentation-state';
import { createDesktopStopPanel, desktopScreenBridge } from '@/lib/desktop-stop-panel';
import { createScreenShareStopPanel, documentPictureInPictureApi, type ScreenShareStopPanel, type ScreenShareStopPanelState } from '@/lib/screen-share-stop-panel';
const copy = {
    ru: { drag: 'Переместить панель (стрелки клавиатуры)', floatingHint: 'Перетащите заголовок, чтобы переместить панель. Режим поверх других окон доступен в поддерживаемых Chrome и Edge.', floatingFailed: 'Не удалось открыть панель поверх окон. Управление доступно здесь.', menu: 'Совместная презентация', menuClose: 'Закрыть управление', scope: 'Только переключение слайдов — без доступа к мыши и клавиатуре.', empty: 'Чтобы передать управление, выберите файл PDF или PPTX.', noCasters: 'Других кастеров пока нет. Они появятся здесь после входа в комнату.', current: 'Сейчас управляет', you: 'Вы', reclaim: 'Забрать управление', more: 'Файл и дополнительные действия', sharingState: 'Демонстрация включена', idleState: 'Показ не запущен', chooseShort: 'Выбрать PDF / PPTX', session: 'Выбрать презентацию', title: 'Презентация PDF / PowerPoint', floating: 'Поверх других окон', delegated: 'Управляет', localControls: 'Вы управляете', native: 'Управлять открытым PowerPoint', disconnect: 'Отключить управление PowerPoint', choose: 'Выбрать PDF или PPTX', hint: 'PDF и PPTX до 1,5 ГБ; PPTX преобразуется в PDF без анимации, музыки и видео. Отдельный видеопоток без звука.', uploading: 'Загружаем PowerPoint…', receiving: 'Получаем PDF…', opening: 'Открываем PDF…', cancel: 'Отменить загрузку', retry: 'Слайд уже изменился. Повторите действие после обновления.', converting: 'Преобразуем PowerPoint…', start: 'Показать презентацию', stop: 'Остановить презентацию', previous: 'Назад', next: 'Вперёд', grant: 'Передать управление', revoke: 'Отозвать управление', caster: 'Выберите кастера', page: 'Страница', rendered: 'Показано', pending: 'Ожидаем отображения', control: 'Подключить управление', panel: 'Показать панель остановки', stopTitle: 'Панель остановки презентации', stopLabel: 'ОСТАНОВИТЬ ПРЕЗЕНТАЦИЮ', stopping: 'Останавливаем…', failed: 'Не удалось выполнить действие. Повторите попытку.', size: 'Выберите PDF или PPTX до 1,5 ГБ (1 500 000 000 байт).', other: 'Презентации в комнате', unavailable: 'Управление недоступно. Повторите попытку; передача видео продолжается.', fallback: 'Остановить показ можно здесь. Плавающая панель может потребовать отдельного нажатия.', error: 'Не удалось открыть презентацию.', close: 'Закрыть файл' },
    en: { drag: 'Move controls (arrow keys)', floatingHint: 'Drag the heading to move controls. Supported Chrome and Edge browsers can show them above other windows.', floatingFailed: 'Could not open controls above other windows. Use the controls here.', menu: 'Co-presentation', menuClose: 'Close controls', scope: 'Slide changes only — no mouse or keyboard access.', empty: 'To give slide controls, choose a PDF or PPTX file.', noCasters: 'No other casters yet. They will appear here after joining the room.', current: 'Current controller', you: 'You', reclaim: 'Reclaim controls', more: 'File and more actions', sharingState: 'Sharing is on', idleState: 'Sharing has not started', chooseShort: 'Choose PDF / PPTX', session: 'Choose presentation', title: 'PDF / PowerPoint presentation', floating: 'Show above other windows', delegated: 'Controlled by', localControls: 'You control', native: 'Control open PowerPoint', disconnect: 'Disconnect PowerPoint controls', choose: 'Choose PDF or PPTX', hint: 'PDF and PPTX up to 1.5 GB; PPTX converts to PDF without animations, music or video. A separate video stream with no audio.', uploading: 'Uploading PowerPoint…', receiving: 'Receiving PDF…', opening: 'Opening PDF…', cancel: 'Cancel loading', retry: 'The slide changed. Retry after the controls refresh.', converting: 'Converting PowerPoint…', start: 'Share presentation', stop: 'Stop presentation', previous: 'Previous', next: 'Next', grant: 'Grant control', revoke: 'Revoke control', caster: 'Choose caster', page: 'Page', rendered: 'Rendered', pending: 'Waiting for render', control: 'Connect controls', panel: 'Show stop panel', stopTitle: 'Presentation stop panel', stopLabel: 'STOP PRESENTATION', stopping: 'Stopping…', failed: 'Action failed. Please retry.', size: 'Choose a PDF or PPTX up to 1.5 GB (1,500,000,000 bytes).', other: 'Room presentations', unavailable: 'Controls unavailable. Please retry; video sharing continues.', fallback: 'You can stop sharing here. Opening the floating panel may require another click.', error: 'Could not open presentation.', close: 'Close file' },
    'zh-CN': { drag: '移动面板（方向键）', floatingHint: '拖动标题可移动面板。受支持的 Chrome 和 Edge 浏览器可将其置于其他窗口上方。', floatingFailed: '无法在其他窗口上方打开面板。请使用此处的控制。', menu: '协同演示', menuClose: '关闭控制菜单', scope: '仅切换幻灯片，不提供鼠标或键盘访问权限。', empty: '要授予幻灯片控制权，请选择 PDF 或 PPTX 文件。', noCasters: '暂无其他参与者。加入房间后，他们将显示在此处。', current: '当前控制者', you: '您', reclaim: '收回控制权', more: '文件和更多操作', sharingState: '正在共享', idleState: '尚未开始共享', chooseShort: '选择 PDF / PPTX', session: '选择演示', title: 'PDF / PowerPoint 演示', floating: '置于其他窗口上方', delegated: '控制者', localControls: '由您控制', native: '控制已打开的 PowerPoint', disconnect: '断开 PowerPoint 控制', choose: '选择 PDF 或 PPTX', hint: 'PDF 和 PPTX 最大 1.5 GB；PPTX 将转换为不含动画、音乐或视频的 PDF。以单独的视频流共享，不包含音频。', uploading: '正在上传 PowerPoint…', receiving: '正在接收 PDF…', opening: '正在打开 PDF…', cancel: '取消加载', retry: '幻灯片已更改。请在控制刷新后重试。', converting: '正在转换 PowerPoint…', start: '共享演示', stop: '停止演示', previous: '上一页', next: '下一页', grant: '授予控制权', revoke: '撤销控制权', caster: '选择参与者', page: '页码', rendered: '已显示', pending: '等待渲染', control: '连接控制', panel: '显示停止面板', stopTitle: '演示停止面板', stopLabel: '停止演示', stopping: '正在停止…', failed: '操作失败，请重试。', size: '请选择最大 1.5 GB（1,500,000,000 字节）的 PDF 或 PPTX。', other: '房间演示', unavailable: '控制暂不可用，请重试；视频共享继续。', fallback: '可在此停止共享。浮动面板可能需要再次点击才能打开。', error: '无法打开演示。', close: '关闭文件' },
};
export function CoPresentationPanel({ room, token, studioId, roomName }: {
    room: Room;
    token: string;
    studioId: string;
    roomName: string;
}) {
    const { locale, t } = useI18n(), text = copy[locale];
    const menuId = useId(), fileInputId = `${menuId}-file`, recipientId = `${menuId}-recipient`;
    const [recipientReopen, setRecipientReopen] = useState(0), [recipientVisible, setRecipientVisible] = useState(false);
    const [nativeControlsReady, setNativeControlsReady] = useState(false), [nativeGrant, setNativeGrant] = useState(''), [nativeVisible, setNativeVisible] = useState(false);
    const [browserControlsReady, setBrowserControlsReady] = useState(false), [floatingFailed, setFloatingFailed] = useState(false);
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
        const rect = button.getBoundingClientRect(), width = Math.min(420, window.innerWidth - 24);
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
    const [native, setNative] = useState<NativePresentation>();
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
    const [screenSharing, setScreenSharing] = useState(false);
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
    const generation = useRef(0), epoch = useRef(0), flight = useRef(false), abort = useRef<AbortController | undefined>(undefined), mounted = useRef(false);
    const updateOwn = (session?: CoPresentation) => { ownRef.current = session; setOwn(session); if (session)
        setPage(session.page); };
    const request = (body: Record<string, unknown>, signal?: AbortSignal) => coPresentationRequest(token, studioId, roomName, body, signal);
    const binding = (session: CoPresentation) => ({ id: session.id, generation: session.generation, controlRevision: session.controlRevision });
    const closeSession = (session?: CoPresentation) => { if (session)
        void request({ action: 'revoke', ...binding(session), close: true }).catch(() => undefined); };
    const stopNative = () => { nativeControl.current?.stop(); nativeControl.current = undefined; setNative(undefined); };
    const failNative = () => {
        nativeFault.current = true;
        const owner = ownRef.current, screen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (owner?.kind === 'powerpoint' && owner.owner.identity === room.localParticipant.identity && owner.owner.sid === room.localParticipant.sid && screen?.track?.mediaStreamTrack.readyState === 'live') {
            // Loss of slide authority must not discard the local media owner.
            // Disconnect only the native control grant and keep STOP available.
            nativeControl.current?.stop(); nativeControl.current = undefined;
            setControlError(true); return;
        }
        controls.current?.clear(); closeSession(owner); stopNative(); updateOwn(undefined); setControlError(true);
    };
    useEffect(() => {
        mounted.current = true;
        recipientScope.current = { room, token, studioId, roomName, epoch: recipientScope.current.epoch + 1 };
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
            setCasters([...room.remoteParticipants.values()].filter(p => { try {
                return JSON.parse(p.metadata || '{}').role === 'guest';
            }
            catch {
                return false;
            } }).map(p => ({ identity: p.identity, name: p.name || p.identity })));
            if (!online) {
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
            if (polling || flight.current)
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
                    if (!local && ownRef.current.kind === 'powerpoint') { failNative(); return; }
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
        if (busy || controlError || !own || !painted || painted.file !== file || painted.page !== own.page || own.renderedRevision === own.revision)
            return;
        void mutate({ action: 'ack', ...binding(own), revision: own.revision, page: painted.page });
    }, [own, painted, file, busy, controlError]);
    const load = async (selected?: File) => {
        controls.current?.clear();
        const current = ++generation.current;
        epoch.current++;
        abort.current?.abort();
        const cancellation = new AbortController();
        abort.current = cancellation;
        closeSession(ownRef.current);
        stopNative(); nativeFault.current = false;
        updateOwn(undefined);
        fileRef.current = undefined;
        canvas.current = undefined;
        setFile(undefined);
        setPainted(undefined);
        setPages(0);
        setPage(1);
        setError('');
        setController('');
        setConverting(false); setFileProgress(undefined); setPdfProgress(undefined);
        flight.current = false;
        setBusy(false);
        await capture.current?.stop();
        if (!selected || current !== generation.current)
            return;
        const pptx = /\.pptx$/i.test(selected.name);
        if (!validPresentationFile(selected)) {
            setError(text.size);
            return;
        }
        let failureText = text.error;
        try {
            let result = selected;
            if (pptx) {
                setConverting(true);
                const blob = await convertPresentationFile({ file: selected, endpoint: `/api/presentation-file?${new URLSearchParams({ studioId, room: roomName })}`, token, signal: cancellation.signal, onProgress: progress => { if (mounted.current && current === generation.current) setFileProgress(progress); } });
                result = new File([blob], selected.name.replace(/\.pptx$/i, '.pdf'), { type: 'application/pdf' });
            }
            if (!mounted.current || current !== generation.current)
                return;
            fileRef.current = result;
            setFile(result);
        }
        catch (cause) {
            if (mounted.current && current === generation.current && !cancellation.signal.aborted) {
                if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' && cause.message.length <= 400) failureText = translateWorkspaceMessage(t, cause.message);
                if (cause && typeof cause === 'object' && 'status' in cause && typeof cause.status === 'number') failureText += ` (HTTP ${cause.status})`;
                setError(failureText);
            }
        }
        finally {
            if (mounted.current && current === generation.current) { setConverting(false); setFileProgress(undefined); }
        }
    };
    const create = async (loaded: File, total: number) => {
        if (fileRef.current !== loaded || flight.current || !connected)
            return;
        const current = generation.current;
        flight.current = true;
        setBusy(true);
        epoch.current++;
        try {
            const response = await request({ action: 'create', name: loaded.name.slice(0, 180), pages: total });
            if (!mounted.current || current !== generation.current || fileRef.current !== loaded) {
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
    const connectNative = async () => {
        const bridge = powerPointBridge(window);
        if (!bridge || !connected || busy) return;
        await load();
        const current = generation.current;
        flight.current = true; setBusy(true); epoch.current++;
        let attached: NativePresentation | undefined;
        try {
            attached = await bridge.connect();
            if (!validNativePresentation(attached)) throw new Error('Invalid PowerPoint response');
            if (!mounted.current || generation.current !== current) { void bridge.disconnect(attached.id).catch(() => undefined); return; }
            const response = await request({ action: 'create', kind: 'powerpoint', name: attached.name, pages: attached.pages, initialPage: attached.page });
            if (!response.session) throw new Error('Presentation unavailable');
            if (!mounted.current || generation.current !== current) { closeSession(response.session); void bridge.disconnect(attached.id).catch(() => undefined); return; }
            const local = attached;
            nativeControl.current = createNativePresentationControl({ bridge, native: local,
                current: () => mounted.current && generation.current === current,
                request, changed: updateOwn, failed: failNative, unavailable: () => setControlError(true) });
            setNative(local); updateOwn(response.session); setControlError(false);
        } catch {
            if (attached?.id) void bridge.disconnect(attached.id).catch(() => undefined);
            if (mounted.current && generation.current === current) { closeSession(ownRef.current); updateOwn(undefined); setError(text.failed); }
        } finally {
            if (mounted.current && generation.current === current) { flight.current = false; setBusy(false); }
        }
    };
    const start = async () => {
        const visible = canvas.current, selected = fileRef.current, current = generation.current;
        if (!visible || !selected || !connected || busy)
            return;
        setError('');
        setBusy(true);
        try {
            await capture.current?.start(visible, () => generation.current === current && fileRef.current === selected);
        }
        catch {
            if (mounted.current && generation.current === current)
                setError(text.failed);
        }
        finally {
            if (mounted.current && generation.current === current)
                setBusy(false);
        }
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
    const pending = (session: CoPresentation) => session.revision !== session.renderedRevision;
    controlsAction.current = async event => {
        if (!mounted.current) return;
        const session = controlledSessions.find(item => slideControlsId(item) === event.id);
        if (!session) return;
        if (event.action === 'stop') { if (isOwner(session)) return stopOwnedPresentation(session); return; }
        if (!connected || controlError || flight.current) return;
        if (event.action === 'delegate') {
            if (!isOwner(session) || !casters.some(caster => caster.identity === event.controllerIdentity)) return;
            return mutate({ action: 'delegate', ...binding(session), controllerIdentity: event.controllerIdentity });
        }
        if (event.action === 'reclaim') {
            if (!isOwner(session) || !session.controller) return;
            return mutate({ action: 'revoke', ...binding(session) });
        }
        if (event.action !== 'previous' && event.action !== 'next' || pending(session)) return;
        return mutate({ action: 'navigate', ...binding(session), revision: session.revision, direction: event.action });
    };
    const controlsState = (session: CoPresentation) => {
        const owner = isOwner(session), id = slideControlsId(session), actualSharing = presentationSharing(session);
        const controllerName = session.controller?.identity === room.localParticipant.identity ? room.localParticipant.name || room.localParticipant.identity : session.controller ? casters.find(caster => caster.identity === session.controller?.identity)?.name || session.controller.identity : '';
        return { id, title: slideControlsText(session.name, text.title), controller: slideControlsText(controllerName ? `${text.delegated}: ${controllerName}` : text.localControls, text.localControls), page: session.renderedPage > 0 ? session.renderedPage : session.page, pages: session.pages, canNavigate: !controlError && !pending(session), canReclaim: !controlError && owner && !!session.controller, busy: busy || pending(session), locale, toolbar: { canDelegate: !controlError && owner, canStop: owner && actualSharing, sharing: actualSharing, controllerIdentity: session.controller?.identity || null, participants: owner ? casters.filter(caster => caster.identity !== session.owner.identity && caster.identity.length <= 256 && !/[\u0000-\u001f\u007f]/.test(caster.identity)).slice(0,100).map(caster => ({ identity: caster.identity, name: slideControlsText(caster.name,caster.identity) })) : [] } };
    };
    useEffect(() => {
        const adapter = controls.current;
        if (!adapter) return;
        if (!connected || !activeControls || controlError && !(isOwner(activeControls) && presentationSharing(activeControls))) { adapter.clear(); return; }
        const session = activeControls, owner = isOwner(session), id = slideControlsId(session), actualSharing = presentationSharing(session);
        const nativeScope = recipientScope.current, nativeEpoch = epoch.current;

        void adapter.update(controlsState(session), pendingNative.current !== id && (!owner || actualSharing)).then(() => {
            if (pendingNative.current === id && mounted.current && controls.current === adapter && recipientScope.current === nativeScope && epoch.current === nativeEpoch && currentControlsGrant.current === id) { pendingNative.current = ''; void adapter.show(); }
        });

    }, [own, sessions, selectedControls, connected, controlError, busy, locale, casters, sharing, screenSharing, native]);
    const openControls = (session: CoPresentation) => {
        const adapter = controls.current, grant = slideControlsId(session);
        if (!adapter || !controlledSessions.some(item => slideControlsId(item) === grant) || !connected || controlError && !(isOwner(session) && presentationSharing(session))) return;
        if (adapter.native) {
            if (activeControls?.id === session.id) void adapter.show();
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
    const controlsButton = (session: CoPresentation) => nativeControlsReady || browserControlsReady ? <button type="button" className="button-secondary" disabled={!connected || controlError && !(isOwner(session) && presentationSharing(session))} onClick={() => openControls(session)}>{text.floating}</button> : null;
    const currentName = activeControls?.controller
        ? activeControls.controller.identity === room.localParticipant.identity ? text.you : casters.find(caster => caster.identity === activeControls.controller?.identity)?.name || activeControls.controller.identity
        : activeControls && isOwner(activeControls) ? text.you : '';
    const canAct = !!activeControls && connected && !busy && !controlError && !pending(activeControls);
    const canNavigate = canAct;
    const candidates = casters.filter(caster => caster.identity !== room.localParticipant.identity).slice(0,100);
    const act = (action: SlideControlsAction['action'], controllerIdentity?: string) => {
        if (!activeControls) return;
        const id = slideControlsId(activeControls);
        void controlsAction.current(action === 'delegate' ? { id, action, controllerIdentity: controllerIdentity! } : { id, action }).catch(() => undefined);
    };
    const delegation = <details className="co-presentation-delegation co-presentation-owner-actions">
          <summary>{locale === "ru" ? "Управление" : locale === "en" ? "Controls" : "控制"}{activeControls && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}</summary>
          {candidates.length ? <div className="co-presentation-casters" role="radiogroup" aria-label={text.caster} onKeyDown={casterKeyboard}>{candidates.map(caster => <button key={caster.identity} type="button" role="radio" aria-checked={activeControls?.controller?.identity === caster.identity} disabled={!canAct || stopBusy} onClick={() => act('delegate', caster.identity)}><span className="co-presentation-radio" aria-hidden="true" /><span>{caster.name}</span></button>)}</div> : <p className="co-presentation-empty">{text.noCasters}</p>}
          {activeControls?.controller && <button type="button" className="button-secondary co-presentation-reclaim" disabled={!canAct || stopBusy} onClick={() => act('reclaim')}>{text.reclaim}</button>}
        </details>;
    const sourceControls = <div className="co-presentation-sources"><label className="button-secondary co-presentation-file" htmlFor={fileInputId}>{text.chooseShort}<input id={fileInputId} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={!connected || converting} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; void load(selected); }} /></label>
        </div>;
    const nativeEntry = nativeControlsReady && !!activeControls;
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
      <button ref={trigger} type="button" className="co-presentation-trigger" popoverTarget={nativeEntry || recipientOnly ? undefined : menuId} aria-controls={nativeEntry ? undefined : recipientOnly ? recipientId : menuId} aria-expanded={nativeEntry ? nativeVisible : recipientOnly ? recipientVisible : menuOpen} aria-haspopup="dialog" onClick={() => { if (nativeEntry) void showCurrentNative(); else if (recipientSessions.length) { setNativeGrant(''); setRecipientReopen(value => value + 1); } }}>
        <span>{text.menu}</span>
      </button>
      {nativeEntry && <button type="button" className="button-secondary co-presentation-files" popoverTarget={menuId} aria-controls={menuId} aria-expanded={menuOpen} aria-label={text.more} title={text.more}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></svg></button>}
      <div ref={menu} id={menuId} className="co-presentation-popover" popover="auto" role="dialog" aria-labelledby={`${menuId}-title`} onToggle={menuToggle}>
        <header ref={heading} className="co-presentation-heading" tabIndex={0} aria-label={text.drag} title={text.drag}>
          <svg className="co-presentation-grip" viewBox="0 0 12 24" aria-hidden="true"><path d="M3 6h.1M9 6h.1M3 12h.1M9 12h.1M3 18h.1M9 18h.1" strokeWidth="3" /></svg>
          <div className="co-presentation-heading-copy"><h2 id={`${menuId}-title`} title={activeControls?.name}>{activeControls?.name || text.menu}</h2>{activeControls && <p className="co-presentation-current">{isOwner(activeControls) && !activeControls.controller ? text.localControls : `${text.delegated}: ${currentName}`}</p>}</div>
          {(nativeControlsReady || browserControlsReady) && activeControls && <button type="button" className="button-secondary co-presentation-close" aria-label={text.floating} title={text.floating} onClick={() => openControls(activeControls)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H4v16h16v-6" /></svg></button>}
          <button type="button" className="button-secondary co-presentation-close" popoverTarget={menuId} popoverTargetAction="hide" onClick={rememberMenuClose} aria-label={text.menuClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14M8 9l4-4 4 4m-4-4v9" /></svg></button>
        </header>
        {controlledSessions.length > 1 && <label className="co-presentation-session-picker">{text.session}<select value={activeControls?.id || ''} onChange={event => setSelectedControls(event.target.value)}>{controlledSessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>}
        {activeControls ? <section className="co-presentation-active" aria-label={text.title}>
          <div className="co-presentation-navigation"><button type="button" className="button-secondary" aria-label={text.previous} disabled={!canNavigate || activeControls.page <= 1} onClick={() => act('previous')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button><output aria-label={text.rendered}>{activeControls.renderedPage > 0 ? activeControls.renderedPage : activeControls.page} / {activeControls.pages}</output><button type="button" className="button-secondary" aria-label={text.next} disabled={!canNavigate || activeControls.page >= activeControls.pages} onClick={() => act('next')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
            {isOwner(activeControls) && delegation}
          </div>
          {pending(activeControls) && <small role="status">{text.pending}</small>}
          <div className="co-presentation-sharing-strip"><span className="co-presentation-sharing" data-sharing={presentationSharing(activeControls)} role="status">{presentationSharing(activeControls) ? text.sharingState : text.idleState}</span>
            {isOwner(activeControls) && presentationSharing(activeControls) && <button type="button" className="co-presentation-stop" disabled={stopBusy} onClick={() => act('stop')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg>{stopBusy ? text.stopping : text.stop}</button>}
          </div>
          {isOwner(activeControls) && activeControls.kind === 'pdf' && !sharing && <button type="button" className="co-presentation-start" disabled={!connected || busy || !painted || painted.file !== file} onClick={() => void start()}>{text.start}</button>}
        </section> : <p className="co-presentation-empty">{text.empty}</p>}
        {own && activeControls?.id !== own.id && presentationSharing(own) && <button type="button" className="co-presentation-stop" disabled={stopBusy} onClick={() => void stopOwnedPresentation(own).catch(() => undefined)}>{stopBusy ? text.stopping : text.stop}</button>}
        {!activeControls && <>{delegation}{sourceControls}</>}
        {converting && <div className="co-presentation-upload"><p role="status">{fileProgress?.phase === 'uploading' ? text.uploading : fileProgress?.phase === 'receiving' ? text.receiving : text.converting}{fileProgress?.percent === undefined ? '' : ` ${fileProgress.percent}%`}</p><progress max={100} value={fileProgress?.percent} aria-label={text.uploading} /><button type="button" className="button-secondary" onClick={() => void load()}>{text.cancel}</button></div>}
        {file && pages === 0 && !error && pages === 0 && <div className="co-presentation-upload"><p role="status">{text.opening}{pdfProgress === undefined ? '' : ` ${pdfProgress}%`}</p><progress max={100} value={pdfProgress} aria-label={text.opening} /><button type="button" className="button-secondary" onClick={() => void load()}>{text.cancel}</button></div>}
        <details className="co-presentation-more"><summary>{text.more}</summary><div className="co-presentation-file-content">
          {activeControls && sourceControls}
          {file && <><strong className="co-presentation-name">{file.name}</strong>

            <PdfPresentationViewer file={file} page={page} onProgress={(percent, loaded) => { if (fileRef.current === loaded) setPdfProgress(percent); }} onLoaded={(total, loaded) => { if (fileRef.current === loaded) {
            setPages(total);
            void create(loaded, total);
        } }} onRendered={(rendered, loaded) => { if (fileRef.current === loaded)
            setPainted({ file: loaded, page: rendered }); }} onCanvasReady={(visible, loaded) => { if (fileRef.current === loaded)
            canvas.current = visible; }} onError={(_message, loaded) => { if (fileRef.current === loaded) {
            setError(translateWorkspaceMessage(t, _message));
            canvas.current = undefined;
            void capture.current?.stop();
        } }}/>
            <div className="co-presentation-file-actions"><button type="button" disabled={sharing ? stopBusy : !connected || busy || !painted || painted.file !== file} onClick={() => sharing ? own ? void stopOwnedPresentation(own).catch(() => undefined) : void capture.current?.stop() : void start()}>{sharing ? text.stop : text.start}</button><button type="button" className="button-secondary" onClick={() => void load()}>{text.close}</button></div>
            {!own && pages > 0 && <button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void create(file, pages)}>{text.control}</button>}
            {sharing && <><small>{text.fallback}</small>{panelState !== 'open' && <button type="button" className="button-secondary" onClick={() => void panel.current?.open()}>{text.panel}</button>}</>}
          </>}
          {native && <><strong className="co-presentation-name">{native.name}</strong><button type="button" className="button-secondary" onClick={() => void load()}>{text.disconnect}</button></>}
          <small className="co-presentation-scope">{text.scope}</small><small>{text.hint}</small>
          {activeControls && controlsButton(activeControls)}
        </div></details>
        {!nativeControlsReady && activeControls && <small className="co-presentation-floating-hint">{text.floatingHint}</small>}
        {floatingFailed && <p className="co-presentation-message" role="status">{text.floatingFailed}</p>}
        {controlError && <p className="co-presentation-message" role="status">{text.unavailable}</p>}{error && <p className="co-presentation-message" role="alert">{error}</p>}
      </div>
      <RecipientSlideControls key={currentRecipientScope.epoch} id={recipientId} sessions={recipientSessions} externalGrant={nativeGrant} onFloat={nativeControlsReady || browserControlsReady ? openControls : undefined} floatingFailed={floatingFailed} browser={!nativeControlsReady} locale={locale} busy={busy} unavailable={!connected || controlError} reopen={recipientReopen} action={event => controlsAction.current(event)} onVisibilityChange={setRecipientVisible} returnFocus={() => trigger.current?.focus({ preventScroll: true })} />
    </div>;
}
