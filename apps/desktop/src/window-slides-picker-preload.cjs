'use strict';
const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('castlinkWindowPicker',{list:()=>ipcRenderer.invoke('window-slides-picker:list'),choose:id=>ipcRenderer.invoke('window-slides-picker:choose',id)});
