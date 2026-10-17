"use client";
import { useI18n } from '@/components/I18nProvider';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Room, RoomEvent, Track, type RemoteVideoTrack } from 'livekit-client';
import type { MultiviewTile, MultiviewAbsence } from '@/lib/multiview';
import { imageTransformStyle, imageCropBounds, croppedImageStyle } from '@/lib/multiview-image';
import { bindMultiviewVideo } from '@/lib/multiview-media';
import { tileAspectRatio } from '@/lib/multiview-layout';

export default function MultiviewMedia({room,tile,absence,editor=false,onDimensions}:{room:Room;tile:MultiviewTile;absence?:MultiviewAbsence;editor?:boolean;onDimensions?:(identity:string,source:MultiviewTile["source"],width:number,height:number)=>void}) {
 const {locale}=useI18n();
 const labels=locale==='en'? ['No video','Assign a source']:locale==='zh-CN'?['无视频','分配来源']:['Нет видео','Назначьте источник'];
 const ref=useRef<HTMLVideoElement>(null);const [available,setAvailable]=useState(false);
 const [sourceAspect,setSourceAspect]=useState<number>();
 const crop=imageCropBounds(tile.transform),cropped=crop.width<1||crop.height<1;
 const aspect=tileAspectRatio(tile,cropped?sourceAspect:undefined);
 const croppedAspect=sourceAspect?sourceAspect*crop.width/crop.height:undefined;
 const cropFit=tile.fit==='cover'?'max':'min';
 const cropStyle:CSSProperties=cropped&&croppedAspect?{position:'absolute',left:'50%',top:'50%',width:`${cropFit}(100cqw, ${croppedAspect*100}cqh)`,height:`${cropFit}(100cqh, ${100/croppedAspect}cqw)`,transform:'translate(-50%, -50%)',overflow:'hidden'}:{position:'absolute',inset:0};
 const frameStyle:CSSProperties=aspect?{position:'absolute',left:'50%',top:'50%',width:`min(100cqw, ${aspect*100}cqh)`,height:`min(100cqh, ${100/aspect}cqw)`,transform:'translate(-50%, -50%)',containerType:'size'}:{position:'absolute',inset:0,containerType:'size'};
 useEffect(()=>{
  const video=ref.current;if(!video)return;
  const report=()=>{if(video.videoWidth>0&&video.videoHeight>0){setSourceAspect(video.videoWidth/video.videoHeight);onDimensions?.(tile.sourceIdentity,tile.source,video.videoWidth,video.videoHeight);}};
  setSourceAspect(undefined);video.addEventListener('loadedmetadata',report);video.addEventListener('resize',report);report();
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
  <div style={frameStyle} data-multiview-aspect={tile.aspectRatio||'source'}>
  <div style={{position:'absolute',inset:0,overflow:'hidden',borderRadius:`min(${tile.borderRadius??0}cqw, ${tile.borderRadius??0}cqh)`,background:!available&&absence?.mode==='black'?'black':'transparent'}}>
  <div style={cropStyle} data-multiview-crop={cropped||undefined}><video ref={ref} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:tile.fit,background:'transparent',visibility:available?'visible':'hidden',...(cropped?croppedImageStyle(tile.transform):imageTransformStyle(tile.transform))}} /></div>
  {!available&&absence?.mode==='image'&&absence.image&&<img alt="" src={absence.image} draggable={false} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',...imageTransformStyle(absence.transform)}} />}
  {editor&&!available&&<span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:12,color:'#9ba2a8',pointerEvents:'none'}}>{tile.sourceIdentity?labels[0]:labels[1]}</span>}
 </div></div></div>;
}
