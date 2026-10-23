'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('castlinkPicker',Object.freeze({sources:()=>ipcRenderer.invoke('remote-pc:picker-sources'),choose:value=>ipcRenderer.invoke('remote-pc:picker-choose',value)}));
