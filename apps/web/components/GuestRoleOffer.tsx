"use client";
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { acceptParticipantRoleOffer, parseParticipantRoleOffer, type ParticipantRoleOffer } from '@/lib/participant-role-client';

/** Staff access opens separately: this component never reconnects guest media. */
export function GuestRoleOffer({ studioId, roomName, identity, token, connected }: {
  studioId: string; roomName: string; identity: string; token: string; connected: boolean;
}) {
  const { t } = useI18n();
  const [offer, setOffer] = useState<ParticipantRoleOffer>();
  const [panelPath, setPanelPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const consumed = useRef(new Set<string>());
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const attempt = ++generation.current;
    setOffer(undefined); setPanelPath(''); setError(''); setPollError(''); setBusy(false); inFlight.current = false;
    if (!connected || !token || !identity) return;
    let polling = false;
    const abort = new AbortController();
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const query = new URLSearchParams({ studioId, room: roomName, identity });
        const response = await fetch(`/api/participant-role?${query}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось проверить назначение роли.');
        if (generation.current !== attempt || abort.signal.aborted) return;
        setPollError('');
        const next = parseParticipantRoleOffer(data);
        setOffer(next && !consumed.current.has(next.id) ? next : undefined);
      } catch (cause) { if (!abort.signal.aborted && generation.current === attempt) setPollError(cause instanceof Error ? cause.message : 'Не удалось проверить назначение роли.'); }
      finally { polling = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 2000);
    return () => { generation.current += 1; abort.abort(); clearInterval(timer); };
  }, [studioId, roomName, identity, token, connected]);
  const accept = async () => {
    if (!offer || !connected || inFlight.current || consumed.current.has(offer.id)) return;
    const current = offer, attempt = generation.current;
    inFlight.current = true; setBusy(true); setError('');
    // Reserve the tab during the explicit click so popup blockers do not turn
    // acceptance into navigation away from the active guest publication.
    let panel: Window | null = null;
    try { panel = window.open('about:blank', '_blank'); if (panel) panel.opener = null; } catch { /* Explicit fallback link stays available. */ }
    try {
      const path = await acceptParticipantRoleOffer({ token, studioId, roomName, offer: current, origin: window.location.origin });
      consumed.current.add(current.id);
      if (generation.current !== attempt) { panel?.close(); return; }
      setOffer(undefined); setPanelPath(path);
      if (panel && !panel.closed) panel.location.replace(new URL(path, window.location.origin).toString());
    } catch (cause) {
      panel?.close();
      if (generation.current === attempt) setError(cause instanceof Error ? cause.message : 'Не удалось принять назначение.');
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
  if (!offer && !panelPath && !error && !pollError) return null;
  return <section className="panel stack guest-role-offer" aria-label={t('Назначение роли')}>
    {offer && <><p>{offer.role === 'admin' ? t('Вам предлагают стать администратором этой комнаты.') : t('Вам предлагают стать модератором этой комнаты.')}</p>
      <p className="muted">{t('Панель откроется в новой вкладке. Камера и микрофон гостя продолжат работать.')}</p>
      <div className="toolbar"><button type="button" disabled={busy || !connected} onClick={() => void accept()}>{t('Принять роль')}</button><button type="button" className="button-secondary" disabled={busy || !connected} onClick={() => void decline()}>{t('Отклонить')}</button></div></>}
    {panelPath && <a className="button-secondary" href={panelPath} target="_blank" rel="noopener noreferrer">{t('Открыть панель в новой вкладке')}</a>}
    {(error || pollError) && <p role="alert">{translateWorkspaceMessage(t, error || pollError)}</p>}
  </section>;
}
