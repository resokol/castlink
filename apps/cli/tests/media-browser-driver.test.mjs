import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {PrivateCdpPipe,createUnverifiedPipeBrowserDriver,isBuiltinBrowserEvidence} from '../dist/media-browser-driver.js';
const node=process.execPath;
const secret='PRIVATE-GUEST-TOKEN';
function fixture(mode='echo') {
 const source=`const fs=require('node:fs');let b='';const i=fs.createReadStream(null,{fd:3});const o=fs.createWriteStream(null,{fd:4});i.on('data',x=>{b+=x;while(b.includes('\\0')){const k=b.indexOf('\\0'),v=JSON.parse(b.slice(0,k));b=b.slice(k+1);if(v.method==='Browser.close'){o.end(JSON.stringify({id:v.id,result:{}})+'\\0');setTimeout(()=>process.exit(0),10);continue;}if(${JSON.stringify(mode)}==='hang')continue;if(${JSON.stringify(mode)}==='malformed'){o.write('{bad}\\0');continue;}if(${JSON.stringify(mode)}==='secret-error'){o.write(JSON.stringify({id:v.id,error:{message:${JSON.stringify(secret)}}})+'\\0');continue;}if(${JSON.stringify(mode)}==='exit'){process.exit(2);continue;}o.write(JSON.stringify({method:'Page.unrelated',params:{}})+'\\0');o.write(JSON.stringify({id:v.id,result:{method:v.method,sessionId:v.sessionId??null}})+'\\0');}});`;
 const env={...process.env};delete env.NODE_TEST_CONTEXT;return spawn(node,['-e',source],{env,stdio:['ignore','ignore','ignore','pipe','pipe']});
}
test('private CDP uses inherited pipes and multiplexes scoped replies without a public listener',async()=>{
 const child=fixture(),pipe=new PrivateCdpPipe(child,{timeoutMs:500});
 try{const [a,b]=await Promise.all([pipe.send('Runtime.enable',{},'s1'),pipe.send('Page.enable',{},'s2')]);assert.deepEqual(a,{method:'Runtime.enable',sessionId:'s1'});assert.deepEqual(b,{method:'Page.enable',sessionId:'s2'});assert.equal(child.spawnargs.some(x=>x.includes('--remote-debugging-port')),false);}finally{await pipe.close();}
 assert.equal(child.exitCode!==null||child.signalCode!==null,true);
});
for(const mode of ['hang','malformed','secret-error','exit'])test(`CDP ${mode} refuses safely and closes its owned process`,async()=>{
 const child=fixture(mode),pipe=new PrivateCdpPipe(child,{timeoutMs:100});
 try{await assert.rejects(pipe.send('Runtime.enable'),e=>!String(e).includes(secret));}finally{await pipe.close();}
 assert.equal(child.exitCode!==null||child.signalCode!==null,true);await assert.rejects(pipe.send('Runtime.enable'));
});
test('fixture launch and imported evidence never acquire built-in provenance',async()=>{
 const child=fixture(),driver=createUnverifiedPipeBrowserDriver(child,{timeoutMs:100});
 assert.equal(isBuiltinBrowserEvidence(driver,{source:'browser',verified:true}),false);
 await driver.close();
 assert.equal(isBuiltinBrowserEvidence(driver,JSON.parse('{"source":"browser","verified":true}')),false);
});
import {mkdtemp,mkdir,writeFile,stat,readFile,rename,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {validateCollectedBrowserObservations} from '../dist/media-browser-driver.js';
async function artifactFixture(fn){const dir=await mkdtemp(path.join(os.tmpdir(),'castlink-browser-'));try{const runId=randomUUID(),room='cli-media-'+runId,p=path.join(dir,'.castlink-media',runId);await mkdir(p,{recursive:true,mode:0o700});const file=path.join(p,'guest-entry.txt'),bytes=`/room?studioId=studio-default&name=${room}#invite=${secret}`;await writeFile(file,bytes,{mode:0o600});const s=await stat(file),input={origin:'https://localhost',studioId:'studio-default',room,runId,inviteArtifact:{schemaVersion:1,contract:'castlink-media-private-v1',target:'local',runId,studioId:'studio-default',room,path:file,association:{dev:s.dev,ino:s.ino,mode:384,sha256:createHash('sha256').update(bytes).digest('hex')}}};await fn(input);}finally{await rm(dir,{recursive:true,force:true});}}
test('private artifact replacement is rejected before any guest navigation',async()=>artifactFixture(async input=>{
 await rename(input.inviteArtifact.path,input.inviteArtifact.path+'.original');await writeFile(input.inviteArtifact.path,await readFile(input.inviteArtifact.path+'.original'),{mode:0o600});const child=fixture(),driver=createUnverifiedPipeBrowserDriver(child,{timeoutMs:100});try{await assert.rejects(driver.run(input));}finally{await driver.close();}
}));
test('foreign invite origin and remote artifacts refuse without reading credentials into CDP',async()=>artifactFixture(async input=>{
 const child=fixture(),driver=createUnverifiedPipeBrowserDriver(child,{timeoutMs:100});try{await assert.rejects(driver.run({...input,inviteArtifact:{...input.inviteArtifact,target:'remote'}}));}finally{await driver.close();}
}));
function observation(){
 const sample=(i,n,screen=false)=>({identity:'guest-'+i,inbound:[{id:'i-m',kind:'audio',source:'microphone',bytes:n,packets:n,frames:0,at:n},{id:'i-c',kind:'video',source:'camera',bytes:n,packets:n,frames:n,at:n},...(screen&&i===2?[{id:'i-s',kind:'video',source:'screen_share',bytes:n,packets:n,frames:n,at:n}]:[])],outbound:[{id:'o-m',kind:'audio',source:'microphone',bytes:n,packets:n,frames:0,at:n},{id:'o-c',kind:'video',source:'camera',bytes:n,packets:n,frames:n,at:n},...(screen&&i===1?[{id:'o-s',kind:'video',source:'screen_share',bytes:n,packets:n,frames:n,at:n}]:[])],candidates:[{selected:true,state:'succeeded',localType:'host',remoteType:'host',protocol:'udp'}],videos:[{source:'camera',width:640,height:480,frames:n},...(screen&&i===2?[{source:'screen_share',width:1280,height:720,frames:n}]:[])]});
 return{schemaVersion:1,contract:'castlink-browser-observations-v1',runId:'r',studioId:'studio-default',room:'room',page:'/room',source:'unverified-pipe',syntheticDevices:true,clients:[1,2].map(i=>({before:sample(i,100),after:sample(i,200)})),screenShare:{before:[1,2].map(i=>sample(i,300,true)),after:[1,2].map(i=>sample(i,400,true))}};
}
test('collected observations require both directions of camera/audio and a measured screen source',()=>{
 const good=observation(),scope={runId:'r',studioId:'studio-default',room:'room'};assert.equal(validateCollectedBrowserObservations(good,scope),true);
 for(const mutate of [v=>v.clients[1].after.inbound[0].bytes=100,v=>v.clients[0].after.outbound[1].frames=100,v=>v.screenShare.after[1].inbound[2].source='camera',v=>v.screenShare.after[1].videos[1].frames=300,v=>v.clients[1].after.identity='guest-foreign',v=>v.clients[0].before.candidates[0].state='failed',v=>v.room='foreign']){const v=structuredClone(good);mutate(v);assert.equal(validateCollectedBrowserObservations(v,scope),false);}
 assert.equal(isBuiltinBrowserEvidence({},good),false);
});
function uiFixture(){
 const samples=JSON.stringify(observation()),source=`const fs=require('node:fs'),vm=require('node:vm');let b='',n=0,c=0;const samples=${samples};const o=fs.createWriteStream(null,{fd:4});fs.createReadStream(null,{fd:3}).on('data',x=>{b+=x;while(b.includes('\\0')){const k=b.indexOf('\\0'),v=JSON.parse(b.slice(0,k));b=b.slice(k+1);let r={};try{if(v.method==='Target.createBrowserContext')r={browserContextId:'context-'+(++c)};if(v.method==='Target.createTarget')r={targetId:'target-'+c};if(v.method==='Target.attachToTarget')r={sessionId:'session-'+c};if(v.method==='Page.addScriptToEvaluateOnNewDocument')new vm.Script(v.params.source);if(v.method==='Page.navigate'&&!v.params.url.includes('#invite=${secret}'))throw Error('missing private fragment');if(v.method==='Runtime.evaluate'){let z=true;if(v.params.expression==='window.__castlinkMediaSample()'){const i=Number(v.sessionId.slice(-1))-1,phase=Math.floor(n++/2);z=phase<2?samples.clients[i][phase===0?'before':'after']:samples.screenShare[phase===2?'before':'after'][i];}r={result:{value:z}};}o.write(JSON.stringify({id:v.id,result:r})+'\\0');if(v.method==='Browser.close')setTimeout(()=>process.exit(0),10);}catch{ o.write(JSON.stringify({id:v.id,error:{message:'private failure'}})+'\\0');}}});`;
 const env={...process.env};delete env.NODE_TEST_CONTEXT;return spawn(node,['-e',source],{env,stdio:['ignore','ignore','ignore','pipe','pipe']});
}
test('two scoped contexts consume private fragment through fixed UI flow but fixture evidence stays unverified',async()=>artifactFixture(async input=>{
 const child=uiFixture(),driver=createUnverifiedPipeBrowserDriver(child,{timeoutMs:500,sampleMs:100,syntheticDevices:true});
 try{const evidence=await driver.run(input);assert.equal(validateCollectedBrowserObservations(evidence,input),true);assert.equal(JSON.stringify(evidence).includes(secret),false);assert.throws(()=>evidence.clients[0].before.identity='guest-forged');assert.equal(isBuiltinBrowserEvidence(driver,evidence),false);assert.equal(isBuiltinBrowserEvidence(driver,structuredClone(evidence)),false);await assert.rejects(driver.run(input));}finally{await driver.close();}
}));
import {createGuardedMediaBrowserTarget,diagnosticBrowserRuntimeDiagnosis} from '../dist/media-browser-target.js';
test('pinned runtime rejects caller supplied image and unbound scope with zero target effects',async()=>{
 let calls=0;const options={executor:{run:async()=>{calls++;throw Error('must not run');}},cursor:{remote:false,assert:async()=>{calls++;},effect:async()=>{calls++;}},binding:{},contract:{},resources:{},fileHashes:{},runtimeImage:'arbitrary:latest'};
 await assert.rejects(createGuardedMediaBrowserTarget(options),e=>e instanceof Error&&e.message==='Guarded diagnostic browser scope or cleanup is unverified; retain the original container acknowledgement and private target cursor. No automatic recreation or name-based adoption is authorized.');assert.equal(calls,0);
});
import {nodeDiagnosticBrowserTarget,isGuardedBrowserProcess} from '../dist/media-browser-target.js';
test('fixed target program emits bounded redacted failure for invalid metadata',()=>{
 const result=spawn(node,['-e',nodeDiagnosticBrowserTarget],{stdio:['pipe','pipe','pipe']});let output='',errors='';result.stdout.on('data',x=>output+=x);result.stderr.on('data',x=>errors+=x);result.stdin.end('{}');return new Promise(resolve=>result.on('close',code=>{assert.equal(code,3);assert.equal(errors,'');assert.equal(output.includes(secret),false);assert.ok(Buffer.byteLength(output)<=1024);assert.equal(output,JSON.stringify({schemaVersion:1,contract:'castlink-media-target-v1',ok:false,diagnosis:'media-target-unverified'})+'\n');assert.equal(isGuardedBrowserProcess({child:result,origin:'https://localhost',runId:'r'}),false);resolve();}));
});
test('runtime source parses without executing browser or profile mutations',()=>{
 const child=spawn(node,['--check',new URL('../../../infrastructure/diagnostic-browser/runtime.mjs',import.meta.url).pathname],{stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{assert.equal(code,0);resolve();});});
});
import {createBuiltinMediaBrowserDriver} from '../dist/media-browser-driver.js';
test('arbitrary process and operator provenance flags cannot enter the built-in driver',async()=>{
 const child=fixture();try{assert.throws(()=>createBuiltinMediaBrowserDriver({child,origin:'https://localhost',studioId:'studio-default',runId:randomUUID(),verified:true,assertScope:async()=>{},closeTarget:async()=>{}}));}finally{child.kill();}
});
test('failed process reap has a bounded unknown close rather than authorizing room cleanup',async()=>{
 const child=fixture('hang'),kill=child.kill.bind(child),pipe=new PrivateCdpPipe(child,{timeoutMs:50});child.kill=()=>false;try{await assert.rejects(pipe.close());}finally{kill('SIGKILL');}
});
test('a same-file foreign-origin fragment is refused before the private pipe receives it',async()=>artifactFixture(async input=>{
 const raw=`https://foreign.invalid/room?studioId=${input.studioId}&name=${input.room}#invite=${secret}`;await writeFile(input.inviteArtifact.path,raw,{mode:0o600});input.inviteArtifact.association.sha256=createHash('sha256').update(raw).digest('hex');const child=fixture(),driver=createUnverifiedPipeBrowserDriver(child,{timeoutMs:100});try{await assert.rejects(driver.run(input));}finally{await driver.close();}
}));
