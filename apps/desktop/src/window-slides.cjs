'use strict';
const path=require('node:path'),{randomUUID}=require('node:crypto'),{execFile:executeFile}=require('node:child_process');
const MAX_OUTPUT=65536;
const texts={WINDOW_SLIDES_UNAVAILABLE:'Выбранное окно PDF недоступно.',WINDOW_SLIDES_STALE:'Выбранное окно PDF изменилось. Выберите его заново.',
 WINDOW_SLIDES_FOREGROUND:'Верните выбранное окно PDF на передний план',WINDOW_SLIDES_DECLINED:'Управление PDF не разрешено.',
 WINDOW_SLIDES_BUSY:'Окно PDF обрабатывает предыдущий запрос.',WINDOW_SLIDES_COMMAND:'Недопустимая или просроченная команда PDF.',WINDOW_SLIDES_AMBIGUOUS:'Результат команды PDF неизвестен. Подключите окно заново.'};
const failure=code=>Object.assign(new Error(texts[code]||texts.WINDOW_SLIDES_UNAVAILABLE),{code});
const label=name=>typeof name==='string'?name.replace(/[\\/:\u0000-\u001f\u007f]/g,' ').slice(0,180).trim():'';
function binding(value){
 if(!value||typeof value.windowHandle!=='string'||!/^[1-9]\d{0,18}$/.test(value.windowHandle)||BigInt(value.windowHandle)>9223372036854775807n||
 typeof value.binding!=='string'||!/^[a-f0-9]{64}$/.test(value.binding)||!label(value.name))throw failure('WINDOW_SLIDES_UNAVAILABLE');
 return{windowHandle:value.windowHandle,binding:value.binding,name:label(value.name)};
}
function createWindowSlidesController({helperPath,execFile=executeFile,chooseWindow=async()=>null,confirm=async()=>false}){
 if(typeof helperPath!=='string'||helperPath.includes('\0')||!path.win32.isAbsolute(helperPath)&&!path.isAbsolute(helperPath)||!helperPath.toLowerCase().endsWith('.exe'))throw failure('WINDOW_SLIDES_UNAVAILABLE');
 let disposed=false,generation=0,busy,prepared,grant,activeRun;
 const open=()=>{if(disposed)throw failure('WINDOW_SLIDES_STALE');};
 const current=epoch=>{open();if(generation!==epoch)throw failure('WINDOW_SLIDES_STALE');};
 const authorize=id=>{open();if(typeof id!=='string'||!grant||grant.id!==id)throw failure('WINDOW_SLIDES_STALE');return grant;};
 const same=(a,b)=>{if(a.windowHandle!==b.windowHandle||a.binding!==b.binding)throw failure('WINDOW_SLIDES_STALE');};
 const publicStatus=(selected,status)=>({id:selected.id,name:status.name,kind:'window'});
 async function exclusive(action){open();if(busy)throw failure('WINDOW_SLIDES_BUSY');const token={};busy=token;try{return await action();}finally{if(busy===token)busy=undefined;}}
 function native(operation,target,request={}){
  open();const args=[operation];
  if(target)args.push(target.windowHandle,target.binding);
  if(operation==='step')args.push(request.direction,String(request.expiresAt??Date.now()+3000));
  return new Promise((resolve,reject)=>{
   let child,done=false;
   const run={cancel(){finish(failure('WINDOW_SLIDES_STALE'));try{child?.kill();}catch{}}};
   const finish=(error,value)=>{if(done)return;done=true;if(activeRun===run)activeRun=undefined;error?reject(error):resolve(value);};activeRun=run;
   try{child=execFile(helperPath,args,{shell:false,windowsHide:true,encoding:'utf8',timeout:5000,maxBuffer:MAX_OUTPUT},(error,stdout)=>{
    try{
     if(typeof stdout!=='string'||Buffer.byteLength(stdout)>MAX_OUTPUT)throw failure('WINDOW_SLIDES_UNAVAILABLE');
     const value=JSON.parse(stdout.replace(/^\uFEFF/,''));
     if(error){const code=typeof value?.error==='string'&&Object.hasOwn(texts,value.error)?value.error:'WINDOW_SLIDES_UNAVAILABLE';throw failure(code);}
     if(operation==='list'){if(!Array.isArray(value)||value.length>64)throw failure('WINDOW_SLIDES_UNAVAILABLE');finish(undefined,value.map(binding));}
     else finish(undefined,binding(value));
    }catch(e){finish(e.code?e:failure('WINDOW_SLIDES_UNAVAILABLE'));}
   });}catch{finish(failure('WINDOW_SLIDES_UNAVAILABLE'));}
  });
 }
 async function observe(selected){
  const epoch=generation;try{const status=await native('status',selected);current(epoch);same(selected,status);return publicStatus(selected,status);}
  catch(error){if(grant===selected){grant=undefined;generation++;}throw error;}
 }
 return{
  prepare(){return exclusive(async()=>{
   const epoch=generation,windows=await native('list');current(epoch);
   const choices=windows.map(target=>({id:randomUUID(),name:target.name,target}));
   const selectedId=await chooseWindow(choices.map(({id,name})=>({id,name})));current(epoch);
   if(selectedId===null||selectedId===undefined)return null;
   const chosen=choices.find(v=>v.id===selectedId);if(!chosen)throw failure('WINDOW_SLIDES_STALE');
   prepared={preparedId:randomUUID(),name:chosen.name,target:chosen.target};
   return{preparedId:prepared.preparedId,name:prepared.name,kind:'window'};
  });},
  start(request){return exclusive(async()=>{
   if(!prepared||request?.preparedId!==prepared.preparedId)throw failure('WINDOW_SLIDES_STALE');
   if(prepared.startedId)return observe(authorize(prepared.startedId));
   if(prepared.attempted)throw failure('WINDOW_SLIDES_STALE');
   const selection=prepared,epoch=generation,verified=await native('status',selection.target);current(epoch);same(selection.target,verified);
   if(await confirm({name:selection.name})!==true){current(epoch);throw failure('WINDOW_SLIDES_DECLINED');}current(epoch);
   selection.attempted=true;grant=undefined;const activeEpoch=++generation;
   const status=await native('activate',selection.target);current(activeEpoch);same(selection.target,status);
   grant={...status,id:randomUUID(),commands:new Map()};selection.startedId=grant.id;
   return publicStatus(grant,status);
  });},
  status(id){return exclusive(()=>observe(authorize(id)));},
  async step(request){
   const selected=authorize(request?.id),{commandId,direction,expiresAt}=request;
   if(typeof commandId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(commandId)||!['next','previous'].includes(direction))throw failure('WINDOW_SLIDES_COMMAND');
   const cached=selected.commands.get(commandId);
   if(cached){if(cached.direction!==direction)throw failure('WINDOW_SLIDES_COMMAND');return cached.result;}
   if(expiresAt!==undefined&&(!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()))throw failure('WINDOW_SLIDES_COMMAND');
   if(busy)throw failure('WINDOW_SLIDES_BUSY');
   if(selected.commands.size>=4096){grant=undefined;generation++;throw failure('WINDOW_SLIDES_STALE');}
   const result=exclusive(async()=>{
    const epoch=generation;
    try{
     if(expiresAt!==undefined&&expiresAt<=Date.now())throw failure('WINDOW_SLIDES_COMMAND');
     const status=await native('step',selected,{direction,expiresAt});current(epoch);same(selected,status);
     return{commandId,status:publicStatus(selected,status)};
    }catch(error){
     if(error.code!=='WINDOW_SLIDES_FOREGROUND'&&grant===selected){grant=undefined;generation++;}
     throw error;
    }
   });
   selected.commands.set(commandId,{direction,result});return result;
  },
  async disconnect(id){authorize(id);grant=undefined;generation++;activeRun?.cancel();return{ok:true};},
  cancelPending(){generation++;activeRun?.cancel();},
  dispose(){if(disposed)return;disposed=true;grant=undefined;prepared=undefined;generation++;activeRun?.cancel();},
 };
}
module.exports={createWindowSlidesController};
