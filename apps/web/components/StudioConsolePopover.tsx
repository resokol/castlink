'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { StudioConsoleIcon } from './StudioConsoleIcon';
import { positionStudioConsolePopover, studioConsolePopoverInvoker } from './studio-console-popover-position';

/** Native top-layer disclosure. Its children and control owners stay mounted. */
export const StudioConsolePopover = forwardRef<HTMLDivElement, {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}>(function StudioConsolePopover({ id, title, children, className = '', onOpenChange }, ref) {
  const { t } = useI18n();
  const popup = useRef<HTMLDivElement>(null), anchor = useRef<HTMLElement | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => popup.current!, []);
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (popup.current && anchor.current) positionStudioConsolePopover(popup.current, anchor.current);
    };
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [open]);
  return <div ref={popup} id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`}
    className={`studio-console-popover ${className}`}
    onBeforeToggle={event => {
      if (event.target !== event.currentTarget || event.newState !== 'open') return;
      anchor.current = studioConsolePopoverInvoker(id, (event.nativeEvent as ToggleEvent & { source?: Element }).source);
    }}
    onToggle={event => {
      if (event.target !== event.currentTarget) return;
      const opened = event.newState === 'open';
      setOpen(opened);
      onOpenChange?.(opened);
      if (!opened && document.activeElement === document.body) anchor.current?.focus({ preventScroll: true });
      if (opened && popup.current) {
        if (anchor.current) positionStudioConsolePopover(popup.current, anchor.current);
        popup.current.scrollTop = 0;
        popup.current.querySelector<HTMLButtonElement>('[data-console-popover-close]')?.focus({ preventScroll: true });
      }
    }}>
    <header className="studio-console-popover-heading"><h2 id={`${id}-title`}>{title}</h2>
      <button data-console-popover-close type="button" popoverTarget={id} popoverTargetAction="hide" aria-label={t('Закрыть')}><StudioConsoleIcon kind="close" /></button>
    </header>
    {children}
  </div>;
});
