import{test}from'node:test';import assert from'node:assert/strict';import{localChecks}from'../dist/probe.js';
test('missing Docker fails and optional local SSH warns, never readiness',async()=>{
 const results=await localChecks({run:async request=>{if(request.executable===process.execPath)return{code:0,stdout:JSON.stringify({platform:'win32',arch:'x64',osVersion:'10.0.26100'}),stderr:''};throw new Error('Missing executable');}});
 assert.equal(results.find(x=>x.id==='docker').state,'fail');assert.equal(results.find(x=>x.id==='ssh').state,'warning');assert.equal(results.find(x=>x.id==='platform').state,'pass');
});
test('Windows containers are rejected even when Docker answers',async()=>{
 const results=await localChecks({run:async request=>request.executable===process.execPath?{code:0,stdout:JSON.stringify({platform:'win32',arch:'x64',osVersion:'10.0.26100'}),stderr:''}:{code:0,stdout:request.executable==='docker'?'windows|amd64|28.0.0':'OpenSSH',stderr:''}});
 assert.equal(results.find(x=>x.id==='docker').state,'fail');
});
test('macOS below 14 and Windows before 11 are unsupported',async()=>{
 for(const facts of [{platform:'darwin',arch:'arm64',osVersion:'13.6'},{platform:'win32',arch:'x64',osVersion:'10.0.19045'}]){
  const results=await localChecks({run:async request=>request.executable===process.execPath?{code:0,stdout:JSON.stringify(facts),stderr:''}:{code:1,stdout:'',stderr:''}});assert.equal(results.find(x=>x.id==='platform').state,'fail');
 }
});
