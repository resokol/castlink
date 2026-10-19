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
});
if (role === 'client') contextBridge.exposeInMainWorld('castlinkDesktop', {
  version: 1,
  screenShare: {
    update: value => ipcRenderer.invoke('castlink:screen-update', value),
    onStop: listener => subscribe('castlink:screen-stop', listener),
    onState: listener => subscribe('castlink:screen-state', listener),
  },
});
if (role === 'picker') contextBridge.exposeInMainWorld('castlinkPicker', {
  sources: () => ipcRenderer.invoke('castlink:capture-sources'),
  choose: value => ipcRenderer.invoke('castlink:capture-choose', value),
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
    const stream=await original(...args),tracks=stream.getTracks(),video=stream.getVideoTracks();
    if(!video.length)return stream;
    const captureId=crypto.randomUUID(),labels={title:words[0],stop:words[1],stopping:words[2],stopError:words[3]};
    let finished=false,removeStop=()=>{};
    const snapshot=sharing=>({captureId,sharing,visible:sharing,stopping:false,failed:false,locale,labels});
    const finish=()=>{
      if(finished||video.some(track=>track.readyState==='live'))return;
      finished=true;removeStop();
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
