import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider,useI18n} from '@/components/I18nProvider';
import {PublishedSourcePreview} from '@/components/ParticipantSourceCard';
import {RemotePcTileControls} from '@/components/RemotePcTileControls';
import type {useRemotePcTile} from '@/lib/use-remote-pc-tile';
const packets:string[]=[];
function App(){
 const {locale,setLocale}=useI18n(),[pending,setPending]=useState(false),[available,setAvailable]=useState(false),[stream,setStream]=useState<MediaStream>(),video=useRef<HTMLDivElement>(null);
 useEffect(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const context=canvas.getContext('2d')!;context.fillStyle='#31463e';context.fillRect(0,0,640,360);context.fillStyle='#eef0f2';context.font='24px sans-serif';context.fillText('CastLink · shared screen',32,80);const media=canvas.captureStream(1);setStream(media);Object.assign(window,{qaGrant:()=>setAvailable(true),qaPackets:packets});return()=>media.getTracks().forEach(t=>t.stop());},[]);
 const control={available,requestable:true,sourceAvailable:true,requestEnded:false,pending,busy:false,error:false,controllerName:undefined,active:available,focused:available,paused:false,userPaused:false,request:async()=>{packets.push('request');setPending(true);},stop:async()=>{packets.push('finish');setAvailable(false);setPending(false);},text:async(value:string)=>{packets.push(value);},chord:async()=>{}} as ReturnType<typeof useRemotePcTile>;
 return <main><header><select aria-label="Language" value={locale} onChange={event=>setLocale(event.target.value as typeof locale)}><option>ru</option><option>en</option><option>zh-CN</option></select></header><article className="panel source-card"><header className="source-card-heading"><strong>Участник · Participant · 参与者</strong></header><div className="castlink-tile-shell remote-pc-source-preview" ref={video} tabIndex={0}><PublishedSourcePreview stream={stream} title="Shared screen"/><RemotePcTileControls control={control}/></div></article></main>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><App/></I18nProvider>);
