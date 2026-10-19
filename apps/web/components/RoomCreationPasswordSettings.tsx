"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { translateManagementMessage } from '@/lib/i18n/management';

type PasswordAccess = { allowed: boolean; configured: boolean; canInitialize: boolean };
export function useRoomCreationPasswordAccess(studioId: string, roomName: string) {
  const [revision, setRevision] = useState(0);
  const requestGeneration = useRef(0);
  const [access, setAccess] = useState<PasswordAccess>({ allowed: false, configured: false, canInitialize: false });
  useEffect(() => {
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    fetch(`/api/room-studio-access?setting=creation-password&studioId=${encodeURIComponent(studioId)}&name=${encodeURIComponent(roomName)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && generation === requestGeneration.current) setAccess({ allowed: data.allowed === true, configured: data.configured === true, canInitialize: data.canInitialize === true });
      }).catch(() => {});
    return () => controller.abort();
  }, [studioId, roomName, revision]);
  return { ...access, refresh: () => setRevision(value => value + 1), markConfigured: () => { ++requestGeneration.current; setAccess(value => ({ ...value, configured: true, canInitialize: false })); } };
}
export function RoomCreationPasswordTab({ access, active, onOpen }: { access: PasswordAccess; active: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  if (!access.allowed) return null;
  return <button type="button" className="sidebar-settings-link room-creation-password-tab" aria-label={t('Пароль создания комнат')} aria-pressed={active} aria-controls="studio-creation-password" onClick={onOpen}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3M12 14v3" /></svg><span>{t('Создание комнат')}</span></button>;
}

/** Mounted only while its workspace tab is open; leaving the tab drops all password state. */
export function RoomCreationPasswordSettings({ studioId, roomName, access, onConfigured }: { studioId: string; roomName: string; access: PasswordAccess; onConfigured?: () => void }) {
  const { t } = useI18n();
  const id = useId();
  const [configured, setConfigured] = useState(access.configured);
  useEffect(() => { setConfigured(access.configured); }, [access.configured]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setSaved(false); setError('');
    if (newPassword !== confirmation) { setError('Новые пароли не совпадают'); return; }
    if (newPassword.length < 8 || newPassword.length > 256 || !newPassword.trim() || /[\r\n\0]/.test(newPassword)) { setError('Новый пароль: от 8 до 256 символов, без переводов строк и пустого значения.'); return; }
    submitting.current = true; setBusy(true);
    try {
      const response = await fetch('/api/room-studio-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change-creation-password', studioId, name: roomName, currentPassword, newPassword, confirmation }) });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw Error(data.error || 'Не удалось подтвердить смену пароля. Повторите попытку.');
      if (mounted.current) { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setConfigured(true); onConfigured?.(); setSaved(true); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Не удалось подтвердить смену пароля. Повторите попытку.'); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  if (!access.allowed) return null;
  return <section id="studio-creation-password" className="room-creation-password-settings" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{t('Пароль создания комнат')}</h2>
    <p>{t('Общий для этого сервера. Нужен только для новых комнат.')}</p>
    {configured || access.canInitialize ? <form onSubmit={submit} aria-label={t(configured ? 'Сменить пароль создания комнат' : 'Установить пароль создания комнат')}>
      {configured && <label htmlFor={`${id}-current`}>{t('Текущий пароль')}<input id={`${id}-current`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} value={currentPassword} disabled={busy} onChange={event => setCurrentPassword(event.target.value)} /></label>}
      <label htmlFor={`${id}-new`}>{t('Новый пароль')}<input id={`${id}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={newPassword} disabled={busy} onChange={event => setNewPassword(event.target.value)} /></label>
      <label htmlFor={`${id}-confirmation`}>{t('Повторите новый пароль')}<input id={`${id}-confirmation`} name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p className="password-settings-error" role="alert">{translateManagementMessage(error, t)}</p>}
      {saved && <p className="password-settings-success" role="status">{t('Пароль изменён. Комнаты продолжают работать.')}</p>}
      <button type="submit" disabled={busy}>{busy ? t('Сохраняем…') : t(configured ? 'Сменить пароль' : 'Установить пароль')}</button>
    </form> : <p>{t('Пароль ещё не установлен. Его задаёт владелец сервера.')}</p>}
  </section>;
}
