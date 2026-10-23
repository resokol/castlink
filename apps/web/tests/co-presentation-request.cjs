const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {coPresentationRequest}=load('../lib/co-presentation-client.ts');
(async()=>{
 const originalAny=AbortSignal.any,originalTimeout=AbortSignal.timeout,originalFetch=global.fetch;
 try {
  AbortSignal.any=undefined;AbortSignal.timeout=undefined;
  const cancellation=new AbortController();let captured;
  global.fetch=async(_url,options)=>{captured=options.signal;return{ok:true,json:async()=>({sessions:[]})};};
  assert.deepEqual(await coPresentationRequest('qa','studio','room',{action:'read'},cancellation.signal),{sessions:[]});assert.equal(captured.aborted,false);
  global.fetch=(_url,options)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const pending=coPresentationRequest('qa','studio','room',{action:'read'},cancellation.signal);cancellation.abort();await assert.rejects(pending,e=>e.name==='AbortError');
 } finally {AbortSignal.any=originalAny;AbortSignal.timeout=originalTimeout;global.fetch=originalFetch;}
 console.log('PASS request cancellation without AbortSignal.any or timeout support');
})().catch(e=>{console.error(e);process.exitCode=1;});
