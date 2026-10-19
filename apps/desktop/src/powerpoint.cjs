'use strict';
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {execFile:executeFile}=require('node:child_process');

const MAX_OUTPUT=16384;
const messages={
  POWERPOINT_UNAVAILABLE:'PowerPoint slideshow is unavailable. Open a slideshow and reconnect.',
  POWERPOINT_DECLINED:'PowerPoint control was not approved.',
  POWERPOINT_STALE:'PowerPoint control has ended. Reconnect to the slideshow.',
  POWERPOINT_CLOSED:'PowerPoint control has ended.',
  POWERPOINT_BUSY:'PowerPoint is processing another request.',
  POWERPOINT_PAGE:'Invalid PowerPoint slide number.',
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
  return{windowHandle:value.windowHandle,binding:value.binding,name,pages:value.pages,page:value.page};
}

// Main-process adapter only. Renderer requests supply an opaque grant and a slide
// number; executable, helper path, operation names and argv are owned here.
function createPowerPointController({helperPath,powershellPath=path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),execFile=executeFile,confirm=async()=>false}){
  if(typeof helperPath!=='string'||helperPath.includes('\0')||!path.win32.isAbsolute(helperPath)&&!path.isAbsolute(helperPath)||!helperPath.toLowerCase().endsWith('.ps1'))throw failure('POWERPOINT_UNAVAILABLE');
  let disposed=false,generation=0,grant,busy,activeRun;
  const assertOpen=()=>{if(disposed)throw failure('POWERPOINT_CLOSED');};
  const current=epoch=>{assertOpen();if(epoch!==generation)throw failure('POWERPOINT_STALE');};
  const authorize=id=>{assertOpen();if(typeof id!=='string'||!grant||id!==grant.id)throw failure('POWERPOINT_STALE');return grant;};
  const publicStatus=(selected,status)=>({id:selected.id,name:status.name,pages:status.pages,page:status.page});
  const sameBinding=(expected,actual)=>{if(expected.windowHandle!==actual.windowHandle||expected.binding!==actual.binding)throw failure('POWERPOINT_STALE');};
  async function exclusive(action){
    assertOpen();if(busy)throw failure('POWERPOINT_BUSY');
    const operation={};busy=operation;
    try{return await action();}finally{if(busy===operation)busy=undefined;}
  }
  function native(operation,bound,page){
    assertOpen();
    const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helperPath,'-Operation',operation];
    if(bound)args.push('-WindowHandle',bound.windowHandle,'-Binding',bound.binding);
    if(page!==undefined)args.push('-Page',String(page));
    return new Promise((resolve,reject)=>{
      let child,finished=false;
      const run={cancel(code){finish(failure(code));try{child?.kill();}catch{}}};
      const finish=(error,value)=>{if(finished)return;finished=true;if(activeRun===run)activeRun=undefined;error?reject(error):resolve(value);};
      activeRun=run;
      try{
        child=execFile(powershellPath,args,{shell:false,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:MAX_OUTPUT},(error,stdout)=>{
          if(error){finish(failure('POWERPOINT_UNAVAILABLE'));return;}
          try{finish(undefined,parseStatus(stdout));}catch{finish(failure('POWERPOINT_UNAVAILABLE'));}
        });
      }catch{finish(failure('POWERPOINT_UNAVAILABLE'));}
    });
  }
  async function command(id,operation,page){
    const selected=authorize(id);
    if(operation==='goto'&&(!Number.isInteger(page)||page<1||page>selected.pages))throw failure('POWERPOINT_PAGE');
    return exclusive(async()=>{
      const epoch=generation;
      try{
        const status=await native(operation,selected,page);current(epoch);sameBinding(selected,status);
        if(operation==='goto'&&status.page!==page)throw failure('POWERPOINT_UNAVAILABLE');
        selected.pages=status.pages;
        return publicStatus(selected,status);
      }catch(error){if(grant===selected){grant=undefined;generation++;}throw error;}
    });
  }
  return{
    connect(){return exclusive(async()=>{
      grant=undefined;const epoch=++generation;
      const initial=await native('status');current(epoch);
      let approved;try{approved=await confirm({name:initial.name,pages:initial.pages});}catch{current(epoch);throw failure('POWERPOINT_DECLINED');}
      current(epoch);if(approved!==true)throw failure('POWERPOINT_DECLINED');
      const verified=await native('status',initial);current(epoch);sameBinding(initial,verified);
      grant={id:randomUUID(),windowHandle:verified.windowHandle,binding:verified.binding,pages:verified.pages};
      return publicStatus(grant,verified);
    });},
    async status(id){return command(id,'status');},
    async goTo(request){return command(request?.id,'goto',request?.page);},
    async disconnect(id){authorize(id);grant=undefined;generation++;activeRun?.cancel('POWERPOINT_STALE');return{ok:true};},
    dispose(){if(disposed)return;disposed=true;grant=undefined;generation++;activeRun?.cancel('POWERPOINT_CLOSED');},
  };
}
module.exports={createPowerPointController};
