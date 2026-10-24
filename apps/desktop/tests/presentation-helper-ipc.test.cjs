'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('helper IPC rejects foreign frames and renderer paths, denies remote navigation and locks runtime isolation',async()=>{
 const handlers=new Map(),events=new Map(),module={exports:{}};
 let options,window,confirmations=0,informational=0,pairs=0,disposed=0,blockConfirmation=false,release;
 const pending=new Promise(r=>release=r);
 class BrowserWindow{
  constructor(value){options=value;window=this;this.webContents={mainFrame:{url:''},setWindowOpenHandler:fn=>this.open=fn,on:(name,fn)=>events.set(name,fn)};}
  async loadFile(page){this.webContents.mainFrame.url=require('node:url').pathToFileURL(page).href;}
  on(){}
  isDestroyed(){return false;}
  show(){}
  focus(){}
 }
 const src=path.join(__dirname,'../src');
 const modules={electron:{ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:()=>{}}},'./presenter-protocol.cjs':require('../src/presenter-protocol.cjs'),'./native-presentation-desktop.cjs':{createDesktopPresentationController:()=>({dispose:()=>disposed++,prepare:()=>assert.fail('No Office effects in IPC test'),start:()=>assert.fail('No Office effects in IPC test'),connect:()=>assert.fail('No Office effects in IPC test')})}};
 const fetch=async(_url,options)=>{const body=JSON.parse(options.body);if(body.action==='pair')pairs++;return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({token:'ch2_'+'a'.repeat(43),connectionId:'11111111-2222-4333-8444-555555555555',expiresAt:Date.now()+60000,context:{room:'fixture-room',ownerIdentity:'guest-fixture'}})};};
 vm.runInNewContext(fs.readFileSync(path.join(src,'presentation-helper.cjs'),'utf8'),{module,exports:module.exports,require:n=>Object.hasOwn(modules,n)?modules[n]:require(n),__dirname:src,process:{argv:[],resourcesPath:'C:/resources'},fetch,URL,Buffer,Date,Set,AbortSignal,clearInterval,setInterval});
 await module.exports.runPresentationHelper({app:{on(){},whenReady:async()=>{},isPackaged:false,quit(){}},BrowserWindow,dialog:{showMessageBox:async(_window,value)=>{if(value.type==='question'){confirmations++;if(blockConfirmation)await pending;}else informational++;return{response:1}}}});
 assert.equal(options.webPreferences.contextIsolation,true);assert.equal(options.webPreferences.nodeIntegration,false);assert.equal(options.webPreferences.sandbox,true);
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
 assert.throws(()=>handlers.get('presentation-helper:state')({...event,senderFrame:{url:event.senderFrame.url}}));
 await assert.rejects(handlers.get('presentation-helper:connect')({...event,sender:{}},{server:'https://test.example',code:'cp2_'+'a'.repeat(43)}));
 await assert.rejects(handlers.get('presentation-helper:connect')(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43),path:'C:/local.pptx'}));assert.equal(confirmations,0);assert.equal(pairs,0);
 let prevented=false;events.get('will-navigate')({preventDefault(){prevented=true}},'https://test.example');assert.equal(prevented,true);assert.equal(window.open().action,'deny');
 // Multiple local Connect clicks must not open two independent authorizations.
 const old=handlers.get('presentation-helper:connect');
 await old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});assert.equal(confirmations,1);assert.equal(pairs,1);assert.equal(disposed,1,'declined consent releases only its test adapter');
 blockConfirmation=true;const first=old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});
 await new Promise(setImmediate);assert.equal(confirmations,2);assert.equal(pairs,2);assert.equal(handlers.get('presentation-helper:state')(event).state,'confirming');
 const second=await old(event,{server:'https://test.example',code:'cp2_'+'a'.repeat(43)});
 assert.equal(second.state,'confirming','busy Connect returns the existing authorization state');assert.equal(confirmations,2,'a second Connect request must not open another consent dialog');assert.equal(pairs,2,'busy Connect cannot consume another pairing ticket');assert.equal(informational,1,'busy state is reported without a second authorization');release();await first;assert.equal(disposed,2);assert.equal(handlers.get('presentation-helper:state')(event).state,'disconnected');
});
