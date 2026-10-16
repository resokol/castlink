"use client";
import {useEffect,useRef} from 'react';
import {Room,RoomEvent,Track,type RemoteAudioTrack} from 'livekit-client';
import {createOutputTrackBindings} from '@/lib/output-track-bindings';
export function MultiviewAudio({room,identity,source}:{room:Room;identity:string;source:'camera'|'screen'}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const binding=createOutputTrackBindings(()=>null,()=>host.current);
  const refresh=()=>{if(room.state!=='connected'){binding.clear();return;}const pub=room.remoteParticipants.get(identity)?.getTrackPublication(source==='camera'?Track.Source.Microphone:Track.Source.ScreenShareAudio);if(pub?.track&&!pub.isMuted){binding.attach(pub.track as RemoteAudioTrack);void binding.resumeAudio();}else binding.clear();};
  const events=[RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.ParticipantDisconnected,RoomEvent.Reconnecting,RoomEvent.Reconnected,RoomEvent.Disconnected];
  const resume=()=>{void room.startAudio().catch(()=>undefined);void binding.resumeAudio(true,'manual');};
  events.forEach(e=>room.on(e,refresh));document.addEventListener('pointerdown',resume);const timer=setInterval(refresh,2000);refresh();
  return()=>{events.forEach(e=>room.off(e,refresh));document.removeEventListener('pointerdown',resume);clearInterval(timer);binding.clear();};
 },[room,identity,source]);
 return <div ref={host} style={{display:'none'}} />;
}
