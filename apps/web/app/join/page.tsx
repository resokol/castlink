"use client";
import { Suspense, useEffect, useState } from 'react';
import { GuestWorkspace } from '@/components/GuestWorkspace';
import { GuestInviteLanding } from '@/components/GuestInviteLanding';
import { EntryShell } from '@/components/EntryShell';
import { useI18n } from '@/components/I18nProvider';
import {parseGuestInviteUrl} from '@/lib/entry-links';
import type { GuestEntrySettings } from '@/lib/guest-entry-settings';
function Join(){
 const {t}=useI18n();
 const [href,setHref]=useState('');
 const [entry,setEntry]=useState<{room:string;studioId:string;invite:string;settings:GuestEntrySettings}>();
 useEffect(()=>{
   const captured=window.location.href;
   const link=parseGuestInviteUrl(captured);
   const clean=new URL(link?.href || captured);clean.searchParams.delete('invite');
   window.history.replaceState(window.history.state,'',clean.href);
   setHref(link?.href || captured);
 },[]);
 const back=()=>window.location.assign('/?mode=guest');
 if(entry)return <GuestWorkspace initialStudioId={entry.studioId} initialRoomName={entry.room} personalInvite={entry.invite} initialEntrySettings={entry.settings} onLeave={back}/>;
 if(!href)return <EntryShell><div role="status">{t('Проверка приглашения…')}</div></EntryShell>;
 return <GuestInviteLanding href={href} onBack={back} onContinue={(room,settings)=>{
   const url=new URL(href);setEntry({room,settings,studioId:url.searchParams.get('studioId')||'studio-default',invite:new URLSearchParams(url.hash.slice(1)).get('invite')||url.searchParams.get('invite')||''});
 }}/>;
}
export default function JoinPage(){return <Suspense><Join/></Suspense>;}
