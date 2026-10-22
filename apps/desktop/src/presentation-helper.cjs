'use strict';
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const opaque=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const exact=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
function helperEndpoint(server,allowLoopback=false){
  if(typeof server!=='string'||server.length>2048)throw Error('Invalid helper server');
  const url=new URL(server);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||allowLoopback&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error('HTTPS server required');
  return url.origin+'/api/co-presentation-helper';
}
function validOperation(op){
  if(!exact(op,['operationId','method','args','expiresAt'])||!UUID.test(op.operationId)||!Number.isSafeInteger(op.expiresAt)||op.expiresAt<=Date.now()||!exact(op.args,['id','preparedId','commandId','direction','expiresAt','kind']))return false;
  const args=op.args;
  if(op.method==='prepare')return exact(args,[])||exact(args,['kind'])&&args.kind==='window';
  if(op.method==='connect')return exact(args,[]);
  if(op.method==='start')return exact(args,['preparedId'])&&opaque(args.preparedId);
  if(op.method==='status'||op.method==='disconnect')return exact(args,['id'])&&opaque(args.id);
  return op.method==='step'&&exact(args,['id','commandId','direction','expiresAt'])&&opaque(args.id)&&opaque(args.commandId)&&['next','previous'].includes(args.direction)&&Number.isSafeInteger(args.expiresAt)&&args.expiresAt>Date.now()&&args.expiresAt<=Date.now()+3000&&op.expiresAt<=args.expiresAt;
}
/** Polling and local Office work are intentionally independent; picker UI must
 * not prevent heartbeat, revocation or exact operation consumption. */
function createHelperSession({controller,post,confirm,changed=()=>{}}){
  let auth,closed=false,busy=false,polling=false,lastSuccess=Date.now();
  const consumed=new Map();
  const publish=state=>changed({state});
  async function detach(state){if(closed)return;closed=true;auth=undefined;controller.dispose();publish(state);}
  async function request(body){if(closed||!auth)throw Error('Helper disconnected');return post({...body,connectionId:auth.connectionId},auth.token);}
  async function execute(op){
    if(closed||busy||!validOperation(op)||consumed.has(op.operationId))return;
    // Status is read-only. Prune its expired delivery IDs while preserving
    // every mutating consumed ID until this pair ends.
    for(const [id,old] of consumed)if(old.method==='status'&&old.expiresAt<=Date.now())consumed.delete(id);
    if(consumed.size>=512){await detach('revoked');return;}
    consumed.set(op.operationId,{method:op.method,expiresAt:op.expiresAt});busy=true;let result;
    try{
      if((op.method==='start'||op.method==='connect')&&await confirm(op.method,op.args)!==true)throw Error('Declined');
      if(closed||op.expiresAt<=Date.now())return;
      switch(op.method){
        case 'prepare':result=await controller.prepare(op.args.kind?op.args:undefined);break;
        case 'start':result=await controller.start(op.args);break;
        case 'connect':result=await controller.connect();break;
        case 'status':result=await controller.status(op.args.id);break;
        case 'step':result=await controller.step(op.args);break;
        case 'disconnect':await controller.disconnect(op.args.id);result=null;break;
        default:return;
      }
    if(result&&typeof result.name==='string')result={...result,name:result.name.slice(0,180)};
      if(result?.status&&typeof result.status.name==='string')result={...result,status:{...result.status,name:result.status.name.slice(0,180)}};
    }catch(error){result={error:op.method==='step'&&error.code==='WINDOW_SLIDES_FOREGROUND'?'WINDOW_SLIDES_FOREGROUND':'HELPER_OPERATION_FAILED'};}
    finally{busy=false;}
    if(closed||op.expiresAt<=Date.now())return;
    // Retrying only a fixed result is safe; never repeat the Office operation.
    for(let attempt=0;attempt<2&&!closed;attempt++){
      try{await request({action:'result',operationId:op.operationId,result});lastSuccess=Date.now();return;}
      catch(error){if(error.status===401||error.status===403){await detach('revoked');return;}}
    }
    publish('error');
  }
  return{
    async pair(code){
      if(closed||auth||!/^cp2_[A-Za-z0-9_-]{43}$/.test(code))throw Error('Invalid pairing');
      const value=await post({action:'pair',code});
      if(closed)return;
      if(!/^ch2_[A-Za-z0-9_-]{43}$/.test(value.token)||!UUID.test(value.connectionId)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now())throw Error('Invalid pairing response');
      auth={token:value.token,connectionId:value.connectionId,expiresAt:value.expiresAt};lastSuccess=Date.now();publish('connected');return value;
    },
    async poll(){
      if(closed||!auth||polling)return;
      if(auth.expiresAt<=Date.now()||lastSuccess+30000<=Date.now()){await detach('revoked');return;}
      polling=true;
      try{const value=await request({action:'poll'});if(closed)return;lastSuccess=Date.now();if(value.operation)void execute(value.operation);}
      catch(error){if(error.status===401||error.status===403)await detach('revoked');else if(lastSuccess+30000<=Date.now())await detach('error');}
      finally{polling=false;}
    },
    async disconnect(){
      if(closed)return;
      const saved=auth;await detach('disconnected');
      if(saved)try{await post({action:'disconnect',connectionId:saved.connectionId},saved.token);}catch{}
    },
  };
}
async function readResponse(response){
  if(Number(response.headers.get('content-length'))>32768)throw Error('Helper response too large');
  const reader=response.body?.getReader();let raw='';
  if(reader){let size=0;const chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)throw Error('Helper response too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}raw=Buffer.concat(chunks).toString('utf8');}
  else raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>32768)throw Error('Helper response too large');
  return JSON.parse(raw);
}
function verifiedPairContext(value){
  if(!exact(value,['room','ownerIdentity','ownerName'])||typeof value.room!=='string'||!value.room||value.room.length>100||typeof value.ownerIdentity!=='string'||!value.ownerIdentity||value.ownerIdentity.length>256||value.ownerName!==undefined&&(typeof value.ownerName!=='string'||!value.ownerName||value.ownerName.length>100))throw Error('Invalid connection context');
  for(const text of [value.room,value.ownerIdentity,value.ownerName||''])if(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(text))throw Error('Invalid connection context');
  return{room:value.room,ownerIdentity:value.ownerIdentity,...(value.ownerName?{ownerName:value.ownerName}:{})};
}
async function runPresentationHelper({app,BrowserWindow,dialog}){
  const {ipcMain}=require('electron'),{isPresenterLaunch,parsePresenterLaunch}=require('./presenter-protocol.cjs');
  let receive,queued=process.argv.find(isPresenterLaunch);
  const deliver=input=>{if(receive)void receive(input);else if(!queued)queued=input;};
  app.on('second-instance',(_event,argv)=>{const input=argv.find(isPresenterLaunch);if(input)deliver(input);});
  app.on('open-url',(event,url)=>{event.preventDefault();if(isPresenterLaunch(url))deliver(url);});
  await app.whenReady();
  const page=path.join(__dirname,'../ui/presentation-helper.html'),pageUrl=pathToFileURL(page).href;
  const window=new BrowserWindow({width:540,height:410,minWidth:400,minHeight:350,title:'CastLink — совместные слайды',webPreferences:{preload:path.join(__dirname,'helper-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false}});
  let session,timer,connecting=false,connectionGeneration=0,state={state:'disconnected'};
  const trusted=event=>event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===pageUrl;
  const changed=value=>{state={...state,...value};};
  async function stop(){connectionGeneration++;clearInterval(timer);timer=undefined;const saved=session;session=undefined;await saved?.disconnect();state={state:'disconnected'};}
  async function connect(value,automatic=false){
    if(session||connecting){window.show();window.focus();await dialog.showMessageBox(window,{type:'info',message:'CastLink уже подключён',detail:'Сначала отключите текущее совместное листание. Новый запрос не изменил выбранную презентацию.'});return state;}
    const endpoint=helperEndpoint(value.server,!app.isPackaged&&process.argv.includes('--presentation-helper-allow-loopback-test'));
    if(!/^cp2_[A-Za-z0-9_-]{43}$/.test(value.code))throw Error('Invalid pairing');
    connecting=true;const epoch=++connectionGeneration;let controller;
    try{
      const resourcesPath=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../../artifacts/desktop-native');
      controller=require('./native-presentation-desktop.cjs').createDesktopPresentationController({resourcesPath,BrowserWindow,ipcMain,dialog,getWindow:()=>window});
      const post=async(body,token)=>{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw Object.assign(Error('Helper request failed'),{status:response.status});return readResponse(response);
      };
      const confirm=async(method,args)=>{
        if(method==='start'&&controller.preparedKind(args.preparedId)==='window')return true;
        return(await dialog.showMessageBox(window,{type:'question',buttons:['Разрешить','Отмена'],defaultId:1,cancelId:1,message:'Разрешить показ PowerPoint?',detail:'Оригинальный файл останется на этом компьютере. CastLink не закрывает и не сохраняет PowerPoint.'})).response===0;
      };
      const next=createHelperSession({controller,post,confirm,changed});session=next;
      const response=await next.pair(value.code);
      if(session!==next||epoch!==connectionGeneration)return state;
      // Bootstrap consumes the one-use ticket, but no polling/native operation
      // occurs until the local owner approves server-verified room/caster context.
      const context=response.context?verifiedPairContext(response.context):automatic?verifiedPairContext(null):null;
      state={state:'confirming',server:new URL(endpoint).origin,...(context?{room:context.room,owner:context.ownerName?context.ownerName+' ('+context.ownerIdentity+')':context.ownerIdentity}:{})};
      const approved=await dialog.showMessageBox(window,{type:'question',buttons:['Подключить','Отмена'],defaultId:1,cancelId:1,message:'Разрешить совместное листание в CastLink?',detail:[new URL(endpoint).origin,context?'Комната: '+context.room:'',context?'Кастер: '+(context.ownerName?context.ownerName+' ('+context.ownerIdentity+')':context.ownerIdentity):''].filter(Boolean).join('\n')});
      if(approved.response!==0||epoch!==connectionGeneration||session!==next){if(session===next)await stop();return state;}
      state={...state,state:'connected'};timer=setInterval(()=>{void next.poll();},500);void next.poll();return state;
    }catch{if(session)await stop();else controller?.dispose();state={state:'error'};return state;}
    finally{connecting=false;}
  }
  ipcMain.handle('presentation-helper:state',event=>{if(!trusted(event))throw Error('Untrusted helper frame');return state;});
  ipcMain.handle('presentation-helper:disconnect',async event=>{if(!trusted(event))throw Error('Untrusted helper frame');await stop();return state;});
  ipcMain.handle('presentation-helper:connect',async(event,value)=>{if(!trusted(event)||!exact(value,['server','code'])||typeof value.code!=='string')throw Error('Invalid helper request');return connect(value);});
  receive=async input=>{try{const value=parsePresenterLaunch(input);await connect(value,true);}catch{state={state:'error'};}};
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==pageUrl)event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.on('closed',()=>{void stop();for(const channel of ['connect','disconnect','state'])ipcMain.removeHandler('presentation-helper:'+channel);app.quit();});
  await window.loadFile(page);if(queued){const input=queued;queued=undefined;void receive(input);}
  return window;
}
module.exports={runPresentationHelper,createHelperSession,helperEndpoint,verifiedPairContext};
