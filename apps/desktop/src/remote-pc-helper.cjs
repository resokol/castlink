'use strict';
const path=require('node:path'),{randomUUID}=require('node:crypto');
const {parseRemoteLaunch,isRemoteLaunch}=require('./remote-pc-protocol.cjs');
const {createCaptureGate,bindSelectedSource,createRemotePicker}=require('./remote-pc-capture.cjs');
const {createRemoteSession}=require('./remote-pc-session.cjs');
const {helperEndpoint}=require('./presentation-helper.cjs');
const exact=(v,required,optional=[])=>v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
const dimension=v=>Number.isSafeInteger(v)&&v>=1&&v<=32768;
function trustedPublisher(event,window,pageUrl){return !!window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url===pageUrl;}
async function boundedResponse(response){
 if(Number(response.headers.get('content-length'))>65536)throw Error('Remote response too large');
 const reader=response.body?.getReader();if(!reader)throw Error('Remote response missing');let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('Remote response too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function runRemotePcHelper({app,BrowserWindow,ipcMain,session,desktopCapturer,screen,dialog,allowLoopback=false}){
 let receive,queued=process.argv.find(isRemoteLaunch),current,connecting=false,activeLaunch,pendingLaunch;
 const deliver=value=>{if(receive)void receive(value);else if(!queued)queued=value;};
 app.on('second-instance',(_event,argv)=>{const value=argv.find(isRemoteLaunch);if(value)deliver(value);});
 app.on('open-url',(event,value)=>{event.preventDefault();if(isRemoteLaunch(value))deliver(value);});
 await app.whenReady();
 function drainOrQuit(){
  if(current||connecting)return;
  if(pendingLaunch){const next=pendingLaunch;pendingLaunch=undefined;void receive(next);}
  else app.quit();
 }
 const resourcesPath=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../../artifacts/desktop-native');
 async function launch(link){
  const parsed=parseRemoteLaunch(link,{allowLoopback});
  if(current||connecting){
   if(current&&!current.window.isDestroyed()){current.window.show();current.window.focus();}
   // A new begin retires the previous server session. Keep only the latest
   // same-origin request, without granting it or disturbing the current picker.
   if(activeLaunch?.server===parsed.server&&activeLaunch.ticket!==parsed.ticket)pendingLaunch=link;
   return;
  }
  connecting=true;activeLaunch=parsed;let owner;
  try{
   const endpoint=helperEndpoint(parsed.server,allowLoopback).replace('/api/co-presentation-helper','/api/remote-pc-control'),pageUrl=parsed.server+'/remote-pc/publisher';
   const post=async(body,token)=>{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(body.action==='native-lease'?650:5000)});
    if(!response.ok)throw Error('Remote request rejected');return boundedResponse(response);
   };
   const partition=session.fromPartition('castlink-remote-'+randomUUID());
   const window=new BrowserWindow({width:620,height:270,minWidth:400,minHeight:230,title:'CastLink — демонстрация экрана',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'remote-pc-publisher-preload.cjs'),additionalArguments:['--castlink-role=remote-pc-publisher'],session:partition,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
   let choice,target,audio,captureId=randomUUID(),configResolve,configReject,leaseTimer,stopped=false,publisherMinimized=false,geometryTimer,lastObserved,captureStoppedResolve,captureStoppedPromise;
   const configReady=new Promise((resolve,reject)=>{configResolve=resolve;configReject=reject;});configReady.catch(()=>{});
   const captureGate=createCaptureGate({session:partition,window,pageUrl});
   const send=(name,value)=>{if(!window.isDestroyed())window.webContents.send('remote-pc:'+name,value);};
   const input=require('./remote-pc-input.cjs').createRemotePcInputController({resourcesPath,onState:value=>{if(value){lastObserved=value;if(value.stopped===true){void owner?.close();if(!window.isDestroyed())window.destroy();return;}send('state',{state:'sharing',inputState:value.ready?'ready':'paused',pointerReady:value.pointerReady===true,reason:value.error});}}});
   const helper=createRemoteSession({post,input,state:value=>{send('state',value);if(value.state==='stopped')void Promise.resolve().then(()=>owner?.close());},stopCapture:()=>{
    if(stopped){if(!window.isDestroyed())window.destroy();return Promise.resolve();}
    if(!captureStoppedPromise)captureStoppedPromise=new Promise(resolve=>{captureStoppedResolve=resolve;const timeout=setTimeout(()=>{if(!window.isDestroyed())window.destroy();resolve();},400);timeout.unref?.();});
    audio?.capture.stop();send('stop-capture');return captureStoppedPromise;
   }});
   const picker=createRemotePicker({BrowserWindow,ipcMain,parent:window,desktopCapturer,resourcesPath});
   let closePromise;
   const close=()=>{
    if(closePromise)return closePromise;if(stopped)return Promise.resolve();stopped=true;
    closePromise=(async()=>{
     try{
      clearInterval(leaseTimer);clearInterval(geometryTimer);
      try{captureGate.dispose();}finally{picker.dispose();}
      audio?.capture.stop();send('stop-capture');
      await helper.stop();
     }catch{/* Native watchdog still bounds an unavailable release/stop channel. */}
     finally{
      configReject(Error('Capture stopped'));captureStoppedResolve?.();
      for(const name of ['config','captured','geometry','published','data','capture-stopped','stop'])ipcMain.removeHandler('remote-pc:'+name);
      try{if(!window.isDestroyed())window.destroy();}
      finally{if(current===owner){current=undefined;activeLaunch=undefined;}drainOrQuit();}
     }
    })();return closePromise;
   };
   owner={window,close};current=owner;
   const trusted=event=>trustedPublisher(event,window,pageUrl)&&!stopped;
   const captureValue=(event,value,fields,optional=[])=>{if(!trusted(event)||!exact(value,fields,optional)||value.captureId!==captureId)throw Error('Denied');};
   ipcMain.handle('remote-pc:config',event=>{if(!trusted(event))throw Error('Denied');return configReady;});
   ipcMain.handle('remote-pc:captured',async(event,value)=>{
    captureValue(event,value,['captureId','width','height']);if(!dimension(value.width)||!dimension(value.height)||!target)throw Error('Denied');
    const result=await helper.captured({...value,sourceKind:target.kind,name:choice.source.name.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,180)||'Screen',target,audio:!!audio});
    geometryTimer=setInterval(()=>{if(lastObserved)void helper.observedState(lastObserved).catch(()=>{});},200);
    return result;
   });
   ipcMain.handle('remote-pc:geometry',(event,value)=>{captureValue(event,value,['captureId','width','height']);if(!dimension(value.width)||!dimension(value.height))throw Error('Denied');return helper.geometry(value);});
   ipcMain.handle('remote-pc:published',async(event,value)=>{
    captureValue(event,value,['captureId','helperSid','videoTrackSid'],['audioTrackSid']);
    if(!/^PA_[A-Za-z0-9]+$/.test(value.helperSid)||!/^TR_[A-Za-z0-9]+$/.test(value.videoTrackSid)||value.audioTrackSid!==undefined&&!/^TR_[A-Za-z0-9]+$/.test(value.audioTrackSid))throw Error('Denied');
    await helper.published(value);
    if(!stopped&&!window.isDestroyed()&&!publisherMinimized){publisherMinimized=true;window.minimize();}
    leaseTimer=setInterval(()=>{void helper.lease();},200);void helper.lease();
   });
   ipcMain.handle('remote-pc:data',(event,value)=>{
    captureValue(event,value,['captureId','senderSid','topic','bytes']);if(typeof value.senderSid!=='string'||typeof value.topic!=='string'||!(value.bytes instanceof Uint8Array)||value.bytes.byteLength>8192)throw Error('Denied');return helper.receive(value);
   });
   ipcMain.handle('remote-pc:capture-stopped',(event,value)=>{captureValue(event,value,['captureId']);captureStoppedResolve?.();});
   ipcMain.handle('remote-pc:stop',event=>{if(!trusted(event))throw Error('Denied');return close();});
   window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(event,url)=>{if(url!==pageUrl)event.preventDefault();});
   window.webContents.on('will-attach-webview',event=>event.preventDefault());window.webContents.on('render-process-gone',()=>{void close();});window.on('closed',()=>{void close();});
   partition.setPermissionCheckHandler((contents,permission,_origin,details)=>contents===window.webContents&&details.isMainFrame===true&&details.requestingUrl===pageUrl&&permission==='display-capture');
   partition.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===window.webContents&&details.isMainFrame===true&&details.requestingUrl===pageUrl&&permission==='display-capture'));
   const paired=await helper.pair(parsed.ticket);
   await window.loadURL(pageUrl);choice=await picker.choose();
   if(!choice||stopped){await close();return;}
   try{target=bindSelectedSource(choice.source,screen);}catch{const kind=choice.source.id.startsWith('window:')?'window':choice.source.id.startsWith('screen:')?'screen':null;if(!kind)throw Error('Unsupported source');target={kind,unavailable:true};}await helper.selected({captureId,sourceKind:target.kind,target});if(stopped)return;captureGate.select(choice.source);
   if(choice.audio)try{
    const id=randomUUID(),capture=require('./process-audio.cjs').createProcessAudioAdapter({resourcesPath}).start({sourceId:choice.source.id,enabled:true,onFrame:value=>send('audio',{id,frames:value.frames,pcm:new Uint8Array(value.pcm)}),onEnded:()=>send('audio-ended',{id})});
    await capture.ready;audio={id,capture};
   }catch{send('state',{state:'sharing',reason:'audio-unavailable'});}
   configResolve({captureId,publisher:paired.publisher,...(choice.audio&&!audio?{audioUnavailable:true}:{}),...(audio?{audio:{id:audio.id,sampleRate:48000,channels:2}}:{})});
   // Native RegisterHotKey owns local Stop and reports explicit stopped state.
   // Electron must not register the same system-wide shortcut a second time.
  }catch{await owner?.close();}
  finally{connecting=false;if(!current)activeLaunch=undefined;drainOrQuit();}
 }
 receive=async value=>{try{await launch(value);}catch{if(!current)app.quit();}};if(queued){const value=queued;queued=undefined;void receive(value);}else{await dialog.showMessageBox({type:'info',message:'Начните демонстрацию экрана в комнате CastLink.'});app.quit();}
}
module.exports={runRemotePcHelper,trustedPublisher,boundedResponse};
