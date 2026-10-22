import type { CoPresentation } from './co-presentation-state';

export function presentationStepMode(session: { navigationMode?: string }) {
  return session.navigationMode === 'powerpoint-steps-v1' || session.navigationMode === 'window-steps-v1';
}
export function presentationNavigationPending(session: CoPresentation) {
  return presentationStepMode(session) ? !!session.command : session.revision !== session.renderedRevision;
}
export function presentationPageLabel(session: { page?: number; renderedPage?: number; pages?: number; navigationMode?: string }) {
  return session.navigationMode === 'window-steps-v1' ? '' : `${session.renderedPage && session.renderedPage > 0 ? session.renderedPage : session.page} / ${session.pages}`;
}
export function presentationDirectionAllowed(session: { navigationMode?: string; page?: number; pages?: number }, direction: 'next' | 'previous') {
  return presentationStepMode(session) || (typeof session.page === 'number' && typeof session.pages === 'number' && (direction === 'previous' ? session.page > 1 : session.page < session.pages));
}
export function presentationScreenGrant(session: CoPresentation, identity: string, sid: string, ownerIdentity: string, ownerSid: string) {
  return session.controller?.identity === identity && session.controller.sid === sid && session.owner.identity === ownerIdentity && session.owner.sid === ownerSid && !(session.owner.identity === identity && session.owner.sid === sid);
}
/** Reject padding around the actual decoded image; no coordinates leave this browser. */
export function presentationImageContains(rect: {left: number; top: number; width: number; height: number}, width: number, height: number, x: number, y: number, fit = 'contain') {
  if (![rect.left,rect.top,rect.width,rect.height,width,height,x,y].every(Number.isFinite) || width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0) return false;
  let w = rect.width, h = rect.height;
  if (fit === 'contain' || fit === 'scale-down') {
    const scale = Math.min(rect.width / width, rect.height / height, fit === 'scale-down' ? 1 : Infinity);
    w = width * scale; h = height * scale;
  }
  const left = rect.left + (rect.width - w) / 2, top = rect.top + (rect.height - h) / 2;
  return x >= left && x <= left + w && y >= top && y <= top + h;
}
export function presentationInputDirection(input: {type: 'click' | 'keydown'; focused: boolean; visible: boolean; interactive: boolean; key?: string; repeat?: boolean; button?: number; detail?: number; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean}): 'previous' | 'next' | undefined {
  if (!input.focused || !input.visible || input.interactive || input.altKey || input.ctrlKey || input.metaKey || input.shiftKey) return;
  if (input.type === 'click') return input.button === 0 && input.detail === 1 ? 'next' : undefined;
  if (input.repeat) return;
  return ['ArrowRight','ArrowDown','PageDown'].includes(input.key || '') ? 'next' : ['ArrowLeft','ArrowUp','PageUp'].includes(input.key || '') ? 'previous' : undefined;
}
export const presentationInteractiveSelector = 'button,a,input,textarea,select,option,label,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="slider"],[role="textbox"],[role="menu"],[role="dialog"],[data-presentation-interactive]';

/** Restore only the last exact navigation button after an async disabled state. */
export function createPresentationNavigationFocus(doc: Document) {
  let grant = '', button: HTMLButtonElement | undefined, disabled = false, restore = false;
  const clear = () => { button = undefined; restore = false; };
  const outsideFocus = (event: Event) => { if (event.target !== button && event.target !== doc.body) clear(); };
  const outsidePointer = (event: Event) => { if (event.target !== button && !button?.contains?.(event.target as Node)) clear(); };
  doc.addEventListener('focusin',outsideFocus); doc.addEventListener('pointerdown',outsidePointer);
  return {
    remember(value: HTMLButtonElement) { button = value; restore = false; },
    update(id: string, nextDisabled: boolean) {
      if (grant !== id) { grant = id; clear(); disabled = nextDisabled; return; }
      if (!disabled && nextDisabled && button) restore = true;
      const eligible = disabled && !nextDisabled && restore;
      disabled = nextDisabled;
      if (eligible) {
        restore = false;
        if (button?.isConnected && doc.activeElement === doc.body && (!doc.hasFocus || doc.hasFocus())) button.focus({preventScroll:true});
      }
    },
    dispose() { clear(); doc.removeEventListener('focusin',outsideFocus); doc.removeEventListener('pointerdown',outsidePointer); },
  };
}
