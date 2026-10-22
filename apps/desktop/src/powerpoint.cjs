'use strict';
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {execFile:executeFile}=require('node:child_process');

const MAX_OUTPUT=16384,MAX_COMMANDS=4096;
const messages={
  POWERPOINT_UNAVAILABLE:'PowerPoint slideshow is unavailable. Open a slideshow and reconnect.',
  POWERPOINT_DECLINED:'PowerPoint control was not approved.',
  POWERPOINT_STALE:'PowerPoint control has ended. Reconnect to the slideshow.',
  POWERPOINT_CLOSED:'PowerPoint control has ended.',
  POWERPOINT_BUSY:'PowerPoint is processing another request.',
  POWERPOINT_PAGE:'Invalid PowerPoint slide number.',
  POWERPOINT_FILE:'Select a local PPTX file.',
  POWERPOINT_COMMAND:'Invalid or expired PowerPoint step command.',
  POWERPOINT_STEP_UNAVAILABLE:'PowerPoint animation step is unavailable for the current show state.',
};
const failure=code=>Object.assign(new Error(messages[code]),{code});
function parseStatus(stdout){
  if(typeof stdout!=='string'||Buffer.byteLength(stdout,'utf8')>MAX_OUTPUT)throw failure('POWERPOINT_UNAVAILABLE');
  let value;try{value=JSON.parse(stdout.replace(/^\uFEFF/,''));}catch{throw failure('POWERPOINT_UNAVAILABLE');}
  if(!value||typeof value!=='object'||typeof value.windowHandle!=='string'||!/^[1-9]\d{0,18}$/.test(value.windowHandle)||BigInt(value.windowHandle)>9223372036854775807n||
    typeof value.binding!=='string'||!/^[a-f0-9]{64}$/.test(value.binding)||typeof value.name!=='string'||
    !Number.isInteger(value.pages)||value.pages<1||value.pages>2147483647||!Number.isInteger(value.page)||value.page<1||value.page>value.pages)throw failure('POWERPOINT_UNAVAILABLE');
  const name=path.win32.basename(value.name).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200).trim();
  if(!name)throw failure('POWERPOINT_UNAVAILABLE');
  const status={windowHandle:value.windowHandle,binding:value.binding,name,pages:value.pages,page:value.page};
  for(const field of ['clickIndex','clickCount','showPosition']){
    if(value[field]!==undefined){
      if(!Number.isInteger(value[field])||value[field]<(field==='clickIndex'?-2:0)||value[field]>2147483647)throw failure('POWERPOINT_UNAVAILABLE');
      status[field]=value[field];
    }
  }
  if(value.ended!==undefined){if(typeof value.ended!=='boolean')throw failure('POWERPOINT_UNAVAILABLE');status.ended=value.ended;}
  return status;
}

// Main-process adapter only. Paths originate solely from the injected native
// picker; renderer requests carry opaque IDs and finite navigation commands.
function createPowerPointController({helperPath,powershellPath=path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),execFile=executeFile,confirm=async()=>false,chooseFile=async()=>null}){
  if(typeof helperPath!=='string'||helperPath.includes('\0')||!path.win32.isAbsolute(helperPath)&&!path.isAbsolute(helperPath)||!helperPath.toLowerCase().endsWith('.ps1'))throw failure('POWERPOINT_UNAVAILABLE');
  let disposed=false,generation=0,grant,busy,activeRun,prepared;
  const assertOpen=()=>{if(disposed)throw failure('POWERPOINT_CLOSED');};
  const current=epoch=>{assertOpen();if(epoch!==generation)throw failure('POWERPOINT_STALE');};
  const authorize=id=>{assertOpen();if(typeof id!=='string'||!grant||id!==grant.id)throw failure('POWERPOINT_STALE');return grant;};
  const publicStatus=(selected,status)=>{
    const result={id:selected.id,name:status.name,pages:status.pages,page:status.page};
    for(const field of ['clickIndex','clickCount','showPosition','ended'])if(status[field]!==undefined)result[field]=status[field];
    return result;
  };
  const sameBinding=(expected,actual)=>{if(expected.windowHandle!==actual.windowHandle||expected.binding!==actual.binding)throw failure('POWERPOINT_STALE');};
  const newGrant=status=>({id:randomUUID(),windowHandle:status.windowHandle,binding:status.binding,pages:status.pages,commands:new Map()});
  async function exclusive(action){
    assertOpen();if(busy)throw failure('POWERPOINT_BUSY');
    const operation={};busy=operation;
    try{return await action();}finally{if(busy===operation)busy=undefined;}
  }
  function native(operation,bound,page,extra={}){
    assertOpen();
    const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helperPath,'-Operation',operation];
    if(bound)args.push('-WindowHandle',bound.windowHandle,'-Binding',bound.binding);
    if(page!==undefined)args.push('-Page',String(page));
    if(extra.filePath!==undefined)args.push('-FilePath',extra.filePath);
    if(extra.direction!==undefined)args.push('-Direction',extra.direction);
    if(extra.expiresAt!==undefined)args.push('-ExpiresAt',String(extra.expiresAt));
    return new Promise((resolve,reject)=>{
      let child,finished=false;
      const run={cancel(code){finish(failure(code));try{child?.kill();}catch{}}};
      const finish=(error,value)=>{if(finished)return;finished=true;if(activeRun===run)activeRun=undefined;error?reject(error):resolve(value);};
      activeRun=run;
      try{
        child=execFile(powershellPath,args,{shell:false,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:MAX_OUTPUT},(error,stdout)=>{
          if(error){finish(failure(error.code===2?'POWERPOINT_STEP_UNAVAILABLE':'POWERPOINT_UNAVAILABLE'));return;}
          try{finish(undefined,parseStatus(stdout));}catch{finish(failure('POWERPOINT_UNAVAILABLE'));}
        });
      }catch{finish(failure('POWERPOINT_UNAVAILABLE'));}
    });
  }
  async function command(id,operation,page,extra={}){
    const selected=authorize(id);
    if(operation==='goto'&&(!Number.isInteger(page)||page<1||page>selected.pages))throw failure('POWERPOINT_PAGE');
    return exclusive(async()=>{
      const epoch=generation;
      try{
        if(extra.expiresAt!==undefined&&extra.expiresAt<=Date.now())throw failure('POWERPOINT_COMMAND');
        const status=await native(operation,selected,page,extra);current(epoch);sameBinding(selected,status);
        if(operation==='goto'&&status.page!==page)throw failure('POWERPOINT_UNAVAILABLE');
        selected.pages=status.pages;
        return publicStatus(selected,status);
      }catch(error){if(grant===selected){grant=undefined;generation++;}throw error;}
    });
  }
  return{
    prepare(){return exclusive(async()=>{
      const epoch=generation;
      let filePath;try{filePath=await chooseFile();}catch{current(epoch);throw failure('POWERPOINT_FILE');}
      current(epoch);if(filePath===null||filePath===undefined)return null;
      if(typeof filePath!=='string'||filePath.length>32767||/[\u0000-\u001f]/.test(filePath)||!(/^[a-z]:[\\/]/i.test(filePath))||path.win32.extname(filePath).toLowerCase()!=='.pptx')throw failure('POWERPOINT_FILE');
      const name=path.win32.basename(filePath).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200).trim();
      if(!name)throw failure('POWERPOINT_FILE');
      prepared={preparedId:randomUUID(),name,filePath};
      return{preparedId:prepared.preparedId,name};
    });},
    start(request){return exclusive(async()=>{
      if(!prepared||request?.preparedId!==prepared.preparedId)throw failure('POWERPOINT_STALE');
      if(prepared.startedId){
        const selected=authorize(prepared.startedId),epoch=generation;
        try{
          const status=await native('status',selected);current(epoch);sameBinding(selected,status);
          return publicStatus(selected,status);
        }catch(error){if(grant===selected){grant=undefined;generation++;}throw error;}
      }
      if(prepared.startAttempted)throw failure('POWERPOINT_STALE');
      grant=undefined;const epoch=++generation,selection=prepared;
      // A timeout can follow Run: consume the attempt before contacting Office.
      selection.startAttempted=true;
      const status=await native('start',undefined,undefined,{filePath:selection.filePath});current(epoch);
      grant=newGrant(status);selection.startedId=grant.id;
      return publicStatus(grant,status);
    });},
    connect(){return exclusive(async()=>{
      grant=undefined;const epoch=++generation;
      const initial=await native('status');current(epoch);
      let approved;try{approved=await confirm({name:initial.name,pages:initial.pages});}catch{current(epoch);throw failure('POWERPOINT_DECLINED');}
      current(epoch);if(approved!==true)throw failure('POWERPOINT_DECLINED');
      const verified=await native('status',initial);current(epoch);sameBinding(initial,verified);
      grant=newGrant(verified);
      return publicStatus(grant,verified);
    });},
    async status(id){return command(id,'status');},
    async goTo(request){return command(request?.id,'goto',request?.page);},
    async step(request){
      const selected=authorize(request?.id),{commandId,direction,expiresAt}=request;
      if(typeof commandId!=='string'||!(/^[a-zA-Z0-9_-]{1,128}$/).test(commandId)||!['next','previous'].includes(direction))throw failure('POWERPOINT_COMMAND');
      const cached=selected.commands.get(commandId);
      if(cached){if(cached.direction!==direction)throw failure('POWERPOINT_COMMAND');return cached.result;}
      if(expiresAt!==undefined&&(!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()))throw failure('POWERPOINT_COMMAND');
      if(busy)throw failure('POWERPOINT_BUSY');
      // Never evict consumed IDs: reaching the finite limit requires a new grant.
      if(selected.commands.size>=MAX_COMMANDS){grant=undefined;generation++;throw failure('POWERPOINT_STALE');}
      const result=command(selected.id,'step',undefined,{direction,expiresAt}).then(status=>({commandId,status}));
      selected.commands.set(commandId,{direction,result});
      return result;
    },
    async disconnect(id){authorize(id);grant=undefined;generation++;activeRun?.cancel('POWERPOINT_STALE');return{ok:true};},
    dispose(){if(disposed)return;disposed=true;grant=undefined;prepared=undefined;generation++;activeRun?.cancel('POWERPOINT_CLOSED');},
  };
}
module.exports={createPowerPointController};
