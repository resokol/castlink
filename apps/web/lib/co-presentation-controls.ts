import { createDocumentPictureInPictureSlot, documentPictureInPictureApi } from './document-picture-in-picture';
import { createSlideToolbar } from './co-presentation-toolbar';
import type { CoPresentation } from './co-presentation-state';
export type SlideControlsState = {
  id: string; title: string; controller: string; page: number; pages: number;
  canNavigate: boolean; canReclaim: boolean; busy: boolean; locale: 'ru' | 'en' | 'zh-CN';
  toolbar?: { canDelegate: boolean; canStop: boolean; sharing: boolean; controllerIdentity: string | null; participants: { identity: string; name: string }[] };
};
export type SlideControlsAction = { id: string; action: 'previous' | 'next' | 'reclaim' | 'stop' } | { id: string; action: 'delegate'; controllerIdentity: string };
export type SlidesBridge = {
  version?: number;
  stopSettled?(value: { id: string; failed: boolean }): Promise<unknown>;
  update(state: SlideControlsState): Promise<{ visible: boolean }>;
  show(state: SlideControlsState): Promise<{ visible: boolean }>;
  hide(id: string): Promise<unknown>;
  onAction(listener: (action: SlideControlsAction) => void): () => void;
};
const labels = {
  ru: { previous: 'Назад', next: 'Вперёд', reclaim: 'Забрать управление', page: 'Слайд', pending: 'Ожидаем отображения…', local: 'Вы управляете', hide: 'Скрыть' },
  en: { previous: 'Previous', next: 'Next', reclaim: 'Reclaim controls', page: 'Slide', pending: 'Waiting for render…', local: 'You control', hide: 'Hide' },
  'zh-CN': { previous: '上一页', next: '下一页', reclaim: '收回控制权', page: '幻灯片', pending: '等待渲染…', local: '由您控制', hide: '隐藏' },
};
export function slidesBridge(host: unknown): SlidesBridge | undefined {
  try {
    const desktop = (host as { castlinkDesktop?: { version?: number; slides?: SlidesBridge } })?.castlinkDesktop;
    const bridge = desktop?.slides;
    if (desktop?.version === 1 && bridge && ['update', 'show', 'hide', 'onAction'].every(key => typeof bridge[key as keyof SlidesBridge] === 'function')) return bridge;
  } catch { /* Browser fallback. */ }
}
export function slideControlsId(session: Pick<CoPresentation, 'id' | 'generation' | 'controlRevision'>) {
  return `${session.id}:${session.generation}:${session.controlRevision}`;
}
export function slideControlsText(value: string, fallback: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) || fallback.slice(0, 120);
}
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length >= 1 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const keys = (value: object, allowed: string[]) => Object.keys(value).length === allowed.length && allowed.every(key => Object.hasOwn(value, key));
export function validSlideControlsState(state: SlideControlsState) {
  if (!state || typeof state !== 'object' || !keys(state, ['id','title','controller','page','pages','canNavigate','canReclaim','busy','locale', ...(Object.hasOwn(state, 'toolbar') ? ['toolbar'] : [])]) || typeof state.id !== 'string' || !/^[a-zA-Z0-9:._-]{1,160}$/.test(state.id) || !validText(state.title,120) || !validText(state.controller,120) || !Number.isSafeInteger(state.pages) || state.pages < 1 || state.pages > 10000 || !Number.isSafeInteger(state.page) || state.page < 1 || state.page > state.pages || typeof state.canNavigate !== 'boolean' || typeof state.canReclaim !== 'boolean' || typeof state.busy !== 'boolean' || !Object.hasOwn(labels,state.locale)) return false;
  if (!Object.hasOwn(state,'toolbar')) return true;
  const toolbar = state.toolbar;
  return !!toolbar && typeof toolbar === 'object' && keys(toolbar,['canDelegate','canStop','sharing','controllerIdentity','participants']) && typeof toolbar.canDelegate === 'boolean' && typeof toolbar.canStop === 'boolean' && typeof toolbar.sharing === 'boolean' && (!toolbar.canStop || toolbar.sharing) && (toolbar.controllerIdentity === null || validText(toolbar.controllerIdentity,256)) && Array.isArray(toolbar.participants) && toolbar.participants.length <= 100 && toolbar.participants.every(person => person && typeof person === 'object' && keys(person,['identity','name']) && validText(person.identity,256) && validText(person.name,120)) && new Set(toolbar.participants.map(person => person.identity)).size === toolbar.participants.length;
}
export function validSlideControlsAction(event: unknown): event is SlideControlsAction {
  if (!event || typeof event !== 'object') return false;
  const action = event as SlideControlsAction;
  return typeof action.id === 'string' && /^[a-zA-Z0-9:._-]{1,160}$/.test(action.id) && (action.action === 'delegate' ? keys(action,['id','action','controllerIdentity']) && validText(action.controllerIdentity,256) : ['previous','next','reclaim','stop'].includes(action.action) && keys(action,['id','action']));
}
/** One controls window. Closing it hides controls without touching presentation or media. */
export function createCoPresentationControls(options: {
  host: Window; bridge?: SlidesBridge; action: (action: SlideControlsAction) => void | Promise<unknown>;
  visibility?: (visible: boolean) => void;
  nativeOpened?: (id: string) => void;
  browserOpened?: (id: string) => void;
}) {
  const bridge = options.bridge || slidesBridge(options.host);
  const api = !bridge ? documentPictureInPictureApi(options.host) : undefined;
  let state: SlideControlsState | undefined, child: Window | null = null;
  let showAttempt = 0;
  let disposed = false, epoch = 0, inFlight = false, stopFlight = false, stopFailed = false, visible = false;
  let view: { id: string; epoch: number; value: ReturnType<typeof createSlideToolbar> } | undefined;
  let themeObserver: MutationObserver | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const autoAttempted = new Set<string>();
  const visibility = (next: boolean) => { visible = next; if (!disposed) options.visibility?.(next); };
  const enqueue = (run: () => Promise<unknown>) => { queue = queue.then(run, run).catch(() => { visibility(false); }); return queue; };
  const hidden = () => { themeObserver?.disconnect(); themeObserver = undefined; view?.value.dispose(); view = undefined; child = null; visibility(false); };
  const slot = api ? createDocumentPictureInPictureSlot(api, 'slides', hidden) : undefined;
  const browserClose = () => { slot?.close(); hidden(); };
  const copyTheme = () => {
    const content = slot?.current(); if (!content) return;
    const light = options.host.document?.documentElement?.getAttribute('data-theme') === 'light';
    content.root.setAttribute('data-theme',light ? 'light' : 'dark');
    content.window.document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    content.window.document.body.style.background = light ? '#f0f2f4' : '#161a1d';
  };
  const nativeState = (current: SlideControlsState) => { if (bridge?.version === 2) return current; const { toolbar: _, ...legacy } = current; return legacy; };
  const allowed = (current: SlideControlsState, event: SlideControlsAction) => {
    if (event.action === 'stop') return !!current.toolbar?.canStop && current.toolbar.sharing && !stopFlight;
    if (inFlight || current.busy) return false;
    if (event.action === 'delegate') return !!current.toolbar?.canDelegate && current.toolbar.participants.some(person => person.identity === event.controllerIdentity);
    if (event.action === 'reclaim') return current.canReclaim;
    return current.canNavigate && (event.action === 'previous' ? current.page > 1 : current.page < current.pages);
  };
  const perform = (event: SlideControlsAction, expectedEpoch = epoch) => {
    const current = state;
    if (!validSlideControlsAction(event) || disposed || !current || expectedEpoch !== epoch || event.id !== current.id || !allowed(current,event)) return;
    const stop = event.action === 'stop';
    if (stop) { stopFlight = true; stopFailed = false; } else inFlight = true;
    render();
    let failed = false;
    void Promise.resolve().then(() => {
      if (!disposed && epoch === expectedEpoch && state?.id === event.id) return options.action(event);
    }).catch(() => { failed = true; }).finally(async () => {
      if (disposed || epoch !== expectedEpoch || state?.id !== event.id) return;
      if (stop) {
        if (bridge?.version === 2 && bridge.stopSettled) { try { await bridge.stopSettled({ id: event.id, failed }); } catch { /* Media result is independent of a closed native window. */ } }
        if (disposed || epoch !== expectedEpoch || state?.id !== event.id) return;
        stopFlight = false; stopFailed = failed;
      } else inFlight = false;
      render();
    });
  };
  const removeAction = bridge?.onAction(event => perform(event));
  function render() {
    if (!child || child.closed || !state) return;
    if (!view || view.id !== state.id || view.epoch !== epoch) {
      view?.value.dispose(); const capturedEpoch = epoch;
      view = { id: state.id, epoch, value: createSlideToolbar(child, event => perform(event,capturedEpoch),browserClose,slot?.current()?.root) };
    }
    view.value.update(state,inFlight,stopFlight,stopFailed);
  }
  const clear = () => {
    const old = state; state = undefined; epoch++; showAttempt++; inFlight = false; stopFlight = false; stopFailed = false; browserClose();
    if (bridge && old) void enqueue(() => bridge.hide(old.id));
  };
  return {
    native: !!bridge,
    browserFloating: !!api,
    update(next?: SlideControlsState, autoOpen = false) {
      if (disposed) return Promise.resolve();
      if (!next) { clear(); return Promise.resolve(); }
      if (!validSlideControlsState(next)) throw new Error('Invalid slide controls state');
      const old = state;
      if (old?.id !== next.id) { epoch++; inFlight = false; stopFlight = false; stopFailed = false; }
      state = { ...next, ...(next.toolbar ? { toolbar: { ...next.toolbar, participants: next.toolbar.participants.map(person => ({ ...person })) } } : {}) }; const version = epoch;
      if (!bridge) { render(); return Promise.resolve(); }
      return enqueue(async () => {
        if (old && old.id !== next.id) await bridge.hide(old.id);
        if (disposed || version !== epoch || state?.id !== next.id) return;
        const result = await bridge.update(nativeState(state!));
        if (disposed || version !== epoch || state?.id !== next.id) return;
        visibility(!!result.visible);
        // Native windows need no popup activation. Open once per exact grant;
        // polling must not undo a user's local hide. Browsers remain opt-in.
        if (autoOpen && !autoAttempted.has(next.id)) {
          autoAttempted.add(next.id);
          if (autoAttempted.size > 512) autoAttempted.delete(autoAttempted.values().next().value!);
          const opened = await bridge.show(nativeState(state));
          if (disposed || version !== epoch || state?.id !== next.id) return;
          visibility(!!opened.visible);
          if (opened.visible) {
            options.nativeOpened?.(next.id);
          }
        }
      }).then(() => undefined);
    },
    async show() {
      const current = state, version = epoch, attempt = ++showAttempt;
      if (disposed || !current) return false;
      if (bridge) {
        await enqueue(async () => {
          if (disposed || version !== epoch || state?.id !== current.id) return;
          const result = await bridge.show(nativeState(state));
          if (!disposed && version === epoch && state?.id === current.id) { visibility(!!result.visible); if (result.visible) options.nativeOpened?.(current.id); }
        });
        return !disposed && version === epoch && visible;
      }
      if (!slot) return false;
      // slot.open invokes requestWindow before this first await. No popup fallback
      // may consume an expired activation after a denied browser request.
      const content = await slot.open({ width: 420, height: 250 });
      if (!content) return false;
      if (disposed || version !== epoch || state?.id !== current.id) {
        // A later explicit show may own this same shared slot.
        if (attempt === showAttempt) slot.close();
        return false;
      }
      child = content.window;
      try {
        try { options.host.document?.fonts?.forEach(font => child!.document.fonts?.add(font)); } catch { /* Keep the bundled font fallback. */ }
        copyTheme();
        if (!themeObserver && typeof MutationObserver !== 'undefined' && options.host.document?.documentElement) {
          themeObserver = new MutationObserver(copyTheme); themeObserver.observe(options.host.document.documentElement,{ attributes: true, attributeFilter: ['data-theme'] });
        }
        render(); child.focus(); visibility(true); options.browserOpened?.(current.id); return true;
      } catch { browserClose(); return false; }
    },
    clear,
    dispose() { if (disposed) return; clear(); disposed = true; removeAction?.(); },
  };
}
