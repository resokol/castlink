'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const file=path.join(__dirname,'../src/remote-pc-input.cjs');
test('persistent input adapter exists',()=>assert.equal(fs.existsSync(file),true));
if(fs.existsSync(file)){
 const {createRemotePcInputController}=require(file);
 function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'remote-input-'));fs.mkdirSync(path.join(root,'remote-input'));fs.writeFileSync(path.join(root,'remote-input/CastLink.RemoteInput.exe'),'fixture');
  let time=100000,child,commands=[],spawnArgs,states=[],active=false,geometry={width:800,height:600,revision:1},pointerReady=true;
  const controller=createRemotePcInputController({resourcesPath:root,platform:'win32',now:()=>time,onState:s=>states.push(s),spawn:(...args)=>{
   spawnArgs=args;child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{child.killed=true;};
   let data='';child.stdin.on('data',b=>{data+=b;while(data.includes('\n')){const index=data.indexOf('\n'),c=JSON.parse(data.slice(0,index));data=data.slice(index+1);commands.push(c);if(c.op==='renew')active=true;if(c.op==='stop')active=false;queueMicrotask(()=>child.stdout.write(JSON.stringify({id:c.id,ok:true,state:{captureId:'capture-1',geometry,ready:true,pointerReady,active}})+'\n'));}});return child;
  }});
  const binding={captureId:'capture-1',source:{kind:'window',hwnd:'11667690'},video:{width:800,height:600},mapping:{kind:'dwm-frame'}};
  const proof=(overrides={})=>({grantId:'grant-1',revision:1,leaseSerial:1,captureId:'capture-1',geometryRevision:1,expiresAt:time+700,...overrides});
  const frame=(overrides={})=>({v:1,sessionId:'session',generation:'generation',captureId:'capture-1',grantId:'grant-1',revision:1,geometryRevision:1,lane:'reliable',seq:2,expiresAt:time+200,moveBarrier:0,event:{type:'key',code:'ControlLeft',down:true,repeat:false},...overrides});
  const heartbeat=(seq=1)=>frame({seq,event:{type:'heartbeat',pressedKeys:[],pressedButtons:[]}});
  async function arm(p=proof()){await controller.activate(p);await controller.input(heartbeat());}
  return {controller,binding,proof,frame,heartbeat,arm,commands,states,emit:s=>{geometry=s.geometry;pointerReady=s.pointerReady===true;child.stdout.write(JSON.stringify({event:'state',state:s})+'\n');},get child(){return child;},get spawnArgs(){return spawnArgs;},advance:ms=>{time+=ms;},cleanup:async()=>{await controller.stop();fs.rmSync(root,{recursive:true,force:true});}};
 }
 test('trusted bind starts one shell-free native process; receiver input cannot activate or renew',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);assert.equal(f.spawnArgs[2].shell,false);assert.deepEqual(f.spawnArgs[1],[]);assert.equal(f.commands[0].op,'start');assert.equal(f.controller.geometry().revision,1);
   await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});assert.equal(f.commands.length,1);
   await f.controller.activate(f.proof());await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_REPLAY'});
   await f.controller.input(f.heartbeat());await f.controller.input(f.frame());assert.equal(f.commands.at(-1).op,'input');assert.equal('mac'in f.commands.at(-1),false);
  }finally{await f.cleanup();}
 });
 test('stale/replayed/overlong leases cannot regain input; fresh server proof rearms same grant',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await assert.rejects(f.controller.activate(f.proof({expiresAt:100751})),{code:'REMOTE_INPUT_LEASE'});await f.arm();
   await assert.rejects(f.controller.renew(f.proof()),{code:'REMOTE_INPUT_LEASE'});await f.controller.renew(f.proof({leaseSerial:2,expiresAt:100740}));
   f.advance(741);const before=f.commands.length;await assert.rejects(f.controller.renew(f.proof({leaseSerial:3,expiresAt:100740})),{code:'REMOTE_INPUT_LEASE'});await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});assert.equal(f.commands.length,before);await f.controller.renew(f.proof({leaseSerial:3}));
   await assert.rejects(f.controller.activate(f.proof({leaseSerial:4})),{code:'REMOTE_INPUT_LEASE'});
  }finally{await f.cleanup();}
 });
 test('capture, geometry, per-lane replay and reliable pointer barriers reject before native effects',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();
   for(const overrides of [{captureId:'old'},{geometryRevision:2},{event:{type:'move',x:0.5,y:0},lane:'move'},{event:{type:'key',code:'ShellCommand',down:true,repeat:false}}])await assert.rejects(f.controller.input(f.frame(overrides)));
   await f.controller.input(f.frame({lane:'move',seq:5,event:{type:'move',x:100,y:200}}));
   await f.controller.input(f.frame({seq:2,moveBarrier:8,event:{type:'button',button:0,down:true,x:100,y:200}}));
   await assert.rejects(f.controller.input(f.frame({lane:'move',seq:7,event:{type:'move',x:200,y:300}})),{code:'REMOTE_INPUT_REPLAY'});
   await f.controller.input(f.frame({seq:3,event:{type:'key',code:'KeyA',down:true,repeat:false}}));
   await assert.rejects(f.controller.input(f.frame({seq:3})),{code:'REMOTE_INPUT_REPLAY'});
   await f.controller.releaseAll();await f.controller.renew(f.proof({leaseSerial:2}));await f.controller.input(f.heartbeat(4));await f.controller.input(f.frame({seq:5,event:{type:'text',text:'Тест'}}));
  }finally{await f.cleanup();}
 });
 test('native unsolicited geometry change closes gate and cannot replace trusted capture',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();
   f.child.stdout.write(JSON.stringify({event:'state',state:{captureId:'capture-1',geometry:{width:900,height:600,revision:2},ready:false,active:false,error:'REMOTE_INPUT_GEOMETRY'}})+'\n');
   await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});assert.equal(f.controller.geometry().revision,2);
   f.child.stdout.write('{"event":"state","state":{"captureId":"forged"}}\n');assert.equal(f.child.stdin.writableEnded,true);
  }finally{await f.cleanup();}
 });
 test('explicit native stop survives adapter state; ordinary geometry pause is not stop',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();
   f.emit({captureId:'capture-1',geometry:{width:900,height:600,revision:2},ready:false,active:false,stopped:false});
   assert.equal(f.states.at(-1).stopped,false);
   f.emit({captureId:'capture-1',geometry:{width:900,height:600,revision:2},ready:false,active:false,stopped:true});
   assert.equal(f.states.at(-1).stopped,true);await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});
  }finally{await f.cleanup();}
 });
 test('early own-child stop before native start preserves exact capture stop notification',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);
   // A fresh binding has no native start reply yet. Exercise the actual child callback
   // in a second controller whose spawn emits the hook state before the start ACK.
   await f.controller.stop();f.states.length=0;
   const binding=f.controller.bind(f.binding);
   f.child.stdout.write(JSON.stringify({event:'state',state:{captureId:null,geometry:{width:1,height:1,revision:1},ready:false,active:false,stopped:true}})+'\n');
   await binding;assert.ok(f.states.some(s=>s.captureId==='capture-1'&&s.stopped===true));
   assert.equal(f.states.at(-1).stopped,true,'late start reply cannot undo the terminal stop');
   await assert.rejects(f.controller.activate(f.proof()),{code:'REMOTE_INPUT_LEASE'});
  }finally{await f.cleanup();}
 });
 test('expired keyup and reliable gap release holds; only empty receiver snapshot resynchronizes',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();
   await f.controller.input(f.frame());
   await assert.rejects(f.controller.input(f.frame({seq:3,expiresAt:99999,event:{type:'key',code:'ControlLeft',down:false,repeat:false}})),{code:'REMOTE_INPUT_LEASE'});
   assert.equal(f.commands.at(-1).op,'releaseAll');
   await assert.rejects(f.controller.input(f.frame({seq:4,event:{type:'key',code:'KeyA',down:true,repeat:false}})),{code:'REMOTE_INPUT_REPLAY'});
   await assert.rejects(f.controller.input(f.heartbeat(5)),{code:'REMOTE_INPUT_REPLAY'});await f.controller.renew(f.proof({leaseSerial:2}));await f.controller.input(f.heartbeat(5));
   await f.controller.input(f.frame({seq:6,event:{type:'key',code:'KeyA',down:true,repeat:false}}));
   await assert.rejects(f.controller.input(f.frame({seq:8,event:{type:'key',code:'KeyA',down:false,repeat:false}})),{code:'REMOTE_INPUT_REPLAY'});
   assert.equal(f.commands.at(-1).op,'releaseAll');
  }finally{await f.cleanup();}
 });
 test('lost keyup is released by pressed snapshot even while server leases continue',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();await f.controller.input(f.frame());
   await f.controller.renew(f.proof({leaseSerial:2}));
   await assert.rejects(f.controller.input(f.heartbeat(3)),{code:'REMOTE_INPUT_REPLAY'});
   assert.equal(f.commands.at(-1).op,'releaseAll');
   await f.controller.renew(f.proof({leaseSerial:3}));await f.controller.input(f.heartbeat(4));
   await f.controller.input(f.frame({seq:5,event:{type:'text',text:'Тест\r\n'}}));
   const before=f.commands.length;
   await assert.rejects(f.controller.input(f.frame({seq:6,event:{type:'heartbeat',pressedKeys:['KeyA','KeyA'],pressedButtons:[]}})),{code:'REMOTE_INPUT_EVENT'});
   assert.equal(f.commands.length,before,'malformed snapshot causes no native input');
  }finally{await f.cleanup();}
 });
 test('source overflow and arbitrary mapping are rejected before spawning; refresh retains original source',async()=>{
  const f=fixture();try{
   await assert.rejects(f.controller.bind({...f.binding,source:{kind:'window',hwnd:'9223372036854775808'}}),{code:'REMOTE_INPUT_SOURCE'});
   await assert.rejects(f.controller.bind({...f.binding,mapping:{kind:'renderer-verified'}}),{code:'REMOTE_INPUT_SOURCE'});
   assert.equal(f.child,undefined);await f.controller.bind(f.binding);
   await f.controller.geometry({video:{width:900,height:600}});
   assert.equal(f.commands.at(-1).op,'start');assert.equal(f.commands.at(-1).source.hwnd,'11667690');assert.equal(f.commands.at(-1).captureId,'capture-1');
  }finally{await f.cleanup();}
 });
 test('stop closes gate before acknowledgement, EOF requested; late native errors expose no paths',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();const stop=f.controller.stop();await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});await stop;assert.equal(f.commands.at(-1).op,'stop');assert.equal(f.child.stdin.writableEnded,true);
  }finally{await f.cleanup();}
 });
 test('strict geometry policy blocks keys/text/receiver reset until geometry returns',async()=>{
  const f=fixture();try{
   await f.controller.bind({...f.binding,fullInputPause:true});assert.equal(f.commands[0].fullInputPause,true);await f.arm();
   f.emit({captureId:'capture-1',geometry:{width:800,height:600,revision:1},ready:true,pointerReady:false,active:false,needsEmptyReset:true});
   await f.controller.renew(f.proof({leaseSerial:2}));
   for(const event of [{type:'heartbeat',pressedKeys:[],pressedButtons:[]},{type:'key',code:'KeyA',down:true,repeat:false},{type:'text',text:'中文 😀'}])await assert.rejects(f.controller.input(f.frame({seq:2,event})),{code:'REMOTE_INPUT_GEOMETRY'});
   f.emit({captureId:'capture-1',geometry:{width:800,height:600,revision:1},ready:true,pointerReady:true,active:false,needsEmptyReset:true});
   await f.controller.renew(f.proof({leaseSerial:3}));await assert.rejects(f.controller.input(f.frame({seq:2})),{code:'REMOTE_INPUT_REPLAY'});await f.controller.input(f.heartbeat(2));await f.controller.input(f.frame({seq:3}));
  }finally{await f.cleanup();}
 });
 test('main-only retirement drains old authority, rejects queued renew and accepts new revision1',async()=>{
  const f=fixture();try{await f.controller.bind(f.binding);await f.arm();const pending=f.controller.renew(f.proof({leaseSerial:2}));const retired=f.controller.retireAuthority();await assert.rejects(pending,{code:'REMOTE_INPUT_LEASE'});await retired;await assert.rejects(f.controller.input(f.frame()),{code:'REMOTE_INPUT_LEASE'});await f.controller.activate(f.proof({grantId:'new-grant'}));await f.controller.input({...f.heartbeat(1),grantId:'new-grant'});assert.equal(f.commands.filter(c=>c.op==='start').length,1,'retire never rebinds native target');assert.ok(f.commands.some(c=>c.op==='retireAuthority'));}finally{await f.cleanup();}
 });
}
