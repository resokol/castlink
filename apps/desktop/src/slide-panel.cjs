'use strict';
const {isClientEvent}=require('./ipc-policy.cjs');
const keys=['id','title','controller','page','pages','canNavigate','canReclaim','busy','locale'];
function validSlideState(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))return false;
 if(typeof value.id!=='string'||!/^[a-zA-Z0-9:._-]{1,160}$/.test(value.id))return false;
 if(['title','controller'].some(key=>typeof value[key]!=='string'||!value[key].length||value[key].length>120||/[\u0000-\u001f\u007f]/.test(value[key])))return false;
 if(!Number.isInteger(value.pages)||value.pages<1||value.pages>10000||!Number.isInteger(value.page)||value.page<1||value.page>value.pages)return false;
 return ['canNavigate','canReclaim','busy'].every(key=>typeof value[key]==='boolean')&&['ru','en','zh-CN'].includes(value.locale);
}
function createSlideController({client,ipcMain,BrowserWindow,preferences,isLocal,ui,trustedOrigins}){
 let panel,state,visible=false;
 const destroy=()=>{if(panel&&!panel.isDestroyed())panel.destroy();panel=undefined;visible=false;};
 const paint=()=>{if(!panel||panel.isDestroyed()||!state)return;panel.webContents.send('castlink:slides-view',state);if(visible)panel.showInactive();else panel.hide();};
 const ensure=()=>{
  if(panel&&!panel.isDestroyed())return;
  const own=new BrowserWindow({width:480,height:174,minWidth:380,minHeight:174,alwaysOnTop:true,resizable:true,minimizable:false,maximizable:false,skipTaskbar:true,show:false,title:'CastLink · Slides',backgroundColor:'#15191c',autoHideMenuBar:true,webPreferences:preferences('slides')});
  panel=own;own.setMenu(null);own.setContentProtection(true);
  own.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  own.webContents.on('will-navigate',event=>event.preventDefault());
  own.webContents.on('will-attach-webview',event=>event.preventDefault());
  own.on('close',event=>{event.preventDefault();visible=false;own.hide();});
  own.loadFile(ui('slide-panel.html')).catch(()=>{if(panel===own){destroy();}});
 };
 const update=(event,value,show)=>{
  if(!isClientEvent(event,client,trustedOrigins)||!validSlideState(value))throw Error('Denied');
  if(state?.id!==value.id)destroy();
  state={...value};
  if(show){visible=true;ensure();}paint();return {visible};
 };
 const action=(event,value)=>{
  if(!isLocal(event,panel,'slide-panel.html')||!state||!visible||state.busy||!value||Object.keys(value).length!==2||value.id!==state.id||!['previous','next','reclaim'].includes(value.action))return;
  if(value.action==='reclaim'?!state.canReclaim:!state.canNavigate)return;
  if(value.action==='previous'&&state.page===1||value.action==='next'&&state.page===state.pages)return;
  state={...state,busy:true};paint();
  if(!client.isDestroyed())client.webContents.send('castlink:slides-action',{id:state.id,action:value.action});
 };
 const ready=event=>{if(isLocal(event,panel,'slide-panel.html'))paint();};
 ipcMain.handle('castlink:slides-update',(event,value)=>update(event,value,false));
 ipcMain.handle('castlink:slides-show',(event,value)=>update(event,value,true));
 ipcMain.handle('castlink:slides-hide',(event,id)=>{if(!isClientEvent(event,client,trustedOrigins)||typeof id!=='string')throw Error('Denied');if(state?.id===id){destroy();state=undefined;}return {visible};});
 ipcMain.on('castlink:slides-action',action);ipcMain.on('castlink:slides-ready',ready);
 const reset=()=>{destroy();state=undefined;};
 return {reset,dispose(){reset();for(const name of ['update','show','hide'])ipcMain.removeHandler('castlink:slides-'+name);ipcMain.removeListener('castlink:slides-action',action);ipcMain.removeListener('castlink:slides-ready',ready);}};
}
module.exports={createSlideController,validSlideState};
