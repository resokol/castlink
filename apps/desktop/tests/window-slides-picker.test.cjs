'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {createWindowSlidesPicker}=require('../src/window-slides-picker.cjs');
test('only current local main frame chooses opaque listed PDF target; cancel and disposal cannot resurrect picker',async()=>{
 const handlers=new Map(),windows=[];const ipcMain={handle:(n,f)=>handlers.set(n,f),removeHandler:n=>handlers.delete(n)};
 class Window extends EventEmitter{constructor(){super();this.dead=false;this.webContents=new EventEmitter();this.webContents.mainFrame={url:pathToFileURL(path.resolve(__dirname,'../ui/window-slides-picker.html')).href};this.webContents.setWindowOpenHandler=()=>{};windows.push(this);}isDestroyed(){return this.dead;}setMenu(){}loadFile(){return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}}
 const picker=createWindowSlidesPicker({BrowserWindow:Window,ipcMain,getParent:()=>({isDestroyed:()=>false})}),pending=picker.choose([{id:'opaque',name:'Own.pdf'}]),window=windows[0];
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},list=handlers.get('window-slides-picker:list'),choose=handlers.get('window-slides-picker:choose');
 assert.throws(()=>list({sender:{},senderFrame:window.webContents.mainFrame}));assert.throws(()=>list({...event,senderFrame:{url:event.senderFrame.url}}));assert.deepEqual(list(event),[{id:'opaque',name:'Own.pdf'}]);assert.throws(()=>choose(event,'foreign'));
 choose(event,'opaque');assert.equal(await pending,'opaque');assert.throws(()=>choose(event,'opaque'));
 const cancelled=picker.choose([{id:'new',name:'New.pdf'}]);picker.dispose();assert.equal(await cancelled,null);assert.equal(handlers.size,0);
});
