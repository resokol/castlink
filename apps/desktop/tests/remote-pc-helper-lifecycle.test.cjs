'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const tick=()=>new Promise(r=>setImmediate(r));
const ticket=letter=>'rp1_'+letter.repeat(43),link=(letter,server='https://studio.example')=>'castlink-remote://connect?server='+encodeURIComponent(server)+'#'+ticket(letter);
async function fixture({failStop=false,holdStop=false}={}){
 const filename=path.resolve(__dirname,'../src/remote-pc-helper.cjs'),localRequire=createRequire(filename),handlers=new Map(),windows=[],pairs=[],order=[];
 let nativeState,shortcutCalls=0,unblock;const barrier=holdStop?new Promise(resolve=>unblock=resolve):Promise.resolve();
 const app=new EventEmitter();Object.assign(app,{isPackaged:false,quitCount:0,whenReady:()=>Promise.resolve(),quit(){this.quitCount++;}});
 class Window extends EventEmitter{constructor(){super();this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},setWindowOpenHandler(){},send(){}});windows.push(this);}setMenu(){}isDestroyed(){return this.dead;}show(){}focus(){}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}destroy(){if(this.dead)return;this.dead=true;order.push('destroy-'+windows.indexOf(this));this.emit('closed');}}
 const ipcMain={handle:(n,f)=>handlers.set(n,f),removeHandler:n=>handlers.delete(n)};
 const ses={setDisplayMediaRequestHandler(){},setPermissionCheckHandler(){},setPermissionRequestHandler(){}};
 const capture={createCaptureGate:()=>({select(){},dispose(){order.push('capture-dispose');}}),bindSelectedSource:()=>({kind:'window',hwnd:'123'}),createRemotePicker:()=>({choose:async()=>({source:{id:'window:123:82',name:'Own fixture'},audio:false}),dispose(){order.push('picker-dispose');}})};
 let nextSession=0;
 const sessions={createRemoteSession:()=>{const id=nextSession++;return{pair:async value=>{pairs.push(value);order.push('pair-'+id);return{publisher:{identity:'helper',token:'narrow',url:'wss://lk.example'}};},selected:async()=>{},stop:async()=>{order.push('stop-'+id);if(id===0){await barrier;if(failStop)throw Error('Native release failed');}order.push('stopped-'+id);}};}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,__dirname:path.dirname(filename),require:n=>n==='./remote-pc-capture.cjs'?capture:n==='./remote-pc-session.cjs'?sessions:n==='./remote-pc-input.cjs'?{createRemotePcInputController:options=>{nativeState=options.onState;return{};}}:localRequire(n),process:{...process,argv:['app',link('a')]},URL,Buffer,Uint8Array,AbortSignal,performance,setInterval,clearInterval,setTimeout,clearTimeout},{filename});
 await module.exports.runRemotePcHelper({app,BrowserWindow:Window,ipcMain,session:{fromPartition:()=>ses},desktopCapturer:{},screen:{},globalShortcut:{register:()=>{shortcutCalls++;return true;},unregister(){shortcutCalls++;}},dialog:{showMessageBox:async()=>({})}});await tick();await tick();
 return{app,windows,pairs,order,handlers,unblock,nativeState:value=>nativeState(value),shortcutCalls:()=>shortcutCalls,invite:(letter,server)=>app.emit('second-instance',{},['app',link(letter,server)]),stop(){const window=windows.at(-1);return handlers.get('remote-pc:stop')({sender:window.webContents,senderFrame:window.webContents.mainFrame});}};
}
test('replacement tickets queue one latest exact-origin request and drain only after old cleanup',async()=>{
 const f=await fixture({holdStop:true});f.invite('b');f.invite('b');f.invite('c');f.invite('z','https://foreign.example');f.invite('a');await tick();assert.deepEqual(f.pairs,[ticket('a')]);
 const closing=f.stop();await tick();assert.equal(f.windows[0].dead,false,'old owned window stays until native stop finishes');assert.equal(f.pairs.length,1,'no new picker/pair before exact old cleanup');f.unblock();await closing;await tick();await tick();
 assert.deepEqual(f.pairs,[ticket('a'),ticket('c')],'same-ticket dedup, latest only; foreign origin never replaces queue');assert.equal(f.windows[0].dead,true);assert.ok(f.order.indexOf('destroy-0')<f.order.indexOf('pair-1'));assert.equal(f.app.quitCount,0,'handoff must not quit the shared helper process');await f.stop();assert.equal(f.app.quitCount,1);
});
test('owned windows close and queued exact-origin handoff survives a native release rejection',async()=>{
 const f=await fixture({failStop:true});f.invite('b');await f.stop().catch(()=>{});await tick();await tick();assert.equal(f.windows[0].dead,true,'native release error cannot strand publisher window');assert.deepEqual(f.pairs,[ticket('a'),ticket('b')]);await f.stop();assert.equal(f.app.quitCount,1);
});

test('native sole-owner local Stop closes capture immediately; ordinary paused state preserves capture',async()=>{const f=await fixture({holdStop:true});f.nativeState({ready:false,active:false,pointerReady:false,stopped:false});assert.equal(f.windows[0].dead,false,'geometry/desktop pause is not a local Stop');f.nativeState({ready:false,active:false,pointerReady:false,stopped:true});assert.equal(f.windows[0].dead,true,'native local Stop tears down capture before a blocked cleanup ACK');assert.equal(f.shortcutCalls(),0,'Electron must not compete with native RegisterHotKey');f.nativeState({ready:false,stopped:true});f.unblock();await tick();await tick();assert.equal(f.app.quitCount,1,'duplicate stopped events share one cleanup');});
