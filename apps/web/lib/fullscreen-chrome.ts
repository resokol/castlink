import { isElementFullscreen } from "./fullscreen";

/** Hide only fullscreen chrome; keyboard focus and open controls remain reachable. */
export function watchFullscreenChrome(element: HTMLElement, idleMs = 3000) {
  const doc = element.ownerDocument, win = doc.defaultView!;
  let timer: number | undefined, active = false;
  const clear = () => { if (timer !== undefined) { win.clearTimeout(timer); timer = undefined; } };
  const fullscreen = () => isElementFullscreen(element) || !!doc.fullscreenElement && element.contains(doc.fullscreenElement);
  const interacting = () => !!element.querySelector(":focus-visible, :popover-open");
  const schedule = () => {
    clear();
    if (active && !interacting()) timer = win.setTimeout(() => {
      timer = undefined;
      if (fullscreen() && !interacting()) element.classList.add("castlink-fullscreen-idle");
    }, idleMs);
  };
  const reveal = () => {
    if (!active) return;
    element.classList.remove("castlink-fullscreen-idle");
    schedule();
  };
  const sync = () => {
    const next = fullscreen();
    if (next === active) return;
    active = next; clear(); element.classList.remove("castlink-fullscreen-idle");
    if (active) schedule();
  };
  const focusOut = () => { if (active) win.queueMicrotask(schedule); };
  doc.addEventListener("fullscreenchange", sync);
  doc.addEventListener("webkitfullscreenchange", sync);
  doc.addEventListener("pointermove", reveal, { passive: true });
  doc.addEventListener("pointerdown", reveal, { passive: true });
  doc.addEventListener("keydown", reveal);
  element.addEventListener("focusin", reveal);
  element.addEventListener("focusout", focusOut);
  const observer = new MutationObserver(sync);
  observer.observe(element, { attributes: true, attributeFilter: ["class"] });
  sync();
  return () => {
    clear(); observer.disconnect(); element.classList.remove("castlink-fullscreen-idle");
    doc.removeEventListener("fullscreenchange", sync); doc.removeEventListener("webkitfullscreenchange", sync);
    doc.removeEventListener("pointermove", reveal); doc.removeEventListener("pointerdown", reveal); doc.removeEventListener("keydown", reveal);
    element.removeEventListener("focusin", reveal); element.removeEventListener("focusout", focusOut);
  };
}
