'use strict';
const {validScreenState,isClientEvent}=require('./ipc-policy.cjs');
const {createStopSession}=require('./stop-session.cjs');
function createStopController({client,ipcMain,BrowserWindow,globalShortcut,preferences,isLocal,ui,trustedOrigins}) {
  let panel,view;
  const shortcut='Control+Alt+Shift+S';
  const send=(channel,value)=>{if(!client.isDestroyed())client.webContents.send(channel,value);};
  const state=createStopSession({
    sendStop:id=>send('castlink:screen-stop',id),notify:value=>send('castlink:screen-state',value),
    register:()=>globalShortcut.register(shortcut,()=>state.stop()),unregister:()=>globalShortcut.unregister(shortcut),
    paint(value){
      view=value;
      if(!value.sharing){if(panel&&!panel.isDestroyed())panel.destroy();panel=undefined;return;}
      if(!panel||panel.isDestroyed()){
        panel=new BrowserWindow({width:440,height:104,minWidth:320,minHeight:88,alwaysOnTop:true,resizable:true,minimizable:false,maximizable:false,skipTaskbar:true,show:false,title:'CastLink · STOP',backgroundColor:'#bd243c',autoHideMenuBar:true,webPreferences:preferences('stop')});
        panel.setMenu(null);
        panel.setContentProtection(true);
        panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));
        panel.webContents.on('will-navigate',event=>event.preventDefault());
        panel.on('close',event=>{event.preventDefault();state.hide();});
        const owned=panel;
        panel.loadFile(ui('stop-panel.html')).catch(()=>{if(panel===owned&&!owned.isDestroyed())state.hide();});
      }
      if(value.visible)panel.showInactive();else panel.hide();
      panel.webContents.send('castlink:stop-view',value);
    },
  });
  const click=event=>{if(isLocal(event,panel,'stop-panel.html'))state.stop();};
  const ready=event=>{if(isLocal(event,panel,'stop-panel.html')&&view)panel.webContents.send('castlink:stop-view',view);};
  ipcMain.handle('castlink:screen-update',(event,value)=>{if(!isClientEvent(event,client,trustedOrigins)||!validScreenState(value))throw Error('Denied');const accepted=state.update(value);if(accepted)send('castlink:screen-state',{captureId:value.captureId,state:value.sharing&&value.visible?'open':'closed'});return accepted;});
  ipcMain.on('castlink:stop-click',click);ipcMain.on('castlink:stop-ready',ready);
  return {reset:()=>state.reset(),dispose(){state.reset();ipcMain.removeHandler('castlink:screen-update');ipcMain.removeListener('castlink:stop-click',click);ipcMain.removeListener('castlink:stop-ready',ready);}};
}
module.exports={createStopController};
