import type { Room } from 'livekit-client';

const openMenuEvent = 'castlink:open-co-presentation-menu';

/** A local UI request only; the exact mounted Room still owns all authority. */
export function requestCoPresentationMenu(room: Room, host: EventTarget = window) {
  return !host.dispatchEvent(new CustomEvent(openMenuEvent, { detail: room, cancelable: true }));
}

export function listenForCoPresentationMenu(room: Room, open: () => boolean, host: EventTarget = window) {
  const receive = (event: Event) => {
    if ((event as CustomEvent<Room>).detail === room && open()) event.preventDefault();
  };
  host.addEventListener(openMenuEvent, receive);
  return () => host.removeEventListener(openMenuEvent, receive);
}
