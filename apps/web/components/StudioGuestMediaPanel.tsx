"use client";
import { useEffect, useState } from "react";
import { StudioGuestMediaControls, type GuestControlActivity } from "./StudioGuestMediaControls";

type Guest = { identity: string; name: string };
export function StudioGuestMediaPanel({ studioId, roomName, guests }: { studioId: string; roomName: string; guests: Guest[] }) {
  const [retained, setRetained] = useState<Record<string, Guest & GuestControlActivity>>({});
  useEffect(() => { setRetained({}); }, [studioId, roomName]);
  const visible = new Map(guests.map(guest => [guest.identity, guest]));
  for (const guest of Object.values(retained)) if (guest.pending || guest.error) visible.set(guest.identity, guest);
  if (!visible.size) return null;
  return <section className="panel studio-guest-media-panel"><h2>Звук и подключение гостей</h2>
    {Array.from(visible.values()).map(guest => <div className="studio-guest-media-row" key={guest.identity}><strong>{guest.name}</strong>
      <StudioGuestMediaControls studioId={studioId} roomName={roomName} identity={guest.identity} name={guest.name} connected={guests.some(current => current.identity === guest.identity)} onActivity={activity => setRetained(current => {
        const previous = current[guest.identity];
        if (!activity.pending && !activity.error) { if (!previous) return current; const next = { ...current }; delete next[guest.identity]; return next; }
        if (previous?.pending === activity.pending && previous?.error === activity.error) return current;
        const next = { ...current, [guest.identity]: { ...guest, ...activity } };
        const completed = Object.keys(next).filter(identity => !next[identity].pending);
        for (const identity of completed.slice(0, Math.max(0, completed.length - 10))) delete next[identity];
        return next;
      })} />
      {!guests.some(current => current.identity === guest.identity) && !retained[guest.identity]?.pending && <button type="button" className="button-secondary" onClick={() => setRetained(current => { const next = { ...current }; delete next[guest.identity]; return next; })}>Закрыть сообщение</button>}
    </div>)}
  </section>;
}
