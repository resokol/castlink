'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,listener)=>{const handler=(_event,value)=>listener(value);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
// This deliberately has no pair/bind/target/activate/renew API. Tokens returned
// by config are SFU publisher-only; HTTP credentials and input keys stay in main.
contextBridge.exposeInMainWorld('castlinkRemotePublisher',Object.freeze({
 config:()=>ipcRenderer.invoke('remote-pc:config'),
 captured:value=>ipcRenderer.invoke('remote-pc:captured',value),
 geometry:value=>ipcRenderer.invoke('remote-pc:geometry',value),
 published:value=>ipcRenderer.invoke('remote-pc:published',value),
 data:value=>ipcRenderer.invoke('remote-pc:data',value),
 captureStopped:value=>ipcRenderer.invoke('remote-pc:capture-stopped',value),
 stop:()=>ipcRenderer.invoke('remote-pc:stop'),
 onStop:listener=>listen('remote-pc:stop-capture',listener),
 onState:listener=>listen('remote-pc:state',listener),
 onAudio:listener=>listen('remote-pc:audio',listener),
 onAudioEnded:listener=>listen('remote-pc:audio-ended',listener),
}));
