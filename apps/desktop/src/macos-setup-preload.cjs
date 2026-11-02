'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const prefix='castlink:macos-setup-';
contextBridge.exposeInMainWorld('castlinkMacSetup',Object.freeze({state:()=>ipcRenderer.invoke(prefix+'state'),run:value=>ipcRenderer.invoke(prefix+'run',value),discover:value=>ipcRenderer.invoke(prefix+'discover',value),generateKey:value=>ipcRenderer.invoke(prefix+'generate-key',value),probe:value=>ipcRenderer.invoke(prefix+'probe',value),folder:()=>ipcRenderer.invoke(prefix+'folder'),cancel:()=>ipcRenderer.invoke(prefix+'cancel'),onProgress:listener=>{const handler=(_event,value)=>listener(value);ipcRenderer.on(prefix+'progress',handler);return ()=>ipcRenderer.removeListener(prefix+'progress',handler);}}));
