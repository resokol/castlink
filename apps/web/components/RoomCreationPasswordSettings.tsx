"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { translateManagementMessage } from '@/lib/i18n/management';

/** Mounted only in the studio sidebar. Authorization and the current secret are checked by the server. */
export function RoomCreationPasswordSettings({ studioId, roomName }: { studioId: string; roomName: string }) {
  const { t } = useI18n();
  const id = useId();
  const [allowed, setAllowed] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch(`/api/room-studio-access?setting=creation-password&studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(roomName)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) { setAllowed(data.allowed === true); setConfigured(data.configured === true); }
      }).catch(() => {});
    return () => { mounted.current = false; controller.abort(); };
  }, [studioId, roomName]);
  const clearPasswords = () => { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setSaved(false); setError('');
    if (newPassword !== confirmation) { setError('Новые пароли не совпадают'); return; }
    if (newPassword.length < 8 || newPassword.length > 256 || !newPassword.trim() || /[\r\n\0]/.test(newPassword)) {
      setError('Новый пароль: от 8 до 256 символов, без переводов строк и пустого значения.'); return;
    }
    submitting.current = true; setBusy(true);
    try {
      const response = await fetch('/api/room-studio-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change-creation-password', studioId, name: roomName, currentPassword, newPassword, confirmation }) });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw Error(data.error || 'Не удалось подтвердить смену пароля. Повторите попытку.');
      if (mounted.current) { clearPasswords(); setSaved(true); }
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Не удалось подтвердить смену пароля. Повторите попытку.');
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  if (!allowed) return null;
  return <details className="room-creation-password-settings" onToggle={event => { if (!event.currentTarget.open) { clearPasswords(); setError(''); setSaved(false); } }}>
    <summary aria-label={t('Пароль создания комнат')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3M12 14v3" /></svg><span>{t('Создание комнат')}</span><svg className="password-settings-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 6 3 3 3-3" /></svg></summary>
    {configured ? <form onSubmit={submit} aria-label={t('Сменить пароль создания комнат')}>
      <p>{t('Общий для этого сервера. Нужен только для новых комнат.')}</p>
      <label htmlFor={`${id}-current`}>{t('Текущий пароль')}<input id={`${id}-current`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} value={currentPassword} disabled={busy} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label htmlFor={`${id}-new`}>{t('Новый пароль')}<input id={`${id}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={newPassword} disabled={busy} onChange={event => setNewPassword(event.target.value)} /></label>
      <label htmlFor={`${id}-confirmation`}>{t('Повторите новый пароль')}<input id={`${id}-confirmation`} name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p className="password-settings-error" role="alert">{translateManagementMessage(error, t)}</p>}
      {saved && <p className="password-settings-success" role="status">{t('Пароль изменён. Комнаты продолжают работать.')}</p>}
      <button type="submit" disabled={busy}>{busy ? t('Сохраняем…') : t('Сменить пароль')}</button>
    </form> : <p className="password-settings-unconfigured">{t('Пароль задаётся при установке сервера.')}</p>}
  </details>;
}
