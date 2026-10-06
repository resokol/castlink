import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readdir, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runCli} from '../dist/main.js';
import {FileStateStore} from '../dist/state.js';

const remote={kind:'remote',host:'203.0.113.8',user:'operator',port:2222};
const profile=target=>({schemaVersion:1,installationId:'12345678-1234-4123-8123-123456789abc',request:{profile:'office',target,network:'loopback',root:target.kind==='local'?'C:\\CastLink':'/opt/castlink/office',release:'0.1.0'},currentRelease:'0.1.0',secretFilePaths:{}});
const result=(stdout,code=0)=>({code,stdout,stderr:'private-stderr-fixture'});
function fixture({target=null,host={platform:'win32',arch:'x64',osVersion:'10.0.26100'},remoteHost={platform:'linux',arch:'x86_64',osVersion:'24.04',distribution:'ubuntu'},docker='linux|amd64|28.0.0',compose='2.33.0',endpoint='unix:///var/run/docker.sock',sshError=false,loadError=null,probeError=false}={}){
 const output=[],calls=[],probes=[];let writes=0,loads=0;
 const respond=request=>{
  probes.push(request);
  if(probeError)throw new Error('timeout private-stderr-fixture');
  if(request.executable===process.execPath)return result(JSON.stringify(host));
  if(request.executable==='python3')return result(JSON.stringify(remoteHost));
  if(request.executable==='docker'){
   if(request.args[0]==='context')return result(JSON.stringify(endpoint));
   if(request.args[0]==='version')return result(docker);
   if(request.args[0]==='compose')return result(compose);
  }
  if(request.executable==='ssh')return result('',sshError?255:0);
  throw new Error('Unexpected process');
 };
 return {output,calls,probes,counts:()=>({writes,loads}),dependencies:{
  readLine:async()=>{throw new Error('No prompts');},write:text=>output.push(text),detect:async()=>{throw new Error('No setup detection');},
  executor:{run:async request=>{calls.push(request);if(request.executable==='ssh'&&request.input){if(sshError)return result('secret-network-fixture',255);return result(JSON.stringify(respond(JSON.parse(Buffer.from(request.input).toString()))));}return respond(request);}},
  store:{load:async()=>{loads++;if(loadError)throw loadError;return target?profile(target):null;},save:async()=>{writes++;throw new Error('No save');},lock:async()=>{writes++;throw new Error('No lock');}},
 }};
}
async function diagnose(f,args=['doctor','--json']){const code=await runCli(args,f.dependencies);return{code,checks:JSON.parse(f.output.join(''))};}
const state=(checks,id)=>checks.find(check=>check.id===id)?.state;

test('doctor rejects an unknown profile before running any process',async()=>{
 const f=fixture();assert.equal(await runCli(['doctor','--profile','office'],f.dependencies),2);assert.equal(f.calls.length,0);assert.deepEqual(f.counts(),{writes:0,loads:1});
});
test('doctor loads a named local profile and checks this computer read-only',async()=>{
 const f=fixture({target:{kind:'local'}});const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,0);assert.equal(state(checks,'platform'),'pass');assert.equal(state(checks,'docker'),'pass');assert.equal(f.calls.some(x=>x.executable==='ssh'&&x.input),false);assert.deepEqual(f.counts(),{writes:0,loads:1});
});
test('doctor without profile checks this computer without loading profile storage',async()=>{
 const f=fixture();const {code,checks}=await diagnose(f);assert.equal(code,0);assert.equal(state(checks,'compose'),'pass');assert.deepEqual(f.counts(),{writes:0,loads:0});
});
test('remote doctor checks Ubuntu over SSH without calling local Docker or Node',async()=>{
 const f=fixture({target:remote});const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,0);assert.equal(state(checks,'platform'),'pass');assert.equal(state(checks,'ssh'),'pass');assert.ok(f.calls.length>0);assert.ok(f.calls.every(x=>x.executable==='ssh'));assert.ok(f.probes.some(x=>x.executable==='python3'&&x.args.join(' ').includes('/etc/os-release')));assert.equal(f.probes.some(x=>x.executable==='node'||x.executable===process.execPath),false);
 for(const request of f.calls){assert.ok(request.args.includes('StrictHostKeyChecking=yes'));assert.ok(request.args.includes('BatchMode=yes'));assert.ok(request.args.includes('PasswordAuthentication=no'));assert.ok(request.args.includes('KbdInteractiveAuthentication=no'));assert.ok(request.args.includes('UpdateHostKeys=no'));assert.ok(request.args.includes('CheckHostIP=no'));assert.ok(request.args.includes('VerifyHostKeyDNS=no'));assert.doesNotMatch(request.args.slice(0,-1).join(' '),/StrictHostKeyChecking=no|accept-new|sudo|ssh-keyscan/);}
 assert.deepEqual(f.counts(),{writes:0,loads:1});
});
test('supported Ubuntu versions and arm64 architecture pass independently of CLI host',async()=>{
 for(const osVersion of ['22.04','24.04']){const f=fixture({target:remote,host:{platform:'linux',arch:'ia32'},remoteHost:{platform:'linux',distribution:'ubuntu',osVersion,arch:'aarch64'},docker:'linux|arm64|28.0.0'});const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,0);assert.equal(state(checks,'platform'),'pass');}
});
test('remote doctor rejects Debian, unsupported Ubuntu and architectures',async()=>{
 for(const facts of [{distribution:'debian',osVersion:'24.04',arch:'x86_64'},{distribution:'ubuntu',osVersion:'20.04',arch:'x86_64'},{distribution:'ubuntu',osVersion:'24.04',arch:'i686'}]){const f=fixture({target:remote,remoteHost:{platform:'linux',...facts}});const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,3);assert.equal(state(checks,'platform'),'fail');}
});
test('local doctor rejects unsupported desktop OS and architecture',async()=>{
 for(const host of [{platform:'linux',arch:'x64',osVersion:'24.04'},{platform:'win32',arch:'arm64',osVersion:'10.0.26100'},{platform:'darwin',arch:'arm64',osVersion:'13.6'},{platform:'win32',arch:'x64',osVersion:'10.0.19045'}]){const f=fixture({host});const {code,checks}=await diagnose(f);assert.equal(code,3);assert.equal(state(checks,'platform'),'fail');}
});
test('doctor accepts macOS 14+ on x64 and arm64 with matching engine architecture',async()=>{
 for(const arch of ['x64','arm64']){const f=fixture({host:{platform:'darwin',arch,osVersion:'14.7'},docker:`linux|${arch==='x64'?'amd64':'arm64'}|28.0.0`});assert.equal((await diagnose(f)).code,0);}
});
test('doctor rejects Windows containers, architecture mismatch and malformed Docker output',async()=>{
 for(const docker of ['windows|amd64|28.0.0','linux|arm64|28.0.0','linux|unknown|28.0.0','linux|amd64|','linux|amd64|28.0.0|extra','linux|amd64|private-stderr-fixture']){const f=fixture({docker});const {code,checks}=await diagnose(f);assert.equal(code,3);assert.equal(state(checks,'docker'),'fail');assert.doesNotMatch(f.output.join(''),/private-stderr-fixture/);}
});
test('nonlocal Docker endpoints are not reported as the selected computer engine',async()=>{
 for(const endpoint of ['ssh://other-host','tcp://203.0.113.9:2376','npipe:////other-host/pipe/docker_engine']){const f=fixture({endpoint});const {code,checks}=await diagnose(f);assert.equal(code,3);assert.equal(state(checks,'docker-context'),'fail');assert.equal(state(checks,'docker'),'unverified');assert.equal(f.probes.some(x=>x.executable==='docker'&&x.args[0]==='version'),false);}
});
test('DOCKER_HOST redirection blocks local and remote engine probes without exposing its value',async()=>{
 for(const target of [null,remote]){const f=fixture({target,host:{platform:'win32',arch:'x64',osVersion:'10.0.26100',dockerHost:'tcp://private-secret-fixture:2376'},remoteHost:{platform:'linux',distribution:'ubuntu',arch:'x86_64',osVersion:'24.04',dockerHost:'tcp://private-secret-fixture:2376'}});const {code,checks}=await diagnose(f,target?['doctor','--profile','office','--json']:undefined);assert.equal(code,3);assert.equal(state(checks,'docker-context'),'fail');assert.doesNotMatch(f.output.join(''),/private-secret-fixture/);assert.equal(f.probes.some(x=>x.executable==='docker'&&x.args[0]==='version'),false);}
});
test('local Windows named-pipe and macOS Unix socket contexts pass',async()=>{
 for(const endpoint of ['npipe:////./pipe/docker_engine','npipe:////./pipe/dockerDesktopLinuxEngine','unix:///Users/operator/.docker/run/docker.sock'])assert.equal((await diagnose(fixture({endpoint}))).code,0);
});
test('Docker Compose requires a complete version >=2',async()=>{
 for(const compose of ['1.29.2','2.garbage','2.33.0 secret','']){const {code,checks}=await diagnose(fixture({compose}));assert.equal(code,3);assert.equal(state(checks,'compose'),'fail');}
});
test('Docker Compose accepts newer stable major versions with read-only probes',async()=>{
 for(const compose of ['3.0.0','5.5.1','v5.5.1']){const f=fixture({compose});const {code,checks}=await diagnose(f);assert.equal(code,0,compose);assert.equal(state(checks,'compose'),'pass');assert.equal(f.counts().writes,0);}
});
test('SSH failure and timeout return failed prerequisites with redacted JSON',async()=>{
 for(const options of [{target:remote,sshError:true},{target:remote,probeError:true},{probeError:true}]){const f=fixture(options);const {code,checks}=await diagnose(f,options.target?['doctor','--profile','office','--json']:undefined);assert.equal(code,3);assert.ok(checks.some(x=>x.state==='fail'));assert.doesNotMatch(f.output.join(''),/private-stderr-fixture|secret-network-fixture/);}
});
test('malformed host and context responses fail closed as JSON checks',async()=>{
 for(const overrides of [{host:[]},{host:{platform:'win32',arch:'x64',osVersion:26100}},{endpoint:''},{endpoint:{Host:'unix:///var/run/docker.sock'}}]){const {code,checks}=await diagnose(fixture(overrides));assert.equal(code,3);assert.ok(checks.some(x=>x.state==='fail'));}
});
test('services, TLS and media remain unverified even when all prerequisites pass',async()=>{
 const {code,checks}=await diagnose(fixture());assert.equal(code,0);for(const id of ['services','tls','media'])assert.equal(state(checks,id),'unverified');
});
test('doctor --media remains an explicit blocker and does not run probes',async()=>{
 const f=fixture({target:remote});assert.equal(await runCli(['doctor','--profile','office','--media'],f.dependencies),3);assert.equal(f.calls.length,0);assert.equal(f.counts().writes,0);assert.doesNotMatch(f.output.join(''),/private-stderr-fixture/);
});
test('corrupt on-disk profiles are rejected before probes without creating locks or changing files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-doctor-'));
 try{await mkdir(path.join(root,'office'));const file=path.join(root,'office','profile.json');const raw='{"schemaVersion":1,"private":"secret-fixture"';await writeFile(file,raw);const f=fixture();f.dependencies.store=new FileStateStore(root);assert.equal(await runCli(['doctor','--profile','office'],f.dependencies),4);assert.equal(f.calls.length,0);assert.equal(await readFile(file,'utf8'),raw);assert.deepEqual(await readdir(path.join(root,'office')),['profile.json']);assert.doesNotMatch(f.output.join(''),/secret-fixture/);}finally{await rm(root,{recursive:true,force:true});}
});
test('all probes are fixed read-only commands without installers or resource operations',async()=>{
 for(const target of [null,remote]){const f=fixture({target});await diagnose(f,target?['doctor','--profile','office','--json']:undefined);for(const probe of f.probes){assert.ok([process.execPath,'python3','docker','ssh'].includes(probe.executable));if(probe.executable==='docker')assert.ok(['context inspect','version --format','compose version'].some(prefix=>probe.args.join(' ').startsWith(prefix)));assert.doesNotMatch(probe.args.join(' '),/\b(?:sudo|pull|up|down|stop|start|install|rm|prune)\b/);}assert.equal(f.counts().writes,0);}
});

test('doctor JSON errors are CheckResult arrays with the original exit code and no probes',async()=>{
 const cases=[{args:['doctor','--profile','office','--json'],code:2},{args:['doctor','--media','--json'],code:3},{args:['doctor','--profile','bad/name','--json'],code:2}];
 for(const item of cases){const f=fixture();if(item.args.includes('bad/name'))f.dependencies.store=new FileStateStore('/not-read-invalid-name');const {code,checks}=await diagnose(f,item.args);assert.equal(code,item.code);assert.deepEqual(checks.map(x=>({id:x.id,state:x.state})),[{id:'doctor',state:'fail'}]);assert.equal(f.calls.length,0);assert.equal(f.counts().writes,0);}
});
test('persisted invalid request fields are corrupt profiles (4), not CLI argument errors',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-doctor-schema-'));
 try{await mkdir(path.join(root,'office'));const file=path.join(root,'office','profile.json');
  for(const change of [{target:{kind:'remote',host:'bad;host',user:'operator',port:22}},{network:'invalid'},{root:42},{release:'latest'}]){const value=profile({kind:'local'});Object.assign(value.request,change);const raw=JSON.stringify(value);await writeFile(file,raw);const f=fixture();f.dependencies.store=new FileStateStore(root);const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,4);assert.equal(checks[0].id,'doctor');assert.equal(f.calls.length,0);assert.equal(await readFile(file,'utf8'),raw);assert.deepEqual(await readdir(path.join(root,'office')),['profile.json']);}
 }finally{await rm(root,{recursive:true,force:true});}
});
test('DOCKER_CONTEXT takes precedence over DOCKER_HOST when selecting the engine',async()=>{
 const f=fixture({host:{platform:'win32',arch:'x64',osVersion:'10.0.26100',dockerHost:'tcp://private-secret-fixture:2376',dockerContext:'desktop-linux'}});const {code,checks}=await diagnose(f);assert.equal(code,0);assert.equal(state(checks,'docker-context'),'pass');assert.ok(f.probes.some(x=>x.executable==='docker'&&x.args[0]==='context'));assert.doesNotMatch(f.output.join(''),/private-secret-fixture/);
});
test('missing optional local OpenSSH warns without blocking desktop prerequisites',async()=>{
 const f=fixture({sshError:true});const {code,checks}=await diagnose(f);assert.equal(code,0);assert.equal(state(checks,'ssh'),'warning');
});

test('persisted remote SSH host and user must be strings before any probes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-doctor-target-'));
 try{await mkdir(path.join(root,'office'));const file=path.join(root,'office','profile.json');
  for(const fields of [{user:undefined},{user:true},{host:undefined},{host:true}]){const value=profile({...remote,...fields});const raw=JSON.stringify(value);await writeFile(file,raw);const f=fixture();f.dependencies.store=new FileStateStore(root);const {code,checks}=await diagnose(f,['doctor','--profile','office','--json']);assert.equal(code,4);assert.equal(checks[0].id,'doctor');assert.equal(f.calls.length,0);assert.equal(await readFile(file,'utf8'),raw);assert.deepEqual(await readdir(path.join(root,'office')),['profile.json']);}
 }finally{await rm(root,{recursive:true,force:true});}
});
