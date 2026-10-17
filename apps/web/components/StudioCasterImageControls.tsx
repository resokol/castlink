"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { useI18n } from "./I18nProvider";
import ImageTransformControls from "./multiview/ImageTransformControls";
import { setStudioImagePreview } from "@/lib/studio-image-transform";
import { validateImageTransform, type ImageTransform } from "@/lib/multiview-image";

const labels = {
  ru: { title: "Изображение кастера в студии", help: "Изменяет отображение в студии и индивидуальном видеовыходе.", reset: "Сбросить в студии", saving: "Сохранение…", saved: "Изображение применено", offline: "Кастер не подключён", changed: "Кастер переподключился. Проверьте изображение и повторите.", error: "Не удалось сохранить изображение" },
  en: { title: "Caster image in the studio", help: "Changes the image displayed in the studio and individual video output.", reset: "Reset in studio", saving: "Saving…", saved: "Image applied", offline: "Caster is offline", changed: "Caster reconnected. Check the image and try again.", error: "Could not save the image" },
  "zh-CN": { title: "工作室中的嘉宾图像", help: "更改工作室和独立视频输出中的显示图像。", reset: "重置工作室图像", saving: "正在保存…", saved: "图像已应用", offline: "嘉宾未连接", changed: "嘉宾已重新连接。请检查图像后重试。", error: "无法保存图像" },
};

function participantImage(metadata?: string): ImageTransform {
  try { return validateImageTransform(JSON.parse(metadata || "{}").studioImageTransform || {}); }
  catch { return {}; }
}
const same = (a: ImageTransform, b: ImageTransform) => JSON.stringify(a) === JSON.stringify(b);

export function StudioCasterImageControls({ room, roomName, identity, studioId = "studio-default" }: { room: Room; roomName: string; identity: string; studioId?: string }) {
  const { locale } = useI18n();const c=labels[locale];
  const [draft,setDraft]=useState<ImageTransform>({}),[sid,setSid]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const change=useRef<(value:ImageTransform)=>void>(()=>{});
  useEffect(()=>{
    let alive=true,session="",saved:ImageTransform={},pending:ImageTransform|null=null,inFlight=false,lastSent=0,revision=0;
    let timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
    const clearPreview=()=>setStudioImagePreview(room,identity,session);
    const schedule=()=>{if(!alive||inFlight||!pending||!session||timer)return;timer=setTimeout(()=>{timer=undefined;void send();},Math.max(120,750-(Date.now()-lastSent)));};
    const send=async()=>{
      if(!alive||inFlight||!pending||!session)return;
      const value=pending,requestSid=session,requestRevision=revision;pending=null;inFlight=true;lastSent=Date.now();controller=new AbortController();const request=controller;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;request.abort();},10000);
      try{
        const response=await fetch("/api/participants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"image-transform",studioId,room:roomName,identity,participantSid:requestSid,transform:value}),signal:request.signal});
        if(!response.ok)throw new Error(response.status===409?c.changed:c.error);
        const data=await response.json();
        if(!alive||requestRevision!==revision||room.remoteParticipants.get(identity)?.sid!==requestSid)return;
        saved=validateImageTransform(data.transform);
        if(!pending){setDraft(saved);setStudioImagePreview(room,identity,session,saved);setNotice(c.saved);setError("");if(same(participantImage(room.remoteParticipants.get(identity)?.metadata),saved))clearPreview();}
      }catch(failure){
        if(alive&&requestRevision===revision&&(!request.signal.aborted||timedOut)){setError(failure instanceof Error?failure.message:c.error);setNotice("");if(!pending){saved=participantImage(room.remoteParticipants.get(identity)?.metadata);setDraft(saved);clearPreview();}}
      }finally{
        clearTimeout(timeout);
        if(alive&&requestRevision===revision){inFlight=false;controller=undefined;if(pending)schedule();else setBusy(false);}
      }
    };
    const refresh=()=>{
      const participant=room.remoteParticipants.get(identity),next=participant?.sid||"",value=participantImage(participant?.metadata);
      if(next!==session){revision++;controller?.abort();controller=undefined;clearTimeout(timer);timer=undefined;pending=null;inFlight=false;lastSent=0;clearPreview();session=next;setSid(next);saved=value;setDraft(value);setBusy(false);setError("");setNotice("");}
      else if(!pending&&!inFlight){saved=value;setDraft(value);clearPreview();}
    };
    change.current=value=>{if(!session)return;pending=validateImageTransform(value);setDraft(pending);setStudioImagePreview(room,identity,session,pending);setBusy(true);setError("");setNotice("");schedule();};
    const events=[RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.ParticipantMetadataChanged,RoomEvent.Reconnected,RoomEvent.Disconnected];
    events.forEach(event=>room.on(event,refresh));refresh();
    return()=>{alive=false;revision++;controller?.abort();clearTimeout(timer);change.current=()=>{};clearPreview();events.forEach(event=>room.off(event,refresh));};
  },[room,identity,roomName,studioId,locale]);
  return <section className="studio-caster-image-controls" aria-label={c.title}>
    <strong>{c.title}</strong><p className="muted">{c.help}</p>
    <ImageTransformControls value={draft} disabled={!sid} onChange={value=>change.current(value)}/>
    <div className="guest-card-controls"><button type="button" disabled={!sid} onClick={()=>change.current({})}>{c.reset}</button></div>
    {!sid&&<small>{c.offline}</small>}{error&&<small role="alert">{error}</small>}{busy?<small role="status">{c.saving}</small>:notice&&<small role="status">{notice}</small>}
  </section>;
}
