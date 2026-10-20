import {resetFixtureTarget,fixedTargetFixture,advanceFixtureTarget} from './fixed-target-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs} from '../dist/args.js';
import * as setup from '../dist/setup.js';
test('default setup accepts the exact offline manifest and target configuration options',()=>{
 const args=parseArgs(['setup','--release-manifest','/private/manifest.json','--architecture','amd64','--bind-ipv4','127.0.0.1','--journal-directory','/private/journal']);
 assert.equal(args.options['release-manifest'],'/private/manifest.json');
});
test('default executor refuses an incompatible plan before target effects',async()=>{
 assert.equal(typeof setup.executeSetup,'function');let calls=0;
 await assert.rejects(()=>setup.executeSetup({schemaVersion:1,request:{profile:'studio'},steps:[],blockers:[]},{run:async()=>{calls++;throw Error('PRIVATE');}},{load:async()=>null,lock:async()=>{calls++;},save:async()=>{calls++;}}),e=>e.code===2&&!e.message.includes('PRIVATE'));
 assert.equal(calls,0);
});
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,lstat} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {FileStateStore} from '../dist/state.js';import {FileJournal} from '../dist/journal.js';import {LocalExecutor} from '../dist/executors/local.js';import {renderBundle} from '../dist/bundle.js';import {runCli} from '../dist/main.js';
const raw=JSON.stringify({schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.oci.image.config.v1+json',digest:'sha256:'+'b'.repeat(64),size:123},layers:[]}),digest='sha256:'+createHash('sha256').update(raw).digest('hex');
const manifest={schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:`example.org/${n}@${digest}`,architectures:['amd64']}]))};
async function fixture(run,remote=false){await resetFixtureTarget();
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-default-'));await mkdir(path.join(root,'scope'),{mode:0o700});
 const store=new FileStateStore(path.join(root,'state')),journalDirectory=path.join(root,'journal'),plan={schemaVersion:1,request:{profile:'studio',target:remote?{kind:'remote',host:'fixture.example',user:'deploy',port:22}:{kind:'local'},root:path.join(root,'scope','bundle'),release:manifest.release,network:'loopback'},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]},options={release:manifest,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory,...(remote?{remoteScope:path.join(root,'scope')}:{})},journal=new FileJournal(journalDirectory),local=new LocalExecutor();
 let active=false,complete=false,ownerAccess='invite',failure='',interrupted='',foreignComplete=false;const calls=[],mutations=[],postRequests=[],ownerRequests=[];let objects;
 async function model(){if(objects)return objects;const profile=await store.load('studio');if(!profile)return null;const root=plan.request.root,rendered=renderBundle({release:manifest,installationId:profile.installationId,architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1',secretFiles:{webEnv:root+'/web.env',postgresEnv:root+'/postgres.env',livekitConfig:root+'/livekit.yaml'}}),project=rendered.projectName,L='com.docker.compose.',hash='c'.repeat(64),networkId='e'.repeat(64);
 const volumes=Object.keys(rendered.composeModel.volumes).map(name=>({Name:project+'_'+name,Driver:'local',Scope:'local',Labels:{[L+'project']:project,[L+'volume']:name},Options:null,CreatedAt:'2026-10-05T00:00:00Z'})),network={Id:networkId,Name:project+'_castlink',Driver:'bridge',Internal:false,Attachable:false,EnableIPv6:false,Options:{},Labels:{[L+'project']:project,[L+'network']:'castlink'}};
 const containers=['postgres','web','livekit','caddy'].map((service,i)=>{const m=rendered.composeModel.services[service];return{Id:String(i+1).repeat(64),Name:'/'+project+'-'+service+'-1',Image:'sha256:'+'a'.repeat(64),ConfigImage:manifest.images[service].reference,Labels:{[L+'project']:project,[L+'service']:service,[L+'config-hash']:hash,[L+'project.config_files']:root+'/compose.yaml',[L+'project.working_dir']:root,[L+'container-number']:'1',[L+'oneoff']:'False',[L+'image']:'sha256:'+'a'.repeat(64)},Mounts:(m.volumes??[]).map(v=>v.type==='volume'?{Type:'volume',Name:project+'_'+v.source,Driver:'local',Destination:v.target,RW:true}:{Type:'bind',Source:v.source,Destination:v.target,RW:false}),PortBindings:Object.fromEntries((m.ports??[]).map(p=>[p.target+'/'+p.protocol,[{HostIp:p.host_ip,HostPort:p.published}]])),Privileged:false,NetworkMode:project+'_castlink',Networks:{[project+'_castlink']:{NetworkID:networkId}},Running:true,Health:service==='postgres'?'healthy':''};});objects={rendered,volumes,network,containers,hash};return objects;}
 const executor={run:async req=>{const fixed=await fixedTargetFixture(req,executor);if(fixed)return fixed;
  calls.push(req);const i=req.input?JSON.parse(Buffer.from(req.input)):null,a=req.args;let stdout;
  if(i?.scopeRoot||i?.fileHashes||i?.text)return local.run(req); // actual protected materialization/capture/remote attempt processes
  if(i?.request&&i?.targetGuard){
   const r=i.request,intent=Object.fromEntries(['schemaVersion','installationId','nodeId','origin','serverName','release','webContainerId','caddyContainerId','files','ownerAssociation'].map(k=>[k,r[k]]));
   assert.equal((await journal.read()).steps.verify,'running');assert.ok(await readFile(path.join(journalDirectory,'setup-completion-intent.json')));
   if(failure==='verify')return{code:3,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};
   const text=JSON.stringify(intent,null,2)+'\n';if(i.allowCreate)await writeFile(i.attemptPath,text,{flag:'wx',mode:0o600});else assert.equal(await readFile(i.attemptPath,'utf8'),text);
   postRequests.push(r);if(!complete){mutations.push('complete');complete=true;}if(interrupted==='verify'){interrupted='';throw Error('PRIVATE_FIXTURE')}
   const held=await stat(i.attemptPath),observation={schemaVersion:1,contract:'castlink-setup-target-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,productVersion:'1.0.0-rc.2',tls:'verified',version:'verified',sql:'verified',ownerAccess,setup:'complete'};
   await advanceFixtureTarget();return{code:0,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-setup-completion-v1',observation,attempt:{path:i.attemptPath,dev:held.dev,ino:held.ino,mode:0o600,sha256:createHash('sha256').update(text).digest('hex')}}),stderr:''};
  }
  if(i?.webContainerId){assert.equal(req.sensitive,true);const state=await journal.read();
   if(failure==='verify')return{code:3,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};
   if(i.complete){assert.equal(state.steps.verify,'running');assert.deepEqual(JSON.parse(await readFile(i.attempt.path,'utf8')),{schemaVersion:1,installationId:i.installationId,nodeId:i.nodeId,origin:i.origin,serverName:i.serverName,release:i.release,webContainerId:i.webContainerId,caddyContainerId:i.caddyContainerId,files:i.files,ownerAssociation:i.ownerAssociation});assert.ok(await readFile(path.join(journalDirectory,'setup-completion-intent.json')));assert.ok(await readFile(path.join(journalDirectory,'setup-completion-receipt.json')));postRequests.push(i);if(!complete){mutations.push('complete');complete=true;}if(interrupted==='verify'){interrupted='';throw Error('PRIVATE_FIXTURE');}}
   return{code:0,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-setup-target-v1',installationId:i.installationId,nodeId:i.nodeId,origin:i.origin,serverName:i.serverName,release:i.release,productVersion:'1.0.0-rc.2',tls:'verified',version:'verified',sql:'verified',ownerAccess,setup:complete||foreignComplete?'complete':'pending'}),stderr:''};
  }
  if(i?.outputDirectory){ownerRequests.push(i);assert.equal((await journal.read()).steps.seed,'verified');const filePath=path.join(i.outputDirectory,'owner-invite.txt');
   if(failure==='owner')return{code:3,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};
   if(i.phase==='inspect')return{code:0,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-owner-host-v1',filePath,status:await readFile(filePath).then(()=>true,()=>false)?'present':'absent'}),stderr:''};
   if(i.phase==='prepare'){if(i.allowInitial){mutations.push('owner');await mkdir(i.outputDirectory,{recursive:true,mode:0o700});await writeFile(filePath,'https://127.0.0.1/super-admin#access=csa2.'+'z'.repeat(43)+'\n',{mode:0o600});}else assert.ok(await readFile(filePath));if(interrupted==='owner'){interrupted='';throw Error('PRIVATE_FIXTURE');}}
   return{code:0,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-owner-host-v1',installationId:i.installationId,nodeId:i.nodeId,filePath,origin:i.origin,status:'verified',expiresAt:2000000000000}),stderr:''};
  }
  if(a.includes('exec')){assert.equal(req.sensitive,true);const phase=i.phase;if(failure===phase)return{code:3,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};mutations.push(phase);if(interrupted===phase){interrupted='';throw Error('PRIVATE_FIXTURE');}return{code:0,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-database-v1',phase,installationId:i.installationId,nodeId:i.nodeId,migrations:{roomVersions:[1,2,3,4,5,6],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null}),stderr:''};}
  if(i?.containerId)return{code:0,stdout:JSON.stringify({schemaVersion:1,sha256:createHash('sha256').update((await model()).rendered.caddyText).digest('hex')}),stderr:''};
  if(a[0]==='buildx'){if(failure==='release')return{code:3,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};stdout=a.includes('--raw')?raw:JSON.stringify({manifest:{mediaType:'application/vnd.oci.image.manifest.v1+json',digest,size:Buffer.byteLength(raw)},platform:{architecture:'amd64',os:'linux',variant:''}});}
  else if(a[0]==='image'){if(failure==='images')return{code:1,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};stdout=JSON.stringify({Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64',...(a.some(x=>x.includes('Variant'))?{Variant:''}:{}),RepoDigests:[a.at(-1)],Volumes:null});}
  else if(a[0]==='compose'&&a.includes('config'))stdout=['postgres','web','livekit','caddy'].map(s=>s+' '+objects.hash).join('\n');
  else if(a[0]==='compose'&&a.includes('up')){assert.equal((await journal.read()).steps.services,'running');active=true;mutations.push('services');if(interrupted==='services'){interrupted='';throw Error('PRIVATE_FIXTURE');}stdout='';}
  else if(a[1]==='ls'){const m=await model();stdout=active?(a[0]==='container'?m.containers.map(c=>c.Id):a[0]==='volume'?m.volumes.map(v=>v.Name):[m.network.Id]).join('\n'):'';}
  else if(['container','volume','network'].includes(a[0])&&a[1]==='inspect'){const m=await model();stdout=JSON.stringify((a[0]==='container'?m.containers:a[0]==='volume'?m.volumes:[m.network]).find(v=>(v.Id??v.Name)===a.at(-1)));}
  else if(i?.tcp)stdout=JSON.stringify({schemaVersion:1,address:true,tcp:i.tcp.map(port=>({port,available:true})),udp:i.udp.map(port=>({port,available:true}))});
  else if(a[0]==='info')stdout=JSON.stringify({ID:'fixture-engine'});else if(a[0]==='context')stdout=JSON.stringify('unix:///var/run/docker.sock');else if(a[0]==='version')stdout='linux|amd64|28.0.0';else if(a[0]==='compose'){await model();stdout='2.40.3';}
  else {if(failure==='preflight')return{code:1,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'};stdout=JSON.stringify(remote?{platform:'linux',arch:'x86_64',distribution:'ubuntu',osVersion:'24.04'}:{platform:'darwin',arch:'x64',osVersion:'14.0'});}
  return{code:0,stdout,stderr:''};
 }};
 try{await run({root,plan,options,store,journal,executor,calls,mutations,ownerRequests,postRequests,model,fail:value=>failure=value,interrupt:value=>interrupted=value,consume:()=>ownerAccess='session',foreign:()=>foreignComplete=true,loseSetup:()=>complete=false});}finally{await rm(root,{recursive:true,force:true});}
}
for(const remote of [false,true])test(`default ${remote?'remote':'local'} sequential setup observes completion and retains exact credentials on repeat`,()=>fixture(async f=>{
 const first=await setup.executeSetup(f.plan,f.executor,f.store,f.options),secret=await readFile(path.join(f.plan.request.root,'web.env')),invite=await readFile(first.owner.filePath),id=first.profile.installationId;
 assert.equal(first.applicationReady,true);assert.equal(first.browserTrust,'unverified');assert.ok(first.checks.some(c=>c.id==='media'&&c.state==='unverified'));assert.deepEqual(f.mutations,['services','migrations','seed','owner','complete']);assert.ok(Object.values((await f.journal.read()).steps).every(s=>s==='verified'));
 const ownerCalls=f.ownerRequests.length;f.consume();const retry=await setup.executeSetup(f.plan,f.executor,f.store);assert.equal(retry.profile.installationId,id);assert.equal(f.ownerRequests.length,ownerCalls);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.deepEqual(await readFile(first.owner.filePath),invite);assert.deepEqual(f.mutations,['services','migrations','seed','owner','complete']);
},remote));
for(const phase of ['services','migrations','seed','owner','verify'])test(`lost ${phase} reply retains uncertain cursor and refuses mutation retry`,()=>fixture(async f=>{
 f.interrupt(phase);await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));const profile=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env')),effects=f.mutations.length,posts=f.postRequests.length;
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal((await f.store.load('studio')).installationId,profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.equal(f.mutations.length,effects);assert.equal(f.postRequests.length,posts);
}));
for(const phase of ['preflight','release','images','migrations','seed','owner','verify'])test(`failed ${phase} blocks readiness and later mutation`,()=>fixture(async f=>{
 f.fail(phase);await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options),e=>!e.message.includes('PRIVATE_FIXTURE'));const p=await f.store.load('studio');if(p)assert.notEqual((await f.journal.read()).steps.verify,'verified');assert.equal(f.mutations.includes('complete'),false);if(['preflight','release','images','migrations','seed'].includes(phase))assert.equal(f.ownerRequests.length,0);
}));
test('foreign completed setup cannot acquire a completion attempt',()=>fixture(async f=>{f.foreign();await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options),e=>e.code===4);assert.equal(f.postRequests.length,0);assert.equal(await readFile(path.join(f.options.journalDirectory,'setup-completion-intent.json')).then(()=>true,()=>false),false);}));
for(const drift of ['secret','volume','owner','attempt'])test(`retained ${drift} drift refuses retry without setup POST`,()=>fixture(async f=>{
 f.interrupt('verify');await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));const before=f.postRequests.length;
 if(drift==='secret')await writeFile(path.join(f.plan.request.root,'web.env'),'PRIVATE_FIXTURE');if(drift==='volume')(await f.model()).volumes.pop();if(drift==='owner')await rm(path.join(f.options.journalDirectory,'owner-invite.txt'));if(drift==='attempt')await writeFile(path.join(f.options.journalDirectory,'setup-completion.json'),'PRIVATE_FIXTURE');
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store),e=>!e.message.includes('PRIVATE_FIXTURE'));assert.equal(f.postRequests.length,before);assert.notEqual((await f.journal.read()).steps.verify,'verified');
}));
test('default CLI dispatch runs application setup but does not claim accepted browser CA',()=>fixture(async f=>{
 const manifestFile=path.join(f.root,'manifest.json');await writeFile(manifestFile,JSON.stringify(manifest));const output=[];
 const argv=['setup','--target','local','--profile','studio','--network','loopback','--root',f.plan.request.root,'--release',manifest.release,'--release-manifest',manifestFile,'--architecture','amd64','--bind-ipv4','127.0.0.1','--journal-directory',f.options.journalDirectory,'--json'];
 assert.equal(await runCli(argv,{executor:f.executor,store:f.store,readLine:async()=>{throw Error('Unexpected prompt');},write:s=>output.push(s),detect:async()=>{throw Error('Speculative detection');}}),3);
 const result=JSON.parse(output.join(''));assert.equal(result.applicationReady,true);assert.equal(result.ready,false);assert.equal(result.browserTrust,'unverified');assert.doesNotMatch(output.join(''),/csa2\.|#access|sha256|dev|ino/);assert.match(result.owner.filePath,/owner-invite.txt$/);
}));
test('default dry run with manifest options never reads manifest or executes target',async()=>{
 let effects=0;const output=[];assert.equal(await runCli(['setup','--target','local','--network','loopback','--root','/private/bundle','--release-manifest','/missing/manifest','--architecture','amd64','--bind-ipv4','127.0.0.1','--journal-directory','/missing/journal','--dry-run','--json'],{executor:{run:async()=>{effects++;}},store:{load:async()=>null,lock:async()=>{effects++;},save:async()=>{effects++;}},readLine:async()=>'',write:s=>output.push(s),detect:async()=>({platform:'darwin',arch:'x64',runtimeReady:false})}),0);assert.equal(effects,0);assert.equal(JSON.parse(output.join('')).steps.length,9);
});

test('untrusted store CliError never exposes credential-like diagnostics',async()=>{
 const {CliError}=await import('../dist/types.js');const p={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},network:'loopback',root:'/private/bundle',release:manifest.release},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};
 await assert.rejects(()=>setup.executeSetup(p,{run:async()=>{throw Error('Unexpected target');}},{load:async()=>{throw new CliError('PRIVATE_FIXTURE',4);},save:async()=>{},lock:async()=>async()=>{}}),e=>e.code===4&&!e.message.includes('PRIVATE_FIXTURE'));
});
test('deleted completion file after applied setup is refused without recreating the target attempt',()=>fixture(async f=>{
 f.interrupt('verify');await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));const file=path.join(f.options.journalDirectory,'setup-completion.json');await rm(file);
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(await readFile(file).then(()=>true,()=>false),false);
}));
test('foreign completion between intent durability and target completion receipt cannot be adopted',()=>fixture(async f=>{
 f.interrupt('verify');await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));await rm(path.join(f.options.journalDirectory,'setup-completion-receipt.json'),{force:true});
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.notEqual((await f.journal.read()).steps.verify,'verified');
}));
for(const boundary of ['preflight','release','config','runtime','services','migrations','seed','owner','verify'])test(`interruption after durable ${boundary} checkpoint resumes nine-step setup`,()=>fixture(async f=>{
 const original=FileJournal.prototype.mark;let interrupted=false;
 FileJournal.prototype.mark=async function(step,state){await original.call(this,step,state);if(!interrupted&&step===boundary&&state==='verified'){interrupted=true;throw Error('PRIVATE_FIXTURE');}};
 try{await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));}finally{FileJournal.prototype.mark=original;}
 assert.equal(interrupted,true);const p=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env'));const result=await setup.executeSetup(f.plan,f.executor,f.store);assert.equal(result.profile.installationId,p.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.ok(Object.values((await f.journal.read()).steps).every(s=>s==='verified'));assert.equal(f.mutations.filter(x=>x==='services').length,1);assert.equal(f.mutations.filter(x=>x==='owner').length,1);
}));
test('remote lost completion batch reply retains exact attempt and refuses replay',()=>fixture(async f=>{
 f.interrupt('verify');await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));const p=await f.store.load('studio'),targetFile=path.join(f.options.remoteScope,'owner-'+p.installationId,'setup-completion.json'),before=await readFile(targetFile),posts=f.postRequests.length;
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.deepEqual(await readFile(targetFile),before);assert.equal(f.postRequests.length,posts);
},true));
test('default remote CLI uses strict SSH envelopes for every selected-target action',()=>fixture(async f=>{
 const manifestFile=path.join(f.root,'manifest.json');await writeFile(manifestFile,JSON.stringify(manifest));const envelopes=[],out=[],transport={run:async req=>{assert.equal(req.executable,'ssh');assert.ok(req.args.includes('StrictHostKeyChecking=yes'));assert.ok(req.args.includes('PreferredAuthentications=publickey'));envelopes.push(req);const envelope=JSON.parse(Buffer.from(req.input));return{code:0,stdout:JSON.stringify(await f.executor.run({...envelope,input:envelope.input?Buffer.from(envelope.input):undefined,sensitive:req.sensitive})),stderr:''};}};
 const argv=['setup','--target','remote','--host','fixture.example','--user','deploy','--profile','studio','--network','loopback','--root',f.plan.request.root,'--release',manifest.release,'--release-manifest',manifestFile,'--architecture','amd64','--bind-ipv4','127.0.0.1','--journal-directory',f.options.journalDirectory,'--remote-scope',f.options.remoteScope,'--json'];
 assert.equal(await runCli(argv,{executor:transport,store:f.store,readLine:async()=>'',write:s=>out.push(s),detect:async()=>{throw Error('Unexpected speculative detection');}}),3);assert.equal(JSON.parse(out.join('')).applicationReady,true);assert.ok(envelopes.length>30);assert.doesNotMatch(out.join(''),/csa2\.|#access/);
},true));
test('interactive setup collects target and private configuration before mutation',()=>fixture(async f=>{
 const file=path.join(f.root,'manifest.json');await writeFile(file,JSON.stringify(manifest));const answers=['local','studio','loopback',f.plan.request.root,file,'amd64','127.0.0.1',f.options.journalDirectory],out=[];let prompts=0;
 const executor={run:req=>{assert.equal(answers.length,0,'all settings must precede effects');return f.executor.run(req);}};
 assert.equal(await runCli(['setup','--release',manifest.release,'--json'],{executor,store:f.store,readLine:async()=>{prompts++;return answers.shift();},write:s=>out.push(s),detect:async()=>{throw Error('Unexpected speculative detect');}}),3);assert.equal(prompts,8);assert.equal(JSON.parse(out.join('')).applicationReady,true);
}));
test('another profile cannot overwrite an existing completed bundle',()=>fixture(async f=>{
 await setup.executeSetup(f.plan,f.executor,f.store,f.options);const p=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env')),count=f.mutations.length;
 await assert.rejects(()=>setup.executeSetup({...f.plan,request:{...f.plan.request,profile:'foreign'}},f.executor,f.store,{...f.options,journalDirectory:path.join(f.root,'foreign-journal')}));assert.equal(await f.store.load('foreign'),null);assert.equal(f.mutations.length,count);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.equal((await f.store.load('studio')).installationId,p.installationId);
}));
test('shared StateStore profile mutation during final target observation refuses readiness and preserves installation secrets',()=>fixture(async f=>{
 const baseline=await setup.executeSetup(f.plan,f.executor,f.store,f.options),shared=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env')),before=f.postRequests.length;let changed=false;
 const aliasStore={load:async()=>shared,save:p=>f.store.save(p),lock:name=>f.store.lock(name)};
 const executor={run:async req=>{const result=await f.executor.run(req);if(!changed&&req.input&&JSON.parse(Buffer.from(req.input)).fileHashes){changed=true;shared.currentRelease='2.0.0';shared.request.network='lan';}return result;}};
 await assert.rejects(()=>setup.executeSetup(f.plan,executor,aliasStore));assert.equal(changed,true);assert.equal(f.postRequests.length,before);assert.equal((await f.store.load('studio')).installationId,baseline.profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);
}));
test('remote completion file removed at the retry open boundary is refused and never recreated',()=>fixture(async f=>{
 const baseline=await setup.executeSetup(f.plan,f.executor,f.store,f.options),secret=await readFile(path.join(f.plan.request.root,'web.env')),file=path.join(f.options.remoteScope,'owner-'+baseline.profile.installationId,'setup-completion.json'),before=f.postRequests.length;let injected=false;
 const executor={run:async req=>{
  const i=req.input?JSON.parse(Buffer.from(req.input)):null;
  if(i?.text){injected=true;const hook=`\noriginal_open=os.open\nraced=False\ndef race_open(file,flags,*args):\n global raced\n if not raced and file==${JSON.stringify(file)}:\n  raced=True\n  os.unlink(file)\n return original_open(file,flags,*args)\nos.open=race_open\n`;
   return f.executor.run({...req,args:['-c',req.args[1].replace('try:\n r=',hook+'try:\n r=')]});
  }return f.executor.run(req);
 }};
 await assert.rejects(()=>setup.executeSetup(f.plan,executor,f.store));assert.equal(injected,true);assert.equal(await readFile(file).then(()=>true,()=>false),false);assert.equal(f.postRequests.length,before);assert.equal((await f.store.load('studio')).installationId,baseline.profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);
},true));
for(const remote of [false,true])test(`completed ${remote?'remote':'local'} setup-file loss refuses retry without another POST or credential replacement`,()=>fixture(async f=>{
 const first=await setup.executeSetup(f.plan,f.executor,f.store,f.options),secret=await readFile(path.join(f.plan.request.root,'web.env')),invite=await readFile(first.owner.filePath),before=f.postRequests.length;
 f.loseSetup();await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(f.postRequests.length,before);assert.equal((await f.store.load('studio')).installationId,first.profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.deepEqual(await readFile(first.owner.filePath),invite);
},remote));
for(const remote of [false,true])test(`setup-file deletion after ${remote?'remote':'local'} completion reply refuses read-only final verification and retained-success retry`,()=>fixture(async f=>{
 let deleted=false;const executor={run:async req=>{const result=await f.executor.run(req);const i=req.input?JSON.parse(Buffer.from(req.input)):null;if(!deleted&&i?.request&&i.targetGuard){deleted=true;f.loseSetup();}return result;}};
 await assert.rejects(()=>setup.executeSetup(f.plan,executor,f.store,f.options));assert.equal(deleted,true);assert.equal(f.postRequests.length,1);assert.notEqual((await f.journal.read()).steps.verify,'verified');
 const p=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env'));await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(f.postRequests.length,1);assert.equal((await f.store.load('studio')).installationId,p.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);
},remote));
for(const remote of [false,true])test(`durable ${remote?'remote':'local'} observed success refuses lost setup when journal is running after refresh interruption`,()=>fixture(async f=>{
 const first=await setup.executeSetup(f.plan,f.executor,f.store,f.options),before=f.postRequests.length,secret=await readFile(path.join(f.plan.request.root,'web.env'));
 await f.journal.mark('verify','running');f.loseSetup();await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(f.postRequests.length,before);assert.equal((await f.store.load('studio')).installationId,first.profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.equal((await f.journal.read()).steps.verify,'running');
},remote));
for(const remote of [false,true])test(`completed ${remote?'remote':'local'} target-attempt file deletion during final observation refuses readiness without recreation`,()=>fixture(async f=>{
 let file,deleted=false;const executor={run:async req=>{const result=await f.executor.run(req),i=req.input?JSON.parse(Buffer.from(req.input)):null;if(!deleted&&i?.request&&i.targetGuard){deleted=true;file=i.attemptPath;await rm(file);}return result;}};
 await assert.rejects(()=>setup.executeSetup(f.plan,executor,f.store,f.options));assert.equal(deleted,true);assert.equal(await readFile(file).then(()=>true,()=>false),false);assert.equal(f.postRequests.length,1);assert.notEqual((await f.journal.read()).steps.verify,'verified');
},remote));

for(const checkpoint of ['config','migrations'])for(const field of ['principal','scope','engine','endpoint','epoch'])test(`default frozen ${field} refuses foreign generation after ${checkpoint} before later effects`,()=>fixture(async f=>{
 const mark=FileJournal.prototype.mark;let switched=false;FileJournal.prototype.mark=async function(id,state){await mark.call(this,id,state);if(id===checkpoint&&state==='verified')switched=true;};
 const executor={run:async req=>{const r=await f.executor.run(req);if(switched&&!req.input&&req.args[1]?.includes('epoch:exists')){const g=JSON.parse(r.stdout);g[field]=field==='epoch'||field==='principal'?g[field]+1:field==='scope'?f.root+'/foreign/.castlink-target-operations':field==='engine'?'foreign-engine':'unix:///foreign';return{...r,stdout:JSON.stringify(g)}}return r;}};
 try{await assert.rejects(()=>setup.executeSetup(f.plan,executor,f.store,f.options));}finally{FileJournal.prototype.mark=mark;}
 assert.equal(switched,true);assert.equal(f.ownerRequests.length,0);assert.equal(f.postRequests.length,0);assert.equal(f.mutations.includes('seed'),false);if(checkpoint==='config')assert.equal(f.mutations.length,0);
 const profile=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env')),effects=f.mutations.length;
 await assert.rejects(()=>setup.executeSetup(f.plan,executor,f.store));assert.equal((await f.store.load('studio')).installationId,profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);assert.equal(f.mutations.length,effects);
}));
test('retained completion with earlier journal drift never replays consumed owner initialization',()=>fixture(async f=>{
 const first=await setup.executeSetup(f.plan,f.executor,f.store,f.options),secret=await readFile(path.join(f.plan.request.root,'web.env')),ownerCalls=f.ownerRequests.length,effects=f.mutations.length;f.consume();await f.journal.mark('owner','running');
 await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(f.ownerRequests.length,ownerCalls);assert.equal(f.mutations.length,effects);assert.equal((await f.store.load('studio')).installationId,first.profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);
}));
test('native Windows default setup preserves first-scope refusal before mutation',async()=>{const descriptor=Object.getOwnPropertyDescriptor(process,'platform'),plan={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},root:'/private/bundle',release:manifest.release,network:'loopback'},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};let saves=0,locks=0;try{Object.defineProperty(process,'platform',{value:'win32'});await assert.rejects(()=>setup.executeSetup(plan,{run:async()=>({code:4,stdout:'PRIVATE_FIXTURE',stderr:'PRIVATE_FIXTURE'})},{load:async()=>null,save:async()=>saves++,lock:async()=>{locks++;return async()=>{}}},{release:manifest,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:'/private/journal'}),e=>e.code===4&&/Windows/.test(e.message)&&/first-setup HKCU authority or private profile root is unverified/.test(e.message)&&!e.message.includes('PRIVATE_FIXTURE'));assert.equal(saves,0);assert.equal(locks,0);}finally{Object.defineProperty(process,'platform',descriptor);}});
for(const phase of ['services','migrations'])test(`missing private cursor after unknown ${phase} reply refuses effects and retains installation secrets`,()=>fixture(async f=>{f.interrupt(phase);await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store,f.options));const profile=await f.store.load('studio'),secret=await readFile(path.join(f.plan.request.root,'web.env')),effects=f.mutations.length,posts=f.postRequests.length;await rm(path.join(f.options.journalDirectory,'target-cursor.json'));await assert.rejects(()=>setup.executeSetup(f.plan,f.executor,f.store));assert.equal(await lstat(path.join(f.options.journalDirectory,'target-cursor.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e}),false);assert.equal(f.mutations.length,effects);assert.equal(f.postRequests.length,posts);assert.equal((await f.store.load('studio')).installationId,profile.installationId);assert.deepEqual(await readFile(path.join(f.plan.request.root,'web.env')),secret);}));
for(const kind of ['target','cursor'])test(`untrusted ${kind} error class cannot disclose injected store diagnostics`,async()=>{const module=await import(kind==='target'?'../dist/target-operation-observer.js':'../dist/setup-target-guard.js'),ErrorClass=kind==='target'?module.TargetOperationObservationError:module.SetupTargetCursorError,plan={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},root:'/private/bundle',release:manifest.release,network:'loopback'},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};await assert.rejects(()=>setup.executeSetup(plan,{run:async()=>{throw Error('Unexpected effect')}},{load:async()=>{throw new ErrorClass('PRIVATE_FIXTURE',4)},save:async()=>{},lock:async()=>async()=>{}},{release:manifest,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:'/private/journal'}),e=>e.code===4&&!e.message.includes('PRIVATE_FIXTURE'));});
