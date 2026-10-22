import type { SlideControlsAction, SlideControlsState } from './co-presentation-controls';

const copy = {
  ru: { previous: 'Предыдущий слайд', next: 'Следующий слайд', menu: 'Совместная презентация', compact: 'Управление', delegate: 'Передать управление', scope: 'Только переключение слайдов. Мышь и клавиатура не передаются.', reclaim: 'Забрать управление', size: 'Компактный размер', sizeHint: 'Восстановить компактный размер плавающей панели', hide: 'Скрыть панель', drag: 'Переместить панель', pending: 'Ожидаем отображения…', stop: 'Остановить показ', stopping: 'Останавливаем…', sharing: 'Демонстрация включена', viewing: 'Просмотр демонстрации', inactive: 'Показ не запущен', neutral: 'Управление слайдами', failed: 'Не удалось остановить показ. Повторите попытку.' },
  en: { previous: 'Previous slide', next: 'Next slide', menu: 'Co-presentation', compact: 'Controls', delegate: 'Give slide controls', scope: 'Slide changes only. Mouse and keyboard access is not shared.', reclaim: 'Reclaim controls', size: 'Compact size', sizeHint: 'Restore the floating panel to its compact size', hide: 'Hide controls', drag: 'Move controls', pending: 'Waiting for render…', stop: 'Stop sharing', stopping: 'Stopping…', sharing: 'Sharing is on', viewing: 'Viewing a shared presentation', inactive: 'Sharing has not started', neutral: 'Slide controls', failed: 'Could not stop sharing. Please retry.' },
  'zh-CN': { previous: '上一张幻灯片', next: '下一张幻灯片', menu: '协同演示', compact: '控制', delegate: '授予幻灯片控制权', scope: '仅切换幻灯片，不共享鼠标或键盘访问权限。', reclaim: '收回控制权', size: '紧凑尺寸', sizeHint: '将浮动面板恢复为紧凑尺寸', hide: '隐藏控制面板', drag: '移动控制面板', pending: '等待渲染…', stop: '停止共享', stopping: '正在停止…', sharing: '正在共享', viewing: '正在观看共享演示', inactive: '尚未开始共享', neutral: '幻灯片控制', failed: '无法停止共享，请重试。' },
};
const css = `
*{box-sizing:border-box}body{margin:0;padding:8px;font:13px/1.45 Manrope,Arial,sans-serif;background:#161a1d;color:#eef0f2;color-scheme:dark}button{font:inherit;cursor:pointer}button:disabled{cursor:default;color:#89949d}button:focus-visible{outline:2px solid #acd9bb;outline-offset:2px}svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}[hidden]{display:none!important}::selection{background:#acd9bb;color:#17251c}
.cl-toolbar{display:flex;align-items:center;gap:10px;padding:12px;background:#1c2024;border-radius:10px;min-width:0}.cl-icon{display:grid;place-items:center;min-width:40px;height:40px;padding:8px;border:0;border-radius:6px;background:transparent;color:#eef0f2}.cl-icon:hover:not(:disabled){background:#343d44}.cl-drag{min-width:36px;width:36px;color:#b0b8bf;touch-action:none;cursor:grab}.cl-title{flex:1 1 180px;min-width:0}.cl-title strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-description{display:block;color:#b0b8bf;font-size:10px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-main{display:contents}.cl-navigation{display:flex;align-items:center;gap:2px;flex:none;border-left:1px solid #3c444c;padding-left:10px}.cl-navigation button{background:#293037}.cl-page{min-width:62px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums}.cl-control{position:relative;flex:0 1 236px;min-width:0}.cl-trigger,.cl-reclaim{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:7px 12px;width:100%;border:1px solid #647e6d;border-radius:6px;background:#2a3930;color:#d5eadc;font-size:12px}.cl-trigger:hover:not(:disabled),.cl-trigger[aria-expanded=true]{background:#344b3d}.cl-trigger:disabled{background:#293037;border-color:#434c53}.cl-chevron{width:14px;height:14px;margin-left:auto}.cl-compact{display:none}.cl-menu{display:flex;flex-direction:column;position:absolute;right:0;top:100px;width:304px;max-width:calc(100vw - 32px);padding:8px;border:1px solid #4d575f;border-radius:10px;background:#252b30;z-index:2}.cl-candidates{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.cl-menu-heading{flex:none;margin:4px 10px 10px;font-size:12px}.cl-candidate{display:flex;align-items:center;gap:10px;min-height:44px;width:100%;padding:8px 10px;border:0;border-radius:6px;color:#eef0f2;background:transparent;text-align:left;font-size:12px;overflow-wrap:anywhere}.cl-candidate:hover:not(:disabled){background:#343d44}.cl-candidate[aria-checked=true]{background:#354a3d}.cl-candidate span{flex:1;min-width:0}.cl-candidate svg{color:#acd9bb;width:17px;height:17px}.cl-candidate[aria-checked=false] svg{visibility:hidden}.cl-menu .cl-reclaim{flex:none;margin-top:6px;justify-content:flex-start;border:0;border-top:1px solid #47524b;border-radius:0;background:transparent}.cl-scope{flex:none;font-size:10px;color:#bdc5cb;margin:8px 10px 4px;padding-top:10px;border-top:1px solid #444e56}.cl-strip{display:flex;align-items:stretch;width:fit-content;max-width:100%;margin:auto;min-height:36px;border-radius:0 0 7px 7px;overflow:hidden;font-size:11px}.cl-status{display:flex;align-items:center;gap:8px;padding:8px 14px;color:#e2e8ed;background:#3a434a}.cl-status[data-sharing=true]{background:#245d43;color:#effff3}.cl-status svg{width:15px;height:15px}.cl-stop{display:flex;align-items:center;gap:7px;justify-content:center;min-height:36px;padding:8px 13px;border:0;background:#bd3443;color:white;font-size:11px;font-weight:600;white-space:nowrap}.cl-stop:hover:not(:disabled){background:#d53d4d}.cl-stop:disabled{color:#fff;background:#79404a}.cl-stop svg{width:13px;height:13px;fill:currentColor;stroke:none}.cl-error{margin:8px 2px 0;color:#f2a7b0;font-size:12px}
@media(max-width:640px){body{padding:6px}.cl-toolbar{display:grid;grid-template-columns:36px minmax(0,1fr) 40px 40px;padding:10px;gap:10px 8px}.cl-drag{grid-column:1;grid-row:1}.cl-title{grid-column:2;grid-row:1}.cl-title strong{font-size:11px}.cl-size{grid-column:3;grid-row:1}.cl-hide{grid-column:4;grid-row:1}.cl-main{display:flex;grid-column:1/-1;grid-row:2;gap:8px;min-width:0}.cl-navigation{border:0;padding:0;gap:0}.cl-navigation button{min-width:36px;width:36px}.cl-page{min-width:54px;font-size:11px}.cl-control{flex:1 1 0}.cl-trigger,.cl-reclaim{font-size:11px;padding:6px 8px}.cl-trigger>svg:first-child{display:none}.cl-full{display:none}.cl-compact{display:inline}.cl-menu{max-width:calc(100vw - 28px)}.cl-strip{width:calc(100% - 20px);font-size:10px}.cl-status{flex:1;justify-content:center;padding:8px;gap:6px}.cl-status svg{display:none}.cl-stop{min-height:40px;padding:8px 10px;font-size:10px}}
`;

/** Build once per grant. Updates patch nodes so polling keeps menu/focus intact. */
export function createSlideToolbar(win: Window, action: (event: SlideControlsAction) => void, hide: () => void, surface?: HTMLElement, compactSize?: () => void) {
  const doc = win.document;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '') => { const node = doc.createElement(tag); node.className = className; return node; };
  const text = (node: HTMLElement, value: string) => { if (node.textContent !== value) node.textContent = value; };
  const icon = (path: string) => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); shape.setAttribute('d', path); svg.append(shape); return svg;
  };
  const button = (className: string, name: string, path?: string) => { const node = create('button', className); node.type = 'button'; node.setAttribute('data-action', name); if (path) node.append(icon(path)); return node; };
  const style = create('style');
  // Generic selectors stay inside this renderer; the independent STOP slot shares its document.
  style.textContent = css.replace(/(^|(?<=[{}]))([^{}]+)\{/g, (rule, boundary: string, selectors: string) => {
    if (selectors.trim().startsWith('@')) return rule;
    return boundary + selectors.split(',').map((selector: string) => {
      const value = selector.trim();
      return value === 'body' ? '[data-slide-toolbar]' : '[data-slide-toolbar] ' + value;
    }).join(',') + '{';
  }) + (!surface ? 'body{margin:0}' : `
[data-pip-slot=slides][data-theme=light] [data-slide-toolbar]{background:#f0f2f4;color:#20252c;color-scheme:light}
[data-pip-slot=slides][data-theme=light] .cl-toolbar{background:#fafbfc}
[data-pip-slot=slides][data-theme=light] :is(.cl-icon,.cl-candidate){color:#20252c}
[data-pip-slot=slides][data-theme=light] :is(.cl-description,.cl-drag,.cl-scope){color:#606b78}
[data-pip-slot=slides][data-theme=light] :is(.cl-icon:hover:not(:disabled),.cl-candidate:hover:not(:disabled)){background:#d8dfe7}
[data-pip-slot=slides][data-theme=light] .cl-navigation button{background:#e5e9ee}
[data-pip-slot=slides][data-theme=light] :is(.cl-trigger,.cl-reclaim){background:#e3eee5;color:#244e32;border-color:#89a991}
[data-pip-slot=slides][data-theme=light] .cl-trigger:disabled{background:#e5e9ee;border-color:#bfc6cf}
[data-pip-slot=slides][data-theme=light] .cl-menu{background:#fafbfc;border-color:#bfc6cf}
[data-pip-slot=slides][data-theme=light] .cl-candidate[aria-checked=true]{background:#d8eadd}
[data-pip-slot=slides][data-theme=light] .cl-candidate svg{color:#306943}
[data-pip-slot=slides][data-theme=light] .cl-error{color:#923a43}
`);
  (surface || doc.head).append(style);
  const root = create('section'); root.setAttribute('data-slide-toolbar', '');
  const bar = create('div', 'cl-toolbar'), drag = button('cl-icon cl-drag', 'drag', 'M8 6h.1M16 6h.1M8 12h.1M16 12h.1M8 18h.1M16 18h.1');
  const title = create('div', 'cl-title'), name = create('strong'), description = create('span', 'cl-description'); title.append(name, description);
  const main = create('div', 'cl-main'), navigation = create('div', 'cl-navigation');
  const previous = button('cl-icon', 'previous', 'm14 6-6 6 6 6'), page = create('output', 'cl-page'), next = button('cl-icon', 'next', 'm10 6 6 6-6 6'); navigation.append(previous, page, next);
  const control = create('div', 'cl-control'), toggle = button('cl-trigger', 'menu', 'M3 4h18v13H3zM12 17v4m-4 0h8');
  const fullLabel = create('span', 'cl-full'), compactLabel = create('span', 'cl-compact'); toggle.append(fullLabel, compactLabel, icon('m6 9 6 6 6-6')); toggle.lastElementChild?.classList.add('cl-chevron');
  toggle.setAttribute('aria-haspopup', 'menu'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'slide-control-menu');
  const menu = create('div', 'cl-menu'); menu.id = 'slide-control-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  const heading = create('div', 'cl-menu-heading'), candidates = create('div', 'cl-candidates'), reclaim = button('cl-reclaim', 'reclaim', 'm8 5-5 5 5 5M3 10h10a6 6 0 0 1 0 12'), reclaimText = create('span'), scope = create('p', 'cl-scope'); reclaim.setAttribute('role', 'menuitem'); reclaim.append(reclaimText); menu.append(heading, candidates, reclaim, scope);
  const legacyReclaim = button('cl-reclaim', 'reclaim'); control.append(toggle, legacyReclaim, menu); main.append(navigation, control);
  const sizeButton = button('cl-icon cl-size', 'compact-size', 'M3 8h5V3m0 5L2 2m19 14h-5v5m0-5 6 6'); sizeButton.hidden = !compactSize; sizeButton.addEventListener('click', () => compactSize?.());
  const hideButton = button('cl-icon cl-hide', 'hide', 'M5 17h14M8 9l4-4 4 4m-4-4v9'); bar.append(drag, title, main, sizeButton, hideButton);
  const strip = create('div', 'cl-strip'), status = create('div', 'cl-status'), statusText = create('span'), stop = button('cl-stop', 'stop', 'M5 5h14v14H5z'), stopText = create('span'); status.setAttribute('role', 'status'); status.append(icon('M3 4h18v13H3zM12 17v4m-4 0h8'), statusText); stop.append(stopText); strip.append(status, stop);
  const error = create('p', 'cl-error'); error.setAttribute('role', 'alert'); error.hidden = true; root.append(bar, strip, error); (surface || doc.body).append(root);
  const items = new Map<string, { button: HTMLButtonElement; name: HTMLSpanElement }>();
  let state: SlideControlsState, busy = false, stopping = false, menuOpen = false;
  const send = (name: 'previous' | 'next' | 'reclaim' | 'stop') => { if (state) action({ id: state.id, action: name }); };
  previous.addEventListener('click', () => send('previous')); next.addEventListener('click', () => send('next')); reclaim.addEventListener('click', () => send('reclaim')); legacyReclaim.addEventListener('click', () => send('reclaim')); stop.addEventListener('click', () => send('stop')); hideButton.addEventListener('click', hide);
  const positionMenu = () => {
    if (!menuOpen) return;
    const top = Math.ceil(strip.getBoundingClientRect().bottom + 12);
    menu.style.top = `${top - control.getBoundingClientRect().top}px`;
    menu.style.maxHeight = `${Math.max(surface ? 60 : 100, Math.min(420, win.innerHeight - top - 12))}px`;
  };
  const fit = () => {
    if (menuOpen) { menu.style.maxHeight = '420px'; menu.style.top = `${Math.ceil(strip.getBoundingClientRect().bottom - control.getBoundingClientRect().top + 12)}px`; }
    try {
      if (!surface && typeof win.resizeTo === 'function') {
        const bottom = Math.max(root.getBoundingClientRect().bottom, menuOpen ? menu.getBoundingClientRect().bottom : 0);
        const wanted = Math.ceil(bottom + 8 + Math.max(0, win.outerHeight - win.innerHeight));
        win.resizeTo(win.outerWidth, Math.min(win.screen.availHeight || wanted, wanted));
      }
    } catch { /* Browser may retain its own window geometry; the body remains scrollable. */ }
    positionMenu();
    if (surface) menu.style.overflowY = 'auto';
  };
  const focusItem = (node?: HTMLButtonElement) => { node?.focus(); node?.scrollIntoView?.({ block: 'nearest' }); };
  const openMenu = (open: boolean) => { menuOpen = open && !!state?.toolbar?.canDelegate; menu.hidden = !menuOpen; toggle.setAttribute('aria-expanded', String(menuOpen)); fit(); };
  toggle.addEventListener('click', () => { openMenu(!menuOpen); if (menuOpen) focusItem(items.values().next().value?.button); });
  const outside = (event: Event) => { if (menuOpen && !control.contains(event.target as Node)) openMenu(false); };
  const keyboard = (event: KeyboardEvent) => {
    if (!menuOpen) return;
    if (event.key === 'Escape') { openMenu(false); toggle.focus(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !menu.contains(event.target as Node)) return;
    event.preventDefault(); const buttons = [...items.values()].map(item => item.button).filter(button => !button.disabled); if (!reclaim.hidden && !reclaim.disabled) buttons.push(reclaim);
    const index = buttons.indexOf(doc.activeElement as HTMLButtonElement), target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; focusItem(buttons[target]);
  };
  doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', keyboard); win.addEventListener('resize', positionMenu);
  let dragPoint: { x: number; y: number } | undefined;
  const move = (x: number, y: number) => { try { win.moveBy(x, y); } catch { /* The browser may require its native title bar. */ } };
  drag.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragPoint = { x: event.screenX, y: event.screenY }; drag.setPointerCapture?.(event.pointerId); event.preventDefault(); });
  drag.addEventListener('pointermove', event => { if (dragPoint) { move(event.screenX - dragPoint.x, event.screenY - dragPoint.y); dragPoint = { x: event.screenX, y: event.screenY }; } });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) drag.addEventListener(event, () => { dragPoint = undefined; });
  drag.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); move(event.key === 'ArrowRight' ? 8 : event.key === 'ArrowLeft' ? -8 : 0, event.key === 'ArrowDown' ? 8 : event.key === 'ArrowUp' ? -8 : 0); } });
  return {
    update(value: SlideControlsState, pending: boolean, stopPending: boolean, stopFailed: boolean) {
      state = value; busy = pending || state.busy; stopping = stopPending; drag.hidden = !!surface;
      const c = copy[state.locale], toolbar = state.toolbar;
      sizeButton.setAttribute('aria-label',c.size); sizeButton.title = c.sizeHint; doc.title = state.title; doc.documentElement.lang = state.locale;
      text(name, state.title); name.title = state.title; text(description, busy ? c.pending : state.controller); text(page, `${state.page} / ${state.pages}`);
      previous.disabled = busy || !state.canNavigate || state.navigationMode !== 'powerpoint-steps-v1' && state.page <= 1; next.disabled = busy || !state.canNavigate || state.navigationMode !== 'powerpoint-steps-v1' && state.page >= state.pages;
      for (const [node, label] of [[previous, c.previous], [next, c.next], [hideButton, c.hide], [drag, c.drag]] as const) { node.title = label; node.setAttribute('aria-label', label); }
      toggle.hidden = !toolbar?.canDelegate; toggle.disabled = busy || stopping; text(fullLabel, c.menu); text(compactLabel, c.compact); toggle.setAttribute('aria-label', c.menu); text(heading, c.delegate); text(scope, c.scope); menu.setAttribute('aria-label', c.menu);
      const people = toolbar?.participants || [];
      for (const [identity, item] of items) if (!people.some(person => person.identity === identity)) { item.button.remove(); items.delete(identity); }
      for (const person of people) {
        let item = items.get(person.identity);
        if (!item) { const node = button('cl-candidate', 'delegate'), label = create('span'); node.append(label, icon('m5 12 4 4L19 6')); node.setAttribute('role', 'menuitemradio'); node.setAttribute('data-identity', person.identity); node.addEventListener('click', () => { action({ id: state.id, action: 'delegate', controllerIdentity: person.identity }); openMenu(false); toggle.focus(); }); candidates.append(node); item = { button: node, name: label }; items.set(person.identity, item); }
        text(item.name, person.name); item.button.disabled = busy || stopping || !toolbar?.canDelegate; item.button.setAttribute('aria-checked', String(toolbar?.controllerIdentity === person.identity));
      }
      text(reclaimText, c.reclaim); reclaim.hidden = !state.canReclaim; reclaim.disabled = busy || stopping; legacyReclaim.hidden = !!toolbar?.canDelegate || !state.canReclaim; legacyReclaim.disabled = busy || stopping; text(legacyReclaim, c.reclaim);
      stop.hidden = !toolbar?.canStop; stop.disabled = stopping; text(stopText, stopping ? c.stopping : c.stop); stop.setAttribute('aria-label', c.stop);
      status.setAttribute('data-sharing', String(!!toolbar?.sharing)); text(statusText, !toolbar ? c.neutral : toolbar.sharing ? toolbar.canDelegate || toolbar.canStop ? c.sharing : c.viewing : c.inactive);
      error.hidden = !stopFailed; text(error, c.failed);
      if (!toolbar?.canDelegate) openMenu(false); else { menu.hidden = !menuOpen; fit(); }
    },
    dispose() { doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', keyboard); win.removeEventListener('resize', positionMenu); root.remove(); style.remove(); },
  };
}
