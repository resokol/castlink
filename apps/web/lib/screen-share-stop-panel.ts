import { createDocumentPictureInPictureSlot, type DocumentPictureInPictureApi } from './document-picture-in-picture';
export { documentPictureInPictureApi } from './document-picture-in-picture';
export type { DocumentPictureInPictureApi } from './document-picture-in-picture';
export type ScreenShareStopLabels = { locale: string; title: string; stop: string; stopping: string; stopError: string };
export type ScreenShareStopPanelState = "closed" | "opening" | "open";

/** Own only this capture's auxiliary window. Closing it never stops media. */
export function createScreenShareStopPanel({ api, labels: initialLabels, isSharing, stop, onStateChange }: {
  api?: DocumentPictureInPictureApi; labels: ScreenShareStopLabels; isSharing: () => boolean; stop: () => Promise<void>; onStateChange?: (state: ScreenShareStopPanelState) => void;
}) {
  let labels = initialLabels, disposed = false, generation = 0;
  let pip: Window | undefined, pending: Promise<boolean> | undefined;
  let button: HTMLButtonElement | undefined, error: HTMLElement | undefined;
  let detach: (() => void) | undefined, stopping = false, stopFailed = false, suppressed = false;
  const state = (value: ScreenShareStopPanelState) => { if (!disposed) onStateChange?.(value); };
  const slot = api ? createDocumentPictureInPictureSlot(api, 'stop', () => {
    generation++; pending = undefined;
    detach?.(); detach = undefined;
    pip = undefined; button = undefined; error = undefined;
    state("closed");
  }) : undefined;
  function paint() {
    if (!pip || pip.closed || !button || !error) return;
    pip.document.title = labels.title;
    pip.document.documentElement.lang = labels.locale;
    button.textContent = stopping ? labels.stopping : labels.stop;
    button.disabled = stopping;
    error.textContent = stopFailed ? labels.stopError : "";
    error.hidden = !stopFailed;
  }
  function close() {
    generation++;
    pending = undefined;
    pip = undefined; button = undefined; error = undefined;
    detach?.(); detach = undefined;
    slot?.close();
    state("closed");
  }
  function sync() { if (!isSharing()) close(); else paint(); }
  async function stopFromPanel() {
    if (disposed || stopping || !pip || pip.closed) return;
    if (!isSharing()) { close(); return; }
    stopping = true; stopFailed = false; paint();
    try { await stop(); }
    catch { if (!disposed) stopFailed = true; }
    finally { stopping = false; if (!disposed) sync(); }
  }
  function open(): Promise<boolean> {
    if (disposed || !api || !isSharing()) return Promise.resolve(false);
    if (pip && !pip.closed) { pip.focus(); return Promise.resolve(true); }
    if (pending) return pending;
    const ticket = generation;
    state("opening");
    let requested: ReturnType<NonNullable<typeof slot>['open']>;
    // No await before requestWindow: an explicit click must retain its activation.
    try { requested = slot!.open({ width: 420, height: 56 }); }
    catch { state("closed"); return Promise.resolve(false); }
    const opening = requested.then(content => {
      if (!content) { if (generation === ticket) state("closed"); return false; }
      if (disposed || generation !== ticket || !isSharing()) { if (slot?.current() === content) slot.close(); return false; }
      const { window, root } = content;
      pip = window; root.className = "cl-pip-stop";
      const document = window.document;
      const style = document.createElement("style");
      style.textContent = ".cl-pip-stop{min-height:56px;display:flex;flex-direction:column;box-sizing:border-box;padding:8px;background:#191c20;color:#eef0f2;font-family:Manrope,Arial,Helvetica,sans-serif}.cl-pip-stop button{flex:1;min-height:40px;width:100%;padding:8px 12px;border:0;border-radius:8px;background:#bd3443;color:#fff;font:700 14px/1.3 Manrope,Arial,Helvetica,sans-serif;cursor:pointer;overflow-wrap:anywhere}.cl-pip-stop button:hover:not(:disabled){background:#a91e34}.cl-pip-stop button:focus-visible{outline:2px solid #fff;outline-offset:-5px}.cl-pip-stop button:disabled{cursor:wait;opacity:.8}.cl-pip-stop [role=alert]{padding:4px 10px;background:#76172a;color:#fff;font-size:12px;line-height:1.3}.cl-pip-stop [hidden]{display:none}";
      root.append(style);
      button = document.createElement("button"); button.type = "button";
      error = document.createElement("div"); error.setAttribute("role", "alert");
      root.append(button, error);
      const click = () => { void stopFromPanel(); };
      button.addEventListener("click", click);
      const ownedButton = button;
      detach = () => { ownedButton.removeEventListener("click", click); };
      paint(); state("open"); return true;
    }).catch(() => { if (!disposed && generation === ticket) { close(); } return false; }).finally(() => { if (pending === opening) pending = undefined; });
    pending = opening;
    return opening;
  }
  return { open, sync, setSuppressed(next: boolean) { if (suppressed === next) return; suppressed = next; slot?.setVisible(!next); }, setLabels(next: ScreenShareStopLabels) { labels = next; paint(); }, dispose() { close(); disposed = true; } };
}

export type ScreenShareStopPanel = ReturnType<typeof createScreenShareStopPanel>;
