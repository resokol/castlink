'use strict';
const {windowHandle}=require('./remote-pc-protocol.cjs');
function bindSelectedSource(source,screen){
 const hwnd=windowHandle(source?.id);if(hwnd)return {kind:'window',hwnd};
 if(!/^screen:[0-9]+:[0-9]+$/.test(source?.id)||!source.display_id)throw Error('Unsupported capture source');
 const display=screen?.getAllDisplays().find(v=>String(v.id)===source.display_id);
 if(!display||typeof screen.dipToScreenRect!=='function')throw Error('Physical monitor unavailable');
 const rect=screen.dipToScreenRect(null,display.bounds);
 if(!rect||!['x','y','width','height'].every(k=>Number.isSafeInteger(rect[k]))||rect.width<=0||rect.height<=0)throw Error('Unsupported monitor geometry');
 return {kind:'screen',rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
}
/** A native picker decision permits one getDisplayMedia request from exactly the
 * isolated publisher top frame. It never grants arbitrary renderer capture. */
function createCaptureGate({session,window,pageUrl}){
 let selected,disposed=false;
 session.setDisplayMediaRequestHandler((request,callback)=>{
  const current=!disposed&&!window.isDestroyed()&&request.frame===window.webContents.mainFrame&&request.frame?.url===pageUrl;
  if(!current||!request.videoRequested||!selected){callback({});return;}
  const source=selected;selected=undefined;callback({video:source});
 });
 return {select(source){if(disposed||!source?.id)throw Error('Capture closed');selected=source;},dispose(){disposed=true;selected=undefined;session.setDisplayMediaRequestHandler(null);}};
}
function createRemotePicker({BrowserWindow,ipcMain,parent,desktopCapturer,resourcesPath}){
 const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
 const page=path.join(__dirname,'../ui/capture-picker.html'),pageUrl=pathToFileURL(page).href;
 let pending;
 const trusted=event=>pending&&!pending.window.isDestroyed()&&event.sender===pending.window.webContents&&event.senderFrame===pending.window.webContents.mainFrame&&event.senderFrame.url===pageUrl;
 ipcMain.handle('remote-pc:picker-sources',event=>{
  if(!trusted(event))throw Error('Denied');
  return {locale:'ru',audioAvailable:process.platform==='win32'&&Number(require('node:os').release().split('.')[2])>=20348&&fs.existsSync(path.join(resourcesPath,'process-audio/CastLink.ProcessAudio.exe')),sources:pending.sources.map(v=>({id:v.id,name:v.name,thumbnail:v.thumbnail.toDataURL()}))};
 });
 ipcMain.handle('remote-pc:picker-choose',(event,value)=>{
  if(!trusted(event))throw Error('Denied');
  if(value===null){pending.finish(null);return;}
  if(!value||Object.keys(value).some(k=>!['id','audio'].includes(k))||typeof value.audio!=='boolean')throw Error('Denied');
  const source=pending.sources.find(v=>v.id===value.id);if(!source||value.audio&&!windowHandle(source.id))throw Error('Denied');
  pending.finish({source,audio:value.audio});
 });
 return {
  async choose(){
   if(pending)throw Error('Capture busy');
   const sources=(await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:400,height:225},fetchWindowIcons:false})).filter(v=>!/^CastLink(?: ·| —)/.test(v.name));
   if(parent.isDestroyed())return null;
   return new Promise(resolve=>{
    const window=new BrowserWindow({width:820,height:620,minWidth:360,minHeight:400,parent,modal:true,title:'CastLink · Screen',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'remote-pc-picker-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    const own={window,sources,finish(value){if(pending!==own)return;pending=undefined;if(!window.isDestroyed())window.destroy();resolve(value);}};pending=own;
    window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-attach-webview',event=>event.preventDefault());window.on('closed',()=>own.finish(null));void window.loadFile(page).catch(()=>own.finish(null));
   });
  },
  dispose(){pending?.finish(null);for(const channel of ['sources','choose'])ipcMain.removeHandler('remote-pc:picker-'+channel);},
 };
}
module.exports={bindSelectedSource,createCaptureGate,createRemotePicker};
