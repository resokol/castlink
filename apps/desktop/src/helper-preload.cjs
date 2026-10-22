'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('castlinkPresentationHelper',Object.freeze({
  connect:value=>ipcRenderer.invoke('presentation-helper:connect',{server:value?.server,code:value?.code}),
  disconnect:()=>ipcRenderer.invoke('presentation-helper:disconnect'),
  state:()=>ipcRenderer.invoke('presentation-helper:state'),
}));
