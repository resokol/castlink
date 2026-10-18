"use client";
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { acceptParticipantRoleOffer, parseParticipantRoleOffer, type ParticipantRoleOffer } from '@/lib/participant-role-client';

/** Acceptance precedes the parent-owned guest capture teardown and staff transition. */
export function GuestRoleOffer({ studioId, roomName, identity, token, connected, deferPrompt = false, onTransition }: {
  studioId: string; roomName: string; identity: string; token: string; connected: boolean; deferPrompt?: boolean; onTransition: (panelPath: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [offer, setOffer] = useState<ParticipantRoleOffer>();
  const [acceptedPath, setAcceptedPath] = useState('');
  const acceptedPathRef = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const consumed = useRef(new Set<string>());
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    generation.current += 1;
    acceptedPathRef.current = '';
    setOffer(undefined); setAcceptedPath(''); setError(''); setPollError(''); setBusy(false); inFlight.current = false;
    return () => { generation.current += 1; };
  }, [studioId, roomName, identity, token]);
  useEffect(() => {
    if (!connected || !token || !identity) {
      // Connectivity can drop after the server consumes an offer but before
      // its valid ACK arrives. Scope changes/unmount invalidate that request;
      // a transient disconnect must preserve its ACK and cleanup/retry path.
      if (!acceptedPathRef.current && !inFlight.current) { setBusy(false); setOffer(undefined); }
      return;
    }
    const attempt = generation.current;
    let polling = false;
    const abort = new AbortController();
    const poll = async () => {
      if (polling || acceptedPathRef.current) return;
      polling = true;
      try {
        const query = new URLSearchParams({ studioId, room: roomName, identity });
        const response = await fetch(`/api/participant-role?${query}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось проверить назначение роли.');
        if (generation.current !== attempt || abort.signal.aborted || acceptedPathRef.current) return;
        setPollError('');
        const next = parseParticipantRoleOffer(data);
        setOffer(next && !consumed.current.has(next.id) ? next : undefined);
      } catch (cause) { if (!abort.signal.aborted && generation.current === attempt && !acceptedPathRef.current) setPollError(cause instanceof Error ? cause.message : 'Не удалось проверить назначение роли.'); }
      finally { polling = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 2000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [studioId, roomName, identity, token, connected]);
  const accept = async () => {
    if (inFlight.current || (!acceptedPathRef.current && (!offer || !connected || consumed.current.has(offer.id)))) return;
    const current = offer, attempt = generation.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      let path = acceptedPathRef.current;
      if (!path && current) {
        path = await acceptParticipantRoleOffer({ token, studioId, roomName, offer: current, origin: window.location.origin });
        if (generation.current !== attempt) return;
        consumed.current.add(current.id);
        acceptedPathRef.current = path; setAcceptedPath(path); setOffer(undefined);
      }
      if (!path || generation.current !== attempt) return;
      await onTransition(path);
    } catch (cause) {
      if (generation.current === attempt) setError(cause instanceof Error ? cause.message : 'Не удалось перейти в панель. Повторите переход.');
    } finally { if (generation.current === attempt) { inFlight.current = false; setBusy(false); } }
  };
  const decline = async () => {
    if (!offer || !connected || inFlight.current) return;
    const current = offer, attempt = generation.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/participant-role', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'decline', studioId, room: roomName, id: current.id }), signal: AbortSignal.timeout(10000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Не удалось отклонить назначение.');
      consumed.current.add(current.id);
      if (generation.current === attempt) setOffer(undefined);
    } catch (cause) { if (generation.current === attempt) setError(cause instanceof Error ? cause.message : 'Не удалось отклонить назначение.'); }
    finally { if (generation.current === attempt) { inFlight.current = false; setBusy(false); } }
  };
  const showDialog = !deferPrompt && (!!offer || !!acceptedPath);
  const dialog = useRef<HTMLDivElement>(null);
  const dialogState = useRef({ busy: false, canDecline: false });
  dialogState.current = { busy, canDecline: !!offer && connected && !acceptedPath };
  const declineRef = useRef(decline); declineRef.current = decline;
  useEffect(() => {
    if (!showDialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const current = dialog.current;
    const first = current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    if (first) first.focus(); else current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!dialogState.current.busy && dialogState.current.canDecline) void declineRef.current();
      }
      if (event.key === 'Tab') {
        const controls = Array.from(current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [showDialog, offer?.id, acceptedPath]);
  if (!showDialog) return !offer && !acceptedPath && (error || pollError) ? <section className="panel stack guest-role-offer" aria-label={t('Назначение роли')}><p role="alert">{translateWorkspaceMessage(t, error || pollError)}</p></section> : null;
  return <div className="guest-device-request-overlay guest-role-offer-overlay"><div ref={dialog} className="guest-device-request-dialog guest-role-offer" role="dialog" aria-modal="true" aria-labelledby="guest-role-offer-title" aria-describedby="guest-role-offer-description" aria-busy={busy} tabIndex={-1}>
    <h2 id="guest-role-offer-title">{t('Назначение роли')}</h2>
    {offer && <p>{offer.role === 'admin' ? t('Вам предлагают стать администратором этой комнаты.') : t('Вам предлагают стать модератором этой комнаты.')}</p>}
    <p id="guest-role-offer-description">{t('Гостевое подключение, камера и микрофон будут отключены. Панель откроется в этой вкладке.')}</p>
    {busy && <p role="status">{t('Подключение…')}</p>}
    {(error || pollError) && <p role="alert">{translateWorkspaceMessage(t, error || pollError)}</p>}
    <div className="guest-device-request-actions">
      {offer && <><button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void decline()}>{t('Отклонить')}</button><button type="button" disabled={busy || !connected} onClick={() => void accept()}>{t('Принять роль')}</button></>}
      {acceptedPath && <button type="button" disabled={busy} onClick={() => void accept()}>{t('Повторить переход в панель')}</button>}
    </div>
  </div></div>;
}
