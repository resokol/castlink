// Production controls + actual hook/DOM/WebCrypto. Only room/store transport is a fixture.
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Participant,Room,TrackPublication} from 'livekit-client';
import {Track} from 'livekit-client';
import {useRemotePcTile} from '@/lib/use-remote-pc-tile';
import {RemotePcTileControls} from '@/components/RemotePcTileControls';
import {PublishedSourcePreview} from '@/components/ParticipantSourceCard';
import {I18nProvider,useI18n} from '@/components/I18nProvider';
import {REMOTE_PC_PURPOSE,type RemotePcInputFrame,type RemotePcSession,type RemotePcSource,type RemotePcUnsignedInput} from '@/lib/remote-pc-protocol';
import type {CommittedTextQa} from './remote-pc-committed-text-store';
const controller={identity:'guest-controller',sid:'PA_controller'},owner={identity:'guest-owner',sid:'PA_owner'};
const source:RemotePcSource={mode:'client-owned',sessionId:'session',generation:'generation',studioId:'fixture',room:'fixture',owner,helper:owner,captureId:'capture',sourceKind:'screen',name:'Fixture screen',geometry:{width:640,height:360,revision:1},videoTrackSid:'TR_video',inputStatus:{state:'ready',pointerReady:true}};
const session:RemotePcSession={purpose:REMOTE_PC_PURPOSE,id:'session',generation:'generation',revision:1,mode:'client-owned',phase:'sharing',owner,source,grant:{id:'grant',revision:1,phase:'active',controller}};
const qa:CommittedTextQa={view:{ready:true,error:false,sessions:[session],sources:[source],requests:[]},credential:{sessionId:'session',generation:'generation',captureId:'capture',grantId:'grant',revision:1,geometryRevision:1,helper:owner,inputKey:btoa(String.fromCharCode(...new Uint8Array(32).fill(3))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),expiresAt:Date.now()+600000},sequences:{move:0,reliable:0},packets:[],trace:[],delayed:true,holdSign:false,pending:false,signs:0,duplicateOnSign:false,duplicateAttempts:0};
window.castlinkCommittedTextQa=qa;
const mark=(type:string,fields:Record<string,unknown>={})=>qa.trace.push({time:performance.now(),type,active:document.activeElement?.tagName,hasFocus:document.hasFocus(),hidden:document.hidden,...fields});
for(const name of ['blur','focusout','focusin','submit'])document.addEventListener(name,event=>{const focus=event as FocusEvent;mark(name,{target:(event.target as Element)?.tagName,related:(focus.relatedTarget as Element)?.tagName,trusted:event.isTrusted});},true);
// Preserve actual HMAC bytes and all product guards; hold only its Promise resolution.
const realSign=crypto.subtle.sign.bind(crypto.subtle);
crypto.subtle.sign=async(algorithm,key,data)=>{
  const result=await realSign(algorithm,key,data),frame=JSON.parse(new TextDecoder().decode(data)) as RemotePcUnsignedInput;
  if(qa.delayed&&frame.event.type==='text'){
    qa.pending=true;qa.signs++;mark('real-text-sign-ready');
    if(qa.duplicateOnSign){qa.duplicateOnSign=false;const form=document.querySelector<HTMLFormElement>('form')!;qa.duplicateAttempts+=2;form.requestSubmit();form.requestSubmit();}
    await new Promise<void>(resolve=>window.setTimeout(resolve,80));
    if(qa.holdSign)await new Promise<void>(resolve=>{qa.releaseSign=resolve;});
    qa.pending=false;delete qa.releaseSign;mark('real-text-sign-resolved');
  }
  return result;
};
const mediaHolder={mediaStreamTrack:{readyState:'live'} as MediaStreamTrack};
const publication={trackSid:'TR_video',track:mediaHolder} as unknown as TrackPublication;
const track={source:Track.Source.ScreenShare,participant:{...owner,isLocal:false} as unknown as Participant,publication};
const room={state:'connected',remoteParticipants:new Map([[owner.identity,owner]]),localParticipant:{...controller,publishData:async(bytes:Uint8Array)=>{const frame=JSON.parse(new TextDecoder().decode(bytes)) as RemotePcInputFrame;qa.packets.push(frame);mark('publish',{event:frame.event.type});}}} as unknown as Room;
function App(){
  const shell=useRef<HTMLDivElement>(null),[stream,setStream]=useState<MediaStream>(),control=useRemotePcTile(room,shell,track),{setLocale}=useI18n();
  useEffect(()=>{setLocale('en');const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const context=canvas.getContext('2d')!;context.fillStyle='#345544';context.fillRect(0,0,640,360);const media=canvas.captureStream(1);mediaHolder.mediaStreamTrack=media.getVideoTracks()[0];setStream(media);return()=>media.getTracks().forEach(item=>item.stop());},[]);
  useEffect(()=>{mark('control-render',{focused:control.focused,active:control.active,paused:control.paused});});
  useEffect(()=>{const observer=new MutationObserver(records=>{for(const record of records)mark('disabled-mutation',{target:(record.target as Element).tagName,disabled:(record.target as HTMLButtonElement).disabled});});observer.observe(shell.current!,{subtree:true,attributes:true,attributeFilter:['disabled']});return()=>observer.disconnect();},[]);
  return <><main><div ref={shell} className="castlink-tile-shell remote-pc-source-preview" tabIndex={0}><PublishedSourcePreview stream={stream} title="Shared screen"/><RemotePcTileControls control={control}/></div></main><button id="outside">Outside controller</button></>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><App/></I18nProvider>);
