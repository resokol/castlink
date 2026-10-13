import test from 'node:test';import assert from 'node:assert/strict';
import {bundlePrerequisiteChecks} from '../dist/bundle-preflight.js';import {privateControlCapability} from '../dist/private-control-capability.js';
const input={network:'loopback',bindIPv4:'127.0.0.1',architecture:'amd64',privateControl:privateControlCapability};
function adapter(change={}) {
 const calls=[],facts={platform:'linux',arch:'x64',osVersion:'13',distribution:'debian',uid:1000,gid:1000,...change};
 const run=async q=> {
  calls.push(q);
  if(q.executable===process.execPath&&!q.input)return{code:0,stdout:JSON.stringify(facts),stderr:''};
  if(q.executable==='docker')return{code:0,stderr:'',stdout:q.args[0]==='context'?'"unix:///fixture"':q.args[0]==='version'?'linux|amd64|28.0.0':'2.40.3'};
  if(q.executable==='ssh')return{code:0,stdout:'',stderr:''};
  if(q.input){const r=JSON.parse(q.input);return{code:0,stderr:'',stdout:JSON.stringify({schemaVersion:1,address:true,tcp:r.tcp.map(port=>({port,available:true})),udp:r.udp.map(port=>({port,available:true}))})};}
  throw Error('unexpected-fixture');
 };
 return{calls,run};
}
test('fixed private capability cannot authorize generic local Linux or wrong real-principal facts',async()=>{for(const change of [{uid:0},{gid:0},{platform:'win32'},{arch:'arm64'}]){const e=adapter(change),r=await bundlePrerequisiteChecks(input,e,false);assert.equal(r.find(c=>c.id==='platform').state,'fail');assert.equal(e.calls.some(q=>q.input),false)}const e=adapter(),{privateControl,...stock}=input,r=await bundlePrerequisiteChecks(stock,e,false);assert.equal(r.find(c=>c.id==='platform').state,'fail');assert.equal(e.calls.some(q=>q.input),false)});
test('unknown private capability rejects before any probe or port effect',async()=>{const e=adapter();await assert.rejects(bundlePrerequisiteChecks({...input,privateControl:{...privateControlCapability,uid:0}},e,false));assert.equal(e.calls.length,0)});
test('private research capability preserves Compose prerequisite and stops port probes on incompatibility',async()=>{const e=adapter(),run=e.run;e.run=async q=>q.executable==='docker'&&q.args[0]==='compose'?{code:0,stdout:'2.22.0',stderr:''}:run(q);const r=await bundlePrerequisiteChecks(input,e,false);assert.equal(r.find(c=>c.id==='platform').state,'pass');assert.equal(r.find(c=>c.id==='compose').state,'fail');assert.equal(e.calls.some(q=>q.input),false)});
