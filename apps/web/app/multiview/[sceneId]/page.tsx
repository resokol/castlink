"use client";
import {useEffect,useRef,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {Room,RoomEvent,Track,VideoQuality} from 'livekit-client';
import {getLiveKitUrl} from '@/lib/livekit-url';
import type {MultiviewScene} from '@/lib/multiview';
import {uniqueMultiviewAudio} from '@/lib/multiview-media';
import MultiviewMedia from '@/components/multiview/MultiviewMedia';
import {MultiviewAudio} from '@/components/multiview/MultiviewAudio';
import styles from './page.module.css';

export default function MultiviewOutput(){
 const {sceneId}=useParams<{sceneId:string}>();const search=useSearchParams();
 const studioId=search.get('studioId')||'studio-default',roomName=search.get('room')||'';
 const [scene,setScene]=useState<MultiviewScene>();const [room,setRoom]=useState<Room>();
 const stage=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const url=new URL(location.href),key=`castlink-multiview-access:${studioId}:${roomName}:${sceneId}`;
  let access=new URLSearchParams(url.hash.slice(1)).get('access')||'';
  try{if(access)sessionStorage.setItem(key,access);else access=sessionStorage.getItem(key)||'';}catch{}
  url.hash='';history.replaceState(null,'',url.pathname+url.search);
  const connection=new Room({adaptiveStream:false,dynacast:false});setRoom(connection);
  let stopped=false,latest:MultiviewScene|undefined,pollTimer:ReturnType<typeof setTimeout>|undefined,retryTimer:ReturnType<typeof setTimeout>|undefined,connecting=false,authorized=false;
  let token='',identity='';const controller=new AbortController();
  const headers={'x-castlink-view-access':access};
  const query=new URLSearchParams({studioId,room:roomName,sceneId});
  const select=()=>{
   const video=new Set(latest?.tiles.filter(t=>t.sourceIdentity).map(t=>t.sourceIdentity+':'+t.source)||[]);
   const audio=new Set(uniqueMultiviewAudio(latest?.tiles||[]).map(t=>t.sourceIdentity+':'+t.source));
   for(const participant of connection.remoteParticipants.values())for(const pub of participant.trackPublications.values()){
    const source=pub.source===Track.Source.Camera||pub.source===Track.Source.Microphone?'camera':pub.source===Track.Source.ScreenShare||pub.source===Track.Source.ScreenShareAudio?'screen':'';
    const wanted=!!source&&(pub.kind===Track.Kind.Video?video:audio).has(participant.identity+':'+source);
    if(pub.isSubscribed!==wanted)pub.setSubscribed(wanted);
    if(wanted&&pub.kind===Track.Kind.Video)pub.setVideoQuality(VideoQuality.HIGH);
   }
  };
  const connect=async()=>{
   if(stopped||!authorized||connecting||connection.state!=='disconnected')return;
   connecting=true;
   try{
    const q=new URLSearchParams({studioId,room:roomName,role:'output',...(identity?{identity}:{})});
    let response=await fetch('/api/token?'+q,{headers:{...headers,...(token?{authorization:`Bearer ${token}`}:{})},cache:'no-store',signal:controller.signal});
    if(response.status===401&&token){token='';identity='';q.delete('identity');response=await fetch('/api/token?'+q,{headers,cache:'no-store',signal:controller.signal});}
    if(!response.ok)throw Error('Не удалось подключить выход');const data=await response.json();if(stopped)return;
    token=data.token;identity=data.identity;await connection.connect(getLiveKitUrl(),token,{autoSubscribe:false});if(stopped){void connection.disconnect();return;}select();
   }catch{if(!stopped&&authorized)retryTimer=setTimeout(()=>void connect(),3000);}finally{connecting=false;}
  };
  const disconnected=()=>{if(!stopped&&authorized){if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(()=>void connect(),1500);}};
  connection.on(RoomEvent.TrackPublished,select).on(RoomEvent.ParticipantConnected,select).on(RoomEvent.Reconnected,select).on(RoomEvent.Disconnected,disconnected);
  const poll=async()=>{
   try{
    const response=await fetch('/api/multiview?'+query,{headers,cache:'no-store',signal:controller.signal});
    if([401,403,404].includes(response.status)){authorized=false;latest=undefined;setScene(undefined);void connection.disconnect();document.title='CastLink — ссылка недоступна';return;}
    if(!response.ok)throw Error('scene unavailable');const data=await response.json();if(stopped)return;
    latest=data.scene;authorized=true;setScene(data.scene);document.title=`CastLink — ${data.scene.name}`;select();void connect();
   }catch{/* A temporary API failure does not tear down healthy media. */}
   finally{if(!stopped)pollTimer=setTimeout(()=>void poll(),2000);}
  };
  void poll();
  return()=>{stopped=true;controller.abort();clearTimeout(pollTimer);clearTimeout(retryTimer);connection.off(RoomEvent.TrackPublished,select).off(RoomEvent.ParticipantConnected,select).off(RoomEvent.Reconnected,select).off(RoomEvent.Disconnected,disconnected);void connection.disconnect();};
 },[sceneId,studioId,roomName]);
 return <main className={styles.output} onDoubleClick={()=>{void stage.current?.requestFullscreen().catch(()=>undefined);if(room)void room.startAudio().catch(()=>undefined);}}>
  <style>{'html,body {background:transparent!important;margin:0!important;overflow:hidden!important;} body{min-height:0!important;}'}</style>
  {scene&&room&&<div ref={stage} className={styles.stage} style={{width:`min(100vw, ${100*scene.width/scene.height}vh)`,height:`min(100vh, ${100*scene.height/scene.width}vw)`}}>
   {scene.tiles.map(tile=><div key={tile.id} className={styles.tile} style={{left:`${tile.x*100}%`,top:`${tile.y*100}%`,width:`${tile.width*100}%`,height:`${tile.height*100}%`}}><MultiviewMedia room={room} tile={tile} absence={scene.absence}/></div>)}
   {uniqueMultiviewAudio(scene.tiles).map(t=><MultiviewAudio key={t.sourceIdentity+':'+t.source} room={room} identity={t.sourceIdentity} source={t.source}/>)}
  </div>}
 </main>;
}
