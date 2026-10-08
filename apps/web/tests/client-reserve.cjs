const assert = require('node:assert/strict');
const fs = require('node:fs'); const ts = require('typescript'); const Module = require('node:module');
Module._extensions['.ts'] = (m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
(async()=>{
 const {ReserveClient,readReserveResponse}=require('../lib/client-reserve.ts');
 await assert.rejects(()=>readReserveResponse(new Response('x'.repeat(65537))), /размер/);
 await assert.rejects(()=>readReserveResponse(new Response('[]')), /недействительный/);
 assert.equal((await readReserveResponse(new Response('{"armed":false}'))).armed,false);
 let now=1000, offline=false, committed=false, loseActivation=false; const calls=[], handoffs=[];
 const prepared={peerId:'peer',targetId:'target',label:'Reserve',targetUrl:'https://reserve.example',cohortId:'cohort',armGeneration:1,revision:1,snapshotAt:now,readyUntil:now+300000,grant:'opaque-own',role:'studio'};
 const fakeFetch=async(url,options)=>{const body=options.body?JSON.parse(options.body):{};calls.push({url,options,body});
  if(url.startsWith('/')) {if(offline)throw Error('source offline');return {ok:true,status:200,json:async()=>({armed:true,prepared})};}
  assert.equal(options.credentials,'omit');assert.equal(options.headers.authorization,'Bearer opaque-own');
  if(body.action==='activate'){committed=true;if(loseActivation){loseActivation=false;throw Error('lost response');}}
  return {ok:true,status:200,json:async()=>body.action==='redeem'||body.action==='activate'?{status:'committed',operationId:'operation',ticket:'one-use',targetUrl:prepared.targetUrl}:{status:committed?'committed':'armed',operationId:committed?'operation':undefined}};
 };
 const client=new ReserveClient({studioId:'studio',room:'room',token:'jwt',canActivate:true,fetch:fakeFetch,now:()=>now,newOperationId:()=> 'chosen-operation',onChange:()=>{},onHandoff:async value=>handoffs.push(value)});
 await client.refresh();await client.poll();assert.equal(client.view.phase,'ready');
 assert.equal(calls.some(c=>c.body.action==='activate'),false,'observing reserve never activates');
 offline=true;await client.refresh();assert.equal(client.view.phase,'ready');
 loseActivation=true;await client.activate();assert.equal(handoffs.length,0);await client.poll();assert.equal(handoffs.length,1,'lost response recovered using committed status without source');
 assert.equal(calls.filter(c=>c.body.action==='activate').length,1);
 const guest=new ReserveClient({studioId:'studio',room:'room',token:'guest-jwt',canActivate:false,fetch:fakeFetch,now:()=>now,newOperationId:()=> 'guest-operation',onChange:()=>{},onHandoff:async()=>{}});
 await assert.rejects(()=>guest.activate());
 now=400000;await client.poll();assert.equal(client.view.phase,'stale');
 const unknown=new ReserveClient({studioId:'studio',room:'room',token:'jwt',canActivate:true,fetch:fakeFetch,now:()=>now,newOperationId:()=> 'id',onChange:()=>{},onHandoff:async()=>{}});
 await unknown.refresh();assert.equal(unknown.view.phase,'unprepared');await assert.rejects(()=>unknown.activate());
 console.log('PASS: manual-only activation, cached grant during source outage, bearer-only polling, lost response recovery and bounded readiness');
})().catch(e=>{console.error(e);process.exitCode=1});
