'use strict';
const {randomUUID}=require('node:crypto');
const {createInputGate}=require('./remote-pc-input-gate.cjs');
const PURPOSE='remote-pc-v1';
const integer=v=>Number.isSafeInteger(v)&&v>0;
function narrowPublisher(value){if(!value||typeof value.identity!=='string'||!value.identity||value.identity.length>200||typeof value.token!=='string'||!value.token||value.token.length>16384||typeof value.url!=='string')throw Error('Invalid publisher');const url=new URL(value.url);if(!['wss:','ws:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid publisher');return {identity:value.identity,token:value.token,url:value.url};}
/** Main-only native authority. Neither the publisher token nor its IPC can
 * select an input target, create a grant, or renew an input lease. */
function createRemoteSession({post,input,now=()=>performance.now(),wall=()=>Date.now(),state=()=>{},stopCapture=()=>{}}){
 let pair,source,selection,closed=false,busy=false,serial=0,requestSeq=0,geometryBusy=false,geometryQueue=Promise.resolve(),active,deadline=0,timer,activated=new Set();
 const gate=createInputGate({input:frame=>input.input(frame),releaseAll:()=>{void input.releaseAll().catch(()=>{});},now,wall});
 async function request(action,args={}){if(closed||!pair)throw Error('Remote PC stopped');return post({purpose:PURPOSE,action,nativeId:pair.nativeId,sessionId:pair.context.sessionId,generation:pair.context.generation,...args},pair.nativeToken);}
 function release(){gate.close();active=undefined;deadline=0;clearTimeout(timer);timer=undefined;return input.releaseAll();}
 async function stop(notify=true){if(closed)return;const saved=pair;closed=true;await release();await input.stop();await stopCapture();state({state:'stopped'});if(notify&&saved)try{await post({purpose:PURPOSE,action:'native-stop',nativeId:saved.nativeId,sessionId:saved.context.sessionId,generation:saved.context.generation,...(source?{captureId:source.captureId}:{})},saved.nativeToken);}catch{}}
 function queueGeometry(job){const next=geometryQueue.catch(()=>{}).then(async()=>{geometryBusy=true;try{return await job();}finally{geometryBusy=false;}});geometryQueue=next;return next;}
 function expiry(){if(closed)return;if(deadline&&now()>=deadline){void release();state({state:'paused',reason:'authority-expired'});}else if(deadline){timer=setTimeout(expiry,Math.max(1,deadline-now()));timer.unref?.();}}
 return {
  async pair(ticket){
   if(pair||closed)throw Error('Pair already consumed');
   const value=await post({purpose:PURPOSE,action:'pair',ticket});
   if(!value||!/^rn1_[A-Za-z0-9_-]{43}$/.test(value.nativeToken)||typeof value.nativeId!=='string'||value.context?.purpose!==PURPOSE||typeof value.context.sessionId!=='string'||typeof value.context.generation!=='string'||typeof value.publisher?.token!=='string'||typeof value.publisher?.identity!=='string'||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=value.serverTime)throw Error('Invalid pairing response');
   const publisher=narrowPublisher(value.publisher);
   pair={...value,publisher};return {publisher:{...publisher},context:{room:value.context.room,owner:{...value.context.owner}}};
  },
  async selected({captureId,sourceKind,target}){
   if(closed||!pair||selection||source)throw Error('Capture already selected');
   selection={captureId,sourceKind};
   try{await input.bind({captureId,source:target,video:{width:1,height:1},mapping:{kind:sourceKind==='window'?'dwm-frame':'win32-monitor'}});selection.bound=true;}catch{selection.bound=false;}
  },
  async captured({captureId,sourceKind,name,width,height,target,audio=false}){
   if(closed||!pair||source||!integer(width)||!integer(height)||width>32768||height>32768)throw Error('Invalid capture');
   // Rule chosen in main from the picker, never accepted from publisher IPC.
   let geometry,inputState='paused';
   try{if(selection){if(selection.captureId!==captureId||selection.sourceKind!==sourceKind||!selection.bound)throw Error('Capture identity unavailable');geometry=await input.geometry({video:{width,height}});}else geometry=await input.bind({captureId,source:target,video:{width,height},mapping:{kind:sourceKind==='window'?'dwm-frame':'win32-monitor'}});inputState=geometry?.ready?'ready':'paused';}catch{geometry=null;}
   const revision=integer(geometry?.geometry?.revision)?geometry.geometry.revision:1;
   source={captureId,sourceKind,name,width,height,revision,inputState,pointerReady:geometry?.pointerReady===true};
   const response=await request('native-source',{captureId,sourceKind,name,geometry:{width,height,revision},audio,inputStatus:{state:inputState,pointerReady:source.pointerReady,...(!source.pointerReady?{reason:geometry?'GEOMETRY_CHANGED':'NATIVE_UNAVAILABLE'}:{})}});
   let publisher;if(response?.publisher){publisher=narrowPublisher(response.publisher);if(publisher.identity!==pair.publisher.identity||publisher.url!==pair.publisher.url)throw Error('Publisher scope changed');}
   state({state:'sharing',inputState,pointerReady:source.pointerReady});return {revision,inputState,pointerReady:source.pointerReady,...(publisher?{publisher}:{})};
  },
  async published(value){if(!source||source.helperSid||value.captureId!==source.captureId)throw Error('Capture mismatch');const response=await request('native-published',value);source={...source,helperSid:value.helperSid,videoTrackSid:value.videoTrackSid};return response;},
  geometry({width,height}){
   return queueGeometry(async()=>{
    if(closed||!source||!integer(width)||!integer(height))throw Error('Invalid geometry');
    await release();const result=await input.geometry({video:{width,height}});if(!integer(result?.geometry?.revision))throw Error('Invalid native geometry');
    const next={...source,width,height,revision:result.geometry.revision,inputState:result.ready?'ready':'paused',pointerReady:result.pointerReady===true};
    await request('native-geometry',{captureId:source.captureId,geometry:{width,height,revision:next.revision},inputStatus:{state:next.inputState,pointerReady:next.pointerReady,...(!next.pointerReady?{reason:'GEOMETRY_CHANGED'}:{})}});source=next;state({state:'sharing',inputState:source.inputState,pointerReady:source.pointerReady});
   });
  },
  observedState(value){
   if(closed||geometryBusy||!source||!value?.geometry||!integer(value.geometry.revision))return Promise.resolve();
   return queueGeometry(async()=>{
    if(closed||source.revision>=value.geometry.revision)return;
    const next=value.ready?'ready':'paused';await release();
    await request('native-geometry',{captureId:source.captureId,geometry:{width:source.width,height:source.height,revision:value.geometry.revision},inputStatus:{state:next,pointerReady:value.pointerReady===true,...(!value.pointerReady?{reason:'GEOMETRY_CHANGED'}:{})}});
    source={...source,revision:value.geometry.revision,inputState:next,pointerReady:value.pointerReady===true};state({state:'sharing',inputState:next,pointerReady:source.pointerReady});
   });
  },
  async lease(){
   if(closed||!pair||!source||busy||geometryBusy)return;busy=true;
   const requestId=randomUUID(),seq=++requestSeq,started=now();
   try{
    const value=await request('native-lease',{requestId,requestSeq:seq});const received=now();
    if(closed)return;
    if(value.requestId!==requestId||value.requestSeq!==seq||!integer(value.leaseSerial)||value.leaseSerial<=serial||!integer(value.validForMs)||value.validForMs>750||!Number.isSafeInteger(value.serverTime)||value.session?.id!==pair.context.sessionId||value.session?.generation!==pair.context.generation||value.session.owner?.identity!==pair.context.owner.identity||value.session.owner?.sid!==pair.context.owner.sid)throw Error('Invalid authority response');
    serial=value.leaseSerial;
    if(value.session.pending){await release();const pending=value.session.pending;if(pending.action==='stop'){await input.stop();await stopCapture();}await request('native-revoked',{revision:pending.revision,leaseSerial:serial});if(pending.action==='stop')await stop(false);return;}
    if(value.session.phase==='stopped'||value.session.phase==='stopping'){await stop(false);return;}
    const grant=value.grant;
    if(!grant||source.inputState!=='ready'){await release();return;}
    const end=Math.min(started+value.validForMs,started+(grant.expiresAt-value.serverTime));
    if(end<=received||end-started>750||grant.captureId!==source.captureId||grant.geometryRevision!==source.revision||grant.sessionId!==pair.context.sessionId||grant.generation!==pair.context.generation||grant.helper?.identity!==pair.publisher.identity||grant.helper?.sid!==source.helperSid||value.session.source?.captureId!==source.captureId||value.session.source?.videoTrackSid!==source.videoTrackSid||value.session.source?.helper.sid!==grant.helper?.sid||value.session.grant?.id!==grant.grantId||value.session.grant?.controller.sid!==grant.controller?.sid||value.session.grant?.controller.identity!==grant.controller?.identity)throw Error('Stale input authority');
    if(active&&(active.grantId!==grant.grantId||active.revision!==grant.revision))await release();
    const proof={grantId:grant.grantId,revision:grant.revision,leaseSerial:serial,captureId:source.captureId,geometryRevision:source.revision,expiresAt:wall()+Math.floor(end-now())};
    if(!activated.has(grant.grantId)){await input.activate(proof);activated.add(grant.grantId);}else await input.renew(proof);
    if(closed||now()>=end){await release();return;}
    active=grant;deadline=end;clearTimeout(timer);timer=setTimeout(expiry,Math.max(1,end-now()));timer.unref?.();
    gate.authorize({...grant,leaseSerial:serial,deadline:end,serverTime:value.serverTime+(received-started),receivedAt:received});
    if(value.session.grant?.phase==='activating')await request('native-activated',{grantId:grant.grantId,revision:grant.revision,activationNonce:grant.activationNonce,leaseSerial:serial});
    state({state:'sharing',inputState:'ready',pointerReady:source.pointerReady});
   }catch{if(deadline&&now()>=deadline)await release();state({state:'paused',reason:'authority-unavailable'});}
   finally{busy=false;}
  },
  receive:value=>!closed&&gate.receive(value),
  stop,
 };
}
module.exports={createRemoteSession};
