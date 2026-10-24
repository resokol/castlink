'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const role = process.argv.find(arg => arg.startsWith('--castlink-role='))?.split('=')[1];
const subscribe = (channel, listener) => {
  const handler = (_event, value) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
const presentationCodes=new Set(['POWERPOINT_COM_UNAVAILABLE','POWERPOINT_NO_SLIDESHOW','POWERPOINT_AMBIGUOUS','POWERPOINT_SOURCE_MISMATCH','POWERPOINT_CAPTURE_STALE','POWERPOINT_TIMEOUT','POWERPOINT_NATIVE_UNAVAILABLE','POWERPOINT_UNAVAILABLE','POWERPOINT_DECLINED','POWERPOINT_STALE','POWERPOINT_CLOSED','POWERPOINT_BUSY','POWERPOINT_PAGE','POWERPOINT_FILE','POWERPOINT_COMMAND','POWERPOINT_STEP_UNAVAILABLE','WINDOW_SLIDES_FOREGROUND']);
const presentationInvoke=async(method,value)=>{
  const result=await ipcRenderer.invoke('castlink:powerpoint-'+method,value);
  if(result?.error){const code=presentationCodes.has(result.error)?result.error:'POWERPOINT_UNAVAILABLE';throw Object.freeze({code,message:code==='WINDOW_SLIDES_FOREGROUND'?'Верните выбранное окно PDF на передний план':'Presentation control unavailable.'});}
  return result;
};
if (role === 'launcher') contextBridge.exposeInMainWorld('castlinkLauncher', {
  settings: () => ipcRenderer.invoke('castlink:settings'),
  connect: value => ipcRenderer.invoke('castlink:connect', value),
  setup: value => ipcRenderer.invoke('castlink:setup', value),
  updates: locale => ipcRenderer.invoke('castlink:updates',locale),
});
if (role === 'client') contextBridge.exposeInMainWorld('castlinkDesktop', {
  version: 1,
  remoteControl:{version:1,
    capabilities:()=>ipcRenderer.invoke('castlink:remote-control-capabilities'),
    attach:value=>ipcRenderer.invoke('castlink:remote-control-attach',value),
    geometry:value=>ipcRenderer.invoke('castlink:remote-control-geometry',value),
    receive:value=>ipcRenderer.invoke('castlink:remote-control-receive',value),
    stop:value=>ipcRenderer.invoke('castlink:remote-control-stop',value),
    updateToolbar:value=>ipcRenderer.invoke('castlink:remote-control-updateToolbar',value),
    onState:listener=>subscribe('castlink:remote-control-state',listener),
    onIntent:listener=>subscribe('castlink:remote-control-intent',listener),
  },
  slides:{version:4,stopSettled:value=>ipcRenderer.invoke('castlink:slides-stop-settled',value),update:value=>ipcRenderer.invoke('castlink:slides-update',value),show:value=>ipcRenderer.invoke('castlink:slides-show',value),hide:id=>ipcRenderer.invoke('castlink:slides-hide',id),onAction:listener=>subscribe('castlink:slides-action',listener)},
  powerPoint:{version:4,prepare:value=>presentationInvoke('prepare',value),start:value=>presentationInvoke('start',value),step:value=>presentationInvoke('step',value),connect:()=>presentationInvoke('connect'),connectShared:value=>presentationInvoke('connectShared',value),status:id=>presentationInvoke('status',id),goTo:value=>presentationInvoke('goTo',value),disconnect:id=>presentationInvoke('disconnect',id)},
  screenShare: {
    beginCapture:()=>ipcRenderer.invoke('castlink:audio-begin'),
    cancelCapture:id=>ipcRenderer.invoke('castlink:audio-cancel',id),
    audioReady:id=>ipcRenderer.invoke('castlink:audio-info',id),
    stopAudio:id=>ipcRenderer.invoke('castlink:audio-stop',id),
    onAudio:listener=>subscribe('castlink:audio-data',listener),
    onAudioEnded:listener=>subscribe('castlink:audio-ended',listener),
    update: value => ipcRenderer.invoke('castlink:screen-update', value),
    onStop: listener => subscribe('castlink:screen-stop', listener),
    onState: listener => subscribe('castlink:screen-state', listener),
  },
});
if (role === 'picker') contextBridge.exposeInMainWorld('castlinkPicker', {
  sources: () => ipcRenderer.invoke('castlink:capture-sources'),
  choose: value => ipcRenderer.invoke('castlink:capture-choose', value),
});
if (role === 'slides') contextBridge.exposeInMainWorld('castlinkSlides', {
  onState:listener=>subscribe('castlink:slides-view',listener),
  ready:()=>ipcRenderer.send('castlink:slides-ready'),
  hide:()=>ipcRenderer.send('castlink:slides-local-hide'),
  menu:open=>ipcRenderer.send('castlink:slides-menu',open),
  action:value=>ipcRenderer.send('castlink:slides-action',value),
});
if (role === 'stop') contextBridge.exposeInMainWorld('castlinkStop', {
  intent:value=>ipcRenderer.send('castlink:stop-intent',value),
  onState: listener => subscribe('castlink:stop-view', listener),
  ready: () => ipcRenderer.send('castlink:stop-ready'),
  stop: () => ipcRenderer.send('castlink:stop-click'),
});

// Local auxiliary windows use Electron's color-scheme media query. Follow the
// trusted page's explicit preference, including live switches, rather than the OS.
function installClientTheme() {
  let previous;
  const publish=()=>{
    const theme=document.documentElement?.dataset.theme;
    if(!['dark','light'].includes(theme)||theme===previous)return;
    previous=theme;ipcRenderer.send('castlink:theme',theme);
  };
  const observe=()=>{
    if(!document.documentElement)return;
    new MutationObserver(publish).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    publish();
  };
  if(document.documentElement)observe();
  else document.addEventListener('DOMContentLoaded',observe,{once:true});
}
if(role==='client'&&typeof document!=='undefined')installClientTheme();

// Runs before the server's scripts. Own only streams returned by getDisplayMedia;
// getUserMedia camera/mic streams are never registered here.
function installCaptureStop(locale) {
  const devices=navigator.mediaDevices,bridge=window.castlinkDesktop?.screenShare;
  if(!devices?.getDisplayMedia||!bridge)return;
  const words={ru:['Демонстрация экрана','ОСТАНОВИТЬ ДЕМОНСТРАЦИЮ','Останавливаем…','Повторите попытку'],en:['Screen sharing','STOP SHARING','Stopping…','Try again'],'zh-CN':['屏幕共享','停止共享','正在停止…','请重试']}[locale];
  const original=devices.getDisplayMedia.bind(devices);
  devices.getDisplayMedia=async function(...args){
    const requestId=await bridge.beginCapture();
    let stream,cleanupAudio=()=>{};
    try{stream=await original(...args);}catch(error){await bridge.cancelCapture(requestId).catch(()=>{});throw error;}
    try{
      const info=typeof bridge.audioReady==='function'?await bridge.audioReady(requestId):null;
      if(info){
        if(info.sampleRate!==48000||info.channels!==2||typeof info.id!=='string')throw Error('Invalid audio format');
        const context=new AudioContext({sampleRate:48000}),destination=context.createMediaStreamDestination(),processor=context.createScriptProcessor(2048,0,2);
        const capacity=48000,ring=new Float32Array(capacity*2);let write=0,read=0,count=0,closed=false;
        const removeAudio=bridge.onAudio(value=>{
          if(closed||value.id!==info.id||!Number.isInteger(value.frames)||value.frames<1||value.frames>4800)return;
          const bytes=new Uint8Array(value.pcm);if(bytes.byteLength!==value.frames*8)return;
          const samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
          for(let i=0;i<value.frames;i++){if(count===capacity){read=(read+1)%capacity;count--;}for(let ch=0;ch<2;ch++)ring[write*2+ch]=Number.isFinite(samples[i*2+ch])?samples[i*2+ch]:0;write=(write+1)%capacity;count++;}
        });
        processor.onaudioprocess=event=>{
          const left=event.outputBuffer.getChannelData(0),right=event.outputBuffer.getChannelData(1);
          for(let i=0;i<left.length;i++){if(count){left[i]=ring[read*2];right[i]=ring[read*2+1];read=(read+1)%capacity;count--;}else{left[i]=0;right[i]=0;}}
        };
        processor.connect(destination);
        const removeEnded=bridge.onAudioEnded(value=>{if(value.id===info.id&&!closed){const live=stream.getTracks().filter(track=>track.readyState==='live');live.forEach(track=>track.stop());live.forEach(track=>track.dispatchEvent(new Event('ended')));}});
        cleanupAudio=()=>{if(closed)return;closed=true;removeAudio();removeEnded();processor.onaudioprocess=null;processor.disconnect();void context.close().catch(()=>{});void bridge.stopAudio(info.id).catch(()=>{});};
        await context.resume();if(context.state!=='running')throw Error('Presentation audio could not start');
        destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
      }
    }catch(error){cleanupAudio();await bridge.cancelCapture(requestId).catch(()=>{});stream.getTracks().forEach(track=>track.stop());throw error;}
    const tracks=stream.getTracks(),video=stream.getVideoTracks();
    if(!video.length){cleanupAudio();await bridge.cancelCapture(requestId).catch(()=>{});return stream;}
    const captureId=requestId,labels={title:words[0],stop:words[1],stopping:words[2],stopError:words[3]};
    for(const track of video)Object.defineProperty(track,'castlinkCaptureId',{value:captureId});
    let finished=false,removeStop=()=>{};
    const snapshot=sharing=>({captureId,sharing,visible:sharing,stopping:false,failed:false,locale,labels});
    const finish=()=>{
      if(finished||video.some(track=>track.readyState==='live'))return;
      finished=true;removeStop();cleanupAudio();
      void bridge.cancelCapture(captureId).catch(()=>{});
      for(const track of tracks){track.removeEventListener('ended',finish);if(track.readyState==='live')track.stop();}
      void bridge.update(snapshot(false)).catch(()=>{});
    };
    for(const track of tracks){
      const stop=track.stop.bind(track);
      track.stop=function(){stop();finish();};
      track.addEventListener('ended',finish);
    }
    removeStop=bridge.onStop(id=>{
      if(id!==captureId||finished)return;
      const live=tracks.filter(track=>track.readyState==='live');
      // Programmatic stop does not emit ended; notify the SDK as an OS stop would
      // so its existing screen unpublication/UI lifecycle also runs.
      live.forEach(track=>track.stop());
      live.forEach(track=>track.dispatchEvent(new Event('ended')));
    });
    await bridge.update(snapshot(true)).catch(()=>{});
    finish();
    return stream;
  };
}
if(role==='client') {
  const requested=process.argv.find(arg=>arg.startsWith('--castlink-locale='))?.split('=')[1];
  const locale=['ru','en','zh-CN'].includes(requested)?requested:'ru';
  contextBridge.executeInMainWorld({func:installCaptureStop,args:[locale]});
}
