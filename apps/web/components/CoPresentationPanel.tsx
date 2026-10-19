'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useI18n } from './I18nProvider';
import { PdfPresentationViewer } from './PdfPresentationViewer';
import { coPresentationRequest, createCanvasPresentationCapture } from '@/lib/co-presentation-client';
import { createNativePresentationControl, powerPointBridge, validNativePresentation, type NativePresentation } from '@/lib/co-presentation-native';
import { createCoPresentationControls, slideControlsId, slideControlsText, type SlideControlsAction } from '@/lib/co-presentation-controls';
import type { CoPresentation } from '@/lib/co-presentation-state';
import { createDesktopStopPanel, desktopScreenBridge } from '@/lib/desktop-stop-panel';
import { createScreenShareStopPanel, documentPictureInPictureApi, type ScreenShareStopPanel, type ScreenShareStopPanelState } from '@/lib/screen-share-stop-panel';
const copy = {
    ru: { title: 'Презентация PDF / PowerPoint', floating: 'Открыть окно управления слайдами', delegated: 'Управляет', localControls: 'Вы управляете', native: 'Управлять открытым PowerPoint', nativeHint: 'Запустите показ в PowerPoint, затем покажите его окно через «Демонстрация экрана». Музыка и видео сохраняются в PowerPoint; звук включите при выборе окна. Доступны только переходы между слайдами.', disconnect: 'Отключить управление PowerPoint', choose: 'Выбрать PDF или PPTX', hint: 'PDF до 100 МБ; PPTX до 25 МБ преобразуется в PDF без анимации, музыки и видео. Отдельный видеопоток без звука.', converting: 'Преобразуем PowerPoint…', start: 'Показать презентацию', stop: 'Остановить презентацию', previous: 'Назад', next: 'Вперёд', grant: 'Передать управление', revoke: 'Отозвать управление', caster: 'Выберите кастера', page: 'Страница', rendered: 'Показано', pending: 'Ожидаем отображения', control: 'Подключить управление', panel: 'Показать панель остановки', stopTitle: 'Панель остановки презентации', stopLabel: 'ОСТАНОВИТЬ ПРЕЗЕНТАЦИЮ', stopping: 'Останавливаем…', failed: 'Не удалось выполнить действие. Повторите попытку.', size: 'Выберите PDF до 100 МБ или PPTX до 25 МБ.', other: 'Презентации в комнате', unavailable: 'Управление недоступно. Повторите попытку; передача видео продолжается.', fallback: 'Остановить показ можно здесь. Плавающая панель может потребовать отдельного нажатия.', error: 'Не удалось открыть презентацию.', close: 'Закрыть файл' },
    en: { title: 'PDF / PowerPoint presentation', floating: 'Open slide controls window', delegated: 'Controlled by', localControls: 'You control', native: 'Control open PowerPoint', nativeHint: 'Start the PowerPoint slideshow, then share its window using Screen share. Music and video remain in PowerPoint; enable audio when selecting the window. Controls only change slides.', disconnect: 'Disconnect PowerPoint controls', choose: 'Choose PDF or PPTX', hint: 'PDF up to 100 MB; PPTX up to 25 MB converts to PDF without animations, music or video. A separate video stream with no audio.', converting: 'Converting PowerPoint…', start: 'Share presentation', stop: 'Stop presentation', previous: 'Previous', next: 'Next', grant: 'Grant control', revoke: 'Revoke control', caster: 'Choose caster', page: 'Page', rendered: 'Rendered', pending: 'Waiting for render', control: 'Connect controls', panel: 'Show stop panel', stopTitle: 'Presentation stop panel', stopLabel: 'STOP PRESENTATION', stopping: 'Stopping…', failed: 'Action failed. Please retry.', size: 'Choose a PDF up to 100 MB or PPTX up to 25 MB.', other: 'Room presentations', unavailable: 'Controls unavailable. Please retry; video sharing continues.', fallback: 'You can stop sharing here. Opening the floating panel may require another click.', error: 'Could not open presentation.', close: 'Close file' },
    'zh-CN': { title: 'PDF / PowerPoint 演示', floating: '打开幻灯片控制窗口', delegated: '控制者', localControls: '由您控制', native: '控制已打开的 PowerPoint', nativeHint: '先在 PowerPoint 中启动幻灯片放映，再通过屏幕共享选择其窗口。音乐和视频保留在 PowerPoint 中；选择窗口时请启用音频。控制仅用于切换幻灯片。', disconnect: '断开 PowerPoint 控制', choose: '选择 PDF 或 PPTX', hint: 'PDF 最大 100 MB；PPTX 最大 25 MB，将转换为不含动画、音乐或视频的 PDF。以单独的视频流共享，不包含音频。', converting: '正在转换 PowerPoint…', start: '共享演示', stop: '停止演示', previous: '上一页', next: '下一页', grant: '授予控制权', revoke: '撤销控制权', caster: '选择参与者', page: '页码', rendered: '已显示', pending: '等待渲染', control: '连接控制', panel: '显示停止面板', stopTitle: '演示停止面板', stopLabel: '停止演示', stopping: '正在停止…', failed: '操作失败，请重试。', size: '请选择不超过 100 MB 的 PDF 或 25 MB 的 PPTX。', other: '房间演示', unavailable: '控制暂不可用，请重试；视频共享继续。', fallback: '可在此停止共享。浮动面板可能需要再次点击才能打开。', error: '无法打开演示。', close: '关闭文件' },
};
export function CoPresentationPanel({ room, token, studioId, roomName }: {
    room: Room;
    token: string;
    studioId: string;
    roomName: string;
}) {
    const { locale } = useI18n(), text = copy[locale];
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
    const [casters, setCasters] = useState<{
        identity: string;
        name: string;
    }[]>([]), [controller, setController] = useState('');
    const controls = useRef<ReturnType<typeof createCoPresentationControls> | undefined>(undefined);
    const controlsAction = useRef<(event: SlideControlsAction) => Promise<unknown>>(async () => undefined);
    const [selectedControls, setSelectedControls] = useState('');
    const autoShownControls = useRef(new Set<string>());
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
    const failNative = () => { controls.current?.clear(); closeSession(ownRef.current); stopNative(); updateOwn(undefined); setControlError(true); };
    useEffect(() => {
        mounted.current = true;
        const slideControls = createCoPresentationControls({ host: window, action: event => controlsAction.current(event) });
        controls.current = slideControls;
        autoShownControls.current.clear();
        setSelectedControls('');
        setNativeSupported(!!powerPointBridge(window));
        stopNative();
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
        const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Disconnected, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged];
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
                setControlError(false);
                if (ownRef.current) {
                    const local = list.find(session => session.id === ownRef.current?.id);
                    updateOwn(local);
                    if (nativeControl.current) {
                        if (!local) { failNative(); return; }
                        flight.current = true;
                        setBusy(true);
                        try { await nativeControl.current.tick(local); }
                        finally { if (active && version === epoch.current) { flight.current = false; setBusy(false); } }
                    }
                }
            }
            catch {
                if (active && version === epoch.current) {
                    controls.current?.clear();
                    setControlError(true);
                    setSessions([]);
                    if (nativeControl.current) failNative();
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
        catch {
            if (mounted.current && current === generation.current) {
                controls.current?.clear();
                setControlError(true);
                if (nativeControl.current) failNative();
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
        stopNative();
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
        try {
            let result = selected;
            if (pptx) {
                setConverting(true);
                const form = new FormData();
                form.set('file', selected);
                const response = await fetch(`/api/presentation-file?${new URLSearchParams({ studioId, room: roomName })}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(120000)]) });
                if (!response.ok)
                    throw Error();
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
                setError(text.error);
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
                request, changed: updateOwn, failed: failNative });
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
            if (await capture.current?.start(visible, () => generation.current === current && fileRef.current === selected))
                void panel.current?.open();
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
    const controlledSessions = [
        ...(own ? [own] : []),
        ...sessions.filter(session => session.id !== own?.id && session.controller?.identity === room.localParticipant.identity && session.controller.sid === room.localParticipant.sid),
    ];
    const activeControls = controlledSessions.find(session => session.id === selectedControls) || controlledSessions[0];
    const isOwner = (session: CoPresentation) => session.owner.identity === room.localParticipant.identity && session.owner.sid === room.localParticipant.sid;
    const pending = (session: CoPresentation) => session.revision !== session.renderedRevision;
    controlsAction.current = async event => {
        if (!mounted.current || !connected || controlError || flight.current) return;
        const session = controlledSessions.find(item => slideControlsId(item) === event.id);
        if (!session) return;
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
        if (!connected || controlError || !activeControls) { adapter.clear(); return; }
        const session = activeControls, owner = isOwner(session), id = slideControlsId(session);
        const controllerName = session.controller?.identity === room.localParticipant.identity ? room.localParticipant.name || room.localParticipant.identity : session.controller ? casters.find(caster => caster.identity === session.controller?.identity)?.name || session.controller.identity : '';
        void adapter.update({ id, title: slideControlsText(session.name, text.title), controller: slideControlsText(controllerName ? `${text.delegated}: ${controllerName}` : text.localControls, text.localControls), page: session.renderedPage > 0 ? session.renderedPage : session.page, pages: session.pages, canNavigate: !pending(session) && !(owner && session.controller), canReclaim: owner && !!session.controller, busy: busy || pending(session), locale });
        if (!autoShownControls.current.has(id)) {
            autoShownControls.current.add(id);
            if (autoShownControls.current.size > 100) autoShownControls.current.delete(autoShownControls.current.values().next().value!);
            void adapter.show();
        }
    }, [own, sessions, selectedControls, connected, controlError, busy, locale, casters]);
    const openControls = (session: CoPresentation) => {
        if (!connected || controlError) return;
        if (activeControls?.id === session.id) void controls.current?.show();
        else { setSelectedControls(session.id); autoShownControls.current.delete(slideControlsId(session)); }
    };
    const controlsButton = (session: CoPresentation) => <button type="button" className="button-secondary" disabled={!connected || controlError} onClick={() => openControls(session)}>{text.floating}</button>;
    return <details className="panel co-presentation-panel" style={{ minWidth: 0 }}><summary>{text.title}</summary><div className="stack" style={{ paddingTop: 12, minWidth: 0 }}>
    {nativeSupported && <div className="stack"><button type="button" className="button-secondary" disabled={!connected || busy || converting} onClick={() => void connectNative()}>{text.native}</button><small>{text.nativeHint}</small></div>}
    {native && <div className="stack"><strong style={{ overflowWrap: 'anywhere' }}>{native.name}</strong><button type="button" className="button-secondary" onClick={() => void load()}>{text.disconnect}</button></div>}
    <label>{text.choose}<input type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={!connected || converting} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; void load(selected); }}/></label>
    <small>{text.hint}</small>{converting && <p role="status">{text.converting}</p>}
    {file && <><strong style={{ overflowWrap: 'anywhere' }}>{file.name}</strong>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button type="button" disabled={!connected || busy || !painted || painted.file !== file} onClick={() => sharing ? void capture.current?.stop() : void start()}>{sharing ? text.stop : text.start}</button>
        {sharing && panelState !== 'open' && <button type="button" className="button-secondary" onClick={() => void panel.current?.open()}>{text.panel}</button>}
        <button type="button" className="button-secondary" onClick={() => void load()}>{text.close}</button></div>
      {sharing && <small>{text.fallback}</small>}
      {!own && pages > 0 && <button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void create(file, pages)}>{text.control}</button>}
    </>}
    {own && <>{controlsButton(own)}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select aria-label={text.caster} value={controller} onChange={event => setController(event.target.value)} style={{ minWidth: 0, maxWidth: '100%' }}><option value="">{text.caster}</option>{casters.map(caster => <option key={caster.identity} value={caster.identity}>{caster.name}</option>)}</select>
        <button type="button" disabled={busy || !connected || !controller || controlError} onClick={() => void mutate({ action: 'delegate', ...binding(own), controllerIdentity: controller })}>{text.grant}</button>
        {own.controller && <button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void mutate({ action: 'revoke', ...binding(own) })}>{text.revoke} · {casters.find(caster => caster.identity === own.controller?.identity)?.name || own.controller.identity}</button>}
      </div></>}
    {sessions.filter(session => session.controller?.identity === room.localParticipant.identity && session.controller.sid === room.localParticipant.sid).map(session => <div className="stack" key={session.id}><strong>{text.other}: {session.name}</strong>{controlsButton(session)}</div>)}
    {controlError && <p role="status">{text.unavailable}</p>}{error && <p role="alert">{error}</p>}
  </div></details>;
}
