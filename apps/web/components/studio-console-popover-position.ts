/** Position a native top-layer menu next to its invoker, without moving its owner. */
export function positionStudioConsolePopover(popup: HTMLElement, anchor: HTMLElement) {
  const margin = 12, gap = 8;
  const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  const rect = anchor.getBoundingClientRect();
  popup.style.maxHeight = `${Math.max(80, viewportHeight - margin * 2)}px`;
  const width = Math.min(parseFloat(getComputedStyle(popup).width) || 380, viewportWidth - margin * 2);
  const height = Math.min(popup.getBoundingClientRect().height || 360, viewportHeight - margin * 2);
  const below = viewportHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  let left = rect.left, top = rect.bottom + gap;
  if (below < height) {
    if (above >= height) top = rect.top - height - gap;
    else if (viewportWidth - rect.right - gap - margin >= width) {
      left = rect.right + gap;
      top = rect.top;
    } else if (below < above) top = rect.top - height - gap;
  }
  popup.style.left = `${Math.max(margin, Math.min(left, viewportWidth - width - margin))}px`;
  const clampedTop = Math.max(margin, Math.min(top, viewportHeight - height - margin));
  popup.style.top = `${clampedTop}px`;
  popup.style.maxHeight = `${Math.max(80, viewportHeight - clampedTop - margin)}px`;
}

export function studioConsolePopoverInvoker(id: string, source?: EventTarget | null) {
  if (source instanceof HTMLElement) return source;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return [...document.querySelectorAll<HTMLElement>("[popovertarget]")]
    .find(element => element.getAttribute("popovertarget") === id && element.getClientRects().length > 0);
}
