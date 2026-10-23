"use client";
import { remotePcOutputMatches } from '@/lib/remote-pc-sources';
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Room, RoomEvent, Track, VideoQuality, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from "livekit-client";
import { createOutputTrackBindings } from "@/lib/output-track-bindings";
import { createSlotOutputController, type SlotOutputSnapshot } from "@/lib/slot-output-controller";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { useI18n } from "@/components/I18nProvider";
import { useVideoRotation } from "@/lib/video-rotation";
import styles from "./output.module.css";
function Output(){
 const params=useParams<{slotId:string}>(),search=useSearchParams(),{t}=useI18n(),studioId=search.get("studioId")||"studio-default",source=search.get("source")||"camera";
 const video=useRef<HTMLDivElement>(null),audio=useRef<HTMLDivElement>(null),[status,setStatus]=useState("Ожидание кастера"),[blocked,setBlocked]=useState(false),resume=useRef<()=>void>(()=>{});
 const [rotationRoom,setRotationRoom]=useState<Room>(),[rotationTarget,setRotationTarget]=useState<{identity:string;sid:string}|null>(null);
 useVideoRotation(source==="camera"&&rotationTarget?rotationRoom:undefined,rotationTarget?.identity||"",video,source==="camera");
 useEffect(()=>{
  document.documentElement.classList.add("studiolink-output-document");
  const access=new URLSearchParams(window.location.hash.slice(1)).get("access")||"",client=crypto.randomUUID(),room=new Room({adaptiveStream:false,dynacast:false});
  setRotationRoom(room);
  const bindings=createOutputTrackBindings(()=>video.current,()=>audio.current),controller=createSlotOutputController(bindings),abort=new AbortController();let stopped=false,timer:ReturnType<typeof setTimeout>,snapshot:SlotOutputSnapshot|null=null,connectedRoom="",connection:Promise<void>|null=null;
  const playback=()=>{void bindings.resumeAudio().then(state=>{if(!stopped)setBlocked(state==="blocked"||state==="failed");});};
  resume.current=()=>{void room.startAudio().catch(()=>undefined);void bindings.resumeAudio(true,"manual").then(state=>{if(!stopped)setBlocked(state==="blocked"||state==="failed");});};
  const reconcile=()=>{
   if(!snapshot||stopped)return;
   let nextRotationTarget:{identity:string;sid:string}|null=null,hasTarget=false;
   for(const participant of room.remoteParticipants.values()){
    let metadata;try{metadata=JSON.parse(participant.metadata||"{}");}catch{metadata={};}
    const target=snapshot.target,match=target&&participant.identity===target.identity&&participant.sid===target.participantSid&&(metadata.admissionId===target.sessionId&&metadata.admissionGeneration===target.generation||target.legacy&&metadata.role==="guest"&&metadata.studioId===studioId);
    if(match&&snapshot.phase==="assigned")hasTarget=true;
    if(match&&snapshot.phase==="assigned"&&source==="camera"&&target)nextRotationTarget={identity:participant.identity,sid:participant.sid};
    for(const publication of participant.trackPublications.values()){
     const aliased=source==="screen"&&target&&snapshot.remotePcSource&&snapshot.remotePcSource.owner.sid===target.participantSid&&remotePcOutputMatches(room,target.identity,source,publication,participant,[snapshot.remotePcSource]);
     const wanted=snapshot.phase==="assigned"&&(source==="screen"?!!aliased||!!match&&!snapshot.remotePcSource&&[Track.Source.ScreenShare,Track.Source.ScreenShareAudio].includes(publication.source):!!match&&[Track.Source.Camera,Track.Source.Microphone].includes(publication.source));
     if(wanted)hasTarget=true;
     if(wanted&&publication.kind===Track.Kind.Video)publication.setVideoQuality(VideoQuality.HIGH);
     if(publication.isSubscribed!==wanted)publication.setSubscribed(wanted);
     if(publication.track){if(wanted&&!publication.isMuted&&target)controller.trackSubscribed(publication.track,{sessionId:target.sessionId,identity:target.identity,generation:target.generation,participantSid:target.participantSid},snapshot.revision);else controller.trackUnsubscribed(publication.track);}
    }
   }
   // ParticipantDisconnected may arrive before the slot snapshot changes. Drop
   // its decoded frame immediately, including tracks absent from the roster.
   if(!hasTarget){controller.clear();setBlocked(false);}
   setRotationTarget(current=>current?.identity===nextRotationTarget?.identity&&current?.sid===nextRotationTarget?.sid?current:nextRotationTarget);
   playback();
  };
  const unsubscribed=(track:RemoteTrack)=>controller.trackUnsubscribed(track);
  const disconnected=()=>{setRotationTarget(null);controller.clear();setBlocked(false);if(!stopped)setStatus("Переподключение…");};
  room.on(RoomEvent.TrackSubscribed,reconcile).on(RoomEvent.TrackPublished,reconcile).on(RoomEvent.ParticipantConnected,reconcile).on(RoomEvent.ParticipantDisconnected,reconcile).on(RoomEvent.ParticipantMetadataChanged,reconcile).on(RoomEvent.TrackUnsubscribed,unsubscribed).on(RoomEvent.TrackMuted,reconcile).on(RoomEvent.TrackUnmuted,reconcile).on(RoomEvent.Reconnected,reconcile).on(RoomEvent.Disconnected,disconnected);
  const poll=async()=>{
   // vMix/CEF may support AbortController without AbortSignal.any or timeout.
   const request=new AbortController(),cancel=()=>request.abort(),timeout=setTimeout(cancel,8000);
   abort.signal.addEventListener("abort",cancel,{once:true});
   try{
   const response=await fetch(`/api/caster-slot-output?${new URLSearchParams({studioId,slot:params.slotId,source,client})}`,{cache:"no-store",signal:request.signal,headers:{"x-castlink-slot-access":access}});
   if(stopped)return;
   if(!response.ok){setRotationTarget(null);controller.clear();setStatus(response.status===403||response.status===410?"Ссылка выхода недействительна":"Выход временно недоступен");if(response.status===403||response.status===410){stopped=true;await room.disconnect();}return;}
   const data=await response.json();if(stopped)return;
   if(snapshot&&data.snapshot.revision<snapshot.revision)return;
   snapshot=data.snapshot;controller.applySnapshot(snapshot!);setStatus(snapshot?.phase==="assigned"?"":"Ожидание кастера");
   if(connectedRoom!==data.room||room.state==="disconnected"){
    if(!connection){connection=(async()=>{if(room.state!=="disconnected")await room.disconnect();if(stopped)return;await room.connect(getLiveKitUrl(),data.token,{autoSubscribe:false});connectedRoom=data.room;})().finally(()=>{connection=null;});}
    await connection;
   }reconcile();
  }catch{if(!stopped){setRotationTarget(null);controller.clear();setStatus("Выход временно недоступен");}}finally{clearTimeout(timeout);abort.signal.removeEventListener("abort",cancel);if(!stopped)timer=setTimeout(poll,1000);}};
  void poll();return()=>{stopped=true;setRotationTarget(null);setRotationRoom(undefined);abort.abort();clearTimeout(timer);controller.dispose();room.removeAllListeners();document.documentElement.classList.remove("studiolink-output-document");void (connection||Promise.resolve()).catch(()=>undefined).then(()=>room.disconnect());};
 },[studioId,params.slotId,source]);
 return <main className={`slot-output ${styles.output}`} data-castlink-clean-output="slot"><div ref={video} className="slot-output-video"/><div ref={audio}/>{status&&<p className={`slot-output-status ${status==="Ожидание кастера"||status==="Переподключение…"?styles.status:""}`} role="status">{t(status)}</p>}{blocked&&<button className="slot-output-audio" onClick={()=>resume.current()}>{t("Включить звук")}</button>}</main>;
}
export default function SlotOutputPage(){return <Suspense><Output/></Suspense>;}
