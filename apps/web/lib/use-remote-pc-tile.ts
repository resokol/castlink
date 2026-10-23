'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { type Participant, type Room, type TrackPublication, Track } from 'livekit-client';
import { useRemotePc } from './use-remote-pc';
import { remotePcCredential, remotePcServerTime, remotePcInputSequences } from './remote-pc-client';
import { createRemotePcInputSender, remotePcVideoPoint, type RemotePcBrowserInput } from './remote-pc-input';
import { REMOTE_PC_MOVE_TOPIC, REMOTE_PC_RELIABLE_TOPIC, remotePcInputMacPayload, type RemotePcUnsignedInput, type RemotePcInputEvent } from './remote-pc-protocol';
export function useRemotePcTile(room:Room,ref:RefObject<HTMLElement|null>,track:{participant:Participant;publication?:TrackPublication;source:Track.Source}){
  const view=useRemotePc(room),[focused,setFocused]=useState(false),[paused,setPaused]=useState(false),[userPaused,setUserPaused]=useState(false);
  const actions=useRef<{text(value:string):Promise<void>;chord(codes:string[]):Promise<void>}|undefined>(undefined);
  const session=view.sessions.find(s=>s.source?.helper.identity===track.participant.identity&&s.source.helper.sid===track.participant.sid&&s.source.videoTrackSid===track.publication?.trackSid&&s.grant?.controller.identity===room.localParticipant.identity&&s.grant.controller.sid===room.localParticipant.sid&&s.grant.phase==='active');
  const held=useRef({grant:'',keys:new Set<string>(),buttons:new Set<0|1|2>()});
  if(session?.grant?.id&&held.current.grant!==session.grant.id)held.current={grant:session.grant.id,keys:new Set(),buttons:new Set()};
  const active=!!session&&view.ready&&!userPaused&&session.source?.inputStatus?.state!=='paused';
  useEffect(()=>setUserPaused(false),[session?.grant?.id]);
  useEffect(()=>{const keyUp=(event:KeyboardEvent)=>held.current.keys.delete(event.code),pointerUp=(event:PointerEvent)=>held.current.buttons.delete(event.button as 0|1|2);window.addEventListener('keyup',keyUp);window.addEventListener('pointerup',pointerUp);return()=>{window.removeEventListener('keyup',keyUp);window.removeEventListener('pointerup',pointerUp);};},[session?.grant?.id]);
  useEffect(()=>{
    const shell=ref.current;if(!shell||!session||!active)return;
    const id=session.id,heldKeys=held.current.keys,heldButtons=held.current.buttons;let disposed=false,focus=false,moveBarrier=remotePcInputSequences(room,session.grant!.id).move,key:CryptoKey|undefined,keyValue='';
    const credential=()=>remotePcCredential(room,id);
    const current=()=>!disposed&&focus&&!document.hidden&&document.activeElement===shell&&!!credential()&&!!track.publication?.track&&!track.publication.isMuted&&track.publication.track.mediaStreamTrack.readyState==='live';
    const send=async(payload:RemotePcBrowserInput,lane:'move'|'reliable',seq:number,deadline:number)=>{
      const grant=credential();if(!grant)return;
      if(payload.type==='button')moveBarrier=payload.moveBarrier||moveBarrier;
      let event:RemotePcInputEvent;
      if(payload.type==='button'){const {moveBarrier:_,...rest}=payload;event={...rest,button:rest.button==='left'?0:rest.button==='middle'?1:2};}
      else if(payload.type==='key')event={...payload,repeat:false};
      else event=payload;
      if(event.type==='move'||event.type==='button'||event.type==='wheel')event={...event,x:Math.round(event.x*65535),y:Math.round(event.y*65535)};
      if(event.type==='wheel')event={...event,deltaX:Math.round(event.deltaX),deltaY:Math.round(event.deltaY)};
      if(keyValue!==grant.inputKey){const bytes=Uint8Array.from(atob(grant.inputKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);keyValue=grant.inputKey;}
      const unsigned:RemotePcUnsignedInput={v:1,sessionId:grant.sessionId,generation:grant.generation,captureId:grant.captureId,grantId:grant.grantId,revision:grant.revision,geometryRevision:grant.geometryRevision,lane,seq,expiresAt:Math.min(deadline+remotePcServerTime(room)-Date.now(),grant.expiresAt),moveBarrier,event};
      const signature=await crypto.subtle.sign('HMAC',key!,new TextEncoder().encode(remotePcInputMacPayload(unsigned)));
      // Revalidate after asynchronous crypto; a replaced grant never gets late input.
      if(disposed||credential()?.grantId!==grant.grantId)return;if(unsigned.expiresAt<=remotePcServerTime(room))throw new Error('Remote PC input expired');
      const mac=btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({...unsigned,mac})),{reliable:lane==='reliable',topic:lane==='move'?REMOTE_PC_MOVE_TOPIC:REMOTE_PC_RELIABLE_TOPIC,destinationIdentities:[grant.helper.identity]});
    };
    const sender=createRemotePcInputSender({sequences:remotePcInputSequences(room,session.grant!.id),current:()=>!disposed&&!!credential(),send});
    const release=()=>{focus=false;setFocused(false);void sender.release().catch(()=>setPaused(true));};
    const rearm=async()=>{if(heldKeys.size||heldButtons.size||!credential())throw new Error('Release keys and buttons before resuming');shell.focus({preventScroll:true});focus=true;setFocused(true);await sender.reliable({type:'heartbeat',pressedKeys:[],pressedButtons:[]});};
    actions.current={async text(value){if(!value||value.length>256||value.includes('\0'))return;await rearm();await sender.reliable({type:'text',text:value});},async chord(codes){await rearm();for(const code of codes)await sender.reliable({type:'key',code,down:true});for(const code of [...codes].reverse())await sender.reliable({type:'key',code,down:false});}};
    const point=(event:{clientX:number;clientY:number})=>{const video=shell.querySelector('video');if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight||video.paused||video.ended)return;const css=getComputedStyle(video);return remotePcVideoPoint(video.getBoundingClientRect(),video.videoWidth,video.videoHeight,event.clientX,event.clientY,css.objectFit,css.objectPosition);};
    const pointer=(event:PointerEvent)=>{
      if(event.target!==shell.querySelector('video')&&!shell.hasPointerCapture?.(event.pointerId))return;
      if(event.type==='pointerup')heldButtons.delete(event.button as 0|1|2);
      const p=point(event);if(!p){if(event.type==='pointerup')release();return;}
      if(event.type==='pointerdown'){if(event.ctrlKey||event.altKey||event.metaKey||event.shiftKey){setPaused(true);return;}shell.focus({preventScroll:true});focus=true;setFocused(true);setPaused(heldKeys.size>0||heldButtons.size>0);void sender.reliable({type:'heartbeat',pressedKeys:[...heldKeys],pressedButtons:[...heldButtons]}).catch(release);shell.setPointerCapture?.(event.pointerId);}
      if(!current())return;event.preventDefault();event.stopPropagation();
      if(session.source?.inputStatus?.pointerReady===false){setPaused(true);return;}
      if(event.type==='pointermove')sender.move(p);
      else if(event.button>=0&&event.button<=2){const button=event.button as 0|1|2,down=event.type==='pointerdown';if(down)heldButtons.add(button);else heldButtons.delete(button);void sender.reliable({type:'button',button:button===0?'left':button===1?'middle':'right',down,...p}).catch(()=>{setPaused(true);release();});}
    };
    const keyEvent=(event:KeyboardEvent)=>{
      const matchingKeyUp=event.type==='keyup'&&heldKeys.has(event.code);
      if(event.type==='keyup')heldKeys.delete(event.code);
      if(!current()||event.target!==shell||event.isComposing||event.key==='Process'||event.key==='Dead')return;
      event.preventDefault();event.stopPropagation();
      if(matchingKeyUp){void sender.reliable({type:'key',code:event.code,down:false}).catch(release);return;}
      if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){if(event.type==='keydown')void sender.reliable({type:'text',text:event.key}).catch(release);return;}
      if(event.repeat)return;const down=event.type==='keydown';if(down)heldKeys.add(event.code);else heldKeys.delete(event.code);void sender.reliable({type:'key',code:event.code,down}).catch(release);
    };
    const wheel=(event:WheelEvent)=>{if(session.source?.inputStatus?.pointerReady===false||!current()||event.target!==shell.querySelector('video'))return;const p=point(event);if(!p)return;event.preventDefault();event.stopPropagation();const factor=event.deltaMode===1?16:event.deltaMode===2?shell.clientHeight:1;void sender.reliable({type:'wheel',...p,deltaX:Math.max(-4096,Math.min(4096,event.deltaX*factor)),deltaY:Math.max(-4096,Math.min(4096,event.deltaY*factor))}).catch(release);};
    const context=(event:Event)=>{if(current())event.preventDefault();};
    const hidden=()=>{if(document.hidden)release();};
    shell.addEventListener('pointerdown',pointer);shell.addEventListener('pointerup',pointer);shell.addEventListener('pointermove',pointer);shell.addEventListener('pointercancel',release);shell.addEventListener('lostpointercapture',release);shell.addEventListener('keydown',keyEvent);shell.addEventListener('keyup',keyEvent);shell.addEventListener('blur',release);shell.addEventListener('wheel',wheel,{passive:false});shell.addEventListener('contextmenu',context);window.addEventListener('blur',release);document.addEventListener('visibilitychange',hidden);
    const heartbeat=window.setInterval(()=>{if(current())void sender.reliable({type:'heartbeat',pressedKeys:[...heldKeys],pressedButtons:[...heldButtons]}).catch(release);},200);
    return()=>{actions.current=undefined;release();void sender.flush().finally(()=>{disposed=true;sender.dispose();});window.clearInterval(heartbeat);shell.removeEventListener('pointerdown',pointer);shell.removeEventListener('pointerup',pointer);shell.removeEventListener('pointermove',pointer);shell.removeEventListener('pointercancel',release);shell.removeEventListener('lostpointercapture',release);shell.removeEventListener('keydown',keyEvent);shell.removeEventListener('keyup',keyEvent);shell.removeEventListener('blur',release);shell.removeEventListener('wheel',wheel);shell.removeEventListener('contextmenu',context);window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',hidden);};
  },[room,ref,session?.id,session?.grant?.id,session?.source?.inputStatus?.pointerReady,active,track.publication]);
  return {available:!!session,active,focused,paused,userPaused,stop:()=>setUserPaused(true),resume:()=>setUserPaused(false),text:(value:string)=>actions.current?.text(value),chord:(codes:string[])=>actions.current?.chord(codes)};
}
