"use client";
import { useI18n } from "@/components/I18nProvider";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GuestAccessGate } from "@/components/GuestAccessGate";
import { GuestInviteLanding } from "@/components/GuestInviteLanding";
import { parseGuestInviteUrl } from "@/lib/entry-links";
import { GuestWorkspace } from "@/components/GuestWorkspace";

function ProtectedRoom() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const studioId = params.get("studioId") || "studio-default";
  const initialRoom = params.get("name") || "";
  const [continued,setContinued]=useState(false);
  const [inviteState, setInviteState] = useState({ ready: false, invite: "", studioId: "", room: "", href: "" });
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragmentInvite = new URLSearchParams(url.hash.slice(1)).get("invite") || "";
    const legacyInvite = params.get("invite") || "";
    // Next refreshes search params after replaceState; keep the captured secret for this entry only.
    setInviteState(current => ({ ready: true, studioId, room: initialRoom,
      invite: fragmentInvite || legacyInvite || (current.studioId === studioId && current.room === initialRoom ? current.invite : ""),
      href: fragmentInvite || legacyInvite ? parseGuestInviteUrl(url.href)?.href || "" : current.studioId === studioId && current.room === initialRoom ? current.href : "" }));
    if (fragmentInvite || legacyInvite) {
      setContinued(false);
      url.hash = "";
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [params, studioId, initialRoom]);
  if (!inviteState.ready || inviteState.studioId !== studioId) return <main className="graphite-entry status-page"><div className="panel status-card" role="status">{t("Проверка приглашения…")}</div></main>;
  if(inviteState.href&&inviteState.room===initialRoom&&!continued)return <GuestInviteLanding href={inviteState.href} onBack={()=>window.location.assign("/?mode=guest")} onContinue={()=>setContinued(true)}/>;
  return <GuestAccessGate initialRoom={initialRoom} studioId={studioId} invite={inviteState.room === initialRoom ? inviteState.invite : ""} resume={params.get("moved") === "1"}>
    {name => <GuestWorkspace initialRoomName={name} initialStudioId={studioId} key={`${studioId}:${name}`} />}
  </GuestAccessGate>;
}
export default function RoomPage() {
  const { t, locale } = useI18n(); return <Suspense fallback={<main className="graphite-entry status-page"><div className="panel status-card" role="status">{t("Загрузка комнаты…")}</div></main>}><ProtectedRoom /></Suspense>; }
