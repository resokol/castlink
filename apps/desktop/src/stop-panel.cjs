'use strict';
const {validScreenState,isClientEvent}=require('./ipc-policy.cjs');
const {createStopSession}=require('./stop-session.cjs');
function createStopController({client,ipcMain,BrowserWindow,globalShortcut,preferences,isLocal,ui,trustedOrigins,getSharedSource=()=>undefined}) {
  let panel,view,remoteControl,remoteIntent;
  const shortcut='Control+Alt+Shift+S';
  const send=(channel,value)=>{if(!client.isDestroyed())client.webContents.send(channel,value);};
  const state=createStopSession({
    sendStop:id=>send('castlink:screen-stop',id),notify:value=>send('castlink:screen-state',value),
    register:()=>globalShortcut.register(shortcut,()=>state.stop()),unregister:()=>globalShortcut.unregister(shortcut),
    paint(value){
      view=value;
      if(!value.sharing){if(panel&&!panel.isDestroyed())panel.destroy();panel=undefined;return;}
      if(!panel||panel.isDestroyed()){
        panel=new BrowserWindow({width:440,height:104,minWidth:320,minHeight:88,alwaysOnTop:true,resizable:true,minimizable:false,maximizable:false,skipTaskbar:true,show:false,title:'CastLink · STOP',backgroundColor:'#191c20',autoHideMenuBar:true,webPreferences:preferences('stop')});
        panel.setMenu(null);
        panel.setContentProtection(true);
        panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));
        panel.webContents.on('will-navigate',event=>event.preventDefault());
        panel.on('close',event=>{event.preventDefault();state.hide();});
        const owned=panel;
        panel.loadFile(ui('stop-panel.html')).catch(()=>{if(panel===owned&&!owned.isDestroyed())state.hide();});
      }
      if(value.visible)panel.showInactive();else panel.hide();
      panel.webContents.send('castlink:stop-view',{...value,...(remoteControl?.captureId===value.captureId?{remoteControl}:{})});
    },
  });
  const click=event=>{if(isLocal(event,panel,'stop-panel.html'))state.stop();};
  const snapshot=()=>({...view,...(remoteControl?.captureId===view?.captureId?{remoteControl}:{})});
  const repaint=()=>{if(panel&&!panel.isDestroyed()&&view)panel.webContents.send('castlink:stop-view',snapshot());};
  const ready=event=>{if(isLocal(event,panel,'stop-panel.html')&&view)repaint();};
  const intent=(event,value)=>{if(isLocal(event,panel,'stop-panel.html'))remoteIntent?.(value);};
  ipcMain.handle('castlink:screen-update',(event,value)=>{
    if(!isClientEvent(event,client,trustedOrigins)||!validScreenState(value))throw Error('Denied');
    // Preload's actual selected capture is authoritative. A web toolbar's UUID
    // or disposal must never replace/retire tracks still owned by getDisplayMedia.
    const shared=getSharedSource();if(shared?.ready){if(value.captureId!==shared.id)return false;if(!value.sharing){state.hide();return true;}}
    const accepted=state.update(value);if(accepted)send('castlink:screen-state',{captureId:value.captureId,state:value.sharing&&value.visible?'open':'closed'});return accepted;
  });
  ipcMain.on('castlink:stop-click',click);ipcMain.on('castlink:stop-ready',ready);
  ipcMain.on('castlink:stop-intent',intent);
  const clearRemoteControl=scope=>{if(scope&&remoteControl&&['captureId','sessionId','generation'].some(k=>scope[k]!==remoteControl[k]))return;remoteControl=remoteIntent=undefined;if(panel&&!panel.isDestroyed())panel.setSize(440,104);repaint();};
  return {updateRemoteControl(value,callback){if(value.captureId!==getSharedSource()?.id||view?.captureId!==value.captureId)return false;const expand=!remoteControl;remoteControl=structuredClone(value);remoteIntent=callback;if(expand&&panel&&!panel.isDestroyed())panel.setSize(440,360);repaint();return true;},clearRemoteControl,reset(){clearRemoteControl();state.reset();},dispose(){clearRemoteControl();state.reset();ipcMain.removeHandler('castlink:screen-update');ipcMain.removeListener('castlink:stop-click',click);ipcMain.removeListener('castlink:stop-ready',ready);ipcMain.removeListener('castlink:stop-intent',intent);}};
}
module.exports={createStopController};
