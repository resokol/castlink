const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ReserveClient}=require('../lib/client-reserve.ts');
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture({enabled=true,canActivate=true,role='studio',supported=true}={}){
 let now=1000,health='down',autoCommitted=false,failToggle=false,failArm=false,failSource=false,policyReply,healthGate,autoGate,toggleGate,armGate;
 let prepared={peerId:'peer',targetId:'reserve',label:'Reserve',targetUrl:'https://reserve.example',cohortId:'cohort',armGeneration:1,revision:1,snapshotAt:1000,readyUntil:301000,grant:'own-grant',role,sourceInstallationId:'source-iid',roomId:'room-id',autoProtocol:'outbound-heartbeat-v1',autoHeartbeatReady:true,autoSupported:supported,autoEnabled:enabled,autoEpoch:enabled?1:0};
 const calls=[],handoffs=[];
 const client=new ReserveClient({studioId:'studio',room:'room',token:'jwt',clientId:'primary',canActivate,now:()=>now,newOperationId:()=> 'same-op',onChange:()=>{},onHandoff:async value=>handoffs.push(value),fetch:async(url,options)=>{
  const body=options.body?JSON.parse(options.body):{};calls.push({url,body,options});
  if(url.startsWith('/')){
   if(failSource)throw TypeError('source offline');
   if(url.includes('action=health')){
    if(healthGate)return healthGate.promise;
    if(health==='network')throw TypeError('Failed to fetch');
    if(typeof health==='number')return response({error:'unavailable'},health);
    if(health==='malformed')return response({liveKitReady:false});
    return response({installationId:health==='wrong-iid'?'wrong':prepared.sourceInstallationId,studioId:'studio',roomId:prepared.roomId,liveKitReady:health==='healthy'});
   }
   if(body.action==='automation'){
    prepared={...prepared,autoEnabled:body.enabled,autoEpoch:prepared.autoEpoch+1};
    if(failToggle)throw Error('lost acknowledgement');
    if(toggleGate){const gate=toggleGate;toggleGate=undefined;const reply=response({armed:true,prepared:{...prepared}});await gate.promise;return reply;}
   }
   if(body.action==='arm'&&armGate)return armGate.promise;
   if(body.action==='arm'&&failArm)throw TypeError('selection unavailable');
   return response({armed:true,prepared:{...prepared}});
  }
  assert.equal(options.credentials,'omit');assert.equal(options.headers.authorization,'Bearer own-grant');
  if(body.action==='auto-activate'){
   assert.equal(body.autoEpoch,prepared.autoEpoch);
   if(autoGate)return autoGate.promise;
   if(autoCommitted)return response({status:'committed',operationId:body.operationId,ticket:'ticket',targetUrl:prepared.targetUrl});
  }
  if(body.action==='activate')return response({status:'committed',operationId:body.operationId,ticket:'ticket',targetUrl:prepared.targetUrl});
  return response(policyReply?{autoProtocol:'outbound-heartbeat-v1',autoHeartbeatReady:true,...policyReply}:{status:'armed',autoProtocol:'outbound-heartbeat-v1',autoHeartbeatReady:true,autoSupported:supported,autoEnabled:prepared.autoEnabled,autoEpoch:prepared.autoEpoch});
 }});
 return {client,calls,handoffs,get prepared(){return prepared;},setPrepared:value=>prepared={...prepared,...value},time:value=>now=value,health:value=>health=value,failToggle:value=>failToggle=value,failArm:value=>failArm=value,failSource:value=>failSource=value,armGate:value=>armGate=value,toggleGate:value=>toggleGate=value,policy:value=>policyReply=value,healthGate:value=>healthGate=value,autoGate:value=>autoGate=value,commit:()=>autoCommitted=true};
}
const automatic=f=>f.calls.filter(c=>c.body.action==='auto-activate');
const checks=async(f,times)=>{for(const time of times){f.time(time);await f.client.checkAutomatic();}};

test('default OFF, legacy target and passive roles never probe or activate',async()=>{
 for(const options of [{enabled:false},{supported:false},{canActivate:false},{role:'guest'},{role:'studio-viewer'}]){
  const f=fixture(options);await f.client.refresh();await checks(f,[1000,6000,11000,16000,21000]);
  assert.equal(f.calls.some(c=>c.url.includes('action=health')),false);assert.equal(automatic(f).length,0);
 }
 const f=fixture();f.setPrepared({autoEnabled:undefined,autoEpoch:undefined});await f.client.refresh();await checks(f,[1000,6000,11000,16000]);assert.equal(automatic(f).length,0);
});

test('primary needs fifteen seconds of spaced failures and target confirmation before handoff',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,2000,6000,11000]);assert.equal(automatic(f).length,0);
 await checks(f,[16000]);assert.equal(automatic(f).length,1);assert.equal(f.handoffs.length,0);assert.notEqual(f.client.view.phase,'committed');
 assert.equal(automatic(f)[0].body.operationId,'same-op');assert.equal(automatic(f)[0].body.revision,1);
 f.commit();await checks(f,[21000]);assert.equal(f.handoffs.length,1);assert.equal(f.client.view.phase,'committed');
});

test('healthy or ambiguous responses and long or backward clock gaps reset failures',async()=>{
 for(const reset of ['healthy','wrong-iid','malformed',401,403,404,429]){
  const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);f.health(reset);await checks(f,[16000]);f.health('down');await checks(f,[21000,26000,31000]);assert.equal(automatic(f).length,0,String(reset));await checks(f,[36000]);assert.equal(automatic(f).length,1,String(reset));
 }
 for(const gap of [30000,-10000]){
  const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000,gap,gap+5000,gap+10000]);assert.equal(automatic(f).length,0);await checks(f,[gap+15000]);assert.equal(automatic(f).length,1);
 }
});

test('network and trusted server errors are candidates with bounded health timeout',async()=>{
 for(const down of ['network',500,503]){
  const f=fixture();await f.client.refresh();f.health(down);await checks(f,[1000,6000,11000,16000]);assert.equal(automatic(f).length,1);
  const health=f.calls.find(c=>c.url.includes('action=health'));assert.equal(health.options.headers.authorization,'Bearer jwt');assert.ok(health.options.signal);
 }
});

test('snapshot refresh keeps outage evidence and operation ID while token renewal updates source bearer',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);f.setPrepared({revision:2,snapshotAt:11000,readyUntil:311000});await f.client.refresh();f.client.updateToken('renewed-jwt');await checks(f,[16000]);
 assert.equal(automatic(f).length,1);assert.equal(automatic(f)[0].body.revision,2);assert.equal(automatic(f)[0].body.operationId,'same-op');assert.equal(f.calls.filter(c=>c.url.includes('action=health')).at(-1).options.headers.authorization,'Bearer renewed-jwt');
});

test('disable immediately blocks attempts and lost acknowledgement remains unconfirmed until retry',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);f.failToggle(true);await f.client.setAutomatic(false);assert.equal(f.client.view.prepared.autoEnabled,true);assert.equal(f.client.view.autoPending,false);assert.equal(f.client.view.autoUnconfirmed,true);
 await checks(f,[16000,21000,26000]);assert.equal(automatic(f).length,0);f.policy({status:'armed',autoSupported:true,autoEnabled:true,autoEpoch:1});await f.client.poll();assert.equal(f.client.view.autoUnconfirmed,true);
 f.failToggle(false);await f.client.setAutomatic(false);assert.equal(f.client.view.prepared.autoEnabled,false);assert.equal(f.client.view.autoUnconfirmed,false);assert.equal(f.client.view.autoPending,undefined);
});

test('older status epoch cannot restore enabled policy after confirmed disable',async()=>{
 const f=fixture();await f.client.refresh();await f.client.setAutomatic(false);const epoch=f.client.view.prepared.autoEpoch;f.policy({status:'armed',autoSupported:true,autoEnabled:true,autoEpoch:epoch-1});await f.client.poll();assert.equal(f.client.view.prepared.autoEnabled,false);assert.equal(f.client.view.prepared.autoEpoch,epoch);
});

test('health probes do not overlap and disable during an in-flight check prevents activation',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);const gate=deferred();f.healthGate(gate);f.time(16000);const pending=f.client.checkAutomatic();await f.client.checkAutomatic();assert.equal(f.calls.filter(c=>c.url.includes('action=health')).length,4);await f.client.setAutomatic(false);gate.resolve(response({installationId:'source-iid',studioId:'studio',roomId:'room-id',liveKitReady:false}));await pending;assert.equal(automatic(f).length,0);
});

test('manual request during automatic activation shares operation and navigates once',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);const gate=deferred();f.autoGate(gate);f.time(16000);const auto=f.client.checkAutomatic();await new Promise(resolve=>setImmediate(resolve));const manual=f.client.activate();gate.resolve(response({status:'committed',operationId:'same-op',ticket:'ticket',targetUrl:'https://reserve.example'}));await Promise.all([auto,manual]);assert.equal(f.calls.filter(c=>['activate','auto-activate'].includes(c.body.action)).length,1);assert.equal(f.handoffs.length,1);
});

test('manual request waiting for unconfirmed automatic activation still performs the manual transfer',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000,6000,11000]);const gate=deferred();f.autoGate(gate);f.time(16000);const auto=f.client.checkAutomatic();await new Promise(resolve=>setImmediate(resolve));const manual=f.client.activate();gate.resolve(response({status:'armed',autoSupported:true,autoEnabled:true,autoEpoch:1}));await Promise.all([auto,manual]);
 assert.equal(f.calls.filter(c=>c.body.action==='activate').length,1);assert.equal(f.calls.filter(c=>c.body.action==='activate')[0].body.operationId,'same-op');assert.equal(f.handoffs.length,1);
});

test('healthy response clears the outage notice and stale equal-epoch source preparation preserves policy',async()=>{
 const f=fixture();await f.client.refresh();await checks(f,[1000]);assert.equal(f.client.view.sourceUnavailable,true);f.health('healthy');await checks(f,[6000]);assert.equal(f.client.view.sourceUnavailable,false);
 await f.client.setAutomatic(false);f.setPrepared({autoEnabled:true});await f.client.refresh();assert.equal(f.client.view.prepared.autoEnabled,false);
});

test('failed reserve selection preserves previous enabled automation without undoing a pending OFF',async()=>{
 for(const offPending of [false,true]){
  const f=fixture();await f.client.refresh();
  if(offPending){f.failToggle(true);await f.client.setAutomatic(false);}
  f.failArm(true);await f.client.select('another-reserve');await f.client.refresh();await f.client.poll();await checks(f,[1000,6000,11000,16000,21000]);
  assert.equal(f.client.view.prepared.targetId,'reserve');
  assert.equal(f.calls.filter(c=>c.url.includes('action=health')).length,offPending?0:5);
  assert.equal(automatic(f).length,offPending?0:2);
 }
});

test('OFF requested during pending enable is sent afterwards and fences the enable acknowledgement',async()=>{
 const f=fixture({enabled:false});await f.client.refresh();const gate=deferred();f.toggleGate(gate);
 const enable=f.client.setAutomatic(true);await new Promise(resolve=>setImmediate(resolve));const disable=f.client.setAutomatic(false);
 assert.equal(f.client.view.autoPending,false);assert.equal(f.client.view.autoUnconfirmed,true);await checks(f,[1000,6000,11000,16000]);assert.equal(automatic(f).length,0);
 gate.resolve();await Promise.all([enable,disable]);
 assert.deepEqual(f.calls.filter(c=>c.body.action==='automation').map(c=>c.body.enabled),[true,false]);assert.equal(f.client.view.prepared.autoEnabled,false);assert.equal(f.client.view.autoPending,undefined);assert.equal(f.client.view.autoUnconfirmed,false);
 await checks(f,[21000,26000,31000,36000]);assert.equal(f.calls.filter(c=>c.url.includes('action=health')).length,0);
});

test('authenticated target revision advance recovers lost snapshot acknowledgement without extending original grant readiness',async()=>{
 for(const mode of ['manual','automatic']){
  const f=fixture();await f.client.refresh();const original={...f.client.view.prepared};f.failSource(true);f.policy({status:'armed',cohortId:'cohort',armGeneration:1,revision:2,autoSupported:true,autoEnabled:true,autoEpoch:1});
  await f.client.refresh();await f.client.poll();assert.equal(f.client.view.prepared.revision,2);assert.equal(f.client.view.prepared.snapshotAt,original.snapshotAt);assert.equal(f.client.view.prepared.readyUntil,original.readyUntil);assert.equal(f.client.view.prepared.grant,original.grant);
  if(mode==='manual')await f.client.activate();else {f.commit();await checks(f,[1000,6000,11000,16000]);}
  const activation=f.calls.find(c=>c.body.action===(mode==='manual'?'activate':'auto-activate'));assert.equal(activation.body.revision,2);assert.equal(f.handoffs.length,1);
  f.time(301001);await f.client.poll();assert.equal(f.client.view.phase,'stale');
 }
 for(const status of [{status:'armed',revision:2},{status:'armed',cohortId:'wrong',armGeneration:1,revision:2},{status:'armed',cohortId:'cohort',armGeneration:2,revision:2},{status:'armed',cohortId:'cohort',armGeneration:1,revision:1.5}]){
  const f=fixture();await f.client.refresh();f.policy(status);await f.client.poll();assert.equal(f.client.view.prepared.revision,1);
 }
});

test('OFF requested during failed selection remains blocked and visibly pending until retry is acknowledged',async()=>{
 const f=fixture();await f.client.refresh();const gate=deferred();f.armGate(gate);const selection=f.client.select('another-reserve');
 await assert.rejects(()=>f.client.setAutomatic(false),/выбора резерва/);assert.equal(f.client.view.autoPending,false);assert.equal(f.client.view.autoUnconfirmed,true);
 gate.reject(TypeError('selection unavailable'));await selection;await f.client.refresh();await f.client.poll();await checks(f,[1000,6000,11000,16000,21000]);assert.equal(f.calls.filter(c=>c.url.includes('action=health')).length,0);assert.equal(automatic(f).length,0);assert.equal(f.client.view.autoPending,false);assert.equal(f.client.view.autoUnconfirmed,true);
 await f.client.setAutomatic(false);assert.equal(f.client.view.prepared.autoEnabled,false);assert.equal(f.client.view.autoPending,undefined);assert.equal(f.client.view.autoUnconfirmed,false);
});

test('outbound automation requires negotiated protocol and a healthy heartbeat baseline',async()=>{
 for(const patch of [{autoProtocol:undefined},{autoProtocol:'unknown'}, {autoHeartbeatReady:false}]){
  const f=fixture();f.setPrepared(patch);await f.client.refresh();await checks(f,[1000,6000,11000,16000,21000,26000]);assert.equal(automatic(f).length,0);
 }
 const f=fixture({enabled:false});f.setPrepared({autoProtocol:undefined});await f.client.refresh();await assert.rejects(()=>f.client.setAutomatic(true));assert.equal(f.calls.filter(c=>c.body.action==='automation').length,0);
});
test('outbound failure observations tolerate a two-second timer jitter without losing the deadline',async()=>{
 const f=fixture();await f.client.refresh();f.health('network');
 for(const at of [1000,2999,5001,6998,9002,10999,13003,15000,17001,19000,21003,23000,25002])await checks(f,[at]);
 assert.ok(automatic(f).length>=1,'source detection must request activation within 25 seconds');
 f.commit();await checks(f,[27005]);assert.equal(f.handoffs.length,1);
});
test('legacy reserve OFF acknowledgement remains valid without outbound capability',async()=>{
 const f=fixture();f.setPrepared({autoProtocol:undefined});await f.client.refresh();
 f.setPrepared({autoSupported:false});await f.client.setAutomatic(false);
 assert.equal(f.client.view.prepared.autoEnabled,false);assert.equal(f.client.view.autoUnconfirmed,false);assert.equal(f.client.view.autoPending,undefined);
});
