/** Move only an in-page panel. Browser PiP windows use their own native frame. */
export function createFloatingPanelDrag(panel: HTMLElement, handle: HTMLElement) {
  const win = panel.ownerDocument.defaultView!;
  let moved = false, point: { id: number; x: number; y: number; left: number; top: number } | undefined;
  const place = (left: number, top: number) => {
    const viewport = win.visualViewport;
    const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
    const width = viewport?.width || win.innerWidth, height = viewport?.height || win.innerHeight;
    panel.style.maxWidth = Math.max(1,width - 24) + 'px'; panel.style.maxHeight = Math.max(1,height - 24) + 'px';
    const rect = panel.getBoundingClientRect();
    panel.style.left = Math.max(x + 12, Math.min(left, x + width - rect.width - 12)) + 'px';
    panel.style.top = Math.max(y + 12, Math.min(top, y + height - rect.height - 12)) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  };
  const clamp = () => { if (!moved) return false; const rect = panel.getBoundingClientRect(); place(rect.left,rect.top); return true; };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as Element)?.closest?.('button,select,input,textarea,a,summary,[contenteditable=true],[role=button]')) return;
    const rect = panel.getBoundingClientRect();
    point = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture?.(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!point || event.pointerId !== point.id) return;
    moved = true; place(point.left + event.clientX - point.x,point.top + event.clientY - point.y); event.preventDefault();
  };
  const end = (event?: PointerEvent) => {
    if (!point || event && event.pointerId !== point.id) return;
    const id = point.id; point = undefined;
    try { handle.releasePointerCapture?.(id); } catch { /* Capture may already be lost. */ }
  };
  const keyboard = (event: KeyboardEvent) => {
    if (event.target !== handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    const rect = panel.getBoundingClientRect(), step = event.shiftKey ? 24 : 8; moved = true;
    place(rect.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),rect.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)); event.preventDefault();
  };
  handle.addEventListener('pointerdown',down); handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',end); handle.addEventListener('pointercancel',end); handle.addEventListener('lostpointercapture',end); handle.addEventListener('keydown',keyboard);
  win.addEventListener('resize',clamp); win.visualViewport?.addEventListener('resize',clamp); win.visualViewport?.addEventListener('scroll',clamp);
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { clamp(); }) : undefined; observer?.observe(panel);
  return { clamp, dispose() { end(); handle.removeEventListener('pointerdown',down); handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',end); handle.removeEventListener('pointercancel',end); handle.removeEventListener('lostpointercapture',end); handle.removeEventListener('keydown',keyboard); win.removeEventListener('resize',clamp); win.visualViewport?.removeEventListener('resize',clamp); win.visualViewport?.removeEventListener('scroll',clamp); observer?.disconnect(); } };
}
