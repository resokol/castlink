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
