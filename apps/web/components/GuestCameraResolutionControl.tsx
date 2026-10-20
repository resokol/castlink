"use client";
import { useEffect, useRef, useState } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { useI18n } from "./I18nProvider";
import { guestCameraHeight } from "@/lib/video-quality";

const labels = {
 ru: { label:"Разрешение камеры", saving:"Отправляем настройку…", requested:"Разрешение запрошено. Фактический кадр зависит от камеры.", error:"Не удалось изменить разрешение камеры", offline:"Кастер не подключён", changed:"Кастер переподключился. Повторите настройку." },
 en: { label:"Camera resolution", saving:"Sending setting…", requested:"Resolution requested. Actual frame size depends on the camera.", error:"Could not change camera resolution", offline:"Caster is offline", changed:"Caster reconnected. Try changing the setting again." },
 "zh-CN": { label:"摄像头分辨率", saving:"正在发送设置…", requested:"已请求分辨率。实际画面尺寸取决于摄像头。", error:"无法更改摄像头分辨率", offline:"嘉宾未连接", changed:"嘉宾已重新连接，请重新设置。" },
};
export function GuestCameraResolutionControl({room,studioId,roomName,identity}:{room:Room;studioId:string;roomName:string;identity:string}) {
 const {locale}=useI18n(),c=labels[locale];
 const [height,setHeight]=useState<720|1080>(1080),[sid,setSid]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const activeSid=useRef(""),epoch=useRef(0),request=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{
  const refresh=()=>{
   const participant=room.remoteParticipants.get(identity),next=room.state==="connected"?participant?.sid||"":"";
   if(next!==activeSid.current){epoch.current++;request.current?.abort();request.current=undefined;activeSid.current=next;setBusy(false);setError("");setNotice("");}
   setSid(next);setHeight(guestCameraHeight(participant?.metadata));
  };
  const events=[RoomEvent.ParticipantMetadataChanged,RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.Connected,RoomEvent.Reconnected,RoomEvent.Disconnected];
  events.forEach(event=>room.on(event,refresh));refresh();
  return()=>{epoch.current++;request.current?.abort();activeSid.current="";events.forEach(event=>room.off(event,refresh));};
 },[room,identity,studioId,roomName]);
 const change=async(value:number)=>{
  if(busy||request.current||!activeSid.current||(value!==720&&value!==1080))return;
  const selectedSid=activeSid.current,revision=epoch.current,controller=new AbortController();request.current=controller;setBusy(true);setError("");setNotice("");
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch("/api/participants",{method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({action:"video-resolution",studioId,room:roomName,identity,participantSid:selectedSid,height:value})});
   await response.json().catch(()=>({}));
   if(revision!==epoch.current||room.remoteParticipants.get(identity)?.sid!==selectedSid)return;
   if(!response.ok)throw new Error(response.status===409?c.changed:c.error);
   setHeight(value);setNotice(c.requested);
  }catch(cause){if(revision===epoch.current)setError(cause instanceof Error?cause.message:c.error);}
  finally{clearTimeout(timer);if(revision===epoch.current){setBusy(false);request.current=undefined;}}
 };
 return <section className="guest-camera-resolution">
  <label className="guest-card-quality">{c.label}<select value={height} disabled={busy||!sid} onChange={event=>void change(Number(event.target.value))}><option value={720}>720p</option><option value={1080}>1080p</option></select></label>
  {!sid&&<small>{c.offline}</small>}{error&&<small role="alert">{error}</small>}{busy?<small role="status">{c.saving}</small>:notice&&<small role="status">{notice}</small>}
 </section>;
}
