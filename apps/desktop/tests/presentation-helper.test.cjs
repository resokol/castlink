'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('helper consumes commands once, keeps polling during local picker and detaches without Office close',async()=>{
 const file=path.join(__dirname,'../src/presentation-helper.cjs');assert.ok(fs.existsSync(file),'isolated helper runtime exists');
 const {createHelperSession,helperEndpoint}=require(file);
 assert.throws(()=>helperEndpoint('http://example.com',true));assert.throws(()=>helperEndpoint('https://u:p@example.com',false));assert.throws(()=>helperEndpoint('https://example.com/other',false));
 assert.equal(helperEndpoint('https://example.com',false),'https://example.com/api/co-presentation-helper');
 assert.equal(helperEndpoint('http://127.0.0.1:9999',true),'http://127.0.0.1:9999/api/co-presentation-helper');
 let calls=0,disposed=0,release,now=Date.now(),polls=0,results=0,resultName;
 const blocked=new Promise(r=>release=r),op={operationId:'11111111-1111-4111-8111-111111111111',method:'prepare',args:{},expiresAt:now+180000};
 const controller={prepare:async()=>{calls++;await blocked;return{preparedId:'opaque',name:'a'.repeat(190)+'.pptx'}},dispose:()=>disposed++};
 const post=async(body)=>{if(body.action==='pair')return{token:'ch2_'+'a'.repeat(43),connectionId:'11111111-1111-4111-8111-111111111111',expiresAt:now+3600000};if(body.action==='poll'){polls++;return{operation:op}}if(body.action==='result'){results++;resultName=body.result.name;return{ok:true}}return{}};
 const session=createHelperSession({controller,post,confirm:async()=>true,changed:()=>{}});
 await session.pair('cp2_'+'a'.repeat(43));await session.poll();await session.poll();assert.equal(calls,1);assert.equal(polls,2,'heartbeat polling continues while native picker is blocked');
 release();await new Promise(r=>setImmediate(r));assert.equal(results,1);assert.equal(resultName.length,180,'wire name respects current web limit without changing the local path');
 await session.poll();assert.equal(calls,1,'duplicate server delivery cannot repeat local picker');
 await session.disconnect();assert.equal(disposed,1);await session.poll();assert.equal(calls,1);
});
test('isolated helper renderer exposes no generic IPC or file paths',()=>{
 const preload=fs.readFileSync(path.join(__dirname,'../src/helper-preload.cjs'),'utf8');
 assert.match(preload,/contextBridge/);assert.doesNotMatch(preload,/sendSync|readFile|executeJavaScript|shell\.|openExternal/);
});

test('650 periodic status polls keep the pair alive without evicting mutating consumed IDs',async()=>{
 const {createHelperSession}=require('../src/presentation-helper.cjs'),savedNow=Date.now;
 let clock=savedNow(),calls=0,disposed=0,currentOp,prepareCalls=0;
 Date.now=()=>clock;
 const preparedOp={operationId:'22222222-2222-4222-8222-222222222222',method:'prepare',args:{},expiresAt:clock+180000};
 const controller={status:async()=>{calls++;return{id:'native',name:'Deck.pptx',page:1,pages:2}},prepare:async()=>{prepareCalls++;return{preparedId:'opaque',name:'Deck.pptx'}},dispose:()=>disposed++};
 const post=async body=>body.action==='pair'?{token:'ch2_'+'a'.repeat(43),connectionId:'11111111-1111-4111-8111-111111111111',expiresAt:clock+3600000}:body.action==='poll'?{operation:currentOp}:{ok:true};
 const session=createHelperSession({controller,post,confirm:async()=>true});
 try{
   await session.pair('cp2_'+'a'.repeat(43));currentOp=preparedOp;await session.poll();await new Promise(r=>setImmediate(r));
   for(let i=0;i<650;i++){currentOp={operationId:require('node:crypto').randomUUID(),method:'status',args:{id:'native'},expiresAt:clock+15000};await session.poll();await new Promise(r=>setImmediate(r));clock+=1000;}
   assert.equal(calls,650,'read-only status polling must not exhaust mutating command capacity');assert.equal(disposed,0);
   currentOp={...preparedOp,expiresAt:clock+180000};await session.poll();await new Promise(r=>setImmediate(r));assert.equal(prepareCalls,1,'old mutating ID remains consumed even when status history is pruned');
 }finally{await session.disconnect();Date.now=savedNow;}
});

test('helper forwards only allowlisted native diagnostics without private messages or paths',async()=>{
 const {createHelperSession}=require('../src/presentation-helper.cjs');
 for(const code of ['POWERPOINT_COM_UNAVAILABLE','POWERPOINT_NO_SLIDESHOW','POWERPOINT_UNKNOWN']){
  let result;
  const operation={operationId:'11111111-1111-4111-8111-111111111111',method:'connect',args:{},expiresAt:Date.now()+60000};
  const session=createHelperSession({controller:{connect:async()=>{throw Object.assign(Error('C:\\Private\\secret.pptx'),{code});},dispose(){}},confirm:async()=>true,
   post:async body=>{if(body.action==='pair')return{token:'ch2_'+'a'.repeat(43),connectionId:operation.operationId,expiresAt:Date.now()+60000};if(body.action==='poll')return{operation};if(body.action==='result')result=body.result;return{};}});
  await session.pair('cp2_'+'a'.repeat(43));await session.poll();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(result,{error:code==='POWERPOINT_UNKNOWN'?'POWERPOINT_UNAVAILABLE':code});assert.ok(!JSON.stringify(result).includes('Private'));
  await session.disconnect();
 }
});

test('browser capability is advertised only by a strict step controller and connectBrowser retains named native consent',async()=>{
 const {createHelperSession}=require('../src/presentation-helper.cjs');
 for(const capable of [false,true]){
  let poll,result,calls=0,confirmations=0;
  const operation={operationId:'11111111-1111-4111-8111-111111111111',method:'connectBrowser',args:{},expiresAt:Date.now()+180000};
  const controller={...(capable?{async connectBrowser(){calls++;return{id:'browser',name:'Deck.pptx',pages:3,page:1};},async step(){}}:{}),dispose(){}};
  const session=createHelperSession({controller,confirm:async()=>{confirmations++;return true;},post:async body=>{if(body.action==='pair')return{token:'ch2_'+'a'.repeat(43),connectionId:operation.operationId,expiresAt:Date.now()+3600000};if(body.action==='poll'){poll=body;return{operation:capable?operation:null};}if(body.action==='result')result=body.result;return{};}});
  await session.pair('cp2_'+'a'.repeat(43));assert.equal(poll,undefined,'pairing never polls before the runtime approves room context');
  await session.poll();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(poll.browserControl,capable?1:undefined);assert.equal(confirmations,0,'the controller performs its own exact named-show consent without a duplicate generic dialog');
  assert.equal(calls,capable?1:0);if(capable)assert.equal(result.id,'browser');
  await session.disconnect();
 }
});
