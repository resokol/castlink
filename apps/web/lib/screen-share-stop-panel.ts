export type DocumentPictureInPictureApi = { requestWindow(options: { width: number; height: number }): Promise<Window> };
export type ScreenShareStopLabels = { locale: string; title: string; stop: string; stopping: string; stopError: string };
export type ScreenShareStopPanelState = "closed" | "opening" | "open";

export function documentPictureInPictureApi(host: unknown): DocumentPictureInPictureApi | undefined {
  try {
    const api = (host as { documentPictureInPicture?: DocumentPictureInPictureApi } | undefined)?.documentPictureInPicture;
    return typeof api?.requestWindow === "function" ? api : undefined;
  } catch { return undefined; }
}

/** Own only this capture's auxiliary window. Closing it never stops media. */
export function createScreenShareStopPanel({ api, labels: initialLabels, isSharing, stop, onStateChange }: {
  api?: DocumentPictureInPictureApi; labels: ScreenShareStopLabels; isSharing: () => boolean; stop: () => Promise<void>; onStateChange?: (state: ScreenShareStopPanelState) => void;
}) {
  let labels = initialLabels, disposed = false, generation = 0;
  let pip: Window | undefined, pending: Promise<boolean> | undefined;
  let button: HTMLButtonElement | undefined, error: HTMLElement | undefined;
  let detach: (() => void) | undefined, stopping = false, stopFailed = false;
  const state = (value: ScreenShareStopPanelState) => { if (!disposed) onStateChange?.(value); };
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
    const owned = pip;
    pip = undefined; button = undefined; error = undefined;
    detach?.(); detach = undefined;
    if (owned && !owned.closed) owned.close();
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
    let requested: Promise<Window>;
    // No await before requestWindow: an explicit click must retain its activation.
    try { requested = api.requestWindow({ width: 420, height: 56 }); }
    catch { state("closed"); return Promise.resolve(false); }
    const opening = requested.then(window => {
      if (disposed || generation !== ticket || !isSharing()) { window.close(); return false; }
      pip = window;
      const document = window.document;
      const style = document.createElement("style");
      style.textContent = "html,body{width:100%;height:100%;margin:0;background:#bd243c;color:#fff;font-family:Arial,Helvetica,sans-serif}body{display:flex;flex-direction:column}button{flex:1;min-height:40px;width:100%;padding:8px 12px;border:0;background:#bd243c;color:#fff;font:700 14px/1.3 Arial,Helvetica,sans-serif;cursor:pointer;overflow-wrap:anywhere}button:hover:not(:disabled){background:#a91e34}button:focus-visible{outline:2px solid #fff;outline-offset:-5px}button:disabled{cursor:wait;opacity:.8}[role=alert]{padding:4px 10px;background:#76172a;color:#fff;font-size:12px;line-height:1.3}[hidden]{display:none}";
      document.head.append(style);
      button = document.createElement("button"); button.type = "button";
      error = document.createElement("div"); error.setAttribute("role", "alert");
      document.body.replaceChildren(button, error);
      const hidden = () => {
        if (pip !== window) return;
        detach?.(); detach = undefined;
        pip = undefined; button = undefined; error = undefined;
        state("closed");
      };
      const click = () => { void stopFromPanel(); };
      button.addEventListener("click", click);
      window.addEventListener("pagehide", hidden);
      const ownedButton = button;
      detach = () => { window.removeEventListener("pagehide", hidden); ownedButton.removeEventListener("click", click); };
      paint(); state("open"); return true;
    }).catch(() => { if (!disposed && generation === ticket) { close(); } return false; }).finally(() => { if (pending === opening) pending = undefined; });
    pending = opening;
    return opening;
  }
  return { open, sync, setLabels(next: ScreenShareStopLabels) { labels = next; paint(); }, dispose() { close(); disposed = true; } };
}

export type ScreenShareStopPanel = ReturnType<typeof createScreenShareStopPanel>;
