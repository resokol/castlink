import {retargetFixtureCursor,resetFixtureTarget,fixedTargetFixture,fixtureHome} from './fixed-target-fixture.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {FileStateStore} from '../dist/state.js';import {FileJournal} from '../dist/journal.js';
import {renderBundle} from '../dist/bundle.js';import {createHash} from 'node:crypto';
import {LocalExecutor} from '../dist/executors/local.js';import {SshExecutor} from '../dist/executors/ssh.js';import {materializeRemoteBundle} from '../dist/remote-bundle.js';
import {parseArgs} from '../dist/args.js';import {runCli} from '../dist/main.js';
const manifest={schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:`example.org/${n}@sha256:${'b'.repeat(64)}`,architectures:['amd64']}]))};
async function fixture(run){await resetFixtureTarget();const root=await mkdtemp(path.join(os.tmpdir(),'castlink-database-'));try{const store=new FileStateStore(path.join(root,'state')),plan={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},root:path.join(root,'bundle'),release:manifest.release,network:'loopback'},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]},options={release:manifest,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:path.join(root,'journal')};
 const executor={run:async r=>{const fixed=await fixedTargetFixture(r,executor);if(fixed)return fixed;let stdout;if(r.args[0]==='info')stdout=JSON.stringify({ID:'fixture-engine'});else if(r.args[0]==='context')stdout=JSON.stringify('unix:///var/run/docker.sock');else if(r.args[0]==='version')stdout='linux|amd64|28.0.0';else if(r.args[0]==='compose')stdout='2.40.3';else if(r.input){const input=JSON.parse(Buffer.from(r.input));stdout=JSON.stringify({schemaVersion:1,address:true,tcp:input.tcp.map(port=>({port,available:true})),udp:input.udp.map(port=>({port,available:true}))});}else stdout=JSON.stringify({platform:'darwin',arch:'x64',osVersion:'14.0'});return{code:0,stdout,stderr:''}}};
 // Real protected bundle/profile/journal; release availability is exercised by
 // existing preparation tests. This fixture prepares through the local API.
 const {prepareLocalConfig}=await import('../dist/setup.js');await prepareLocalConfig(plan,options,executor,store);
 const owner=path.join(root,'journal','owner.json'),profile=await store.load('studio');await writeFile(owner,JSON.stringify({schemaVersion:1,installationId:profile.installationId,request:plan.request,preparation:options}),{mode:0o600});const journal=new FileJournal(options.journalDirectory);for(const id of ['preflight','release']){await journal.mark(id,'running');await journal.mark(id,'verified');}
 await run({root,store,plan,options,executor,journal,profile});}finally{await rm(root,{recursive:true,force:true});}}
function resources(f){const root=f.plan.request.root,rendered=renderBundle({release:manifest,installationId:f.profile.installationId,architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1',secretFiles:{webEnv:root+'/web.env',postgresEnv:root+'/postgres.env',livekitConfig:root+'/livekit.yaml'}}),project=rendered.projectName,L='com.docker.compose.',networkId='e'.repeat(64),hash='c'.repeat(64);let active=false,lose=false,fake=false;const calls=[];
 const volumes=Object.keys(rendered.composeModel.volumes).map(name=>({Name:project+'_'+name,Driver:'local',Scope:'local',Labels:{[L+'project']:project,[L+'volume']:name},Options:null,CreatedAt:'2026-10-05T00:00:00Z'}));
 const network={Id:networkId,Name:project+'_castlink',Driver:'bridge',Internal:false,Attachable:false,EnableIPv6:false,Options:{},Labels:{[L+'project']:project,[L+'network']:'castlink'}};
 const containers=['postgres','web','livekit','caddy'].map((service,i)=>{const model=rendered.composeModel.services[service];return{Id:String(i+1).repeat(64),Name:'/'+project+'-'+service+'-1',Image:'sha256:'+'a'.repeat(64),ConfigImage:manifest.images[service].reference,Labels:{[L+'project']:project,[L+'service']:service,[L+'config-hash']:hash,[L+'project.config_files']:root+'/compose.yaml',[L+'project.working_dir']:root,[L+'container-number']:'1',[L+'oneoff']:'False',[L+'image']:'sha256:'+'a'.repeat(64)},Mounts:(model.volumes??[]).map(m=>m.type==='volume'?{Type:'volume',Name:project+'_'+m.source,Driver:'local',Destination:m.target,RW:true}:{Type:'bind',Source:m.source,Destination:m.target,RW:false}),PortBindings:Object.fromEntries((model.ports??[]).map(p=>[p.target+'/'+p.protocol,[{HostIp:p.host_ip,HostPort:p.published}]])),Privileged:false,NetworkMode:project+'_castlink',Networks:{[project+'_castlink']:{NetworkID:networkId}},Running:true,Health:service==='postgres'?'healthy':''};});
 const executor={run:async r=>{calls.push(r);const fixed=await fixedTargetFixture(r,executor);if(fixed)return fixed;if(r.args[0]==='info')return{code:0,stdout:JSON.stringify({ID:'fixture-engine'}),stderr:''};if(r.input&&JSON.parse(Buffer.from(r.input)).containerId)return{code:0,stdout:JSON.stringify({schemaVersion:1,sha256:createHash('sha256').update(rendered.caddyText).digest('hex')}),stderr:''};let stdout;
 if(r.args[0]==='image')stdout=JSON.stringify({Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64',RepoDigests:[r.args.at(-1)],Volumes:null});
 else if(r.args[0]==='compose'&&r.args.includes('config'))stdout=['postgres','web','livekit','caddy'].map(s=>s+' '+hash).join('\n');
 else if(r.args[0]==='compose'&&r.args.includes('up')){assert.equal((await f.journal.read()).steps.services,'running');assert.ok(await readFile(path.join(f.root,'journal','services-attempt.json')));active=!fake;if(lose){lose=false;throw Error('PRIVATE_FIXTURE')}stdout='PRIVATE_FIXTURE';}
 else if(r.args[1]==='ls'){const kind=r.args[0];stdout=active?(kind==='container'?containers.map(c=>c.Id):kind==='volume'?volumes.map(v=>v.Name):[network.Id]).join('\n'):'';}
 else if(['container','volume','network'].includes(r.args[0])&&r.args[1]==='inspect'){const values=r.args[0]==='container'?containers:r.args[0]==='volume'?volumes:[network];stdout=JSON.stringify(values.find(v=>(v.Id??v.Name)===r.args.at(-1)));}
 else return f.executor.run(r);return{code:0,stdout,stderr:''};}};
 return{executor,calls,volumes,network,containers,activate:()=>active=true,lose:()=>lose=true,fake:()=>fake=true};}
async function database(f,run){
 const api=await import('../dist/setup.js');assert.equal(typeof api.preparePreparedDatabase,'function','guarded database API missing');
 const r=resources(f);await api.startPreparedServices(f.plan,f.options,r.executor,f.store);
 let fail='',missing=false,lose=false;const phases=[];
 const executor={run:async req=>{
  const fixed=await fixedTargetFixture(req,executor);if(fixed)return fixed;
  if(req.args.includes('exec')){
   const input=JSON.parse(Buffer.from(req.input));phases.push(input.phase);
   assert.equal(req.sensitive,true);assert.equal(req.executable,'docker');
   assert.deepEqual(req.args.slice(req.args.indexOf('exec')),['exec','-T','web','node','/app/scripts/setup-database-v1.mjs']);
   assert.deepEqual(Object.keys(input).sort(),['installationId','nodeId','phase','schemaVersion']);
   assert.equal(input.installationId,f.profile.installationId);
   assert.equal((await f.journal.read()).steps[input.phase],'running');
   assert.ok(await readFile(path.join(f.options.journalDirectory,input.phase+'-attempt.json')));
   if(missing)return{code:1,stdout:'PRIVATE_FIXTURE',stderr:'Cannot find module PRIVATE_FIXTURE'};
   if(input.phase===fail)return{code:3,stdout:JSON.stringify({schemaVersion:1,contract:'castlink-database-v1',ok:false,diagnosis:'database-contract-refused'}),stderr:'PRIVATE_FIXTURE'};
   const result={schemaVersion:1,contract:'castlink-database-v1',phase:input.phase,installationId:input.installationId,nodeId:input.nodeId,migrations:{roomVersions:[1,2,3],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:input.phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null};
   if(lose){lose=false;throw Error('PRIVATE_FIXTURE')}
   return{code:0,stdout:JSON.stringify(result),stderr:''};
  }return r.executor.run(req);
 }};
 await run({api,r,executor,phases,fail:p=>fail=p,missing:()=>missing=true,lose:()=>lose=true});
}
test('database stage flags are explicit mutually exclusive and bounded to setup',()=>{
 assert.equal(parseArgs(['setup','--prepare-database']).options['prepare-database'],'true');
 for(const other of ['prepare-config','start-services'])assert.throws(()=>parseArgs(['setup','--prepare-database','--'+other]));
 assert.throws(()=>parseArgs(['doctor','--prepare-database']));
});
test('database API reobserves migrations before seed and verified retry with fixed stdin helper',()=>fixture(async f=>database(f,async d=>{
 const up=d.r.calls.filter(r=>r.args.includes('up')).length;await d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store);
 assert.deepEqual(d.phases,['migrations','seed']);const j=await f.journal.read();for(const s of ['migrations','seed'])assert.equal(j.steps[s],'verified');for(const s of ['owner','verify'])assert.equal(j.steps[s],'pending');
 await d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store);assert.deepEqual(d.phases,['migrations','seed','migrations','seed']);assert.equal(d.r.calls.filter(r=>r.args.includes('up')).length,up);
})));
test('failed migrations keep seed pending and do not trust exit status or dependency errors',()=>fixture(async f=>database(f,async d=>{
 d.fail('migrations');await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store),e=>e.code===4&&!e.message.includes('PRIVATE_FIXTURE'));
 assert.deepEqual(d.phases,['migrations']);const j=await f.journal.read();assert.equal(j.steps.migrations,'running');assert.equal(j.steps.seed,'pending');
})));
test('seed failure retains migration proof and retries actual SQL without services up',()=>fixture(async f=>database(f,async d=>{
 d.fail('seed');await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store),e=>e.code===4);let j=await f.journal.read();assert.equal(j.steps.migrations,'verified');assert.equal(j.steps.seed,'running');d.fail('');const count=d.phases.length;await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store));assert.equal(d.phases.length,count);assert.equal((await f.journal.read()).steps.seed,'running');
})));
test('missing helper has actionable fixed pinned-image-contract diagnosis and no arbitrary fallback',()=>fixture(async f=>database(f,async d=>{
 d.missing();await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store),e=>e.code===4&&/image.*contract|contract.*image/i.test(e.message)&&!e.message.includes('PRIVATE_FIXTURE'));
 assert.deepEqual(d.phases,['migrations']);assert.equal((await f.journal.read()).steps.migrations,'running');
})));
test('lost SQL response retries under same profile and actual resource identity',()=>fixture(async f=>database(f,async d=>{
 d.lose();await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store));await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store));assert.deepEqual(d.phases,['migrations']);
})));
for(const change of ['files','resource','image','readiness','owner','scope'])test(`database stage refuses ${change} drift before helper mutation`,()=>fixture(async f=>database(f,async d=>{
 if(change==='files')await writeFile(path.join(f.plan.request.root,'web.env'),'PRIVATE_FIXTURE\n',{mode:0o600});
 if(change==='resource')d.r.containers[0].Id='f'.repeat(64);
 if(change==='image')d.r.containers[1].Image='sha256:'+'f'.repeat(64);
 if(change==='readiness')d.r.containers[0].Health='unhealthy';
 if(change==='owner')await f.journal.mark('owner','running');
 if(change==='scope')f.options.journalDirectory=path.join(f.root,'foreign');
 await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,f.store));assert.deepEqual(d.phases,[]);
})));
test('database stage refuses concurrent profile lock before helper',()=>fixture(async f=>database(f,async d=>{
 const unlock=await f.store.lock('studio');try{await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,d.executor,new FileStateStore(f.store.root)),e=>e.code===4);assert.deepEqual(d.phases,[]);}finally{await unlock();}
})));
for(const altered of ['schema','hashes','identity','versions','counts','extra','duplicate'])test(`exit zero with invalid observed ${altered} cannot verify migrations/seed`,()=>fixture(async f=>database(f,async d=>{
 const executor={run:async req=>{const r=await d.executor.run(req);if(req.input&&JSON.parse(Buffer.from(req.input)).targetGuard){const o=JSON.parse(r.stdout);if(altered==='schema')o.migrations.schema=false;if(altered==='hashes')o.migrations.hashes=false;if(altered==='identity')o.installationId='foreign';if(altered==='versions')o.migrations.controlVersions=[1];if(altered==='extra')o.extra='PRIVATE_FIXTURE';if(altered==='counts'&&o.seed)o.seed.nodes=0;return{...r,stdout:altered==='duplicate'?r.stdout.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'):JSON.stringify(o)}}return r;}};
 await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,executor,f.store),e=>e.code===4&&!e.message.includes('PRIVATE_FIXTURE'));const j=await f.journal.read();assert.notEqual(j.steps[altered==='counts'?'seed':'migrations'],'verified');
})));
test('CLI database stage reports partial ready false/code3 and leaves owner/verify pending',()=>fixture(async f=>database(f,async d=>{
 const file=path.join(f.root,'manifest.json'),out=[];await writeFile(file,JSON.stringify(manifest));
 const code=await runCli(['setup','--prepare-database','--target','local','--profile','studio','--root',f.plan.request.root,'--network','loopback','--release',manifest.release,'--release-manifest',file,'--architecture','amd64','--bind-ipv4','127.0.0.1','--journal-directory',f.options.journalDirectory,'--json'],{executor:d.executor,store:f.store,readLine:async()=>'',write:s=>out.push(s),detect:async()=>{throw Error('speculative detect forbidden')}});
 assert.equal(code,3);const result=JSON.parse(out.join(''));assert.equal(result.status,'partial');assert.equal(result.ready,false);assert.match(result.message,/owner|readiness/);assert.doesNotMatch(out.join(''),/PRIVATE_FIXTURE|https:\/\/|invitation/);
})));

async function actualDocker(f,remote,run){
 const r=resources(f),bin=path.join(f.root,'bin'),modelFile=path.join(f.root,'docker-fixture.json'),oldPath=process.env.PATH;await mkdir(bin,{mode:0o700});
 const render=renderBundle({release:manifest,installationId:f.profile.installationId,architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1',secretFiles:{webEnv:f.plan.request.root+'/web.env',postgresEnv:f.plan.request.root+'/postgres.env',livekitConfig:f.plan.request.root+'/livekit.yaml'}});
 await writeFile(modelFile,JSON.stringify({active:false,containers:r.containers,volumes:r.volumes,network:r.network,caddy:render.caddyText,journal:f.options.journalDirectory}));
 await writeFile(path.join(bin,'docker'),`#!${process.execPath}\nconst fs=require('node:fs'),file=${JSON.stringify(modelFile)},r=JSON.parse(fs.readFileSync(file)),a=process.argv.slice(2);fs.appendFileSync(file+'.calls',JSON.stringify(a)+'\\n');let out='';
 if(a[0]==='info')out=JSON.stringify({ID:'fixture-engine'});else if(a[0]==='context')out=JSON.stringify('unix:///var/run/docker.sock');else if(a[0]==='version')out='linux|amd64|28.0.0';else if(a[0]==='image')out=JSON.stringify({Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64',RepoDigests:[a.at(-1)],Volumes:null});
 else if(a[0]==='compose'&&a[1]==='version')out='2.40.3';else if(a[0]==='compose'&&a.includes('config')){
  const root=a[a.indexOf('--project-directory')+1],model=JSON.parse(fs.readFileSync(root+'/compose.yaml','utf8'));
  if(model.name!==a[a.indexOf('--project-name')+1]||Object.keys(model.services).sort().join(',')!=='caddy,livekit,postgres,web')process.exit(7);
  for(const [name,service]of Object.entries(model.services))if(service.env_file){const environment={};for(const source of service.env_file){const file=source.replaceAll('$$','$');if(!['postgres','web'].includes(name)||file!==root+'/'+name+'.env')process.exit(7);for(const line of fs.readFileSync(file,'utf8').split('\\n').filter(Boolean)){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!m||Object.hasOwn(environment,m[1]))process.exit(7);environment[m[1]]=m[2]}}service.environment={...environment,...service.environment};delete service.env_file}
  const resolved=JSON.stringify(model);if(a.includes('--format')&&a.at(-1)==='json')out=resolved;else{if(!a.includes('--hash')||a[a.indexOf('-f')+1]!=='-'||fs.readFileSync(0,'utf8')!==resolved)process.exit(7);out=['postgres','web','livekit','caddy'].map(s=>s+' '+'c'.repeat(64)).join('\\n');}
 }
 else if(a[0]==='inspect'){const c=r.containers.find(c=>c.Id===a.at(-1));out=JSON.stringify([{Id:c.Id,Image:c.Image,State:{Running:c.Running},Config:{Env:fs.readFileSync(c.Labels['com.docker.compose.project.working_dir']+'/web.env','utf8').trim().split('\\n'),Labels:c.Labels}}])}else if(a.includes('exec')){let raw='';process.stdin.on('data',b=>raw+=b);process.stdin.on('end',()=>{const q=JSON.parse(raw),j=JSON.parse(fs.readFileSync(r.journal+'/journal.json'));if(!r.active||j.steps[q.phase]!=='running'||!fs.existsSync(r.journal+'/'+q.phase+'-attempt.json'))process.exit(7);process.stdout.write(JSON.stringify({schemaVersion:1,contract:'castlink-database-v1',phase:q.phase,installationId:q.installationId,nodeId:q.nodeId,migrations:{roomVersions:[1,2,3],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:q.phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null}));});return;}
 else if(a.includes('up')){if(JSON.parse(fs.readFileSync(r.journal+'/journal.json')).steps.services!=='running'||!fs.existsSync(r.journal+'/services-attempt.json'))process.exit(7);r.active=true;fs.writeFileSync(file,JSON.stringify(r));out='PRIVATE_FIXTURE'}
 else if(a[1]==='ls')out=r.active?(a[0]==='container'?r.containers.map(c=>c.Id):a[0]==='volume'?r.volumes.map(v=>v.Name):[r.network.Id]).join('\\n'):'';
 else if(a[1]==='inspect')out=JSON.stringify((a[0]==='container'?r.containers:a[0]==='volume'?r.volumes:[r.network]).find(v=>(v.Id??v.Name)===a.at(-1)));
 else if(a[0]==='cp'){if(!r.active||a[1]!==r.containers[3].Id+':/etc/caddy/Caddyfile'||a[2]!=='-')process.exit(8);const body=Buffer.from(r.caddy),h=Buffer.alloc(512);h.write('Caddyfile');h.write('0000444\\0',100);h.write('0000000\\0',108);h.write('0000000\\0',116);h.write(body.length.toString(8).padStart(11,'0')+'\\0',124);h.write('00000000000\\0',136);h.fill(32,148,156);h.write('0',156);h.write('ustar\\0',257);h.write('00',263);h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\\0 ',148);process.stdout.write(Buffer.concat([h,body,Buffer.alloc((512-body.length%512)%512),Buffer.alloc(1024)]));process.exit(0)}else process.exit(9);process.stdout.write(out);`,{mode:0o700});
 const local=new LocalExecutor(),calls=[];process.env.PATH=bin+path.delimiter+oldPath;
 const localSelected={run:async req=>{if(req.args[1]?.includes('const leaseFs')){const shim=`const os=require('node:os');os.userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(fixtureHome)}});`;return local.run({...req,args:[req.args[0],shim+req.args[1]]})}if(req.executable==='docker'||req.input&&JSON.parse(Buffer.from(req.input)).containerId)return local.run(req);return f.executor.run(req)}};
 const transport={run:async req=>{calls.push(req);assert.equal(req.executable,'ssh');assert.ok(req.args.includes('StrictHostKeyChecking=yes'));assert.ok(req.args.includes('PreferredAuthentications=publickey'));const envelope=JSON.parse(Buffer.from(req.input));if(envelope.args?.[1]?.includes('lease_pwd')){const shim=`import pwd,os\nclass Principal: pw_uid=os.getuid();pw_dir=${JSON.stringify(fixtureHome)}\npwd.getpwuid=lambda _:Principal()\n`;envelope.args[1]=shim+envelope.args[1];req={...req,input:Buffer.from(JSON.stringify(envelope))}};
  if(envelope.executable==='python3'&&envelope.args[1].includes('/etc/os-release'))return{code:0,stdout:JSON.stringify({code:0,stdout:JSON.stringify({platform:'linux',arch:'x86_64',distribution:'ubuntu',osVersion:'24.04'}),stderr:''}),stderr:''};
  if(envelope.input&&JSON.parse(envelope.input).tcp)return{code:0,stdout:JSON.stringify(await f.executor.run({executable:'python3',args:envelope.args,input:Buffer.from(envelope.input),sensitive:false})),stderr:''};
  const source=req.args.at(-1).slice("python3 -c '".length,-1).replaceAll("'\\''","'");return local.run({executable:'python3',args:['-c',source],input:req.input,sensitive:req.sensitive});}};
 const target={kind:'remote',host:'fixture.example',user:'deploy',port:22},selected=remote?new SshExecutor(target,transport):localSelected;
 try{if(remote){await rm(f.plan.request.root,{recursive:true});await materializeRemoteBundle({release:manifest,installationId:f.profile.installationId,architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1'},{scopeRoot:f.root,directory:f.plan.request.root},selected);f.plan.request.target=target;f.options.remoteScope=f.root;f.profile.request=f.plan.request;await retargetFixtureCursor(f.options.journalDirectory,f.plan.request);await f.store.save(f.profile);await writeFile(path.join(f.options.journalDirectory,'owner.json'),JSON.stringify({schemaVersion:1,installationId:f.profile.installationId,request:f.plan.request,preparation:f.options}),{mode:0o600});}
 await run(selected,()=>readFile(modelFile+'.calls','utf8'));}finally{process.env.PATH=oldPath;}
}

for(const remote of [false,true])test(`actual database fixture process ${remote?'through strict SSH envelope':'through local Executor'} validates fixed scoped invocation and partial readiness`,()=>fixture(async f=>actualDocker(f,remote,async(executor,log)=>{
 const api=await import('../dist/setup.js');await api.startPreparedServices(f.plan,f.options,executor,f.store);await api.preparePreparedDatabase(f.plan,f.options,executor,f.store);await api.preparePreparedDatabase(f.plan,f.options,executor,f.store);
 const calls=(await log()).trim().split('\n').map(JSON.parse),execs=calls.filter(a=>a.includes('exec')&&a.at(-1)==='/app/scripts/setup-database-v1.mjs');assert.equal(execs.length,8);assert.equal(calls.filter(a=>a.includes('up')).length,1);
 for(const a of execs)assert.deepEqual(a.slice(a.indexOf('exec')),['exec','-i','2'.repeat(64),'node','/app/scripts/setup-database-v1.mjs']);const j=await f.journal.read();assert.equal(j.steps.seed,'verified');assert.equal(j.steps.owner,'pending');assert.equal(j.steps.verify,'pending');
})));

for(const drift of ['owner','profile','journal','service attempt','migration attempt'])test(`review ${drift} content drift during helper refuses final verification and following seed`,()=>fixture(async f=>database(f,async d=>{
 const executor={run:async req=>{const result=await d.executor.run(req);if(req.input&&JSON.parse(Buffer.from(req.input)).targetGuard&&JSON.parse(Buffer.from(req.input)).phase==='migrations'){
  if(drift==='service attempt')await writeFile(path.join(f.options.journalDirectory,'services-attempt.json'),JSON.stringify({schemaVersion:1,installationId:'foreign'}),{mode:0o600});
  if(drift==='migration attempt')await writeFile(path.join(f.options.journalDirectory,'migrations-attempt.json'),JSON.stringify({schemaVersion:1,installationId:'foreign'}),{mode:0o600});
  if(drift==='owner')await writeFile(path.join(f.options.journalDirectory,'owner.json'),JSON.stringify({schemaVersion:1,installationId:'foreign'}),{mode:0o600});
  if(drift==='profile')await f.store.save({...await f.store.load('studio'),currentRelease:'9.9.9'});
  if(drift==='journal'){const j=await f.journal.read();j.steps.owner='running';await writeFile(path.join(f.options.journalDirectory,'journal.json'),JSON.stringify(j),{mode:0o600});}
 }return result;}};
 await assert.rejects(()=>d.api.preparePreparedDatabase(f.plan,f.options,executor,f.store),e=>e.code===4);assert.deepEqual(d.phases,['migrations']);assert.notEqual((await f.journal.read()).steps.migrations,'verified');assert.equal((await f.journal.read()).steps.seed,'pending');
})));
