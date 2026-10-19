'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const role = process.argv.find(arg => arg.startsWith('--castlink-role='))?.split('=')[1];
const subscribe = (channel, listener) => {
  const handler = (_event, value) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
if (role === 'launcher') contextBridge.exposeInMainWorld('castlinkLauncher', {
  settings: () => ipcRenderer.invoke('castlink:settings'),
  connect: value => ipcRenderer.invoke('castlink:connect', value),
  setup: value => ipcRenderer.invoke('castlink:setup', value),
});
if (role === 'client') contextBridge.exposeInMainWorld('castlinkDesktop', {
  version: 1,
  slides:{update:value=>ipcRenderer.invoke('castlink:slides-update',value),show:value=>ipcRenderer.invoke('castlink:slides-show',value),hide:id=>ipcRenderer.invoke('castlink:slides-hide',id),onAction:listener=>subscribe('castlink:slides-action',listener)},
  powerPoint:{connect:()=>ipcRenderer.invoke('castlink:powerpoint-connect'),status:id=>ipcRenderer.invoke('castlink:powerpoint-status',id),goTo:value=>ipcRenderer.invoke('castlink:powerpoint-goTo',value),disconnect:id=>ipcRenderer.invoke('castlink:powerpoint-disconnect',id)},
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
  action:value=>ipcRenderer.send('castlink:slides-action',value),
});
if (role === 'stop') contextBridge.exposeInMainWorld('castlinkStop', {
  onState: listener => subscribe('castlink:stop-view', listener),
  ready: () => ipcRenderer.send('castlink:stop-ready'),
  stop: () => ipcRenderer.send('castlink:stop-click'),
});

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
    if(!video.length)return stream;
    const captureId=crypto.randomUUID(),labels={title:words[0],stop:words[1],stopping:words[2],stopError:words[3]};
    let finished=false,removeStop=()=>{};
    const snapshot=sharing=>({captureId,sharing,visible:sharing,stopping:false,failed:false,locale,labels});
    const finish=()=>{
      if(finished||video.some(track=>track.readyState==='live'))return;
      finished=true;removeStop();cleanupAudio();
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
