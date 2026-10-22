'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('helper IPC rejects foreign frames and renderer paths, denies remote navigation and locks runtime isolation',async()=>{
 const handlers=new Map(),events=new Map(),module={exports:{}};
 let options,window,confirmations=0,blockConfirmation=false,release;
 const pending=new Promise(r=>release=r);
 class BrowserWindow{
  constructor(value){options=value;window=this;this.webContents={mainFrame:{url:''},setWindowOpenHandler:fn=>this.open=fn,on:(name,fn)=>events.set(name,fn)};}
  async loadFile(page){this.webContents.mainFrame.url=require('node:url').pathToFileURL(page).href;}
  on(){}
 }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/presentation-helper.cjs'),'utf8'),{module,exports:module.exports,require:n=>n==='electron'?{ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:()=>{}}}:n==='./powerpoint.cjs'?{createPowerPointController:()=>{throw Error('No Office effects in IPC test')}}:require(n),__dirname:path.join(__dirname,'../src'),process:{argv:[],resourcesPath:'C:/resources'},URL,Buffer,Date,Set,AbortSignal,clearInterval,setInterval});
 await module.exports.runPresentationHelper({app:{whenReady:async()=>{},isPackaged:false,quit(){}},BrowserWindow,dialog:{showMessageBox:async()=>{confirmations++;if(blockConfirmation)await pending;return{response:1}}}});
 assert.equal(options.webPreferences.contextIsolation,true);assert.equal(options.webPreferences.nodeIntegration,false);assert.equal(options.webPreferences.sandbox,true);
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
 assert.throws(()=>handlers.get('presentation-helper:state')({...event,senderFrame:{url:event.senderFrame.url}}));
 await assert.rejects(handlers.get('presentation-helper:connect')({...event,sender:{}},{server:'https://test.example',code:'cp2_'+'a'.repeat(43)}));
 await assert.rejects(handlers.get('presentation-helper:connect')(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43),path:'C:/local.pptx'}));assert.equal(confirmations,0);
 let prevented=false;events.get('will-navigate')({preventDefault(){prevented=true}},'https://test.example');assert.equal(prevented,true);assert.equal(window.open().action,'deny');
 // Multiple local Connect clicks must not open two independent authorizations.
 const old=handlers.get('presentation-helper:connect');
 await old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});assert.equal(confirmations,1);
 blockConfirmation=true;const first=old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});
 const second=old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});second.catch(()=>{});
 assert.equal(confirmations,2,'a second Connect request must not open another consent dialog');release();await first;await assert.rejects(second);
});
