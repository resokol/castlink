'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useI18n } from './I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { PdfPresentationViewer } from './PdfPresentationViewer';
import { coPresentationRequest, createCanvasPresentationCapture } from '@/lib/co-presentation-client';
import { createNativePresentationControl, powerPointBridge, validNativePresentation, type NativePresentation } from '@/lib/co-presentation-native';
import { createCoPresentationControls, slideControlsId, slideControlsText, type SlideControlsAction } from '@/lib/co-presentation-controls';
import type { CoPresentation } from '@/lib/co-presentation-state';
import { createDesktopStopPanel, desktopScreenBridge } from '@/lib/desktop-stop-panel';
import { createScreenShareStopPanel, documentPictureInPictureApi, type ScreenShareStopPanel, type ScreenShareStopPanelState } from '@/lib/screen-share-stop-panel';
const copy = {
    ru: { menu: 'Управление', menuClose: 'Закрыть управление', scope: 'Только переключение слайдов — без доступа к мыши и клавиатуре.', empty: 'Чтобы передать управление, выберите PDF/PPTX или подключите открытый PowerPoint.', noCasters: 'Других кастеров пока нет. Они появятся здесь после входа в комнату.', current: 'Сейчас управляет', you: 'Вы', reclaim: 'Вернуть управление себе', more: 'Файл и дополнительные действия', sharingState: 'Демонстрация включена', idleState: 'Показ не запущен', chooseShort: 'Выбрать PDF / PPTX', officeShort: 'Подключить PowerPoint', session: 'Выбрать презентацию', title: 'Презентация PDF / PowerPoint', floating: 'Открыть окно управления слайдами', delegated: 'Управляет', localControls: 'Вы управляете', native: 'Управлять открытым PowerPoint', nativeHint: 'Запустите показ в PowerPoint, затем покажите его окно через «Демонстрация экрана». Музыка и видео сохраняются в PowerPoint; звук включите при выборе окна. Доступны только переходы между слайдами.', disconnect: 'Отключить управление PowerPoint', choose: 'Выбрать PDF или PPTX', hint: 'PDF до 100 МБ; PPTX до 25 МБ преобразуется в PDF без анимации, музыки и видео. Отдельный видеопоток без звука.', converting: 'Преобразуем PowerPoint…', start: 'Показать презентацию', stop: 'Остановить презентацию', previous: 'Назад', next: 'Вперёд', grant: 'Передать управление', revoke: 'Отозвать управление', caster: 'Выберите кастера', page: 'Страница', rendered: 'Показано', pending: 'Ожидаем отображения', control: 'Подключить управление', panel: 'Показать панель остановки', stopTitle: 'Панель остановки презентации', stopLabel: 'ОСТАНОВИТЬ ПРЕЗЕНТАЦИЮ', stopping: 'Останавливаем…', failed: 'Не удалось выполнить действие. Повторите попытку.', size: 'Выберите PDF до 100 МБ или PPTX до 25 МБ.', other: 'Презентации в комнате', unavailable: 'Управление недоступно. Повторите попытку; передача видео продолжается.', fallback: 'Остановить показ можно здесь. Плавающая панель может потребовать отдельного нажатия.', error: 'Не удалось открыть презентацию.', close: 'Закрыть файл' },
    en: { menu: 'Controls', menuClose: 'Close controls', scope: 'Slide changes only — no mouse or keyboard access.', empty: 'To give slide controls, choose a PDF/PPTX or connect an open PowerPoint slideshow.', noCasters: 'No other casters yet. They will appear here after joining the room.', current: 'Current controller', you: 'You', reclaim: 'Reclaim controls', more: 'File and more actions', sharingState: 'Sharing is on', idleState: 'Sharing has not started', chooseShort: 'Choose PDF / PPTX', officeShort: 'Connect PowerPoint', session: 'Choose presentation', title: 'PDF / PowerPoint presentation', floating: 'Open slide controls window', delegated: 'Controlled by', localControls: 'You control', native: 'Control open PowerPoint', nativeHint: 'Start the PowerPoint slideshow, then share its window using Screen share. Music and video remain in PowerPoint; enable audio when selecting the window. Controls only change slides.', disconnect: 'Disconnect PowerPoint controls', choose: 'Choose PDF or PPTX', hint: 'PDF up to 100 MB; PPTX up to 25 MB converts to PDF without animations, music or video. A separate video stream with no audio.', converting: 'Converting PowerPoint…', start: 'Share presentation', stop: 'Stop presentation', previous: 'Previous', next: 'Next', grant: 'Grant control', revoke: 'Revoke control', caster: 'Choose caster', page: 'Page', rendered: 'Rendered', pending: 'Waiting for render', control: 'Connect controls', panel: 'Show stop panel', stopTitle: 'Presentation stop panel', stopLabel: 'STOP PRESENTATION', stopping: 'Stopping…', failed: 'Action failed. Please retry.', size: 'Choose a PDF up to 100 MB or PPTX up to 25 MB.', other: 'Room presentations', unavailable: 'Controls unavailable. Please retry; video sharing continues.', fallback: 'You can stop sharing here. Opening the floating panel may require another click.', error: 'Could not open presentation.', close: 'Close file' },
    'zh-CN': { menu: '控制', menuClose: '关闭控制菜单', scope: '仅切换幻灯片，不提供鼠标或键盘访问权限。', empty: '要授予幻灯片控制权，请选择 PDF/PPTX 或连接已打开的 PowerPoint 放映。', noCasters: '暂无其他参与者。加入房间后，他们将显示在此处。', current: '当前控制者', you: '您', reclaim: '收回控制权', more: '文件和更多操作', sharingState: '正在共享', idleState: '尚未开始共享', chooseShort: '选择 PDF / PPTX', officeShort: '连接 PowerPoint', session: '选择演示', title: 'PDF / PowerPoint 演示', floating: '打开幻灯片控制窗口', delegated: '控制者', localControls: '由您控制', native: '控制已打开的 PowerPoint', nativeHint: '先在 PowerPoint 中启动幻灯片放映，再通过屏幕共享选择其窗口。音乐和视频保留在 PowerPoint 中；选择窗口时请启用音频。控制仅用于切换幻灯片。', disconnect: '断开 PowerPoint 控制', choose: '选择 PDF 或 PPTX', hint: 'PDF 最大 100 MB；PPTX 最大 25 MB，将转换为不含动画、音乐或视频的 PDF。以单独的视频流共享，不包含音频。', converting: '正在转换 PowerPoint…', start: '共享演示', stop: '停止演示', previous: '上一页', next: '下一页', grant: '授予控制权', revoke: '撤销控制权', caster: '选择参与者', page: '页码', rendered: '已显示', pending: '等待渲染', control: '连接控制', panel: '显示停止面板', stopTitle: '演示停止面板', stopLabel: '停止演示', stopping: '正在停止…', failed: '操作失败，请重试。', size: '请选择不超过 100 MB 的 PDF 或 25 MB 的 PPTX。', other: '房间演示', unavailable: '控制暂不可用，请重试；视频共享继续。', fallback: '可在此停止共享。浮动面板可能需要再次点击才能打开。', error: '无法打开演示。', close: '关闭文件' },
};
export function CoPresentationPanel({ room, token, studioId, roomName }: {
    room: Room;
    token: string;
    studioId: string;
    roomName: string;
}) {
    const { locale, t } = useI18n(), text = copy[locale];
    const menuId = useId(), fileInputId = `${menuId}-file`;
    const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), restoreMenuFocus = useRef(false);
    const [menuOpen, setMenuOpen] = useState(false), [stopBusy, setStopBusy] = useState(false);
    const positionMenu = () => {
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
    const [nativeSupported, setNativeSupported] = useState(false), [native, setNative] = useState<NativePresentation>();
    const nativeControl = useRef<ReturnType<typeof createNativePresentationControl> | undefined>(undefined);
    const [page, setPage] = useState(1), [pages, setPages] = useState(0);
    const [sessions, setSessions] = useState<CoPresentation[]>([]), [own, setOwn] = useState<CoPresentation>();
    const ownRef = useRef<CoPresentation | undefined>(undefined);
    const [painted, setPainted] = useState<{
        file: File;
        page: number;
    }>();
    const [busy, setBusy] = useState(false), [converting, setConverting] = useState(false), [sharing, setSharing] = useState(false);
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
        const slideControls = createCoPresentationControls({ host: window, action: event => controlsAction.current(event) });
        controls.current = slideControls;
        setSelectedControls('');
        setNativeSupported(!!powerPointBridge(window));
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
        setConverting(false);
        flight.current = false;
        setBusy(false);
        await capture.current?.stop();
        if (!selected || current !== generation.current)
            return;
        const pptx = /\.pptx$/i.test(selected.name), pdf = /\.pdf$/i.test(selected.name);
        if ((!pptx && !pdf) || !selected.size || selected.size > (pptx ? 25 : 100) * 1024 * 1024) {
            setError(text.size);
            return;
        }
        let failureText = text.error;
        try {
            let result = selected;
            if (pptx) {
                setConverting(true);
                const form = new FormData();
                form.set('file', selected);
                const response = await fetch(`/api/presentation-file?${new URLSearchParams({ studioId, room: roomName })}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(120000)]) });
                if (!response.ok) {
                    const detail = await response.json().catch(() => null);
                    failureText = typeof detail?.error === 'string' && detail.error.length <= 400
                        ? translateWorkspaceMessage(t, detail.error) : `${text.error} (HTTP ${response.status})`;
                    throw Error();
                }
                const blob = await response.blob();
                if (blob.size > 100 * 1024 * 1024 || !blob.size || !blob.type.includes('application/pdf'))
                    throw Error();
                result = new File([blob], selected.name.replace(/\.pptx$/i, '.pdf'), { type: 'application/pdf' });
            }
            if (!mounted.current || current !== generation.current)
                return;
            fileRef.current = result;
            setFile(result);
        }
        catch {
            if (mounted.current && current === generation.current && !cancellation.signal.aborted)
                setError(failureText);
        }
        finally {
            if (mounted.current && current === generation.current)
                setConverting(false);
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
        if (event.action !== 'previous' && event.action !== 'next' || isOwner(session) && !!session.controller || pending(session)) return;
        return mutate({ action: 'navigate', ...binding(session), revision: session.revision, direction: event.action });
    };
    useEffect(() => {
        const adapter = controls.current;
        if (!adapter) return;
        if (!connected || !activeControls || controlError && !(isOwner(activeControls) && presentationSharing(activeControls))) { adapter.clear(); return; }
        const session = activeControls, owner = isOwner(session), id = slideControlsId(session), actualSharing = presentationSharing(session);
        const controllerName = session.controller?.identity === room.localParticipant.identity ? room.localParticipant.name || room.localParticipant.identity : session.controller ? casters.find(caster => caster.identity === session.controller?.identity)?.name || session.controller.identity : '';
        void adapter.update({ id, title: slideControlsText(session.name, text.title), controller: slideControlsText(controllerName ? `${text.delegated}: ${controllerName}` : text.localControls, text.localControls), page: session.renderedPage > 0 ? session.renderedPage : session.page, pages: session.pages, canNavigate: !controlError && !pending(session) && !(owner && session.controller), canReclaim: !controlError && owner && !!session.controller, busy: busy || pending(session), locale, toolbar: { canDelegate: !controlError && owner, canStop: owner && actualSharing, sharing: actualSharing, controllerIdentity: session.controller?.identity || null, participants: owner ? casters.filter(caster => caster.identity !== session.owner.identity && caster.identity.length <= 256 && !/[\u0000-\u001f\u007f]/.test(caster.identity)).slice(0,100).map(caster => ({ identity: caster.identity, name: slideControlsText(caster.name,caster.identity) })) : [] } });

    }, [own, sessions, selectedControls, connected, controlError, busy, locale, casters, sharing, screenSharing, native]);
    const openControls = (session: CoPresentation) => {
        if (!connected || controlError && !(isOwner(session) && presentationSharing(session))) return;
        if (activeControls?.id === session.id) void controls.current?.show();
        else setSelectedControls(session.id);
    };
    const controlsButton = (session: CoPresentation) => <button type="button" className="button-secondary" disabled={!connected || controlError && !(isOwner(session) && presentationSharing(session))} onClick={() => openControls(session)}>{text.floating}</button>;
    const currentName = activeControls?.controller
        ? activeControls.controller.identity === room.localParticipant.identity ? text.you : casters.find(caster => caster.identity === activeControls.controller?.identity)?.name || activeControls.controller.identity
        : activeControls && isOwner(activeControls) ? text.you : '';
    const canAct = !!activeControls && connected && !busy && !controlError && !pending(activeControls);
    const canNavigate = canAct && !(isOwner(activeControls!) && activeControls!.controller);
    const candidates = casters.filter(caster => caster.identity !== room.localParticipant.identity).slice(0,100);
    const act = (action: SlideControlsAction['action'], controllerIdentity?: string) => {
        if (!activeControls) return;
        const id = slideControlsId(activeControls);
        void controlsAction.current(action === 'delegate' ? { id, action, controllerIdentity: controllerIdentity! } : { id, action }).catch(() => undefined);
    };
    const sourceControls = <div className="co-presentation-sources"><label className="button-secondary co-presentation-file" htmlFor={fileInputId}>{text.chooseShort}<input id={fileInputId} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={!connected || converting} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; void load(selected); }} /></label>
          {nativeSupported && <button type="button" className="button-secondary" disabled={!connected || busy || converting} onClick={() => void connectNative()}>{text.officeShort}</button>}
        </div>;
    return <div className="co-presentation-control">
      <button ref={trigger} type="button" className="co-presentation-trigger" popoverTarget={menuId} aria-controls={menuId} aria-expanded={menuOpen} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 14 9-7 1-3 7-4-17Zm8 11 4 6" /></svg><span>{text.menu}</span><svg className="co-presentation-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
      </button>
      <div ref={menu} id={menuId} className="co-presentation-popover" popover="auto" role="dialog" aria-labelledby={`${menuId}-title`} onToggle={menuToggle}>
        <header className="co-presentation-heading"><h2 id={`${menuId}-title`}>{text.menu}</h2><button type="button" className="button-secondary co-presentation-close" popoverTarget={menuId} popoverTargetAction="hide" onClick={rememberMenuClose} aria-label={text.menuClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
        {controlledSessions.length > 1 && <label className="co-presentation-session-picker">{text.session}<select value={activeControls?.id || ''} onChange={event => setSelectedControls(event.target.value)}>{controlledSessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>}
        {activeControls ? <section className="co-presentation-active" aria-label={text.title}>
          <strong className="co-presentation-name" title={activeControls.name}>{activeControls.name}</strong>
          <p className="co-presentation-current">{text.current}: <strong>{currentName}</strong></p>
          <div className="co-presentation-navigation"><button type="button" className="button-secondary" aria-label={text.previous} disabled={!canNavigate || activeControls.page <= 1} onClick={() => act('previous')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button><output aria-label={text.rendered}>{activeControls.renderedPage > 0 ? activeControls.renderedPage : activeControls.page} / {activeControls.pages}</output><button type="button" className="button-secondary" aria-label={text.next} disabled={!canNavigate || activeControls.page >= activeControls.pages} onClick={() => act('next')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
            {isOwner(activeControls) && presentationSharing(activeControls) && <button type="button" className="co-presentation-stop" disabled={stopBusy} onClick={() => act('stop')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg>{stopBusy ? text.stopping : text.stop}</button>}
          </div>
          {pending(activeControls) && <small role="status">{text.pending}</small>}
          <small className="co-presentation-sharing">{presentationSharing(activeControls) ? text.sharingState : text.idleState}</small>
          {isOwner(activeControls) && activeControls.kind === 'pdf' && !sharing && <button type="button" className="co-presentation-start" disabled={!connected || busy || !painted || painted.file !== file} onClick={() => void start()}>{text.start}</button>}
        </section> : <p className="co-presentation-empty">{text.empty}</p>}
        {(!activeControls || isOwner(activeControls)) && <section className="co-presentation-delegation">
          <h3>{text.grant}</h3>
          {candidates.length ? <div className="co-presentation-casters" role="radiogroup" aria-label={text.caster} onKeyDown={casterKeyboard}>{candidates.map(caster => <button key={caster.identity} type="button" role="radio" aria-checked={activeControls?.controller?.identity === caster.identity} disabled={!canAct || stopBusy} onClick={() => act('delegate', caster.identity)}><span className="co-presentation-radio" aria-hidden="true" /><span>{caster.name}</span></button>)}</div> : <p className="co-presentation-empty">{text.noCasters}</p>}
          {activeControls?.controller && <button type="button" className="button-secondary co-presentation-reclaim" disabled={!canAct || stopBusy} onClick={() => act('reclaim')}>{text.reclaim}</button>}
        </section>}
        {!activeControls && sourceControls}
        {converting && <p role="status">{text.converting}</p>}
        <details className="co-presentation-more"><summary>{text.more}</summary><div className="co-presentation-file-content">
          {activeControls && sourceControls}
          {file && <><strong className="co-presentation-name">{file.name}</strong>
            <PdfPresentationViewer file={file} page={page} onLoaded={(total, loaded) => { if (fileRef.current === loaded) {
            setPages(total);
            void create(loaded, total);
        } }} onRendered={(rendered, loaded) => { if (fileRef.current === loaded)
            setPainted({ file: loaded, page: rendered }); }} onCanvasReady={(visible, loaded) => { if (fileRef.current === loaded)
            canvas.current = visible; }} onError={(_message, loaded) => { if (fileRef.current === loaded) {
            setError(text.error);
            canvas.current = undefined;
            void capture.current?.stop();
        } }}/>
            <div className="co-presentation-file-actions"><button type="button" disabled={sharing ? stopBusy : !connected || busy || !painted || painted.file !== file} onClick={() => sharing ? own ? void stopOwnedPresentation(own).catch(() => undefined) : void capture.current?.stop() : void start()}>{sharing ? text.stop : text.start}</button><button type="button" className="button-secondary" onClick={() => void load()}>{text.close}</button></div>
            {!own && pages > 0 && <button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void create(file, pages)}>{text.control}</button>}
            {sharing && <><small>{text.fallback}</small>{panelState !== 'open' && <button type="button" className="button-secondary" onClick={() => void panel.current?.open()}>{text.panel}</button>}</>}
          </>}
          {native && <><strong className="co-presentation-name">{native.name}</strong><button type="button" className="button-secondary" onClick={() => void load()}>{text.disconnect}</button></>}
          <small className="co-presentation-scope">{text.scope}</small><small>{text.hint}</small>{nativeSupported && <small>{text.nativeHint}</small>}
          {activeControls && controlsButton(activeControls)}
        </div></details>
        {controlError && <p className="co-presentation-message" role="status">{text.unavailable}</p>}{error && <p className="co-presentation-message" role="alert">{error}</p>}
      </div>
    </div>;
}
