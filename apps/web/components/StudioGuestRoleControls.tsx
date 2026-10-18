"use client";
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import type { ParticipantStaffRole } from '@/lib/participant-role-client';

export function StudioGuestRoleControls({ studioId, roomName, identity, participantSid, disabled = false }: {
  studioId: string; roomName: string; identity: string; participantSid: string; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [canAdmin, setCanAdmin] = useState(false);
  const [canModerator, setCanModerator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const requestBusy = useRef(false);
  useEffect(() => {
    const attempt = ++generation.current, abort = new AbortController();
    setCanAdmin(false); setCanModerator(false); setMessage(''); setError(''); setBusy(false); requestBusy.current = false;
    const query = new URLSearchParams({ studioId, room: roomName });
    void Promise.allSettled(['/api/admin-access', '/api/moderator-access'].map(async endpoint => {
      const response = await fetch(`${endpoint}?${query}`, { cache: 'no-store', signal: abort.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Не удалось проверить права.'); return data;
    })).then(([admin, moderator]) => {
      if (abort.signal.aborted || generation.current !== attempt) return;
      if (admin.status === 'fulfilled') setCanAdmin(admin.value.owner === true);
      if (moderator.status === 'fulfilled') setCanModerator(moderator.value.owner === true || moderator.value.canInvite === true);
    });
    return () => { generation.current += 1; abort.abort(); };
  }, [studioId, roomName, identity, participantSid]);
  const assign = async (role: ParticipantStaffRole) => {
    if (disabled || !participantSid || requestBusy.current || (role === 'admin' ? !canAdmin : !canModerator)) return;
    const attempt = generation.current;
    requestBusy.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/participant-role', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'offer', studioId, room: roomName, identity, participantSid, role }), signal: AbortSignal.timeout(10000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Не удалось предложить роль.');
      if (generation.current === attempt) setMessage('Запрос отправлен. Гость должен принять роль в своей вкладке.');
    } catch (cause) { if (generation.current === attempt) setError(cause instanceof Error ? cause.message : 'Не удалось предложить роль.'); }
    finally { if (generation.current === attempt) { requestBusy.current = false; setBusy(false); } }
  };
  if (!canAdmin && !canModerator) return null;
  return <div className="stack guest-role-controls">
    <div className="toolbar">
      {canAdmin && <button type="button" className="button-secondary" disabled={disabled || busy || !participantSid} onClick={() => void assign('admin')}>{t('Назначить администратором')}</button>}
      {canModerator && <button type="button" className="button-secondary" disabled={disabled || busy || !participantSid} onClick={() => void assign('moderator')}>{t('Назначить модератором')}</button>}
    </div>
    {message && <small role="status">{translateWorkspaceMessage(t, message)}</small>}
    {error && <small role="alert">{translateWorkspaceMessage(t, error)}</small>}
  </div>;
}
