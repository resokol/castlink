const assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const {createHelperBroker}=load('../lib/co-presentation-helper.ts');
(async()=>{
 const owner={identity:'presenter',sid:'presenter-sid',association:'qa'},scope={studioId:'qa',room:'qa'},store=createHelperBroker({live:async()=>owner});
 let pair=store.createPair(scope,owner),native=await store.pair(pair.code),state=await store.owner(scope,owner,'state',{});
 assert.equal(state.connected,true);assert.equal(state.ready,false,'pairing is not approval/readiness');assert.equal(state.browserControl,false);
 const connect=()=>store.owner(scope,owner,'request',{clientRequestId:crypto.randomUUID(),method:'connectBrowser',args:{}});
 await assert.rejects(connect,'no native effects before locally approved poll');
 await store.native(native.token,native.connectionId,'poll',{});state=await store.owner(scope,owner,'state',{});
 assert.equal(state.ready,true);assert.equal(state.browserControl,false,'old component never silently uses foreground connect');await assert.rejects(connect);
 await assert.rejects(store.native(native.token,native.connectionId,'poll',{browserControl:2}),'finite capability only');
 await store.native(native.token,native.connectionId,'poll',{browserControl:1});state=await store.owner(scope,owner,'state',{});assert.equal(state.browserControl,true);
 const started=Date.now(),queued=await connect(),op=(await store.native(native.token,native.connectionId,'poll',{browserControl:1})).operation;
 assert.equal(op.method,'connectBrowser');assert.deepEqual(op.args,{});assert.ok(op.expiresAt>=started+179000,'local named consent gets bounded 180 seconds');
 await store.native(native.token,native.connectionId,'result',{operationId:queued.operationId,result:{error:'POWERPOINT_DECLINED'}});
 assert.deepEqual((await store.owner(scope,owner,'result',{operationId:queued.operationId})).result,{error:'POWERPOINT_DECLINED'});
 const invalid=await connect();await store.native(native.token,native.connectionId,'poll',{browserControl:1});
 await assert.rejects(store.native(native.token,native.connectionId,'result',{operationId:invalid.operationId,result:{error:'PRIVATE_PATH_TOKEN'}}),'unknown error payload rejected');
 await assert.rejects(store.native(native.token,native.connectionId,'result',{operationId:invalid.operationId,result:{id:'wrong-window',name:'Document.pdf',kind:'window'}}),'connectBrowser is PowerPoint only; never accept window controls');
 await store.native(native.token,native.connectionId,'result',{operationId:invalid.operationId,result:{id:'ppt',name:'Effects.pptx',pages:3,page:1}});
 const windowStart=await store.owner(scope,owner,'request',{clientRequestId:crypto.randomUUID(),method:'start',args:{preparedId:'prepared-window'}});await store.native(native.token,native.connectionId,'poll',{browserControl:1});
 await store.native(native.token,native.connectionId,'result',{operationId:windowStart.operationId,result:{id:'legacy-window',name:'Document.pdf',kind:'window'}});
 assert.equal((await store.owner(scope,owner,'result',{operationId:windowStart.operationId})).result.kind,'window','existing explicitly prepared window flow stays supported');
 pair=store.createPair(scope,owner);native=await store.pair(pair.code);state=await store.owner(scope,owner,'state',{});
 assert.equal(state.ready,false,'replacement pairing resets approval');assert.equal(state.browserControl,false,'replacement pairing resets capabilities');
 await assert.rejects(store.owner(scope,{...owner,sid:'recipient-sid'},'request',{clientRequestId:crypto.randomUUID(),method:'connectBrowser',args:{}}),'other SID cannot inherit presenter component');
 const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;
 try {
  const timed=createHelperBroker({live:async()=>owner});let challenge=timed.createPair(scope,owner),peer=await timed.pair(challenge.code);
  clock+=45000;assert.equal((await timed.owner(scope,owner,'state',{})).connected,true,'pre-ready local approval has120s, not active30s heartbeat');
  await assert.rejects(timed.owner(scope,owner,'request',{clientRequestId:crypto.randomUUID(),method:'connectBrowser',args:{}}),'approval grace never permits an operation');
  await timed.native(peer.token,peer.connectionId,'poll',{browserControl:1});clock+=30001;await assert.rejects(timed.owner(scope,owner,'state',{}),'active heartbeat remains30s');
  challenge=timed.createPair(scope,owner);peer=await timed.pair(challenge.code);clock+=120001;await assert.rejects(timed.native(peer.token,peer.connectionId,'poll',{browserControl:1}),'unapproved pair expires120s');
 } finally {Date.now=savedNow;}
 console.log('PASS browser presenter helper readiness/capability gate, fixed method, named-consent budget, finite errors and exact pairing/SID');
})().catch(error=>{console.error(error);process.exitCode=1});
