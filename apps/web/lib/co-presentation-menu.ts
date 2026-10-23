import type { Room } from 'livekit-client';

const openMenuEvent = 'castlink:open-co-presentation-menu';

/** A local UI request only; the exact mounted Room still owns all authority. */
type MenuRequest = { room: Room; initiator?: HTMLButtonElement | null };

export function requestCoPresentationMenu(room: Room, host: EventTarget = window, initiator?: HTMLButtonElement | null) {
  return !host.dispatchEvent(new CustomEvent<MenuRequest>(openMenuEvent, { detail: { room, initiator }, cancelable: true }));
}

export function listenForCoPresentationMenu(room: Room, open: (initiator?: HTMLButtonElement | null) => boolean, host: EventTarget = window) {
  const receive = (event: Event) => {
    const detail = (event as CustomEvent<MenuRequest>).detail;
    if (detail?.room === room && open(detail.initiator)) event.preventDefault();
  };
  host.addEventListener(openMenuEvent, receive);
  return () => host.removeEventListener(openMenuEvent, receive);
}
