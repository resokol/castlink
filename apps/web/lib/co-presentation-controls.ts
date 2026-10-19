import type { CoPresentation } from './co-presentation-state';
export type SlideControlsState = {
  id: string; title: string; controller: string; page: number; pages: number;
  canNavigate: boolean; canReclaim: boolean; busy: boolean; locale: 'ru' | 'en' | 'zh-CN';
};
export type SlideControlsAction = { id: string; action: 'previous' | 'next' | 'reclaim' };
export type SlidesBridge = {
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
export function validSlideControlsState(state: SlideControlsState) {
  return !!state && typeof state.id === 'string' && /^[a-zA-Z0-9:._-]{1,160}$/.test(state.id) && typeof state.title === 'string' && state.title.length >= 1 && state.title.length <= 120 && !/[\u0000-\u001f\u007f]/.test(state.title) && typeof state.controller === 'string' && state.controller.length >= 1 && state.controller.length <= 120 && !/[\u0000-\u001f\u007f]/.test(state.controller) && Number.isSafeInteger(state.pages) && state.pages >= 1 && state.pages <= 10000 && Number.isSafeInteger(state.page) && state.page >= 1 && state.page <= state.pages && typeof state.canNavigate === 'boolean' && typeof state.canReclaim === 'boolean' && typeof state.busy === 'boolean' && Object.hasOwn(labels, state.locale) && Object.keys(state).length === 9;
}
/** One controls window. Closing it hides controls without touching presentation or media. */
export function createCoPresentationControls(options: {
  host: Window; bridge?: SlidesBridge; action: (action: SlideControlsAction) => void | Promise<unknown>;
  visibility?: (visible: boolean) => void;
}) {
  const bridge = options.bridge || slidesBridge(options.host);
  let state: SlideControlsState | undefined, child: Window | null = null;
  let disposed = false, epoch = 0, inFlight = false, visible = false;
  let queue: Promise<unknown> = Promise.resolve();
  const visibility = (next: boolean) => { visible = next; if (!disposed) options.visibility?.(next); };
  const enqueue = (run: () => Promise<unknown>) => { queue = queue.then(run, run).catch(() => { visibility(false); }); return queue; };
  const browserClose = () => { const previous = child; child = null; if (previous && !previous.closed) previous.close(); visibility(false); };
  const perform = (event: SlideControlsAction, expectedEpoch = epoch) => {
    const current = state;
    if (!event || typeof event.id !== 'string' || !['previous', 'next', 'reclaim'].includes(event.action)) return;
    if (disposed || !current || expectedEpoch !== epoch || event.id !== current.id || inFlight || current.busy) return;
    if (event.action === 'reclaim' ? !current.canReclaim : !['previous', 'next'].includes(event.action) || !current.canNavigate || event.action === 'previous' && current.page <= 1 || event.action === 'next' && current.page >= current.pages) return;
    inFlight = true; render();
    void Promise.resolve().then(() => { if (!disposed && epoch === expectedEpoch && state?.id === event.id) return options.action(event); }).catch(() => undefined).finally(() => { if (epoch === expectedEpoch) { inFlight = false; render(); } });
  };
  const removeAction = bridge?.onAction(event => perform(event));
  function render() {
    if (!child || child.closed || !state) return;
    const current = state, text = labels[current.locale], doc = child.document, capturedEpoch = epoch;
    doc.title = current.title; doc.documentElement.lang = current.locale;
    const body = doc.body; body.replaceChildren();
    Object.assign(body.style, { margin: '0', padding: '14px', fontFamily: 'Arial, sans-serif', color: '#f5f5f5', background: '#202225', display: 'grid', gap: '10px', boxSizing: 'border-box' });
    const title = doc.createElement('strong'); title.textContent = current.title; title.style.overflowWrap = 'anywhere';
    const controller = doc.createElement('div'); controller.textContent = current.controller || text.local;
    const status = doc.createElement('div'); status.setAttribute('aria-live', 'polite'); status.textContent = `${text.page} ${current.page} / ${current.pages}${current.busy ? ` · ${text.pending}` : ''}`;
    const buttons = doc.createElement('div'); Object.assign(buttons.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });
    const button = (label: string, disabled: boolean, click: () => void) => { const element = doc.createElement('button'); element.type = 'button'; element.textContent = label; element.disabled = disabled; Object.assign(element.style, { minHeight: '40px', padding: '8px 14px', border: '1px solid #70747a', borderRadius: '6px', fontSize: '15px', color: '#f5f5f5', background: '#363a40', cursor: disabled ? 'default' : 'pointer' }); element.addEventListener('click', click); buttons.append(element); };
    button(text.previous, current.busy || inFlight || !current.canNavigate || current.page <= 1, () => perform({ id: current.id, action: 'previous' }, capturedEpoch));
    button(text.next, current.busy || inFlight || !current.canNavigate || current.page >= current.pages, () => perform({ id: current.id, action: 'next' }, capturedEpoch));
    if (current.canReclaim) button(text.reclaim, current.busy || inFlight, () => perform({ id: current.id, action: 'reclaim' }, capturedEpoch));
    button(text.hide, false, browserClose);
    body.append(title, controller, status, buttons);
  }
  const clear = () => {
    const old = state; state = undefined; epoch++; inFlight = false; browserClose();
    if (bridge && old) void enqueue(() => bridge.hide(old.id));
  };
  return {
    update(next?: SlideControlsState) {
      if (disposed) return Promise.resolve();
      if (!next) { clear(); return Promise.resolve(); }
      if (!validSlideControlsState(next)) throw new Error('Invalid slide controls state');
      const old = state;
      if (old?.id !== next.id) { epoch++; inFlight = false; }
      state = { ...next }; const version = epoch;
      if (!bridge) { render(); return Promise.resolve(); }
      return enqueue(async () => {
        if (old && old.id !== next.id) await bridge.hide(old.id);
        if (disposed || version !== epoch || state?.id !== next.id) return;
        const result = await bridge.update(next);
        if (!disposed && version === epoch && state?.id === next.id) visibility(!!result.visible);
      }).then(() => undefined);
    },
    async show() {
      const current = state, version = epoch;
      if (disposed || !current) return false;
      if (bridge) {
        await enqueue(async () => {
          if (disposed || version !== epoch || state?.id !== current.id) return;
          const result = await bridge.show(state);
          if (!disposed && version === epoch && state?.id === current.id) visibility(!!result.visible);
        });
        return !disposed && version === epoch && visible;
      }
      try {
        if (!child || child.closed) {
          const width = Math.max(240, Math.min(560, options.host.screen.availWidth || 560));
          const height = Math.max(160, Math.min(260, options.host.screen.availHeight || 260));
          child = options.host.open('', '_blank', `popup=yes,width=${width},height=${height},resizable=yes`);
          if (!child) { visibility(false); return false; }
          child.opener = null;
          const opened = child;
          opened.addEventListener('pagehide', () => { if (child === opened) { child = null; visibility(false); } }, { once: true });
        }
        render(); child.focus(); visibility(true); return true;
      } catch { browserClose(); return false; }
    },
    clear,
    dispose() { if (disposed) return; clear(); disposed = true; removeAction?.(); },
  };
}
