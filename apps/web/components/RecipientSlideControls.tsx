'use client';
import { useEffect, useRef, useState } from 'react';
import { slideControlsId, type SlideControlsAction } from '@/lib/co-presentation-controls';
import type { CoPresentation } from '@/lib/co-presentation-state';

const copy = {
  ru: { title: 'Управление слайдами', previous: 'Предыдущий слайд', next: 'Следующий слайд', hide: 'Скрыть панель', pending: 'Ожидаем отображения…', ready: 'Вы можете переключать слайды', unavailable: 'Управление временно недоступно', select: 'Выбрать презентацию' },
  en: { title: 'Slide controls', previous: 'Previous slide', next: 'Next slide', hide: 'Hide controls', pending: 'Waiting for render…', ready: 'You can change slides', unavailable: 'Controls temporarily unavailable', select: 'Choose presentation' },
  'zh-CN': { title: '幻灯片控制', previous: '上一张幻灯片', next: '下一张幻灯片', hide: '隐藏控制面板', pending: '等待渲染…', ready: '您可以切换幻灯片', unavailable: '控制暂不可用', select: '选择演示' },
};

export function recipientSlideSessions(sessions: CoPresentation[], identity: string, sid: string) {
  return sessions.filter(session => session.controller?.identity === identity && session.controller.sid === sid && !(session.owner.identity === identity && session.owner.sid === sid));
}
type GrantView = { seen: string[]; active: string; open: boolean };
/** Only a new exact grant or an explicit reopen may undo a user dismissal. */
export function recipientGrantTransition(previous: GrantView, grants: string[], reopen = false): GrantView {
  const fresh = grants.find(id => !previous.seen.includes(id));
  return { seen: [...new Set([...previous.seen, ...grants])].slice(-512), active: fresh || (grants.includes(previous.active) ? previous.active : grants[0]) || '', open: !!grants.length && (!!fresh || reopen || previous.open) };
}

export function RecipientSlideControls({ id, sessions, locale, busy, unavailable, reopen, action, onVisibilityChange, returnFocus }: {
  id: string; sessions: CoPresentation[]; locale: keyof typeof copy; busy: boolean; unavailable: boolean; reopen: number;
  action: (event: SlideControlsAction) => void | Promise<unknown>; onVisibilityChange?: (visible: boolean) => void; returnFocus?: () => void;
}) {
  const popup = useRef<HTMLDivElement>(null), hadFocus = useRef(false), lastReopen = useRef(reopen);
  const latest = useRef({ sessions, busy, unavailable, action, onVisibilityChange, returnFocus });
  latest.current = { sessions, busy, unavailable, action, onVisibilityChange, returnFocus };
  const [view, setView] = useState<GrantView>({ seen: [], active: '', open: false });
  const [sending, setSending] = useState(''), [failed, setFailed] = useState(false);
  const flight = useRef<object | undefined>(undefined), alive = useRef(true);
  const grants = sessions.map(slideControlsId), signature = grants.join('|');
  const session = sessions.find(item => slideControlsId(item) === view.active) || sessions[0];
  const text = copy[locale], pending = !!session && session.revision !== session.renderedRevision;
  const disabled = !session || busy || unavailable || pending || !!sending;
  const position = () => {
    const element = popup.current; if (!element) return;
    const width = Math.min(300, window.innerWidth - 24); element.style.width = `${width}px`;
    element.style.maxHeight = `${Math.max(80, window.innerHeight - 24)}px`;
    const height = element.getBoundingClientRect().height;
    const footer = element.closest('.castlink-conference-footer')?.getBoundingClientRect();
    element.style.left = `${Math.max(12, (window.innerWidth - width) / 2)}px`;
    element.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, (footer?.top ?? window.innerHeight - 12) - height - 12))}px`;
  };
  const hide = () => {
    const element = popup.current;
    const restore = !!element && (element.contains(document.activeElement) || document.activeElement === document.body && hadFocus.current);
    if (element?.matches(':popover-open')) element.hidePopover();
    latest.current.onVisibilityChange?.(false);
    if (restore) latest.current.returnFocus?.();
  };
  const close = () => { hide(); setView(value => ({ ...value, open: false })); };
  useEffect(() => {
    const requested = reopen !== lastReopen.current; lastReopen.current = reopen;
    setView(value => recipientGrantTransition(value, grants, requested));
  }, [signature, reopen]);
  useEffect(() => {
    const element = popup.current; if (!element) return;
    if (!view.open || !session) { hide(); return; }
    const focused = document.activeElement;
    if (!element.matches(':popover-open')) {
      element.showPopover();
      // A new delegation announces controls without taking focus from chat.
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }
    position(); latest.current.onVisibilityChange?.(true);
    const focus = (event: FocusEvent) => { if (event.target !== document.body) hadFocus.current = element.contains(event.target as Node); };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[popover="auto"]:popover-open')) return;
      event.preventDefault(); close();
    };
    document.addEventListener('focusin', focus); document.addEventListener('keydown', escape);
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    return () => { document.removeEventListener('focusin', focus); document.removeEventListener('keydown', escape); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [view.open, view.active, sessions.length, locale]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (popup.current?.matches(':popover-open')) popup.current.hidePopover(); }; }, []);
  const navigate = (direction: 'previous' | 'next') => {
    if (!session || disabled || flight.current) return;
    const grant = slideControlsId(session), current = latest.current.sessions.find(item => slideControlsId(item) === grant);
    if (!current || latest.current.busy || latest.current.unavailable || current.revision !== current.renderedRevision || (direction === 'previous' ? current.page <= 1 : current.page >= current.pages)) return;
    const operation = {}; flight.current = operation; hadFocus.current = true; setSending(grant); setFailed(false);
    void Promise.resolve().then(() => {
      if (alive.current && latest.current.sessions.some(item => slideControlsId(item) === grant)) return latest.current.action({ id: grant, action: direction });
    }).catch(() => { if (alive.current && latest.current.sessions.some(item => slideControlsId(item) === grant)) setFailed(true); }).finally(() => {
      if (flight.current === operation) { flight.current = undefined; if (alive.current) setSending(''); }
    });
  };
  return <div ref={popup} id={id} className="recipient-slide-controls" popover="manual" role="dialog" aria-label={text.title} onFocusCapture={() => { hadFocus.current = true; }}>
    <header className="recipient-slide-heading"><strong className="recipient-slide-title" title={session?.name}>{session?.name || text.title}</strong><button type="button" className="recipient-slide-hide" aria-label={text.hide} onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
    {sessions.length > 1 && <select className="recipient-slide-select" aria-label={text.select} value={session ? slideControlsId(session) : ''} onChange={event => setView(value => ({ ...value, active: event.target.value }))}>{sessions.map(item => <option key={slideControlsId(item)} value={slideControlsId(item)}>{item.name}</option>)}</select>}
    <div className="recipient-slide-navigation" aria-busy={disabled}><button type="button" aria-label={text.previous} disabled={disabled || !session || session.page <= 1} onClick={() => navigate('previous')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button><output aria-live="polite">{session ? `${session.renderedPage > 0 ? session.renderedPage : session.page} / ${session.pages}` : '—'}</output><button type="button" aria-label={text.next} disabled={disabled || !session || session.page >= session.pages} onClick={() => navigate('next')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button></div>
    <p className="recipient-slide-status" role="status">{unavailable || failed ? text.unavailable : busy || pending || sending ? text.pending : text.ready}</p>
  </div>;
}
