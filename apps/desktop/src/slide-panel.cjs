'use strict';
const {isClientEvent}=require('./ipc-policy.cjs');
const keys=['id','title','controller','page','pages','canNavigate','canReclaim','busy','locale'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,allowed)=>object(value)&&Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9:._-]{1,160}$/.test(value);
function validToolbar(value){
 if(!exact(value,['canDelegate','canStop','sharing','controllerIdentity','participants'])||['canDelegate','canStop','sharing'].some(key=>typeof value[key]!=='boolean')||value.canStop&&!value.sharing)return false;
 if(value.controllerIdentity!==null&&!text(value.controllerIdentity,256)||!Array.isArray(value.participants)||value.participants.length>100)return false;
 const identities=new Set();
 for(const participant of value.participants){if(!exact(participant,['identity','name'])||!text(participant.identity,256)||!text(participant.name,120)||identities.has(participant.identity))return false;identities.add(participant.identity);}
 return true;
}
function validSlideState(value){
 if(!object(value)||!exact(value,Object.hasOwn(value,'toolbar')?[...keys,'toolbar']:keys))return false;
 if(!validId(value.id)||!text(value.title,120)||!text(value.controller,120))return false;
 if(!Number.isInteger(value.pages)||value.pages<1||value.pages>10000||!Number.isInteger(value.page)||value.page<1||value.page>value.pages)return false;
 if(!['canNavigate','canReclaim','busy'].every(key=>typeof value[key]==='boolean')||!['ru','en','zh-CN'].includes(value.locale))return false;
 return !Object.hasOwn(value,'toolbar')||validToolbar(value.toolbar);
}
function createSlideController({client,ipcMain,BrowserWindow,preferences,isLocal,ui,trustedOrigins,getWorkArea=()=>({x:0,y:0,width:1920,height:1080})}){
 let panel,state,visible=false,menuOpen=false,stopPending=false,stopFailed=false;
 const area=()=>{try{const value=getWorkArea(panel?.getBounds?.()||client.getBounds?.()||{x:0,y:0,width:860,height:116});if(value&&['x','y','width','height'].every(key=>Number.isFinite(value[key]))&&value.width>32&&value.height>32)return value;}catch{}return{x:0,y:0,width:1920,height:1080};};
 const size=()=>{const work=area(),width=Math.min(860,Math.max(1,work.width-16)),collapsed=width<620?170:116,rows=Math.min(5,state?.toolbar?.participants.length||0),menu=menuOpen?Math.max(210,Math.min(430,rows*48+190)):0;return{width,height:Math.min(work.height-16,collapsed+(menu?menu+12:0)),work};};
 const fit=()=>{
  if(!panel||panel.isDestroyed()||!panel.setBounds)return;
  const {width,height,work}=size(),old=panel.getBounds(),x=Math.max(work.x+8,Math.min(old.x,work.x+work.width-width-8)),y=Math.max(work.y+8,Math.min(old.y,work.y+work.height-height-8));
  if(old.x!==x||old.y!==y||old.width!==width||old.height!==height)panel.setBounds({x,y,width,height});
 };
 const destroy=()=>{if(panel&&!panel.isDestroyed())panel.destroy();panel=undefined;visible=false;menuOpen=false;stopPending=false;stopFailed=false;};
 const paint=()=>{
  if(!panel||panel.isDestroyed()||!state)return;
  fit();panel.webContents.send('castlink:slides-view',{...state,menuOpen,stopPending,stopFailed});
  if(visible)panel.showInactive();else panel.hide();
 };
 const hideLocal=()=>{menuOpen=false;visible=false;paint();};
 const local=event=>!!panel&&!panel.isDestroyed()&&isLocal(event,panel,'slide-panel.html');
 const ensure=()=>{
  if(panel&&!panel.isDestroyed())return;
  const {width,height}=size();
  const own=new BrowserWindow({width,height,minWidth:Math.min(320,width),minHeight:Math.min(116,height),maxWidth:860,frame:false,transparent:true,alwaysOnTop:true,resizable:false,minimizable:false,maximizable:false,skipTaskbar:true,show:false,title:'CastLink · Slides',backgroundColor:'#00000000',autoHideMenuBar:true,webPreferences:preferences('slides')});
  panel=own;own.setMenu(null);own.setContentProtection(true);
  own.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  own.webContents.on('will-navigate',event=>event.preventDefault());
  own.webContents.on('will-attach-webview',event=>event.preventDefault());
  own.on('close',event=>{event.preventDefault();if(panel===own)hideLocal();});
  own.loadFile(ui('slide-panel.html')).catch(()=>{if(panel===own)destroy();});
 };
 const update=(event,value,show)=>{
  if(!isClientEvent(event,client,trustedOrigins)||!validSlideState(value))throw Error('Denied');
  if(state?.id!==value.id)destroy();
  state={...value,...(value.toolbar?{toolbar:{...value.toolbar,participants:value.toolbar.participants.map(item=>({...item}))}}:{})};
  if(!state.toolbar?.sharing){stopPending=false;stopFailed=false;}
  if(!state.toolbar?.canDelegate&&!state.canReclaim)menuOpen=false;
  if(show){visible=true;ensure();}paint();return{visible};
 };
 const action=(event,value)=>{
  if(!local(event)||!state||!visible||!object(value)||!validId(value.id)||value.id!==state.id)return;
  const delegate=value.action==='delegate';
  if(!exact(value,delegate?['id','action','controllerIdentity']:['id','action'])||!['previous','next','reclaim','delegate','stop'].includes(value.action))return;
  if(value.action==='stop'){
   if(!state.toolbar?.canStop||!state.toolbar.sharing||stopPending)return;
   stopPending=true;stopFailed=false;
  }else{
   if(state.busy)return;
   if(delegate){if(!state.toolbar?.canDelegate||!state.toolbar.participants.some(item=>item.identity===value.controllerIdentity))return;}
   else if(value.action==='reclaim'){if(!state.canReclaim||state.toolbar&&!state.toolbar.canDelegate)return;}
   else if(!state.canNavigate||state.toolbar?.canDelegate&&state.toolbar.controllerIdentity!==null||value.action==='previous'&&state.page===1||value.action==='next'&&state.page===state.pages)return;
   state={...state,busy:true};menuOpen=false;
  }
  paint();
  if(!client.isDestroyed())client.webContents.send('castlink:slides-action',delegate?{id:state.id,action:value.action,controllerIdentity:value.controllerIdentity}:{id:state.id,action:value.action});
 };
 const ready=event=>{if(local(event))paint();};
 const menu=(event,value)=>{if(!local(event)||!visible||!state||typeof value!=='boolean'||value&&!state.toolbar?.canDelegate&&!state.canReclaim)return;menuOpen=value;paint();};
 const hide=event=>{if(local(event))hideLocal();};
 ipcMain.handle('castlink:slides-update',(event,value)=>update(event,value,false));
 ipcMain.handle('castlink:slides-show',(event,value)=>update(event,value,true));
 ipcMain.handle('castlink:slides-hide',(event,id)=>{if(!isClientEvent(event,client,trustedOrigins)||!validId(id))throw Error('Denied');if(state?.id===id){destroy();state=undefined;}return{visible};});
 ipcMain.handle('castlink:slides-stop-settled',(event,value)=>{
  if(!isClientEvent(event,client,trustedOrigins)||!exact(value,['id','failed'])||!validId(value.id)||typeof value.failed!=='boolean')throw Error('Denied');
  if(state?.id===value.id&&state.toolbar&&stopPending){stopPending=false;stopFailed=value.failed&&state.toolbar.sharing&&state.toolbar.canStop;paint();}
  return{visible};
 });
 ipcMain.on('castlink:slides-action',action);ipcMain.on('castlink:slides-ready',ready);ipcMain.on('castlink:slides-local-hide',hide);ipcMain.on('castlink:slides-menu',menu);
 const reset=()=>{destroy();state=undefined;};
 return{reset,dispose(){reset();for(const name of['update','show','hide','stop-settled'])ipcMain.removeHandler('castlink:slides-'+name);for(const[name,listener]of[['action',action],['ready',ready],['local-hide',hide],['menu',menu]])ipcMain.removeListener('castlink:slides-'+name,listener);}};
}
module.exports={createSlideController,validSlideState};
