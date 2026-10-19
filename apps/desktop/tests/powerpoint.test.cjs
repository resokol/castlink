'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const controllerFile=path.join(__dirname,'../src/powerpoint.cjs');
const createPowerPointController=fs.existsSync(controllerFile)?require(controllerFile).createPowerPointController:undefined;
const helperPath='C:\\Program Files\\CastLink\\native\\Control.ps1';
const binding='a'.repeat(64),otherBinding='b'.repeat(64);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
  assert.equal(typeof createPowerPointController,'function','the native PowerPoint controller API must exist');
  const f={calls:[],confirmations:[],kills:0,state:{windowHandle:'12345',binding,name:'Presentation.pptx',pages:12,page:3}};
  f.execFile=(executable,args,settings,callback)=>{
    const request={executable,args,settings,callback};f.calls.push(request);
    if(!f.hold)queueMicrotask(()=>{
      if(f.failure)return callback(f.failure,'',f.stderr||'');
      if(args.includes('-Page'))f.state.page=Number(args[args.indexOf('-Page')+1]);
      callback(null,f.output??JSON.stringify(f.state),'');
    });
    return{kill(){f.kills++;}};
  };
  f.controller=createPowerPointController({helperPath,execFile:f.execFile,confirm:async value=>{f.confirmations.push(value);return true;},...options});
  return f;
}
test('connect requires native consent, revalidates one running slideshow and uses fixed arguments only',async()=>{
  const f=fixture(),connected=await f.controller.connect();
  assert.match(connected.id,/^[0-9a-f-]{36}$/);assert.deepEqual(Object.keys(connected).sort(),['id','name','page','pages']);
  assert.deepEqual(f.confirmations,[{name:'Presentation.pptx',pages:12}]);
  assert.equal(f.calls.length,2,'consent is followed by exact-window revalidation');
  assert.deepEqual(f.calls[0].args,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helperPath,'-Operation','status']);
  assert.deepEqual(f.calls[1].args,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helperPath,'-Operation','status','-WindowHandle','12345','-Binding',binding]);
  for(const call of f.calls){assert.match(call.executable,/\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);assert.equal(call.settings.shell,false);assert.equal(call.settings.windowsHide,true);assert.equal(call.settings.encoding,'utf8');assert.equal(call.settings.timeout,10000);assert.equal(call.settings.maxBuffer,16384);assert.ok(!call.args.includes('-Command'));}
  assert.deepEqual(await f.controller.status(connected.id),connected);
  assert.deepEqual(await f.controller.goTo({id:connected.id,page:9,command:'Quit',file:'evil.pptx'}),{...connected,page:9});
  assert.deepEqual(f.calls.at(-1).args,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helperPath,'-Operation','goto','-WindowHandle','12345','-Binding',binding,'-Page','9']);
  assert.deepEqual(await f.controller.disconnect(connected.id),{ok:true});
  await assert.rejects(f.controller.status(connected.id),{code:'POWERPOINT_STALE'});
});
test('declined or nonboolean consent never creates a control grant',async()=>{
  for(const approval of [false,undefined,{response:0}]){
    const f=fixture({confirm:async()=>approval});await assert.rejects(f.controller.connect(),{code:'POWERPOINT_DECLINED'});assert.equal(f.calls.length,1);
    await assert.rejects(f.controller.goTo({id:'unknown',page:2}),{code:'POWERPOINT_STALE'});
  }
});
test('document changes during confirmation or after connection revoke the exact binding',async()=>{
  let confirm;const f=fixture({confirm:()=>new Promise(resolve=>{confirm=resolve;})});
  const pending=f.controller.connect();await tick();f.state.binding=otherBinding;confirm(true);
  await assert.rejects(pending,{code:'POWERPOINT_STALE'});assert.equal(f.calls.length,2);
  const g=fixture(),connected=await g.controller.connect();g.state.binding=otherBinding;
  await assert.rejects(g.controller.status(connected.id),{code:'POWERPOINT_STALE'});
  const before=g.calls.length;await assert.rejects(g.controller.goTo({id:connected.id,page:2}),{code:'POWERPOINT_STALE'});assert.equal(g.calls.length,before);
});
test('only one native operation runs, disconnect cancels pending work and stale IDs cannot replace a grant',async()=>{
  const f=fixture(),connected=await f.controller.connect();f.hold=true;
  const pending=f.controller.status(connected.id);await assert.rejects(f.controller.goTo({id:connected.id,page:2}),{code:'POWERPOINT_BUSY'});
  await assert.rejects(f.controller.connect(),{code:'POWERPOINT_BUSY'});
  await assert.rejects(f.controller.disconnect('another-id'),{code:'POWERPOINT_STALE'});
  assert.equal(f.calls.length,3);const rejected=assert.rejects(pending,{code:'POWERPOINT_STALE'});
  assert.deepEqual(await f.controller.disconnect(connected.id),{ok:true});await rejected;assert.equal(f.kills,1);
  f.calls.at(-1).callback(null,JSON.stringify(f.state),'');
  await assert.rejects(f.controller.status(connected.id),{code:'POWERPOINT_STALE'});
});
test('dispose during consent or native execution cannot issue a late grant',async()=>{
  let confirm;const f=fixture({confirm:()=>new Promise(resolve=>{confirm=resolve;})});
  const pending=f.controller.connect();await tick();f.controller.dispose();confirm(true);
  await assert.rejects(pending,{code:'POWERPOINT_CLOSED'});assert.equal(f.calls.length,1);
  await assert.rejects(f.controller.connect(),{code:'POWERPOINT_CLOSED'});
  const g=fixture();g.hold=true;const native=g.controller.connect(),rejected=assert.rejects(native,{code:'POWERPOINT_CLOSED'});
  g.controller.dispose();await rejected;assert.equal(g.kills,1);g.calls[0].callback(null,JSON.stringify(g.state),'');
});
test('invalid page numbers and forged IDs never reach PowerShell',async()=>{
  const f=fixture(),connected=await f.controller.connect(),before=f.calls.length;
  for(const page of [0,-1,13,1.5,'2',NaN,Infinity,null,{},'1; Quit'])await assert.rejects(f.controller.goTo({id:connected.id,page}),{code:'POWERPOINT_PAGE'});
  await assert.rejects(f.controller.goTo({id:'12345; -Command evil',page:2}),{code:'POWERPOINT_STALE'});
  assert.equal(f.calls.length,before);
  assert.equal((await f.controller.goTo({id:connected.id,page:1})).page,1);
});
test('native failure, oversized or malformed output fails closed without exposing stderr or file paths',async()=>{
  for(const output of ['not JSON','x'.repeat(16385),JSON.stringify({windowHandle:'0',binding,name:'bad',pages:3,page:1}),JSON.stringify({windowHandle:'12345',binding:'bad',name:'bad',pages:3,page:1}),JSON.stringify({windowHandle:'12345',binding,name:'bad',pages:3,page:4})]){
    const f=fixture();f.output=output;await assert.rejects(f.controller.connect(),{code:'POWERPOINT_UNAVAILABLE'});assert.equal(f.confirmations.length,0);
  }
  const f=fixture(),connected=await f.controller.connect();f.failure=Object.assign(Error('C:\\private\\secret.pptx'),{code:'ETIMEDOUT'});f.stderr='private token';
  await assert.rejects(f.controller.status(connected.id),error=>error.code==='POWERPOINT_UNAVAILABLE'&&!error.message.includes('private')&&!error.message.includes('secret'));
  await assert.rejects(f.controller.status(connected.id),{code:'POWERPOINT_STALE'});
  const g=fixture();g.state.name='C:\\private\\deck\u0000.pptx';g.state.fullName='C:\\private\\deck.pptx';
  assert.equal((await g.controller.connect()).name,'deck.pptx');assert.deepEqual(g.confirmations,[{name:'deck.pptx',pages:12}]);
});
test('goto must confirm the requested slide and reconnect invalidates the previous opaque ID',async()=>{
  const f=fixture(),first=await f.controller.connect(),second=await f.controller.connect();assert.notEqual(first.id,second.id);
  await assert.rejects(f.controller.status(first.id),{code:'POWERPOINT_STALE'});
  f.output=JSON.stringify(f.state);await assert.rejects(f.controller.goTo({id:second.id,page:8}),{code:'POWERPOINT_UNAVAILABLE'});
  await assert.rejects(f.controller.status(second.id),{code:'POWERPOINT_STALE'});
});
