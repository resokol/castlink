const assert = require('node:assert/strict');
const fs = require('node:fs'); const ts = require('typescript'); const Module = require('node:module');
Module._extensions['.ts'] = (m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const originalLoad = Module._load;
let effects=[], states=[];
Module._load=function(id,...args){if(id==='react')return {
 useRef:value=>({current:value}), useState:value=>[value,next=>states.push(next)], useEffect:callback=>effects.push(callback),
};return originalLoad.call(this,id,...args);};
const {useSessionTransfer,guestReserveStatusText}=require('../lib/use-session-transfer.ts');
const originalInterval=global.setInterval, originalClear=global.clearInterval;
let timers=[]; global.setInterval=(callback,delay)=>{const item={callback,delay};timers.push(item);return item;};global.clearInterval=item=>{timers=timers.filter(timer=>timer!==item);};
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
(async()=>{
 assert.equal(guestReserveStatusText({phase:'unprepared',busy:false}),null,'no reserve is not a permanent guest warning');
 assert.equal(guestReserveStatusText({phase:'ready',busy:false}),null);
 assert.match(guestReserveStatusText({phase:'committed',busy:true}),/Подключаемся/);
 assert.match(guestReserveStatusText({phase:'unreachable',busy:false}),/резерв/i);

 for(const role of ['studio','guest','admin','moderator']){
  effects=[];states=[];timers=[];let sourceUp=true,activated=false,lost=false,disconnected=0,snapshots=0;
  const calls=[],destinations=[];
  const prepared={peerId:'peer',targetId:'reserve',label:'Reserve',targetUrl:'https://reserve.example',cohortId:'cohort',armGeneration:1,revision:1,snapshotAt:Date.now(),readyUntil:Date.now()+299000,grant:`own-${role}`,role};
  global.window={location:{assign:value=>destinations.push(value)}};
  global.fetch=async(url,options)=>{
   const body=options.body?JSON.parse(options.body):{};calls.push({url,body,options});
   if(url.startsWith('/')){
    if(!sourceUp)throw Error('source web stopped');
    return {ok:true,status:200,json:async()=>url.startsWith('/api/server-transfer')?{}:{armed:true,prepared}};
   }
   assert.equal(options.credentials,'omit');assert.equal(options.headers.authorization,`Bearer own-${role}`);
   if(body.action==='activate'){assert.equal(role,'studio');activated=true;if(lost){lost=false;throw Error('activation response lost');}}
   return {ok:true,status:200,json:async()=>body.action==='status'?{status:activated?'committed':'armed',operationId:activated?'op':undefined}:{status:'committed',operationId:'op',targetUrl:prepared.targetUrl,ticket:`ticket-${role}`}};
  };
  const hook=useSessionTransfer({studioId:'studio',room:'room',token:`jwt-${role}`,clientId:`client-${role}`,canActivate:role==='studio',snapshot:async()=>{snapshots++;return {role,studioId:'studio',room:'room',settings:{deviceLabels:{camera:'Exact camera'}}};},beforeHandoff:async()=>{disconnected++;}});
  const cleanup=effects[0]();await flush();
  assert.equal(states.at(-1).phase,'ready');assert.deepEqual(timers.map(t=>t.delay),role==='studio'?[30000,2000,2000,5000]:[30000,2000,2000]);
  assert.equal(calls.some(c=>c.body.action==='activate'),false);
  sourceUp=false;await timers[0].callback();await flush();assert.equal(destinations.length,0,'outage must not move a client');
  if(role==='studio') {lost=true;await hook.activate();assert.equal(destinations.length,0);}
  else {await assert.rejects(()=>hook.activate());activated=true;}
  await timers[1].callback();await flush();
  assert.equal(destinations.length,1);assert.equal(disconnected,1);assert.equal(snapshots,1);
  const destination=new URL(destinations[0]);assert.equal(destination.origin,prepared.targetUrl);assert.equal(destination.pathname,'/transfer');
  assert.equal(new URLSearchParams(destination.hash.slice(1)).get('handoff'),`ticket-${role}`);
  await timers[1].callback();await flush();assert.equal(destinations.length,1,'committed status cannot navigate twice');
  cleanup();assert.equal(timers.length,0,'unmount releases source and direct polling');
 }
 effects=[];states=[];timers=[];let stoppedMedia=0;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({armed:false})});
 const validationHook=useSessionTransfer({studioId:'studio',room:'room',token:'jwt',canActivate:true,snapshot:async()=>({role:'studio',studioId:'studio',room:'room'}),beforeHandoff:async()=>{stoppedMedia++;}});
 const validationCleanup=effects[0]();await flush();
 await assert.rejects(()=>validationHook.handoff({targetUrl:'https://reserve.example',ticket:''}));
 await assert.rejects(()=>validationHook.handoff({targetUrl:'https://reserve.example/path',ticket:'ticket'}));
 assert.equal(stoppedMedia,0,'invalid target/ticket must not release or disconnect source');validationCleanup();
 console.log('PASS: actual transfer hook effects prepare all roles, survive source outage, observe manual activation, disconnect once and clean up timers');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.setInterval=originalInterval;global.clearInterval=originalClear;});
