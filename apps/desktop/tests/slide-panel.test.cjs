'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createSlideController,validSlideState}=require('../src/slide-panel.cjs');
const sample=()=>({id:'session:1:2',title:'Презентация',controller:'Анна',page:4,pages:18,canNavigate:true,canReclaim:false,busy:false,locale:'ru'});
function fixture(){
 const handlers=new Map(),windows=[],sent=[];
 const ipcMain=new EventEmitter();ipcMain.handle=(key,handler)=>handlers.set(key,handler);ipcMain.removeHandler=key=>handlers.delete(key);
 class Window extends EventEmitter{
  constructor(options){super();this.options=options;this.dead=false;this.visible=false;this.webContents=new EventEmitter();this.webContents.send=(...args)=>sent.push(args);this.webContents.setWindowOpenHandler=handler=>this.popup=handler;windows.push(this);}
  isDestroyed(){return this.dead;}destroy(){this.dead=true;}setMenu(){}setContentProtection(value){this.protection=value;}showInactive(){this.visible=true;}hide(){this.visible=false;}loadFile(){return Promise.resolve();}
 }
 const client={isDestroyed:()=>false,webContents:{mainFrame:{url:'https://studio.example/room'},send:(...args)=>sent.push(args)}};
 const event={sender:client.webContents,senderFrame:client.webContents.mainFrame};
 const controller=createSlideController({client,ipcMain,BrowserWindow:Window,preferences:role=>({role}),isLocal:(event,panel)=>event.panel===panel,ui:name=>name,trustedOrigins:new Set(['https://studio.example'])});
 return {controller,windows,sent,event,ipcMain,invoke:(name,value,eventOverride=event)=>handlers.get('castlink:slides-'+name)(eventOverride,value),click:(panel,value)=>ipcMain.emit('castlink:slides-action',{panel},value)};
}
test('strict slide state bounds reject malformed values and arbitrary options',()=>{
 assert.equal(validSlideState(sample()),true);
 for(const patch of [{page:0},{page:19},{pages:10001},{busy:1},{locale:'xx'},{id:'bad\nidentity'},{title:'x'.repeat(121)},{controller:'bad\0name'},{url:'https://bad.example'}])assert.equal(validSlideState({...sample(),...patch}),false,JSON.stringify(patch));
});
test('updates remain hidden; show opens protected isolated panel and close hides without action',()=>{
 const f=fixture();assert.deepEqual(f.invoke('update',sample()),{visible:false});assert.equal(f.windows.length,0);
 assert.deepEqual(f.invoke('show',sample()),{visible:true});const panel=f.windows[0];assert.equal(panel.options.alwaysOnTop,true);assert.equal(panel.options.webPreferences.role,'slides');assert.equal(panel.protection,true);
 let prevented=false;panel.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(panel.visible,false);
 f.invoke('update',{...sample(),page:5});assert.equal(panel.visible,false);assert.equal(f.sent.filter(([name])=>name==='castlink:slides-action').length,0);
 f.invoke('show',{...sample(),page:5});assert.equal(panel.visible,true);
});
test('only current authorized actions from own local window are forwarded once',()=>{
 const f=fixture();f.invoke('show',sample());const panel=f.windows[0];
 f.click({}, {id:sample().id,action:'next'});f.click(panel,{id:'old',action:'next'});f.click(panel,{id:sample().id,action:'reclaim'});f.click(panel,{id:sample().id,action:'stop'});
 assert.equal(f.sent.filter(([name])=>name==='castlink:slides-action').length,0);
 f.click(panel,{id:sample().id,action:'next'});f.click(panel,{id:sample().id,action:'next'});
 assert.equal(f.sent.filter(([name])=>name==='castlink:slides-action').length,1);
 f.invoke('update',{...sample(),canNavigate:false,canReclaim:true,page:5});
 f.click(panel,{id:sample().id,action:'previous'});f.click(panel,{id:sample().id,action:'reclaim'});
 assert.equal(f.sent.filter(([name])=>name==='castlink:slides-action').length,2);
});
test('retired panel cannot act on replacement; hide and reset dispose window and deny stale IPC',()=>{
 const f=fixture();f.invoke('show',sample());const old=f.windows[0];f.invoke('update',{...sample(),id:'session:1:3'});
 assert.equal(old.dead,true);f.click(old,{id:sample().id,action:'next'});assert.equal(f.sent.filter(([name])=>name==='castlink:slides-action').length,0);
 f.invoke('show',{...sample(),id:'session:1:3'});const current=f.windows[1];f.invoke('hide','old');assert.equal(current.dead,false);
 f.invoke('hide','session:1:3');assert.equal(current.dead,true);
 f.invoke('show',sample());f.controller.reset();assert.equal(f.windows[2].dead,true);
 assert.throws(()=>f.invoke('show',sample(),{...f.event,senderFrame:{url:'https://untrusted.example'}}),/Denied/);
 assert.throws(()=>f.invoke('update',{...sample(),url:'bad'}),/Denied/);
 f.controller.dispose();assert.equal(f.ipcMain.listenerCount('castlink:slides-action'),0);
});
