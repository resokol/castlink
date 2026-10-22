'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const filename=path.resolve(__dirname,'../src/presentation-helper.cjs'),localRequire=createRequire(filename),tick=()=>new Promise(r=>setImmediate(r));
async function fixture(context={room:'Verified room',ownerIdentity:'caster',ownerName:'Verified caster'}){
 const app=new EventEmitter();app.whenReady=()=>Promise.resolve();app.quit=()=>{};app.isPackaged=true;
 const ipcMain={handlers:new Map(),handle(k,v){this.handlers.set(k,v)},removeHandler(k){this.handlers.delete(k)}};
 const posts=[],dialogs=[],timers=[];let answer,disposed=0;
 class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};}loadFile(){return Promise.resolve();}show(){}focus(){}}
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,__dirname:path.dirname(filename),Buffer,URL,AbortSignal,process:{argv:['client.exe','castlink-presenter://connect?server=https%3A%2F%2Fcastlink.ru#cp2_'+'a'.repeat(43)],resourcesPath:'C:/component'},setInterval:fn=>{timers.push(fn);return 1},clearInterval(){},fetch:async(_url,options)=>{
  const body=JSON.parse(options.body);posts.push(body);const data=body.action==='pair'?{token:'ch2_'+'a'.repeat(43),connectionId:'11111111-1111-4111-8111-111111111111',expiresAt:Date.now()+3600000,context}:{};
  return{ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)};
 },require:n=>n==='electron'?{ipcMain}:n==='./native-presentation-desktop.cjs'?{createDesktopPresentationController:()=>({dispose(){disposed++}})}:localRequire(n)});
 const window=await module.exports.runPresentationHelper({app,BrowserWindow:Window,dialog:{showMessageBox:async(_window,options)=>{dialogs.push(options);if(options.type==='info')return{response:0};return new Promise(r=>answer=r);}}});await tick();
 return{app,posts,dialogs,timers,window,answer:response=>answer({response}),disposed:()=>disposed,stop:async()=>{const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};window.webContents.mainFrame={url:require('node:url').pathToFileURL(path.resolve(__dirname,'../ui/presentation-helper.html')).href};event.senderFrame=window.webContents.mainFrame;await ipcMain.handlers.get('presentation-helper:disconnect')(event)}};
}
test('automatic bootstrap consumes ticket, shows verified scope and never polls/native-operates before local approval',async()=>{
 const f=await fixture();assert.deepEqual(f.posts.map(p=>p.action),['pair']);assert.equal(f.timers.length,0);assert.match(f.dialogs[0].detail,/Verified room/);assert.match(f.dialogs[0].detail,/Verified caster/);
 f.answer(0);await tick();assert.equal(f.timers.length,1);assert.deepEqual(f.posts.map(p=>p.action),['pair','poll']);
 f.app.emit('second-instance',{},['client.exe','castlink-presenter://connect?server=https%3A%2F%2Fcastlink.ru#cp2_'+'b'.repeat(43)]);await tick();assert.equal(f.posts.filter(p=>p.action==='pair').length,1);assert.equal(f.disposed(),0,'second URI cannot replace active scope');await f.stop();assert.equal(f.disposed(),1);
});
test('local cancellation revokes consumed bootstrap without polling or native activity',async()=>{const f=await fixture();f.answer(1);await tick();assert.deepEqual(f.posts.map(p=>p.action),['pair','disconnect']);assert.equal(f.timers.length,0);assert.equal(f.disposed(),1);});
test('missing or untrusted context fails closed and revokes issued token',async()=>{for(const context of [null,{room:'URI room',ownerIdentity:'caster',ownerName:'bad\u202ename'}]){const f=await fixture(context);await tick();assert.equal(f.dialogs.length,0);assert.deepEqual(f.posts.map(p=>p.action),['pair','disconnect']);assert.equal(f.timers.length,0);}});
