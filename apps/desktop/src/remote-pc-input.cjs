'use strict';
// Main-process only. Callers verify server lease responses and LiveKit sender/MAC before
// entering this adapter. The publisher renderer is never an authority for these methods.
const fs=require('node:fs'),path=require('node:path'),{spawn:spawnProcess}=require('node:child_process'),{performance}=require('node:perf_hooks');
const MAX_LINE=16384,MAX_LEASE_MS=750;
const codes=new Set(['REMOTE_INPUT_UNAVAILABLE','REMOTE_INPUT_PROTOCOL','REMOTE_INPUT_SOURCE','REMOTE_INPUT_GEOMETRY','REMOTE_INPUT_LEASE','REMOTE_INPUT_REPLAY','REMOTE_INPUT_EVENT','REMOTE_INPUT_OCCLUDED','REMOTE_INPUT_DESKTOP','REMOTE_INPUT_STOPPED']);
function failure(code){const e=Error('Remote input unavailable.');e.code=codes.has(code)?code:'REMOTE_INPUT_UNAVAILABLE';return e;}
const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const token=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const keyCode=s=>typeof s==='string'&&/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Arrow(Left|Right|Up|Down)|Enter|Tab|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Escape|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/.test(s);
function eventValid(e,lane){
 if(!e||typeof e!=='object'||Array.isArray(e))return false;
 const point=()=>int(e.x,0,65535)&&int(e.y,0,65535);
 if(lane==='move')return e.type==='move'&&point()&&Object.keys(e).length===3;
 if(e.type==='button')return point()&&int(e.button,0,2)&&typeof e.down==='boolean'&&Object.keys(e).length===5;
 if(e.type==='wheel')return point()&&int(e.deltaX,-12000,12000)&&int(e.deltaY,-12000,12000)&&Object.keys(e).length===5;
 if(e.type==='key')return keyCode(e.code)&&typeof e.down==='boolean'&&typeof e.repeat==='boolean'&&Object.keys(e).length===4;
 if(e.type==='heartbeat')return Object.keys(e).length===3&&Array.isArray(e.pressedKeys)&&e.pressedKeys.length<=32&&e.pressedKeys.every(keyCode)&&new Set(e.pressedKeys).size===e.pressedKeys.length&&Array.isArray(e.pressedButtons)&&e.pressedButtons.length<=3&&e.pressedButtons.every(b=>int(b,0,2))&&new Set(e.pressedButtons).size===e.pressedButtons.length;
 if(e.type==='text')return typeof e.text==='string'&&e.text.length>0&&e.text.length<=256&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(e.text)&&Object.keys(e).length===2;
 return e.type==='releaseAll'&&Object.keys(e).length===1;
}
function createRemotePcInputController({resourcesPath,platform=process.platform,spawn=spawnProcess,now,onState=()=>{}}={}){
 const epoch=Date.now(),mono=performance.now(),clock=now||(()=>epoch+performance.now()-mono);
 let child=null,capture=null,state=null,grant=null,authority=null,bindingSnapshot=null,lastRevision=0,id=0,buffer='',closed=true,stopping=false,seq={move:0,reliable:0},barrier=0,receiverPaused=true,resetSerial=0,heldKeys=new Set(),heldButtons=new Set();
 const pending=new Map();
 function notify(){try{onState(state?structuredClone(state):null);}catch{}}
 function close(code='REMOTE_INPUT_STOPPED'){
  closed=true;grant=null;authority=null;
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(failure(code));}pending.clear();
  if(child){const current=child;child=null;current.stdin?.end();const timer=setTimeout(()=>{if(!current.killed)current.kill();},150);timer.unref?.();}
  if(state){state={...state,active:false,error:code};notify();}
 }
 function acceptState(s){
  if(!s||s.captureId!==capture||!s.geometry||!int(s.geometry.width,1,32768)||!int(s.geometry.height,1,32768)||!int(s.geometry.revision,1)||typeof s.ready!=='boolean'||typeof s.active!=='boolean')throw failure('REMOTE_INPUT_PROTOCOL');
  if(state&&s.geometry.revision<state.geometry.revision)throw failure('REMOTE_INPUT_PROTOCOL');
  if(state&&s.geometry.revision!==state.geometry.revision)grant=null;
  state={captureId:capture,geometry:{width:s.geometry.width,height:s.geometry.height,revision:s.geometry.revision},ready:s.ready,active:s.active,
   pointerReady:s.pointerReady===true,needsEmptyReset:s.needsEmptyReset===true,error:codes.has(s.error)?s.error:null};
  if(s.rect&&int(s.rect.x,-100000,100000)&&int(s.rect.y,-100000,100000)&&int(s.rect.width,1,32768)&&int(s.rect.height,1,32768))state.rect={x:s.rect.x,y:s.rect.y,width:s.rect.width,height:s.rect.height};
  if(!s.ready)grant=null;
  if(s.needsEmptyReset){receiverPaused=true;resetSerial=Math.max(resetSerial,authority?.leaseSerial??0);heldKeys.clear();heldButtons.clear();}
  notify();
 }
 function request(op,data={}){
  if(!child||closed)return Promise.reject(failure('REMOTE_INPUT_STOPPED'));
  if(pending.size>=64){close('REMOTE_INPUT_PROTOCOL');return Promise.reject(failure('REMOTE_INPUT_PROTOCOL'));}
  const requestId=++id,line=JSON.stringify({id:requestId,op,...data})+'\n';
  if(Buffer.byteLength(line)>MAX_LINE)return Promise.reject(failure('REMOTE_INPUT_PROTOCOL'));
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{close('REMOTE_INPUT_UNAVAILABLE');},1000);timer.unref?.();pending.set(requestId,{resolve,reject,timer});
   try{if(!child.stdin.write(line))close('REMOTE_INPUT_UNAVAILABLE');}catch{close('REMOTE_INPUT_UNAVAILABLE');}
  });
 }
 function proofValid(p,activation){
  if(closed||stopping||!state?.ready||!p||!token(p.grantId)||!int(p.revision,1)||!int(p.leaseSerial,1)||p.captureId!==capture||p.geometryRevision!==state.geometry.revision||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=clock()||p.expiresAt>clock()+MAX_LEASE_MS)throw failure('REMOTE_INPUT_LEASE');
  if(activation){if(p.revision<=lastRevision)throw failure('REMOTE_INPUT_LEASE');}
  else if(!authority||p.grantId!==authority.grantId||p.revision!==authority.revision||p.leaseSerial<=authority.leaseSerial)throw failure('REMOTE_INPUT_LEASE');
 }
 async function lease(p,activation){
  proofValid(p,activation);
  const selected={grantId:p.grantId,revision:p.revision,leaseSerial:p.leaseSerial,captureId:p.captureId,geometryRevision:p.geometryRevision,expiresAt:p.expiresAt};
  // Update authority before awaiting so concurrent packets cannot race an old grant.
  if(activation){grant=null;lastRevision=p.revision;seq={move:0,reliable:0};barrier=0;receiverPaused=true;resetSerial=p.leaseSerial-1;heldKeys.clear();heldButtons.clear();}
  const current=child;await request('renew',{...selected,activate:activation});
  if(child!==current||closed||stopping||!state?.ready||p.geometryRevision!==state.geometry.revision||p.revision!==lastRevision||p.expiresAt<=clock()||(authority?.revision===p.revision&&authority.leaseSerial>=p.leaseSerial))throw failure('REMOTE_INPUT_LEASE');
  authority=selected;grant=selected;return structuredClone(state);
 }
 return {
  async bind(binding){
   if(child||!closed)throw failure('REMOTE_INPUT_SOURCE');
   const s=binding?.source,v=binding?.video,m=binding?.mapping;
   const rect=s?.rect;
   const validSource=s?.kind==='window'?typeof s.hwnd==='string'&&/^[1-9][0-9]{0,18}$/.test(s.hwnd)&&BigInt(s.hwnd)<=9223372036854775807n:
    s?.kind==='screen'&&rect&&int(rect.x,-100000,100000)&&int(rect.y,-100000,100000)&&int(rect.width,1,32768)&&int(rect.height,1,32768);
   if(!token(binding?.captureId)||!validSource||!int(v?.width,1,32768)||!int(v?.height,1,32768)||m?.kind!==(s.kind==='window'?'dwm-frame':'win32-monitor'))throw failure('REMOTE_INPUT_SOURCE');
   if(platform!=='win32')throw failure('REMOTE_INPUT_UNAVAILABLE');
   const executable=path.join(resourcesPath,'remote-input','CastLink.RemoteInput.exe');
   if(!fs.existsSync(executable)||!fs.lstatSync(executable).isFile())throw failure('REMOTE_INPUT_UNAVAILABLE');
   capture=binding.captureId;bindingSnapshot=structuredClone(binding);state=null;grant=null;authority=null;closed=false;stopping=false;buffer='';lastRevision=0;seq={move:0,reliable:0};barrier=0;
   try{child=spawn(executable,[],{shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true});}catch{close('REMOTE_INPUT_UNAVAILABLE');throw failure('REMOTE_INPUT_UNAVAILABLE');}
   const current=child;
   child.once('error',()=>{if(child===current)close('REMOTE_INPUT_UNAVAILABLE');});child.once('exit',()=>{if(child===current)close('REMOTE_INPUT_STOPPED');});
   child.stdin.on('error',()=>{if(child===current)close('REMOTE_INPUT_UNAVAILABLE');});child.stderr.on('data',()=>{});
   child.stdout.on('data',chunk=>{
    if(child!==current||closed)return;
    buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>MAX_LINE*2){close('REMOTE_INPUT_PROTOCOL');return;}
    while(buffer.includes('\n')&&!closed){
     const split=buffer.indexOf('\n'),line=buffer.slice(0,split);buffer=buffer.slice(split+1);
     try{
      if(Buffer.byteLength(line)>MAX_LINE)throw failure('REMOTE_INPUT_PROTOCOL');const reply=JSON.parse(line);
      if(reply.event==='state'){acceptState(reply.state);continue;}
      if(!int(reply.id,1)||!pending.has(reply.id)||typeof reply.ok!=='boolean')throw failure('REMOTE_INPUT_PROTOCOL');
      const p=pending.get(reply.id);pending.delete(reply.id);clearTimeout(p.timer);
      if(reply.ok){try{if(reply.state)acceptState(reply.state);p.resolve(reply.state);}catch(e){p.reject(e);throw e;}}
      else{try{if(reply.state)acceptState(reply.state);}catch(e){p.reject(e);throw e;}p.reject(failure(reply.error));grant=null;}
     }catch{close('REMOTE_INPUT_PROTOCOL');}
    }
   });
   return request('start',{captureId:capture,source:structuredClone(s),video:{width:v.width,height:v.height},mapping:{kind:m.kind}});
  },
  geometry(update){if(!update)return state?structuredClone(state.geometry):null;const v=update.video;if(!bindingSnapshot||!int(v?.width,1,32768)||!int(v?.height,1,32768))return Promise.reject(failure('REMOTE_INPUT_GEOMETRY'));grant=null;bindingSnapshot.video={width:v.width,height:v.height};return request('start',bindingSnapshot);},
  activate:p=>lease(p,true),renew:p=>lease(p,false),
  async input(f){
   if(closed||!grant||grant.expiresAt<=clock())throw failure('REMOTE_INPUT_LEASE');
   if(f?.captureId===capture&&f.grantId===grant.grantId&&f.revision===grant.revision&&f.geometryRevision===state.geometry.revision&&f.lane==='reliable'&&int(f.expiresAt,1)&&f.expiresAt<=clock()){receiverPaused=true;resetSerial=authority.leaseSerial;heldKeys.clear();heldButtons.clear();await request('releaseAll');throw failure('REMOTE_INPUT_LEASE');}
   if(!f||f.captureId!==capture||f.grantId!==grant.grantId||f.revision!==grant.revision||f.geometryRevision!==state.geometry.revision||!int(f.expiresAt,1)||f.expiresAt<=clock()||f.expiresAt>clock()+MAX_LEASE_MS)throw failure('REMOTE_INPUT_LEASE');
   if(!['move','reliable'].includes(f.lane)||!int(f.seq,1)||!int(f.moveBarrier)||!eventValid(f.event,f.lane))throw failure('REMOTE_INPUT_EVENT');
   if(f.seq<=seq[f.lane]||(f.lane==='move'&&f.seq<=barrier))throw failure('REMOTE_INPUT_REPLAY');
   const emptyHeartbeat=f.event.type==='heartbeat'&&f.event.pressedKeys.length===0&&f.event.pressedButtons.length===0;
   if(f.lane==='reliable'&&(receiverPaused||f.seq!==seq.reliable+1)){if(!receiverPaused){receiverPaused=true;resetSerial=authority.leaseSerial;heldKeys.clear();heldButtons.clear();await request('releaseAll');}if(!emptyHeartbeat||authority.leaseSerial<=resetSerial)throw failure('REMOTE_INPUT_REPLAY');}
   if(f.event.type==='heartbeat'&&(!f.event.pressedKeys.every(k=>heldKeys.has(k))||f.event.pressedKeys.length!==heldKeys.size||!f.event.pressedButtons.every(b=>heldButtons.has(b))||f.event.pressedButtons.length!==heldButtons.size)){receiverPaused=true;resetSerial=authority.leaseSerial;heldKeys.clear();heldButtons.clear();await request('releaseAll');throw failure('REMOTE_INPUT_REPLAY');}
   if(emptyHeartbeat)receiverPaused=false;
   if(receiverPaused)throw failure('REMOTE_INPUT_REPLAY');
   seq[f.lane]=f.seq;if(f.lane==='reliable'&&['button','wheel'].includes(f.event.type))barrier=Math.max(barrier,f.moveBarrier);
   if(f.event.type==='key'){if(f.event.down)heldKeys.add(f.event.code);else heldKeys.delete(f.event.code);}
   if(f.event.type==='button'){if(f.event.down)heldButtons.add(f.event.button);else heldButtons.delete(f.event.button);}
   if(f.event.type==='releaseAll'){receiverPaused=true;resetSerial=authority.leaseSerial;heldKeys.clear();heldButtons.clear();}
   return request('input',{captureId:capture,grantId:grant.grantId,revision:grant.revision,geometryRevision:f.geometryRevision,lane:f.lane,seq:f.seq,expiresAt:f.expiresAt,moveBarrier:f.moveBarrier,event:structuredClone(f.event)});
  },
  releaseAll(){receiverPaused=true;resetSerial=authority?.leaseSerial??0;heldKeys.clear();heldButtons.clear();return closed?Promise.resolve():request('releaseAll');},
  async stop(){
   if(closed||stopping)return;grant=null;stopping=true;
   const promise=request('stop');
   // Native processes all preceding input then stop; no further input can enter.
   try{await promise;}finally{close();}
  },
 };
}
module.exports={createRemotePcInputController};
