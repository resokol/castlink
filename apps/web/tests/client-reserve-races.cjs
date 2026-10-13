const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ReserveClient}=require('../lib/client-reserve.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};};
const response=value=>({ok:true,status:200,json:async()=>value});
const prepared=(target='a',revision=1)=>({peerId:target,targetId:target,label:target,targetUrl:`https://${target}.example`,cohortId:'cohort',armGeneration:1,revision,snapshotAt:1000,readyUntil:301000,grant:`grant-${target}`,role:'studio'});
const create=request=>{const handoffs=[];const client=new ReserveClient({studioId:'studio',room:'room',token:'jwt',clientId:'primary',canActivate:true,fetch:request,now:()=>1000,newOperationId:()=> 'manual-op',onChange:()=>{},onHandoff:async value=>handoffs.push(value)});return{client,handoffs};};
(async()=>{
 {
  const oldRefresh=deferred();let refreshCalls=0;
  const {client}=create(async(url,options)=>{const body=JSON.parse(options.body);if(url.startsWith('/')){if(body.action==='refresh'){refreshCalls++;if(refreshCalls===1)return response({armed:true,prepared:prepared()});return oldRefresh.promise;}if(body.action==='disarm')return response({armed:false});}return response({status:'armed'});});
  await client.refresh();const inflight=client.refresh();await client.select('');oldRefresh.resolve(response({armed:true,prepared:prepared()}));await inflight;
  assert.equal(client.view.prepared,undefined,'refresh arriving after acknowledged disarm must not rearm the UI');
 }
 {
  const late=deferred();let refreshCalls=0;
  const {client}=create(async(url,options)=>{const body=JSON.parse(options.body);if(url.startsWith('/')){if(body.action==='refresh'){refreshCalls++;return refreshCalls===1?response({armed:true,prepared:prepared()}):late.promise;}return response({armed:true,prepared:prepared('b',2)});}return response({status:'armed'});});
  await client.refresh();const inflight=client.refresh();await client.select('b');late.resolve(response({armed:true,prepared:prepared('a',1)}));await inflight;
  assert.equal(client.view.prepared.targetId,'b','older response must not replace newly armed reserve');
 }
 {
  const status=deferred();let sourceCalls=0;
  const {client,handoffs}=create(async(url,options)=>{const body=JSON.parse(options.body);if(url.startsWith('/')){sourceCalls++;return response({armed:true,prepared:prepared('a',sourceCalls===1?2:1)});}if(body.action==='status')return status.promise;return response({status:'committed',ticket:'ticket',targetUrl:'https://a.example',operationId:'manual-op'});});
  await client.refresh();await client.refresh();assert.equal(client.view.prepared.revision,2,'late revision must not regress');
  const poll=client.poll();await client.activate();status.resolve(response({status:'armed'}));await poll;
  assert.equal(client.view.phase,'committed','older armed status must not revert committed operation');assert.equal(handoffs.length,1);
 }
 {
  const status=deferred();const {client,handoffs}=create(async(url,options)=>url.startsWith('/')?response({armed:true,prepared:prepared()}):status.promise);
  await client.refresh();const poll=client.poll();client.dispose();status.resolve(response({status:'committed',operationId:'manual-op'}));await poll;
  assert.equal(handoffs.length,0,'disposed client must not redeem or navigate');
 }
 console.log('PASS: delayed preparation cannot undo disarm/rearm, revisions stay monotonic, stale status cannot undo activation and disposed clients cannot hand off');
})().catch(error=>{console.error(error);process.exitCode=1});
