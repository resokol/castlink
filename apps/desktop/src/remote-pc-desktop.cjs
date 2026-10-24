'use strict';
// Main owns target selection, endpoint, pairing credentials and native leases.
const fs=require('node:fs'),path=require('node:path');
const {isClientEvent}=require('./ipc-policy.cjs');
const {createRemoteSession}=require('./remote-pc-session.cjs');
const {createRemotePcInputController}=require('./remote-pc-input.cjs');
const RESOURCE='CastLink.RemoteInput/full-input-pause/2';
const exact=(v,required,optional=[])=>v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const id=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const dim=v=>Number.isSafeInteger(v)&&v>0&&v<=32768;
const sid=v=>typeof v==='string'&&/^PA_[A-Za-z0-9]+$/.test(v);
const track=v=>typeof v==='string'&&/^TR_[A-Za-z0-9]+$/.test(v);
function nativeResourceAvailable(resourcesPath,platform=process.platform){
 if(platform!=='win32')return false;
 try{const file=path.join(resourcesPath,'remote-input/CastLink.RemoteInput.exe');return fs.lstatSync(file).isFile()&&fs.readFileSync(file).includes(Buffer.from(RESOURCE,'utf16le'));}catch{return false;}
}
function validToolbar(v,now=Date.now()){
 const person=p=>exact(p,['identity','sid','name'])&&id(p.identity)&&sid(p.sid)&&typeof p.name==='string'&&p.name.length<=180&&!/[\u0000-\u001f\u007f]/.test(p.name);
 return exact(v,['captureId','sessionId','generation','revision','sequence','expiresAt','locale','participants','requests','status','busy'],['controller','error'])&&['captureId','sessionId','generation'].every(k=>id(v[k]))&&Number.isSafeInteger(v.revision)&&v.revision>0&&Number.isSafeInteger(v.sequence)&&v.sequence>0&&Number.isSafeInteger(v.expiresAt)&&v.expiresAt>now&&v.expiresAt<=now+30000&&['ru','en','zh-CN'].includes(v.locale)&&['ready','paused'].includes(v.status)&&typeof v.busy==='boolean'&&(v.error===undefined||typeof v.error==='string'&&v.error.length<=240)&&(v.controller===undefined||person(v.controller))&&Array.isArray(v.participants)&&v.participants.length<=250&&v.participants.every(person)&&new Set(v.participants.map(p=>p.sid)).size===v.participants.length&&Array.isArray(v.requests)&&v.requests.length<=16&&v.requests.every(r=>exact(r,['id','requester','expiresAt'])&&id(r.id)&&person(r.requester)&&Number.isSafeInteger(r.expiresAt)&&r.expiresAt>now&&r.expiresAt<=now+30000)&&new Set(v.requests.map(r=>r.id)).size===v.requests.length;
}
function createRemotePcDesktop({client,ipcMain,trustedOrigins,resourcesPath,getSharedSource,platform=process.platform,supported=()=>nativeResourceAvailable(resourcesPath,platform),post,createSession=createRemoteSession,createInput=createRemotePcInputController,schedule=setInterval,cancel=clearInterval,toolbar,now=Date.now}){
 let current,capture,epoch=0,disposed=false,cleanup=Promise.resolve();
 const send=(channel,value)=>{if(!client.isDestroyed())client.webContents.send('castlink:remote-control-'+channel,value);};
 function retire(own){if(!own)return Promise.resolve();cancel(own.timer);own.closed=true;if(own.scope)toolbar?.clearRemoteControl?.(own.scope);return own.session.stop().catch(()=>{});}
 function reset(){epoch++;const old=current;current=undefined;cleanup=Promise.all([cleanup,retire(old)]).then(()=>{});return cleanup;}
 const trusted=event=>!disposed&&isClientEvent(event,client,trustedOrigins);
 function bound(event,v,fields,optional=[]){if(!trusted(event)||!exact(v,fields,optional)||!current||current.closed||v.captureId!==current.captureId||getSharedSource()!==current.shared)throw Error('Denied');return current;}
 function scope(own,v){return own.scope&&own.scope.sessionId===v.sessionId&&own.scope.generation===v.generation;}
 // Capture lifetime is independent of a server control registration. Bind once
 // inside the existing picker callback; never resolve a stale HWND at attach.
 async function releaseCapture(id){
  if(id!==undefined&&capture?.id!==id)return;
  const selected=capture;capture=undefined;await reset();if(selected){selected.terminal=true;await selected.ready;await selected.input?.stop().catch(()=>{});}
 }
 async function selectCapture(shared){
  const previous=releaseCapture();
  const selected={id:shared.id,target:shared.target,terminal:false,bound:false};capture=selected;
  selected.ready=(async()=>{
   await previous;if(disposed||capture!==selected||!supported()||!shared.target){selected.terminal=true;return;}
   selected.input=createInput({resourcesPath,onState:value=>{
    if(capture!==selected||!value)return;
    selected.observed=value;
    const terminal=value.stopped||['REMOTE_INPUT_STOPPED','REMOTE_INPUT_UNAVAILABLE','REMOTE_INPUT_PROTOCOL'].includes(value.error);
    if(terminal)selected.terminal=true;
    if(current?.capture===selected){send('state',{...current.scope,captureId:selected.id,state:terminal?'stopped':value.ready&&value.pointerReady?'ready':'paused',pointerReady:!terminal&&value.pointerReady===true,...(terminal?{reason:'native-unavailable'}:{})});if(terminal)void reset();}
   }});
   try{await selected.input.bind({captureId:shared.id,source:shared.target,video:{width:1,height:1},mapping:{kind:shared.target.kind==='window'?'dwm-frame':'win32-monitor'},fullInputPause:true});selected.bound=true;}catch{selected.terminal=true;}
   if(capture!==selected){selected.terminal=true;await selected.input.stop().catch(()=>{});}
  })();await selected.ready;
 }
 const handlers={
  capabilities(event){if(!trusted(event))throw Error('Denied');const available=supported()&&(!capture||!capture.terminal);return {version:1,supported:available,publicationMode:'client-owned',fullInputPause:true,resourceVersion:2,...(!available?{reason:platform==='win32'?'NATIVE_UNAVAILABLE':'PLATFORM'}:{})};},
  async attach(event,v){
   if(!trusted(event)||!exact(v,['ticket','captureId','ownerSid','videoTrackSid','width','height'],['audioTrackSid'])||!/^rp1_[A-Za-z0-9_-]{43}$/.test(v.ticket)||!id(v.captureId)||!sid(v.ownerSid)||!track(v.videoTrackSid)||v.audioTrackSid!==undefined&&!track(v.audioTrackSid)||!dim(v.width)||!dim(v.height)||!supported())throw Error('Denied');
   const shared=getSharedSource(),selected=capture;if(!shared?.ready||shared.id!==v.captureId||!shared.target||selected?.id!==shared.id||selected.target!==shared.target)throw Error('Denied');
   await selected.ready;if(selected.terminal||!selected.bound||capture!==selected)throw Error('Native unavailable');
   const frame=event.senderFrame,url=frame.url;const previous=reset(),ticket=epoch;await previous;
   if(ticket!==epoch||!trusted(event)||event.senderFrame!==frame||frame.url!==url||getSharedSource()!==shared)throw Error('Stale attach');
   const own={captureId:v.captureId,capture:selected,shared,width:v.width,height:v.height,closed:false};current=own;
   const active=()=>current===own&&!own.closed&&epoch===ticket&&trusted(event)&&frame.url===url&&getSharedSource()===shared;
   const raw=selected.input;
   const input={
    bind:binding=>{if(capture!==selected||selected.terminal||binding.captureId!==selected.id)throw Error('Native unavailable');return raw.geometry({video:binding.video});},
    geometry:value=>raw.geometry(value),activate:value=>raw.activate(value),renew:value=>raw.renew(value),input:value=>raw.input(value),releaseAll:()=>raw.releaseAll(),
    stop:async()=>{if(!selected.terminal)await raw.retireAuthority();else await raw.releaseAll().catch(()=>{});},
   };
   const endpoint=new URL('/api/remote-pc-control',new URL(url).origin).href;
   const request=post?((body,token)=>post(body,token,endpoint)):async(body,token)=>{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(body.action==='native-lease'?650:5000)});
    if(!response.ok)throw Error('Remote request rejected');return require('./remote-pc-helper.cjs').boundedResponse(response);
   };
   own.session=createSession({post:request,input,publicationMode:'client-owned',authorityLossMs:30000,state:value=>{if(active()){send('state',{...own.scope,captureId:own.captureId,...value});if(value.state==='stopped')void reset();}}});
   try{
    const paired=await own.session.pair(v.ticket);if(!active())throw Error('Stale attach');
    if(paired.context.owner.sid!==v.ownerSid)throw Error('Denied');
    own.scope={captureId:v.captureId,sessionId:paired.context.sessionId,generation:paired.context.generation};
    await own.session.captured({captureId:v.captureId,sourceKind:shared.target.kind,name:(shared.name||'Screen').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,180),width:v.width,height:v.height,target:shared.target,audio:!!v.audioTrackSid});if(!active())throw Error('Stale attach');
    await own.session.published({captureId:v.captureId,helperSid:v.ownerSid,videoTrackSid:v.videoTrackSid,...(v.audioTrackSid?{audioTrackSid:v.audioTrackSid}:{})});if(!active())throw Error('Stale attach');
    own.timer=schedule(()=>{if(!active()){if(current===own)void reset();return;}void own.session.lease();if(selected.observed)void own.session.observedState(selected.observed).catch(()=>{});},200);own.timer?.unref?.();void own.session.lease();return {...own.scope};
   }catch(error){if(current===own)await reset();else await retire(own);throw Error(error.message==='Denied'?'Denied':'Stale attach');}
  },
  geometry(event,v){const own=bound(event,v,['captureId','width','height']);if(!dim(v.width)||!dim(v.height))throw Error('Denied');if(v.width===own.width&&v.height===own.height)return;own.width=v.width;own.height=v.height;return own.session.geometry(v);},
  receive(event,v){const own=bound(event,v,['captureId','senderSid','topic','bytes']);if(!sid(v.senderSid)||!['castlink.remote-pc.input.v1','castlink.remote-pc.move.v1'].includes(v.topic)||!(v.bytes instanceof Uint8Array)||v.bytes.byteLength>8192)throw Error('Denied');return own.session.receive(v);},
  stop(event,v){const own=bound(event,v,['captureId','sessionId','generation','reason']);if(!scope(own,v)||!['finish','capture-ended','source-changed','disconnect','authority-lost','attach-stale','dispose','error'].includes(v.reason))throw Error('Denied');return reset();},
  updateToolbar(event,v){const own=bound(event,v,['captureId','sessionId','generation','revision','sequence','expiresAt','locale','participants','requests','status','busy'],['controller','error']);if(!scope(own,v)||!validToolbar(v,now())||v.sequence<=(own.toolbar?.sequence||0)||v.revision<(own.toolbar?.revision||0))throw Error('Denied');own.toolbar=structuredClone(v);toolbar?.updateRemoteControl?.(own.toolbar,intent);return true;},
 };
 function intent(value){const own=current,v=own?.toolbar;if(!v||own.closed||getSharedSource()!==own.shared||v.expiresAt<=now()||v.busy||!exact(value,['captureId','sessionId','generation','revision','sequence','action'],['participant','requestId','decision'])||!['captureId','sessionId','generation','revision','sequence'].every(k=>value[k]===v[k]))return false;
  if(value.action==='delegate'){if(!exact(value,['captureId','sessionId','generation','revision','sequence','action','participant'])||!exact(value.participant,['identity','sid'])||!v.participants.some(p=>p.identity===value.participant.identity&&p.sid===value.participant.sid))return false;}
  else if(value.action==='decide-request'){if(!exact(value,['captureId','sessionId','generation','revision','sequence','action','requestId','decision'])||!['approve','deny'].includes(value.decision)||!v.requests.some(r=>r.id===value.requestId&&r.expiresAt>now()))return false;}
  else if(value.action!=='revoke'||!exact(value,['captureId','sessionId','generation','revision','sequence','action'])||!v.controller)return false;
  send('intent',structuredClone(value));return true;
 }
 for(const [method,handler]of Object.entries(handlers))ipcMain.handle('castlink:remote-control-'+method,handler);
 return{reset,selectCapture,releaseCapture,intent,dispose(){disposed=true;void releaseCapture();for(const method of Object.keys(handlers))ipcMain.removeHandler('castlink:remote-control-'+method);}};
}
module.exports={createRemotePcDesktop,nativeResourceAvailable,validToolbar,RESOURCE};
