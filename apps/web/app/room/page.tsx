"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GuestAccessGate } from "@/components/GuestAccessGate";
import { GuestWorkspace } from "@/components/GuestWorkspace";

function ProtectedRoom() {
  const params = useSearchParams();
  const studioId = params.get("studioId") || "studio-default";
  const initialRoom = params.get("name") || "";
  const [inviteState, setInviteState] = useState({ ready: false, invite: "", studioId: "", room: "" });
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragmentInvite = new URLSearchParams(url.hash.slice(1)).get("invite") || "";
    const legacyInvite = params.get("invite") || "";
    // Next refreshes search params after replaceState; keep the captured secret for this entry only.
    setInviteState(current => ({ ready: true, studioId, room: initialRoom,
      invite: fragmentInvite || legacyInvite || (current.studioId === studioId && current.room === initialRoom ? current.invite : "") }));
    if (fragmentInvite || legacyInvite) {
      url.hash = "";
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [params, studioId, initialRoom]);
  if (!inviteState.ready || inviteState.studioId !== studioId) return <main className="graphite-entry status-page"><div className="panel status-card" role="status">Проверка приглашения…</div></main>;
  return <GuestAccessGate initialRoom={initialRoom} studioId={studioId} invite={inviteState.room === initialRoom ? inviteState.invite : ""} resume={params.get("moved") === "1"}>
    {name => <GuestWorkspace initialRoomName={name} initialStudioId={studioId} key={`${studioId}:${name}`} />}
  </GuestAccessGate>;
}
export default function RoomPage() { return <Suspense fallback={<main className="graphite-entry status-page"><div className="panel status-card" role="status">Загрузка комнаты…</div></main>}><ProtectedRoom /></Suspense>; }
