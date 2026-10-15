"use client";

import { useI18n } from "@/components/I18nProvider";
import { useEffect, useState, type ReactNode } from "react";
import { StudioGuestMediaControls, type GuestControlActivity } from "./StudioGuestMediaControls";

type Guest = { identity: string; name: string };
/** Keep command controllers mounted when a route change temporarily removes a guest. */
export function StudioGuestMediaPanel<T extends Guest>({ studioId, roomName, guests, allowDeviceControl = false, renderGuest }: { studioId: string; roomName: string; guests: T[]; allowDeviceControl?: boolean; renderGuest: (guest: T, controls: ReactNode) => ReactNode }) {
  const { t, locale } = useI18n();
  const [retained, setRetained] = useState<Record<string, T & GuestControlActivity>>({});
  useEffect(() => { setRetained({}); }, [studioId, roomName]);
  const visible = new Map(guests.map(guest => [guest.identity, guest]));
  for (const guest of Object.values(retained)) if ((guest.pending || guest.error) && !visible.has(guest.identity)) visible.set(guest.identity, guest);
  if (!visible.size) return null;
  return <>{Array.from(visible.values()).map(guest => {
    const connected = guests.some(current => current.identity === guest.identity);
    return <StudioGuestMediaControls key={guest.identity} studioId={studioId} roomName={roomName} identity={guest.identity} name={guest.name} connected={connected} allowDeviceControl={allowDeviceControl} onActivity={activity => setRetained(current => {
      const previous = current[guest.identity];
      if (!activity.pending && !activity.error) { if (!previous) return current; const next = { ...current }; delete next[guest.identity]; return next; }
      if (previous?.pending === activity.pending && previous?.error === activity.error) return current;
      const next = { ...current, [guest.identity]: { ...guest, ...activity } };
      const completed = Object.keys(next).filter(identity => !next[identity].pending);
      for (const identity of completed.slice(0, Math.max(0, completed.length - 10))) delete next[identity];
      return next;
    })} render={controls => connected ? renderGuest(guest, controls) : <section className="panel studio-guest-reconnect" aria-label={t("Подключение {name}", { name: guest.name })}>
      <h3>{guest.name}</h3>{controls}
      {!retained[guest.identity]?.pending && <button type="button" className="button-secondary" onClick={() => setRetained(current => { const next = { ...current }; delete next[guest.identity]; return next; })}>{t("Закрыть сообщение")}</button>}
    </section>} />;
  })}</>;
}
