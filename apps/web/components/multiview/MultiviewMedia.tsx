"use client";
import { useI18n } from '@/components/I18nProvider';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteVideoTrack } from 'livekit-client';
import type { MultiviewTile, MultiviewAbsence } from '@/lib/multiview';
import { imageTransformStyle } from '@/lib/multiview-image';
import { bindMultiviewVideo } from '@/lib/multiview-media';

export default function MultiviewMedia({room,tile,absence,editor=false,onDimensions}:{room:Room;tile:MultiviewTile;absence?:MultiviewAbsence;editor?:boolean;onDimensions?:(identity:string,source:MultiviewTile["source"],width:number,height:number)=>void}) {
 const {locale}=useI18n();
 const labels=locale==='en'? ['No video','Assign a source']:locale==='zh-CN'?['无视频','分配来源']:['Нет видео','Назначьте источник'];
 const ref=useRef<HTMLVideoElement>(null);const [available,setAvailable]=useState(false);
 useEffect(()=>{
  const video=ref.current;if(!video||!onDimensions)return;
  const report=()=>{if(video.videoWidth>0&&video.videoHeight>0)onDimensions(tile.sourceIdentity,tile.source,video.videoWidth,video.videoHeight);};
  video.addEventListener('loadedmetadata',report);video.addEventListener('resize',report);
  return()=>{video.removeEventListener('loadedmetadata',report);video.removeEventListener('resize',report);};
 },[tile.sourceIdentity,tile.source,onDimensions]);

 useEffect(()=>{
  if(!ref.current)return;const binding=bindMultiviewVideo(ref.current,setAvailable);
  const update=()=>{if(room.state!=='connected'){binding.clear();return;}const publication=room.remoteParticipants.get(tile.sourceIdentity)?.getTrackPublication(tile.source==='screen'?Track.Source.ScreenShare:Track.Source.Camera);binding.update(publication?{track:publication.track as RemoteVideoTrack|undefined,isMuted:publication.isMuted}:undefined);};
  const events=[RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.TrackPublished,RoomEvent.TrackUnpublished,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.Reconnecting,RoomEvent.Reconnected,RoomEvent.Disconnected];
  events.forEach(e=>room.on(e,update));const timer=setInterval(update,1000);update();
  return()=>{events.forEach(e=>room.off(e,update));clearInterval(timer);binding.clear();};
 },[room,tile.sourceIdentity,tile.source]);
 return <div style={{position:'absolute',inset:0,containerType:'size'}} data-multiview-available={available}>
  <div style={{position:'absolute',inset:0,overflow:'hidden',borderRadius:`min(${tile.borderRadius??0}cqw, ${tile.borderRadius??0}cqh)`,background:!available&&absence?.mode==='black'?'black':'transparent'}}>
  <video ref={ref} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:tile.fit,background:'transparent',visibility:available?'visible':'hidden',...imageTransformStyle(tile.transform)}} />
  {!available&&absence?.mode==='image'&&absence.image&&<img alt="" src={absence.image} draggable={false} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',...imageTransformStyle(absence.transform)}} />}
  {editor&&!available&&<span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:12,color:'#9ba2a8',pointerEvents:'none'}}>{tile.sourceIdentity?labels[0]:labels[1]}</span>}
 </div></div>;
}
