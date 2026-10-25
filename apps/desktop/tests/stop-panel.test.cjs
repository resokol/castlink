const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStopSession } = require('../src/stop-session.cjs');
const state = {captureId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',sharing:true,visible:true,stopping:false,failed:false,locale:'ru',labels:{title:'Panel',stop:'STOP',stopping:'Stopping',stopError:'Retry'}};
test('hidden panel keeps capture/hotkey and STOP is scoped and single flight', () => {
  const sent=[], views=[], notifications=[];let registered=0,unregistered=0;
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:s=>notifications.push(s),register:()=>{registered++;return true;},unregister:()=>unregistered++});
  session.update(state);assert.equal(registered,1);
  session.hide();assert.equal(sent.length,0);assert.equal(views.at(-1).visible,false);assert.equal(unregistered,0);
  session.stop();session.stop();assert.deepEqual(sent,[state.captureId]);
  session.update({...state,stopping:false,failed:true});session.stop();assert.equal(sent.length,2);
  session.reset();session.stop();assert.equal(sent.length,2);assert.equal(unregistered,1);
});
test('stopped capture ids are retired; late updates cannot reopen or stop a new share', () => {
  const views=[],sent=[];
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:()=>{},register:()=>true,unregister:()=>{}});
  session.update(state);session.update({...state,sharing:false});
  session.update({...state,captureId:'11111111-2222-4333-8444-555555555555'});
  assert.equal(session.update(state),false);session.stop();assert.equal(sent.at(-1),'11111111-2222-4333-8444-555555555555');
  session.reset();
});
test('shortcut conflict is visible without disabling the button', () => {
  const views=[],sent=[];
  const session=createStopSession({paint:s=>views.push(s),sendStop:id=>sent.push(id),notify:()=>{},register:()=>false,unregister:()=>{}});
  session.update(state);assert.equal(views.at(-1).shortcutAvailable,false);session.stop();assert.equal(sent.length,1);session.reset();
});

test('actual capture owns stop surface; unrelated web UUID and live disposal cannot retire it',()=>{
 const {createStopController}=require('../src/stop-panel.cjs'),{EventEmitter}=require('node:events');
 const handlers=new Map(),ipcMain=new EventEmitter();ipcMain.handle=(n,f)=>handlers.set(n,f);ipcMain.removeHandler=n=>handlers.delete(n);
 const wc=new EventEmitter();wc.mainFrame={url:'https://castlink.test/room'};const sent=[];wc.send=(...v)=>sent.push(v);const client={isDestroyed:()=>false,webContents:wc};const event={sender:wc,senderFrame:wc.mainFrame};
 class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=()=>{};}isDestroyed(){return false;}setMenu(){}setContentProtection(){}loadFile(){return Promise.resolve();}showInactive(){}hide(){}destroy(){}setSize(){}}
 let shared={id:state.captureId,ready:true};const controller=createStopController({client,ipcMain,BrowserWindow:Window,globalShortcut:{register:()=>true,unregister(){}},preferences:()=>({}),isLocal:()=>true,ui:n=>n,trustedOrigins:new Set(['https://castlink.test']),getSharedSource:()=>shared});
 const update=v=>handlers.get('castlink:screen-update')(event,v);update(state);
 assert.equal(update({...state,captureId:'11111111-2222-4333-8444-555555555555'}),false);
 update({...state,sharing:false});ipcMain.emit('castlink:stop-click',{});assert.equal(sent.at(-1)[0],'castlink:screen-stop');assert.equal(sent.at(-1)[1],state.captureId);
 shared=undefined;update({...state,sharing:false});assert.equal(update(state),false,'only actual media end retires live capture');controller.dispose();
});

test('floating stop panel stays compact until its local control menu is opened',()=>{
 const {createStopController}=require('../src/stop-panel.cjs'),{EventEmitter}=require('node:events');
 const handlers=new Map(),ipcMain=new EventEmitter(),windows=[],sent=[];
 ipcMain.handle=(n,f)=>handlers.set(n,f);ipcMain.removeHandler=n=>handlers.delete(n);
 const wc=new EventEmitter();wc.mainFrame={url:'https://castlink.test/room'};wc.send=(...v)=>sent.push(v);
 class Window extends EventEmitter{constructor(options){super();this.options=options;this.sizes=[];this.messages=[];this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=(channel,value)=>this.messages.push([channel,value]);windows.push(this);}isDestroyed(){return false;}setMenu(){}setContentProtection(){}loadFile(){return Promise.resolve();}showInactive(){}hide(){this.hidden=true;}destroy(){}setSize(...size){this.sizes.push(size);}}
 const shared={id:state.captureId,ready:true,name:'Actual selected screen'};
 const controller=createStopController({client:{isDestroyed:()=>false,webContents:wc},ipcMain,BrowserWindow:Window,globalShortcut:{register:()=>true,unregister(){}},preferences:()=>({}),isLocal:event=>event.local===true,ui:n=>n,trustedOrigins:new Set(['https://castlink.test']),getSharedSource:()=>shared});
 handlers.get('castlink:screen-update')({sender:wc,senderFrame:wc.mainFrame},state);
 const panel=windows[0];assert.equal(panel.options.frame,false);assert.equal(panel.options.resizable,false);assert.ok(panel.options.height<=140);
 const toolbar={captureId:state.captureId,sessionId:'s',generation:'g',participants:[],requests:[]};let remoteIntents=0;
 controller.updateRemoteControl(toolbar,()=>remoteIntents++);assert.ok(panel.sizes.every(([,height])=>height<=140),'polling never expands window');assert.equal(panel.messages.at(-1)[1].sourceName,shared.name);
 ipcMain.emit('castlink:stop-intent',{local:false},{action:'panel-menu',open:true});assert.ok(panel.sizes.every(([,height])=>height<=140));
 ipcMain.emit('castlink:stop-intent',{local:true},{action:'panel-menu',open:true});assert.ok(panel.sizes.at(-1)[1]>140);assert.equal(remoteIntents,0,'local menu command never reaches remote authorization actions');
 controller.updateRemoteControl({...toolbar,sequence:2},()=>remoteIntents++);assert.equal(panel.messages.at(-1)[1].menuOpen,true);
 ipcMain.emit('castlink:stop-intent',{local:true},{action:'panel-menu',open:false});assert.ok(panel.sizes.at(-1)[1]<=140);
 let prevented=false;panel.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(panel.hidden,true);assert.equal(sent.some(([channel])=>channel==='castlink:screen-stop'),false,'OS close only hides');controller.dispose();
});
