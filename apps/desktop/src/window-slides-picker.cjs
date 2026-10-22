'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
function createWindowSlidesPicker({BrowserWindow,ipcMain,getParent}){
 let pending;const page=path.join(__dirname,'../ui/window-slides-picker.html'),url=pathToFileURL(page).href;
 const trusted=event=>!!pending&&!pending.window.isDestroyed()&&event.sender===pending.window.webContents&&event.senderFrame===pending.window.webContents.mainFrame&&event.senderFrame.url===url;
 ipcMain.handle('window-slides-picker:list',event=>{if(!trusted(event))throw Error('Denied');return pending.choices;});
 ipcMain.handle('window-slides-picker:choose',(event,id)=>{if(!trusted(event)||id!==null&&!pending.choices.some(v=>v.id===id))throw Error('Denied');pending.finish(id);});
 function cancel(){pending?.finish(null);}
 return{
  choose(choices){
   cancel();const parent=getParent();if(!parent||parent.isDestroyed())return Promise.resolve(null);
   return new Promise(resolve=>{
    const window=new BrowserWindow({width:560,height:430,minWidth:360,minHeight:300,parent,modal:true,title:'Выберите окно PDF',backgroundColor:'#111315',autoHideMenuBar:true,
     webPreferences:{preload:path.join(__dirname,'window-slides-picker-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    const own={window,choices:choices.map(({id,name})=>({id,name})),finish(id){if(pending!==own)return;pending=undefined;if(!window.isDestroyed())window.destroy();resolve(id);}};pending=own;
    window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
    window.on('closed',()=>own.finish(null));window.loadFile(page).catch(()=>own.finish(null));
   });
  },
  dispose(){cancel();ipcMain.removeHandler('window-slides-picker:list');ipcMain.removeHandler('window-slides-picker:choose');},
 };
}
module.exports={createWindowSlidesPicker};
