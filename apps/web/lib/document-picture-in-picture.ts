export type DocumentPictureInPictureApi = { requestWindow(options: { width: number; height: number }): Promise<Window> };
export function documentPictureInPictureApi(host: unknown): DocumentPictureInPictureApi | undefined {
  try {
    const api = (host as { documentPictureInPicture?: DocumentPictureInPictureApi } | undefined)?.documentPictureInPicture;
    return typeof api?.requestWindow === 'function' ? api : undefined;
  } catch { return undefined; }
}
type Content = { window: Window; root: HTMLElement };
type Claim = { width: number; height: number; content?: Content; hidden: () => void };
type Surface = { window?: Window; pending?: Promise<Window>; claims: Set<Claim> };
const surfaces = new WeakMap<DocumentPictureInPictureApi, Surface>();
/** One browser-owned window, independent content lifetimes. Never changes media. */
export function createDocumentPictureInPictureSlot(api: DocumentPictureInPictureApi, name: 'slides' | 'stop', hidden: () => void) {
  let surface = surfaces.get(api);
  if (!surface) { surface = { claims: new Set() }; surfaces.set(api, surface); }
  const shared = surface;
  let claim: Claim | undefined, pending: Promise<Content | undefined> | undefined;
  const fit = (initial = false) => {
    const window = shared.window;
    if (!window || window.closed || !shared.claims.size || initial && shared.claims.size === 1) return;
    const claims = [...shared.claims], width = Math.max(...claims.map(item => item.width)), height = claims.reduce((sum,item) => sum + item.height,0);
    try {
      // A fresh PiP can temporarily report its opener's outer dimensions.
      // requestWindow already sizes its initial single surface; shared resizing
      // accepts only small measured decorations, never a stale opener frame.
      const frame = (value: number, limit: number) => Number.isFinite(value) && value >= 0 && value <= limit ? value : 0;
      const frameWidth = frame(window.outerWidth - window.innerWidth,32), frameHeight = frame(window.outerHeight - window.innerHeight,96);
      window.resizeTo(Math.min(window.screen.availWidth || width,width + frameWidth),Math.min(window.screen.availHeight || height,height + frameHeight));
    } catch { /* Browser may retain user geometry; each slot remains scrollable. */ }
  };
  const release = (owned: Claim) => {
    if (!shared.claims.delete(owned)) return;
    owned.content?.root.remove();
    if (claim === owned) { claim = undefined; pending = undefined; }
    owned.hidden(); fit();
    if (!shared.claims.size && shared.window) {
      const window = shared.window; shared.window = undefined;
      if (!window.closed) window.close();
    }
  };
  function request(size: { width: number; height: number }): Promise<Window> {
    if (shared.window && !shared.window.closed) { fit(); return Promise.resolve(shared.window); }
    if (shared.pending) return shared.pending;
    // This invocation stays synchronous with the explicit user gesture.
    const requested = api.requestWindow(size);
    const opening = Promise.resolve(requested).then(window => {
      if (!shared.claims.size) { window.close(); return window; }
      shared.window = window; fit(true);
      const style = window.document.createElement('style');
      style.textContent = 'html,body{margin:0;min-height:100%;background:#161a1d;color:#eef0f2;color-scheme:dark}body{display:flex;flex-direction:column}[data-pip-slot]{flex:none;min-width:0}';
      window.document.head.append(style);
      window.addEventListener('pagehide', () => {
        if (shared.window !== window) return;
        shared.window = undefined;
        for (const item of [...shared.claims]) release(item);
      }, { once: true });
      return window;
    }).finally(() => { if (shared.pending === opening) shared.pending = undefined; });
    shared.pending = opening;
    return opening;
  }
  return {
    current: () => claim?.content,
    open(size: { width: number; height: number }): Promise<Content | undefined> {
      if (claim?.content && !claim.content.window.closed) { claim.content.window.focus(); return Promise.resolve(claim.content); }
      if (pending) return pending;
      const owned: Claim = { ...size, hidden }; claim = owned; shared.claims.add(owned);
      let requested: Promise<Window>;
      try { requested = request(size); }
      catch { release(owned); return Promise.resolve(undefined); }
      const opening = requested.then(window => {
        if (claim !== owned || !shared.claims.has(owned)) return undefined;
        if (window.closed) { release(owned); return undefined; }
        const root = window.document.createElement('div'); root.setAttribute('data-pip-slot', name);
        window.document.body.append(root); owned.content = { window, root };
        window.focus(); return owned.content;
      }).catch(() => { release(owned); return undefined; }).finally(() => { if (pending === opening) pending = undefined; });
      pending = opening;
      return opening;
    },
    close() { if (claim) release(claim); },
  };
}
