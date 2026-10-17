"use client";

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { resolveParticipantRole } from '@/lib/participant-role';
import { createPdfPresentationBridge, presentationPage, presentationRequest } from '@/lib/pdf-presentation-client';
import type { PresentationCommand, PresentationDirection, PresentationSession, PresentationStatus } from '@/lib/presentation-control';
import { PdfPresentationViewer } from '@/components/PdfPresentationViewer';

type Pair = { pairToken: string; sessionId: string; expiresAt: number };
type PdfBridge = { bridge: ReturnType<typeof createPdfPresentationBridge>; timer: ReturnType<typeof setInterval>; sessionId: string };

export function PresentationControls({ room, roomName, studioId, token, connected = room.state === 'connected' }: {
  room: Room; roomName: string; studioId: string; token: string; connected?: boolean;
}) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<PresentationSession[]>([]);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pair, setPair] = useState<Pair>();
  const [file, setFile] = useState<File>();
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [painted, setPainted] = useState<{ file: File; page: number }>();
  const renderingCommand = useRef<{ file: File; page: number; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const [selectedController, setSelectedController] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ sessionId: string; seq: number; expiresAt: number }>();
  const pdfStatus = useRef<PresentationStatus>({ title: '', ready: false });
  const pdfPage = useRef(1);
  const active = useRef<PdfBridge | undefined>(undefined);
  const ownedId = useRef('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const identity = room.localParticipant.identity;
  pdfStatus.current = { title: (file?.name || '').slice(0, 160), ...(pages ? { page, pages } : {}), ready: !!file && pages > 0 && !pdfError && painted?.file === file && painted.page === page, ...(pdfError ? { error: pdfError.slice(0, 240) } : {}) };
  pdfPage.current = page;
  const participants = Array.from(room.remoteParticipants.values()).filter(participant => resolveParticipantRole(participant) === 'guest' && participant.identity !== identity);
  const name = (value: string) => value === identity ? t('Вы') : room.remoteParticipants.get(value)?.name || value;
  const body = (action: string, extra: Record<string, unknown> = {}) => ({ action, studioId, room: roomName, ...extra });
  const stopLocalBridge = () => { if (renderingCommand.current) { clearTimeout(renderingCommand.current.timer); renderingCommand.current.reject(new Error('Управление презентацией завершено.')); renderingCommand.current = undefined; } if (active.current) { clearInterval(active.current.timer); active.current.bridge.stop(); active.current = undefined; } };
  const refresh = async () => {
    const data = await presentationRequest<{ sessions: PresentationSession[] }>(token, body('read'));
    if (!mounted.current) return;
    setSessions(data.sessions);
    setPair(value => value && data.sessions.some(session => session.id === value.sessionId && session.connected) ? undefined : value);
    setPending(value => value && (value.expiresAt <= Date.now() || data.sessions.some(session => session.id === value.sessionId && (session.result?.seq || 0) >= value.seq)) ? undefined : value);
  };
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  useEffect(() => {
    mounted.current = true;
    const changed = () => setVersion(value => value + 1);
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged];
    events.forEach(event => room.on(event, changed));
    return () => { mounted.current = false; events.forEach(event => room.off(event, changed)); };
  }, [room]);
  useEffect(() => {
    let cancelled = false, inFlight = false;
    if (!connected) {
      generation.current += 1; stopLocalBridge(); setSessions([]); setPair(undefined);
      if (ownedId.current) void presentationRequest(token, { action: 'revoke', studioId, room: roomName, sessionId: ownedId.current }).catch(() => undefined);
      ownedId.current = '';
      return;
    }
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try { const data = await presentationRequest<{ sessions: PresentationSession[] }>(token, { action: 'read', studioId, room: roomName }); if (!cancelled) {
        setSessions(data.sessions);
        setPair(value => value && data.sessions.some(session => session.id === value.sessionId && session.connected) ? undefined : value);
        setPending(value => value && (value.expiresAt <= Date.now() || data.sessions.some(session => session.id === value.sessionId && (session.result?.seq || 0) >= value.seq)) ? undefined : value);
      } } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Не удалось получить состояние презентации.'); }
      finally { inFlight = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [connected, roomName, studioId, token]);
  useEffect(() => () => {
    generation.current += 1; stopLocalBridge();
    if (ownedId.current) void fetch('/api/presentation-control', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'revoke', studioId, room: roomName, sessionId: ownedId.current }), keepalive: true }).catch(() => undefined);
    ownedId.current = '';
  }, [room, studioId, roomName, token]);
  const perform = async (run: () => Promise<void>) => {
    if (busy || !connected) return;
    setBusy(true); setError('');
    try { await run(); if (mounted.current) await refreshRef.current(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Не удалось изменить управление презентацией.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const startPdf = () => perform(async () => {
    if (!pdfStatus.current.ready) throw new Error('Сначала откройте PDF.');
    stopLocalBridge();
    const attempt = ++generation.current;
    const paired = await presentationRequest<Pair>(token, body('pair', { kind: 'pdf' }));
    if (!mounted.current || attempt !== generation.current) { await presentationRequest(token, body('revoke', { sessionId: paired.sessionId })).catch(() => undefined); return; }
    ownedId.current = paired.sessionId;
    const connectionId = crypto.randomUUID();
    const connectedPdf = await presentationRequest<{ sessionToken: string }>(paired.pairToken, { action: 'connect', connectionId });
    if (!mounted.current || attempt !== generation.current) { await presentationRequest(token, body('revoke', { sessionId: paired.sessionId })).catch(() => undefined); return; }
    let stopped = false;
    const bridge = createPdfPresentationBridge({ token: connectedPdf.sessionToken, connectionId, getStatus: () => pdfStatus.current,
      navigate: direction => {
        const next = presentationPage(pdfPage.current, direction, pdfStatus.current.pages || 1);
        if (next === pdfPage.current) return;
        if (!file) throw new Error('Сначала откройте PDF.');
        pdfPage.current = next; pdfStatus.current = { ...pdfStatus.current, page: next, ready: false };
        return new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { if (renderingCommand.current?.timer === timer) renderingCommand.current = undefined; reject(new Error('PDF не подтвердил показ страницы.')); }, 2500);
          renderingCommand.current = { file, page: next, resolve, reject, timer };
          setPage(next);
        });
      },
      onStopped: message => { stopped = true; stopLocalBridge(); if (mounted.current) setError(message); },
    });
    await bridge.poll();
    if (stopped || !mounted.current || attempt !== generation.current) { bridge.stop(); return; }
    active.current = { bridge, sessionId: paired.sessionId, timer: setInterval(() => void bridge.poll(), 600) };
    setPair(undefined);
  });
  const startPowerPoint = () => perform(async () => {
    const attempt = ++generation.current; stopLocalBridge();
    const value = await presentationRequest<Pair>(token, body('pair', { kind: 'powerpoint' }));
    if (!mounted.current || attempt !== generation.current) { await presentationRequest(token, body('revoke', { sessionId: value.sessionId })).catch(() => undefined); return; }
    ownedId.current = value.sessionId; setPair(value);
  });
  const stop = (sessionId: string) => perform(async () => {
    generation.current += 1;
    if (ownedId.current === sessionId) { stopLocalBridge(); ownedId.current = ''; setPair(undefined); }
    await presentationRequest(token, body('revoke', { sessionId }));
  });
  const command = (sessionId: string, direction: PresentationDirection) => perform(async () => {
    const data = await presentationRequest<{ command: PresentationCommand }>(token, body('command', { sessionId, direction }));
    setPending({ sessionId, seq: data.command.seq, expiresAt: data.command.expiresAt });
  });
  const delegate = (sessionId: string, controllerIdentity: string) => perform(async () => {
    await presentationRequest(token, body('delegate', { sessionId, controllerIdentity }));
  });
  return <section className="panel stack presentation-controls" aria-label={t('Презентации')}>
    <h2>{t('Презентации')}</h2>
    <p className="muted">{t('Откройте презентацию на своём компьютере и передайте переключение слайдов выбранному кастеру. Изображение показывайте через демонстрацию экрана.')}</p>
    <label>{t('Открыть PDF на этом компьютере')}<input type="file" accept="application/pdf,.pdf" disabled={busy || !!active.current} onChange={event => {
      const value = event.target.files?.[0]; if (!value) return;
      setPage(1); pdfPage.current = 1; setPages(0); setPdfError(''); setFile(value);
    }} /></label>
    {file && <div className="stack">
      <p>{file.name} — <span aria-label={t('Текущая страница PDF')}>{page} / {pages || '…'}</span></p>
      <PdfPresentationViewer file={file} page={page} onLoaded={(count, loadedFile) => { if (loadedFile === file) setPages(count); }} onRendered={(renderedPage, renderedFile) => {
        if (renderedFile !== file || renderedPage !== pdfPage.current) return;
        setPainted({ file: renderedFile, page: renderedPage }); setPdfError('');
        const waiting = renderingCommand.current;
        if (waiting?.file === renderedFile && waiting.page === renderedPage) { clearTimeout(waiting.timer); renderingCommand.current = undefined; waiting.resolve(); }
      }} onError={(message, failedFile, failedPage) => {
        if (failedFile !== file || failedPage !== undefined && failedPage !== pdfPage.current) return;
        setPdfError(message);
        const waiting = renderingCommand.current;
        if (waiting) { clearTimeout(waiting.timer); renderingCommand.current = undefined; waiting.reject(new Error(message)); }
      }} />
      {!active.current && <div className="toolbar">
        <button type="button" disabled={page <= 1 || !pages} onClick={() => setPage(value => Math.max(1, value - 1))}>{t('Предыдущая страница')}</button>
        <button type="button" disabled={page >= pages || !pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>{t('Следующая страница')}</button>
      </div>}
      <button type="button" disabled={busy || !connected || !pdfStatus.current.ready || !!active.current} onClick={() => void startPdf()}>{t('Разрешить управление PDF')}</button>
      <small className="muted">{t('PDF остаётся в вашем браузере. Покажите эту вкладку через демонстрацию экрана.')}</small>
    </div>}
    <button type="button" disabled={busy || !connected} onClick={() => void startPowerPoint()}>{t('Подключить PowerPoint')}</button>
    {pair && <div className="stack" role="status">
      <p>{t('Запустите показ слайдов PowerPoint, скачайте помощник для своей системы и подтвердите управление на этом компьютере.')}</p>
      <div className="toolbar"><a className="button-secondary" href="/helpers/CastLink-PowerPoint-Windows.ps1" download>{t('Помощник для Windows')}</a><a className="button-secondary" href="/helpers/CastLink-PowerPoint-macOS.js" download>{t('Помощник для macOS')}</a></div>
      <p style={{ overflowWrap: 'anywhere' }}>Windows: <code>powershell -NoProfile -STA -ExecutionPolicy Bypass -File &quot;$HOME\Downloads\CastLink-PowerPoint-Windows.ps1&quot;</code></p>
      <p style={{ overflowWrap: 'anywhere' }}>macOS: <code>osascript -l JavaScript &quot;$HOME/Downloads/CastLink-PowerPoint-macOS.js&quot;</code></p>
      <p>{t('В помощнике укажите адрес этого сайта и одноразовый код. Код действует 2 минуты.')}</p>
      <label>{t('Одноразовый код подключения')}<input readOnly value={pair.pairToken} autoComplete="off" spellCheck={false} /></label>
      <button type="button" onClick={() => void navigator.clipboard.writeText(pair.pairToken).catch(cause => setError(cause instanceof Error ? cause.message : 'Не удалось скопировать код.'))}>{t('Скопировать код')}</button>
      <button type="button" disabled={busy} onClick={() => void stop(pair.sessionId)}>{t('Отменить подключение')}</button>
    </div>}
    {sessions.filter(session => session.ownerIdentity === identity || session.controllerIdentity === identity).map(session => {
      const owner = session.ownerIdentity === identity;
      const canControl = owner || session.controllerIdentity === identity;
      const waiting = pending?.sessionId === session.id;
      const ready = session.connected && session.status?.ready;
      return <div key={session.id} className="panel stack" aria-label={t('Управление презентацией')}>
        <strong>{session.kind === 'pdf' ? 'PDF' : 'PowerPoint'}: {session.status?.title || name(session.ownerIdentity)}</strong>
        <p>{t('Владелец:')} {name(session.ownerIdentity)} · {t('Управляет:')} {name(session.controllerIdentity)}</p>
        <p role="status">{ready ? `${t('Подключено')}${session.status?.page ? ` · ${session.status.page}${session.status.pages ? ` / ${session.status.pages}` : ''}` : ''}` : t('Ожидаем подключения презентации.')}</p>
        {canControl && <div className="toolbar">
          <button type="button" disabled={busy || !ready || waiting} onClick={() => void command(session.id, 'previous')}>{t('Предыдущий слайд')}</button>
          <button type="button" disabled={busy || !ready || waiting} onClick={() => void command(session.id, 'next')}>{t('Следующий слайд')}</button>
        </div>}
        {waiting && <small role="status">{t('Ожидаем подтверждение переключения…')}</small>}
        {owner && <>
          <label>{t('Передать управление кастеру')}<select value={selectedController[session.id] || ''} disabled={busy || !ready} onChange={event => setSelectedController(value => ({ ...value, [session.id]: event.target.value }))}>
            <option value="">{t('Выберите кастера')}</option>{participants.map(participant => <option key={participant.identity} value={participant.identity}>{participant.name || participant.identity}</option>)}
          </select></label>
          <div className="toolbar"><button type="button" disabled={busy || !ready || !selectedController[session.id]} onClick={() => void delegate(session.id, selectedController[session.id])}>{t('Передать управление')}</button>
          <button type="button" disabled={busy || session.controllerIdentity === identity} onClick={() => void delegate(session.id, identity)}>{t('Забрать управление')}</button>
          <button type="button" disabled={busy} onClick={() => void stop(session.id)}>{t('Завершить управление презентацией')}</button></div>
        </>}
        {session.status?.error && <p role="alert">{translateWorkspaceMessage(t, session.status.error)}</p>}
        {session.result?.ok === false && session.result.error && <p role="alert">{translateWorkspaceMessage(t, session.result.error)}</p>}
      </div>;
    })}
    {error && <p role="alert" className="media-device-error">{translateWorkspaceMessage(t, error)}</p>}
  </section>;
}
