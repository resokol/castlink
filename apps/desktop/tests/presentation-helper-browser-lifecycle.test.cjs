'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
test('approved browser helper can pair again after revocation and late old failures cannot detach the new pair',async()=>{
 const file=path.join(__dirname,'../src/presentation-helper.cjs'),localRequire=createRequire(file),handlers=new Map(),timers=new Map(),calls=[],controllers=[];
 const app=new EventEmitter();Object.assign(app,{whenReady:async()=>{},isPackaged:false,quit(){}});
 let window,sequence=0,pairs=0,polls=0,releasePermission,releaseResult,revokeSecond=false;
 const firstPermission=new Promise(resolve=>{releasePermission=resolve;}),oldResult=new Promise(resolve=>{releaseResult=resolve;});
 class Window extends EventEmitter{
  constructor(){super();window=this;this.webContents={mainFrame:{url:''},setWindowOpenHandler(){},on(){}};}
  async loadFile(page){this.webContents.mainFrame.url=require('node:url').pathToFileURL(page).href;}
  show(){}focus(){}isDestroyed(){return false;}
 }
 const response=(status,value)=>({ok:status===200,status,headers:{get:()=>null},text:async()=>JSON.stringify(value)});
 const context={module:{exports:{}},__dirname:path.dirname(file),process:{argv:[]},URL,Buffer,Date,AbortSignal,
  setInterval:fn=>{timers.set(++sequence,fn);return sequence;},clearInterval:id=>timers.delete(id),
  require:name=>name==='electron'?{ipcMain:{handle:(channel,fn)=>handlers.set(channel,fn),removeHandler:channel=>handlers.delete(channel)}}:name==='./native-presentation-desktop.cjs'?{createDesktopPresentationController:()=>{const controller={disposed:0,async connectBrowser(){return{id:'native',name:'Deck.pptx',page:1,pages:3};},async step(){},dispose(){this.disposed++;}};controllers.push(controller);return controller;}}:localRequire(name),
  fetch:async(_url,options)=>{
   const body=JSON.parse(options.body);calls.push(body);
   if(body.action==='pair'){pairs++;return response(200,{token:'ch2_'+String(pairs).repeat(43),connectionId:`${pairs}1111111-1111-4111-8111-111111111111`,expiresAt:Date.now()+3600000,context:{room:'Room',ownerIdentity:'caster'}});}
   if(body.action==='poll'){
    polls++;if(pairs===1&&polls===1)return response(200,{operation:{operationId:'11111111-1111-4111-8111-111111111111',method:'connectBrowser',args:{},expiresAt:Date.now()+180000}});
    if(pairs===1)return response(401,{});
    if(revokeSecond)return response(401,{});
    return response(200,{operation:null});
   }
   if(body.action==='result')return oldResult;
   return response(200,{});
  }};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 let permissionCount=0;
 await context.module.exports.runPresentationHelper({app,BrowserWindow:Window,dialog:{showMessageBox:async(_window,value)=>{if(value.message==='Разрешить совместное листание в CastLink?'){permissionCount++;assert.equal(value.buttons[0],'Разрешить');if(permissionCount===1)return firstPermission;}return{response:0};}}});
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},launch=letter=>app.emit('open-url',{preventDefault(){}},'castlink-presenter://connect?server=https%3A%2F%2Fcastlink.ru#cp2_'+letter.repeat(43));
 launch('a');await settle();assert.equal(calls.filter(call=>call.action==='poll').length,0,'no capability or command polling before room permission');
 releasePermission({response:0});await settle();assert.equal(calls.find(call=>call.action==='poll').browserControl,1);assert.equal(calls.filter(call=>call.action==='result').length,1);
 launch('a');await settle();assert.equal(pairs,1,'the same active ticket only focuses its existing permission/session');
 launch('b');await settle();assert.equal(pairs,1,'a newer ticket must wait for the current pair to terminate');
 [...timers.values()][0]();await settle();assert.equal(controllers[0].disposed,1,'revocation disposes only the old local controller');
 assert.equal(pairs,2,'a handoff link arriving before the old revocation poll is retained without a manual helper Disconnect');
 releaseResult(response(500,{}));await settle();
 assert.equal(handlers.get('presentation-helper:state')(event).state,'connected','late old delivery failure cannot overwrite a newer helper state');
 assert.equal(controllers[1].disposed,0);assert.equal(timers.size,1);
 launch('b');await settle();revokeSecond=true;[...timers.values()][0]();await settle();
 assert.equal(pairs,2,'a repeated active ticket is never queued and replayed after its revocation');
 await handlers.get('presentation-helper:disconnect')(event);assert.equal(timers.size,0);assert.equal(controllers[1].disposed,1);
});
