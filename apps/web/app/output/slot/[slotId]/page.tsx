"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from "livekit-client";
import { createOutputTrackBindings } from "@/lib/output-track-bindings";
import { createSlotOutputController, type SlotOutputSnapshot } from "@/lib/slot-output-controller";
import { getLiveKitUrl } from "@/lib/livekit-url";
import { useI18n } from "@/components/I18nProvider";
function Output(){
 const params=useParams<{slotId:string}>(),search=useSearchParams(),{t}=useI18n(),studioId=search.get("studioId")||"studio-default",source=search.get("source")||"camera";
 const video=useRef<HTMLDivElement>(null),audio=useRef<HTMLDivElement>(null),[status,setStatus]=useState("Ожидание кастера"),[blocked,setBlocked]=useState(false),resume=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const access=new URLSearchParams(window.location.hash.slice(1)).get("access")||"",client=crypto.randomUUID(),room=new Room({adaptiveStream:false,dynacast:false});
  const bindings=createOutputTrackBindings(()=>video.current,()=>audio.current),controller=createSlotOutputController(bindings),abort=new AbortController();let stopped=false,timer:ReturnType<typeof setTimeout>,snapshot:SlotOutputSnapshot|null=null,connectedRoom="",connection:Promise<void>|null=null;
  const playback=()=>{void bindings.resumeAudio().then(state=>{if(!stopped)setBlocked(state==="blocked"||state==="failed");});};
  resume.current=()=>{void room.startAudio().catch(()=>undefined);void bindings.resumeAudio(true,"manual").then(state=>{if(!stopped)setBlocked(state==="blocked"||state==="failed");});};
  const reconcile=()=>{
   if(!snapshot||stopped)return;
   for(const participant of room.remoteParticipants.values()){
    let metadata;try{metadata=JSON.parse(participant.metadata||"{}");}catch{metadata={};}
    const target=snapshot.target,match=target&&participant.identity===target.identity&&participant.sid===target.participantSid&&(metadata.admissionId===target.sessionId&&metadata.admissionGeneration===target.generation||target.legacy&&metadata.role==="guest"&&metadata.studioId===studioId);
    for(const publication of participant.trackPublications.values()){
     const wanted=!!match&&snapshot.phase==="assigned"&&(source==="camera"?[Track.Source.Camera,Track.Source.Microphone]:[Track.Source.ScreenShare,Track.Source.ScreenShareAudio]).includes(publication.source);
     if(publication.isSubscribed!==wanted)publication.setSubscribed(wanted);
     if(publication.track){if(wanted&&!publication.isMuted&&target)controller.trackSubscribed(publication.track,{sessionId:target.sessionId,identity:participant.identity,generation:target.generation,participantSid:participant.sid},snapshot.revision);else controller.trackUnsubscribed(publication.track);}
    }
   }playback();
  };
  const unsubscribed=(track:RemoteTrack)=>controller.trackUnsubscribed(track);
  const disconnected=()=>{controller.clear();if(!stopped)setStatus("Переподключение…");};
  room.on(RoomEvent.TrackSubscribed,reconcile).on(RoomEvent.TrackPublished,reconcile).on(RoomEvent.ParticipantConnected,reconcile).on(RoomEvent.ParticipantMetadataChanged,reconcile).on(RoomEvent.TrackUnsubscribed,unsubscribed).on(RoomEvent.TrackMuted,reconcile).on(RoomEvent.TrackUnmuted,reconcile).on(RoomEvent.Reconnected,reconcile).on(RoomEvent.Disconnected,disconnected);
  const poll=async()=>{try{
   const response=await fetch(`/api/caster-slot-output?${new URLSearchParams({studioId,slot:params.slotId,source,client})}`,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)]),headers:{"x-castlink-slot-access":access}});
   if(!response.ok){controller.clear();setStatus(response.status===403||response.status===410?"Ссылка выхода недействительна":"Выход временно недоступен");if(response.status===403||response.status===410){stopped=true;await room.disconnect();}return;}
   const data=await response.json();if(stopped)return;
   if(snapshot&&data.snapshot.revision<snapshot.revision)return;
   snapshot=data.snapshot;controller.applySnapshot(snapshot!);setStatus(snapshot?.phase==="assigned"?"":"Ожидание кастера");
   if(connectedRoom!==data.room||room.state==="disconnected"){
    if(!connection){connection=(async()=>{if(room.state!=="disconnected")await room.disconnect();if(stopped)return;await room.connect(getLiveKitUrl(),data.token,{autoSubscribe:false});connectedRoom=data.room;})().finally(()=>{connection=null;});}
    await connection;
   }reconcile();
  }catch{if(!stopped){controller.clear();setStatus("Выход временно недоступен");}}finally{if(!stopped)timer=setTimeout(poll,1000);}};
  void poll();return()=>{stopped=true;abort.abort();clearTimeout(timer);controller.dispose();room.removeAllListeners();void (connection||Promise.resolve()).catch(()=>undefined).then(()=>room.disconnect());};
 },[studioId,params.slotId,source]);
 return <main className="slot-output"><div ref={video} className="slot-output-video"/><div ref={audio}/>{status&&<p className="slot-output-status" role="status">{t(status)}</p>}{blocked&&<button className="slot-output-audio" onClick={()=>resume.current()}>{t("Включить звук")}</button>}</main>;
}
export default function SlotOutputPage(){return <Suspense><Output/></Suspense>;}
