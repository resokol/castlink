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

test('prepare uses local picker only, returns no path, cancellation preserves selection and never contacts Office',async()=>{
  const picks=['C:\\Private\\Talk.pptx',null,'C:\\Private\\bad.pdf','relative.pptx','https://example.org/deck.pptx'];
  const f=fixture({chooseFile:async()=>picks.shift()});
  const selected=await f.controller.prepare({path:'C:\\evil.pptx'});
  assert.match(selected.preparedId,/^[0-9a-f-]{36}$/);assert.deepEqual(Object.keys(selected).sort(),['name','preparedId']);assert.equal(selected.name,'Talk.pptx');
  assert.equal(await f.controller.prepare(),null);
  for(let i=0;i<3;i++)await assert.rejects(f.controller.prepare(),{code:'POWERPOINT_FILE'});
  assert.equal(f.calls.length,0);
  await assert.rejects(f.controller.start({preparedId:'C:\\Private\\Talk.pptx'}),{code:'POWERPOINT_STALE'});
  const started=await f.controller.start({preparedId:selected.preparedId,path:'C:\\evil.pptx'});
  assert.equal(started.name,'Presentation.pptx');
  assert.ok(f.calls[0].args.includes('-FilePath'));assert.equal(f.calls[0].args.at(-1),'C:\\Private\\Talk.pptx');
});
test('repeat start observes exact existing show, preparation replacement invalidates old ID, new start invalidates old grant',async()=>{
  const picks=['C:\\one.pptx','C:\\two.pptx'];const f=fixture({chooseFile:async()=>picks.shift()});
  const one=await f.controller.prepare(),first=await f.controller.start(one);
  f.state.page=7;const again=await f.controller.start(one);assert.equal(again.id,first.id);assert.equal(again.page,7);
  assert.equal(f.calls.filter(x=>x.args[x.args.indexOf('-Operation')+1]==='start').length,1);
  const two=await f.controller.prepare();await assert.rejects(f.controller.start(one),{code:'POWERPOINT_STALE'});
  const second=await f.controller.start(two);assert.notEqual(second.id,first.id);
  await assert.rejects(f.controller.status(first.id),{code:'POWERPOINT_STALE'});
});
test('step acknowledges same-slide animation, observes owner movement and deduplicates before native effect',async()=>{
  const f=fixture(),connected=await f.controller.connect();Object.assign(f.state,{page:12,clickIndex:1,clickCount:3,showPosition:12,ended:false});
  const request={id:connected.id,commandId:'click-1',direction:'next'};
  const result=await f.controller.step(request);assert.equal(result.commandId,'click-1');assert.equal(result.status.page,12);assert.equal(result.status.clickIndex,1);
  const count=f.calls.length;assert.deepEqual(await f.controller.step(request),result);assert.equal(f.calls.length,count);
  await assert.rejects(f.controller.step({...request,direction:'previous'}),{code:'POWERPOINT_COMMAND'});
  assert.ok(f.calls.at(-1).args.includes('-Direction'));assert.equal(f.calls.at(-1).args.at(-1),'next');assert.ok(!f.calls.at(-1).args.includes('-Page'));
  f.state.page=6;assert.equal((await f.controller.status(connected.id)).page,6);
  assert.equal(f.calls.at(-1).args[f.calls.at(-1).args.indexOf('-Operation')+1],'status');
  for(const direction of ['left','Next',null])await assert.rejects(f.controller.step({id:connected.id,commandId:'bad',direction}),{code:'POWERPOINT_COMMAND'});
});
test('inflight duplicate step shares completion, unknown effect revokes grant and is never repeated',async()=>{
  const f=fixture(),connected=await f.controller.connect();f.hold=true;
  const request={id:connected.id,commandId:'held-command',direction:'next'};
  const one=f.controller.step(request),two=f.controller.step(request);await tick();assert.equal(f.calls.length,3);
  f.calls.at(-1).callback(null,JSON.stringify(f.state),'');assert.deepEqual(await one,await two);
  f.hold=false;f.failure=Error('ambiguous native completion');await assert.rejects(f.controller.step({...request,commandId:'uncertain'}),{code:'POWERPOINT_UNAVAILABLE'});
  const count=f.calls.length;await assert.rejects(f.controller.step({...request,commandId:'uncertain'}),{code:'POWERPOINT_STALE'});assert.equal(f.calls.length,count);
});
test('step exposes truthful ended and optional observation fields without leaking paths',async()=>{
  const f=fixture(),connected=await f.controller.connect();Object.assign(f.state,{page:12,clickIndex:3,clickCount:3,showPosition:12,ended:true,fullName:'C:\\Private\\Talk.pptx'});
  const result=await f.controller.step({id:connected.id,commandId:'end',direction:'next'});
  assert.deepEqual(result.status,{...connected,page:12,clickIndex:3,clickCount:3,showPosition:12,ended:true});
  for(const field of ['clickIndex','clickCount','showPosition']){const g=fixture();g.state[field]='invalid';await assert.rejects(g.controller.connect(),{code:'POWERPOINT_UNAVAILABLE'});}
});

test('expired or malformed command deadline never reaches native effect',async()=>{
  const f=fixture(),connected=await f.controller.connect(),before=f.calls.length;
  for(const expiresAt of [Date.now()-1,NaN,'soon',0])await assert.rejects(f.controller.step({id:connected.id,commandId:'expired',direction:'next',expiresAt}),{code:'POWERPOINT_COMMAND'});
  assert.equal(f.calls.length,before);
  const expiresAt=Date.now()+3000;await f.controller.step({id:connected.id,commandId:'fresh',direction:'next',expiresAt});
  assert.equal(f.calls.at(-1).args.at(-1),String(expiresAt));assert.ok(f.calls.at(-1).args.includes('-ExpiresAt'));
});

test('ambiguous start is consumed, repeat owner action requires selecting again',async()=>{
  const f=fixture({chooseFile:async()=>'C:\\Private\\Deck.pptx'}),prepared=await f.controller.prepare();
  f.failure=Error('native timeout after possible Run');await assert.rejects(f.controller.start(prepared),{code:'POWERPOINT_UNAVAILABLE'});
  const before=f.calls.length;f.failure=undefined;await assert.rejects(f.controller.start(prepared),{code:'POWERPOINT_STALE'});assert.equal(f.calls.length,before);
  const selectedAgain=await f.controller.prepare();await f.controller.start(selectedAgain);assert.equal(f.calls.length,before+1);
});
test('unsupported native click state is explicit and new grants cannot replay consumed commands',async()=>{
  const f=fixture(),first=await f.controller.connect();
  await f.controller.step({id:first.id,commandId:'one',direction:'next'});
  const second=await f.controller.connect();const before=f.calls.length;
  await assert.rejects(f.controller.step({id:first.id,commandId:'one',direction:'next'}),{code:'POWERPOINT_STALE'});assert.equal(f.calls.length,before);
  f.failure=Object.assign(Error('private automatic state'),{code:2});
  await assert.rejects(f.controller.step({id:second.id,commandId:'unsupported',direction:'next'}),{code:'POWERPOINT_STEP_UNAVAILABLE'});
  const after=f.calls.length;await assert.rejects(f.controller.step({id:second.id,commandId:'unsupported',direction:'next'}),{code:'POWERPOINT_STALE'});assert.equal(f.calls.length,after);
});
test('dispose during local picker prevents late preparation and preserves no usable ID',async()=>{
  let choose;const f=fixture({chooseFile:()=>new Promise(resolve=>{choose=resolve;})});
  const prepared=f.controller.prepare();f.controller.dispose();choose('C:\\Private\\Deck.pptx');
  await assert.rejects(prepared,{code:'POWERPOINT_CLOSED'});assert.equal(f.calls.length,0);
});
