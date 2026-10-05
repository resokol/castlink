import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dgram from 'node:dgram';
import {prerequisiteChecks} from '../dist/probe.js';
import {LocalExecutor} from '../dist/executors/local.js';
const input=()=>({network:'loopback',bindIPv4:'127.0.0.1',architecture:'amd64'});
const state=(checks,id)=>checks.find(x=>x.id===id)?.state;
const output=()=>({schemaVersion:1,address:true,tcp:[443,7881].map(port=>({port,available:true})),udp:Array.from({length:101},(_,i)=>({port:61000+i,available:true}))});
function fixture(options={}){
 const calls=[];
 return {calls,run:async r=>{calls.push(r);await options.onCall?.(r);
  let stdout='';
  if(r.input){if(options.error)throw Error('secret-fixture');stdout=options.raw??JSON.stringify(options.output??output());}
  else if(r.executable===process.execPath||r.executable==='python3')stdout=JSON.stringify(options.facts??{platform:'darwin',arch:'x64',osVersion:'14.0'});
  else if(r.args[0]==='context')stdout=JSON.stringify(options.endpoint??'unix:///var/run/docker.sock');
  else if(r.args[0]==='version')stdout=options.docker??'linux|amd64|28.0.0';
  else if(r.args[0]==='compose')stdout=options.compose??'2.23.1';
  return {code:r.input?(options.code??0):0,stdout,stderr:'secret-fixture'};
 }};
}
async function bundle(...args){const module=await import('../dist/bundle-preflight.js');return module.bundlePrerequisiteChecks(...args);}
test('bundle requires stable Compose >=2.23.1 while default doctor retains v2 behavior',async()=>{
 for(const version of ['2.23.0','2.23.1','2.24.0','v2.30.2','2.23.1-rc.1','2.23.1+meta','3.0.0','garbage','']){
  const f=fixture({compose:version});const checks=await prerequisiteChecks(f,false,{architecture:'amd64'});
  const pass=['2.23.1','2.24.0','v2.30.2'].includes(version);assert.equal(state(checks,'compose'),pass?'pass':'fail',version);
 }
 assert.equal(state(await prerequisiteChecks(fixture({compose:'2.23.0'}),false),'compose'),'pass');
});
test('bundle rejects requested architecture mismatch',async()=>{
 assert.equal(state(await prerequisiteChecks(fixture(),false,{architecture:'arm64'}),'platform'),'fail');
});
test('invalid network/address/architecture rejects before any process',async()=>{
 for(const change of [{network:'internet'},{bindIPv4:'0.0.0.0'},{bindIPv4:'127.000.0.1'},{bindIPv4:'127.0.0.1;evil'},{architecture:'x64'}]){
 const f=fixture();await assert.rejects(bundle({...input(),...change},f,false));assert.equal(f.calls.length,0);
 }
});
test('bundle only probes networking after every required prerequisite passes',async()=>{
 for(const options of [{facts:{platform:'linux',arch:'x64',osVersion:'6.0'}},{endpoint:'tcp://secret:2376'},{docker:'linux|arm64|28.0.0'},{compose:'2.23.0'}]){
 const f=fixture(options);const checks=await bundle(input(),f,false);assert.equal(state(checks,'bind-address'),'unverified');assert.equal(state(checks,'ports'),'unverified');assert.equal(f.calls.some(r=>r.input),false);
 }
});
test('complete availability passes with fixed separate unknown readiness checks',async()=>{
 const f=fixture();const checks=await bundle(input(),f,false);assert.equal(state(checks,'bind-address'),'pass');assert.equal(state(checks,'ports'),'pass');
 for(const id of ['desktop-networking','images','config','media'])assert.equal(state(checks,id),'unverified');
 assert.match(checks.find(x=>x.id==='ports').message,/момент/);
 const r=f.calls.find(r=>r.input);assert.equal(r.executable,process.execPath);assert.equal(r.args[0],'-e');assert.deepEqual(JSON.parse(Buffer.from(r.input)),{schemaVersion:1,bindIPv4:'127.0.0.1',tcp:[443,7881],udp:Array.from({length:101},(_,i)=>61000+i)});
});
test('address missing, busy TCP or UDP fail separately',async()=>{
 for(const field of ['address','tcp','udp']){const data=output();if(field==='address')data.address=false;else data[field][0].available=false;
 const checks=await bundle(input(),fixture({output:data}),false);assert.equal(state(checks,'bind-address'),field==='address'?'fail':'pass');assert.equal(state(checks,'ports'),field==='address'?'fail':'fail');}
});
test('permission/error/malformed/incomplete/duplicate responses fail closed and redact',async()=>{
 const short=output();short.udp.pop();const duplicate=output();duplicate.tcp[1]=duplicate.tcp[0];const bad=output();bad.address='true';
 for(const options of [{error:true},{code:1},{raw:'secret-fixture'}, {output:short},{output:duplicate},{output:bad},{output:{}}]){
 const checks=await bundle(input(),fixture(options),false);assert.equal(state(checks,'ports'),'fail');assert.equal(state(checks,'bind-address'),'fail');assert.doesNotMatch(JSON.stringify(checks),/secret-fixture/);
 }
});
test('input is snapshotted before awaits and helper scripts are fixed',async()=>{
 const value=input();const f=fixture({onCall:()=>{value.bindIPv4='192.168.1.20';value.network='lan';value.architecture='arm64';}});await bundle(value,f,false);
 const r=f.calls.find(r=>r.input);assert.equal(JSON.parse(Buffer.from(r.input)).bindIPv4,'127.0.0.1');
 const other=fixture();await bundle({network:'lan',bindIPv4:'192.168.1.21',architecture:'amd64'},other,false);assert.deepEqual(r.args,other.calls.find(r=>r.input).args);assert.equal(r.sensitive,false);
});
test('selected remote executor receives Python only and validates remote architecture',async()=>{
 const f=fixture({facts:{platform:'linux',distribution:'ubuntu',osVersion:'24.04',arch:'aarch64'},docker:'linux|arm64|28.0.0'});
 const checks=await bundle({...input(),architecture:'arm64'},f,true);assert.equal(state(checks,'ports'),'pass');const r=f.calls.find(r=>r.input);assert.equal(r.executable,'python3');assert.equal(r.args[0],'-c');assert.ok(f.calls.every(r=>r.executable==='python3'||r.executable==='docker'));
});
test('actual fixed Node and Python helpers detect held TCP/UDP sockets and release probes',async()=>{
 const tcp=net.createServer();await new Promise(resolve=>tcp.listen(0,'127.0.0.1',resolve));const udp=dgram.createSocket('udp4');await new Promise(resolve=>udp.bind(0,'127.0.0.1',resolve));
 try{for(const remote of [false,true]){
 const f=fixture(remote?{facts:{platform:'linux',distribution:'ubuntu',osVersion:'24.04',arch:'x86_64'}}:{});await bundle(input(),f,remote);const r=f.calls.find(r=>r.input);
 const tcpPort=tcp.address().port,udpPort=udp.address().port;
 const real=new LocalExecutor(5000);const response=await real.run({...r,input:Buffer.from(JSON.stringify({schemaVersion:1,bindIPv4:'127.0.0.1',tcp:[tcpPort],udp:[udpPort]}))});assert.equal(response.code,0);const data=JSON.parse(response.stdout);assert.equal(data.address,true);assert.equal(data.tcp[0].available,false);assert.equal(data.udp[0].available,false);
 const free=await real.run({...r,input:Buffer.from(JSON.stringify({schemaVersion:1,bindIPv4:'127.0.0.1',tcp:[0],udp:[0]}))});assert.equal(free.code,0);const result=JSON.parse(free.stdout);assert.equal(result.tcp[0].available,true);assert.equal(result.udp[0].available,true);
 }}finally{await new Promise(resolve=>tcp.close(resolve));await new Promise(resolve=>udp.close(resolve));}
});
test('helpers close successful TCP and UDP probes so the exact ports can immediately be rebound',async()=>{
 for(const remote of [false,true]){
 const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const tcpPort=server.address().port;await new Promise(resolve=>server.close(resolve));
 const socket=dgram.createSocket('udp4');await new Promise(resolve=>socket.bind(0,'127.0.0.1',resolve));const udpPort=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const f=fixture(remote?{facts:{platform:'linux',distribution:'ubuntu',osVersion:'24.04',arch:'x86_64'}}:{});await bundle(input(),f,remote);const r=f.calls.find(r=>r.input);
 const response=await new LocalExecutor(5000).run({...r,input:Buffer.from(JSON.stringify({schemaVersion:1,bindIPv4:'127.0.0.1',tcp:[tcpPort],udp:[udpPort]}))});assert.equal(response.code,0);const data=JSON.parse(response.stdout);assert.equal(data.tcp[0].available,true);assert.equal(data.udp[0].available,true);
 const rebound=dgram.createSocket('udp4');
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(tcpPort,'127.0.0.1',resolve)});await new Promise((resolve,reject)=>{rebound.once('error',reject);rebound.bind(udpPort,'127.0.0.1',resolve)});}finally{if(server.listening)await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>rebound.close(resolve));}
 }
});
test('real helpers return address failure for an absent IPv4 and reject malformed input silently',async()=>{
 for(const remote of [false,true]){
 const f=fixture(remote?{facts:{platform:'linux',distribution:'ubuntu',osVersion:'24.04',arch:'x86_64'}}:{});await bundle(input(),f,remote);const r=f.calls.find(r=>r.input);const executor=new LocalExecutor(5000);
 const result=await executor.run({...r,input:Buffer.from(JSON.stringify({schemaVersion:1,bindIPv4:'192.0.2.240',tcp:[0],udp:[0]}))});assert.equal(result.code,0);const data=JSON.parse(result.stdout);assert.equal(data.address,false);assert.equal(data.tcp[0].available,false);assert.equal(data.udp[0].available,false);
 const bad=await executor.run({...r,input:Buffer.from('secret-malformed-fixture')});assert.equal(bad.code,1);assert.equal(bad.stdout,'');assert.equal(bad.stderr,'');
 }
});
test('requested architecture mismatch gives a fixed actionable message',async()=>{
 const checks=await prerequisiteChecks(fixture(),false,{architecture:'arm64'});
 assert.match(checks.find(x=>x.id==='platform').message,/запрошенн/);
});
test('duplicate JSON member names fail closed including escaped-equivalent names',async()=>{
 const complete=JSON.stringify(output());
 for(const raw of [
  complete.replace('"address":true','"address":false,"address":true'),
  complete.replace('"available":true','"available":false,"available":true'),
  complete.replace('"address":true','"address":false,"\\u0061ddress":true'),
  complete.replace('"available":true','"available":false,"\\u0061vailable":true'),
 ]){
  const checks=await bundle(input(),fixture({raw}),false);
  assert.equal(state(checks,'bind-address'),'fail');assert.equal(state(checks,'ports'),'fail');assert.doesNotMatch(JSON.stringify(checks),/secret-fixture/);
 }
});
