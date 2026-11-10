"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** The native invoker also prevents light dismiss from reopening the same menu. */
export function GuestMediaMenu({ label, disabled, className = "", triggerClassName = "", children }: { label: string; disabled: boolean; className?: string; triggerClassName?: string; children: ReactNode | ((open: boolean) => ReactNode) }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => menu.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);
  return <>
    <button ref={arrow} type="button" className={`lk-button guest-media-menu-toggle ${triggerClassName}`} popoverTarget={id} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={disabled}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </button>
    <div ref={menu} id={id} popover="auto" role="dialog" aria-label={label} className={`guest-media-menu ${className}`} onBeforeToggle={event => {
      if (event.newState !== "open" || !arrow.current || !menu.current) return;
      const rect = arrow.current.getBoundingClientRect();
      const bottom = Math.max(12, window.innerHeight - rect.top + 8);
      menu.current.style.left = `${Math.max(12, Math.min(rect.right - 320, window.innerWidth - 332))}px`;
      menu.current.style.bottom = `${bottom}px`;
      menu.current.style.maxHeight = `${Math.max(0, window.innerHeight - bottom - 12)}px`;
    }} onToggle={event => setOpen(event.newState === "open")}>
      {typeof children === "function" ? children(open) : children}
    </div>
  </>;
}
