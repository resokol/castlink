"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { GuestWorkspace } from "@/components/GuestWorkspace";
function Join(){const params=useSearchParams(),{t}=useI18n(),studioId=params.get("studioId")||"studio-default";
 const [entry,setEntry]=useState<{room:string;invite:string}>(),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();const url=new URL(window.location.href),invite=new URLSearchParams(url.hash.slice(1)).get("invite")||"";
  if(!invite){setError("Приглашение недействительно");return;}
  fetch("/api/guest-admission",{method:"POST",signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify({action:"resolve",studioId,invite})}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setEntry({room:data.room,invite});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[studioId]);
 if(entry)return <GuestWorkspace initialStudioId={studioId} initialRoomName={entry.room} personalInvite={entry.invite}/>;
 return <main className="guest-entry-page graphite-entry"><div className="panel" role={error?"alert":"status"}>{error?t("Приглашение недействительно"):t("Проверка приглашения…")}</div></main>;
}
export default function JoinPage(){return <Suspense><Join/></Suspense>;}
