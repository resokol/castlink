import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,rename} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';import {createServer} from 'node:https';
import {nodeMediaHttpTarget,pythonMediaHttpTarget} from '../dist/media-http-target.js';
import {nodeMediaFilesTarget,pythonMediaFilesTarget} from '../dist/media-files-target.js';
import {LocalExecutor} from '../dist/executors/local.js';import {openSetupTargetCursor} from '../dist/setup-target-guard.js';
import * as transportModule from '../dist/media-target-transport.js';import {nodeTargetLease} from '../dist/target-operation.js';
const {createGuardedMediaTransport}=transportModule,sha=x=>createHash('sha256').update(x).digest('hex');
const privateCookie='studiolink-studio=PRIVATE-TARGET-SESSION',privateGrant='PRIVATE-GUEST-GRANT';
async function fixture(fn,ca=true){
 const home=await mkdtemp(path.join(os.tmpdir(),'castlink-media-target-')),root=path.join(home,'install'),bin=path.join(home,'bin');await mkdir(root,{mode:0o700});await mkdir(bin,{mode:0o700});
 const installationId=randomUUID(),runId=randomUUID(),nodeId='srv-'+installationId.replaceAll('-',''),web='a'.repeat(64),caddy='b'.repeat(64),image='sha256:'+'c'.repeat(64),caddyImage='sha256:'+'d'.repeat(64),configHash='e'.repeat(64);
 const fileHashes={};for(const name of ['compose.yaml','livekit.yaml','postgres.env','web.env']){const bytes=name==='web.env'?`STUDIOLINK_INSTALLATION_ID=${installationId}\nCASTLINK_NODE_ID=${nodeId}\nDATABASE_URL=postgresql://fixture\n`:'fixture\n';await writeFile(path.join(root,name),bytes,{mode:0o600});fileHashes[name]=sha(bytes);}
 const key=path.join(home,'key'),certFile=path.join(home,'root.crt');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',certFile,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-addext','basicConstraints=critical,CA:'+ (ca?'TRUE':'FALSE')],{stdio:'ignore'});const cert=await readFile(certFile);await writeFile(path.join(home,'ca.tar'),execFileSync('tar',['--format=ustar','-cf','-','-C',home,'root.crt']));
 const session=path.join(home,'session');await writeFile(session,privateCookie,{mode:0o600});const s=await stat(session);
 const container=(id,img,service)=>({Id:id,Image:img,State:{Running:true},Config:{Labels:{'com.docker.compose.project':'fixture','com.docker.compose.service':service,'com.docker.compose.config-hash':configHash,'com.docker.compose.project.working_dir':root,'com.docker.compose.project.config_files':root+'/compose.yaml'},Env:['STUDIOLINK_INSTALLATION_ID='+installationId,'CASTLINK_NODE_ID='+nodeId,'DATABASE_URL=postgresql://fixture']}});
 await writeFile(path.join(home,'containers.json'),JSON.stringify({[web]:container(web,image,'web'),[caddy]:container(caddy,caddyImage,'caddy')}));
 await writeFile(path.join(bin,'docker'),`#!/usr/bin/python3\nimport sys,json,os\nh=${JSON.stringify(home)}\na=sys.argv[1:]\nif a[0]=='info': print('{"ID":"fixture-engine"}')\nelif a[0]=='context': print('"unix:///fixture"')\nelif a[0]=='inspect': print(json.dumps([json.load(open(h+'/containers.json'))[a[-1]]],separators=(',',':')))\nelif a[0]=='cp': sys.stdout.buffer.write(open(h+'/ca.tar','rb').read())\nelse: sys.exit(2)\n`,{mode:0o700});
 let posts=[],mode='normal',onPost;const room={schemaVersion:1,contract:'castlink-media-room-v2',studioId:'studio-default',name:'cli-media-'+runId,association:{creationId:randomUUID(),revision:randomUUID()}};
 const server=createServer({key:await readFile(key),cert},(req,res)=>{let raw='';req.on('data',x=>raw+=x);req.on('end',async()=>{
  try{assert.equal(req.headers.cookie,privateCookie);if(req.method==='GET'){res.end(JSON.stringify({schemaVersion:1,contract:mode==='old'?'castlink-media-room-v1':room.contract,studioId:room.studioId,conditionalCleanup:true}));return;}
  const body=JSON.parse(raw);posts.push(body);if(onPost)await onPost(body);
  if(mode==='lost'){req.socket.destroy();return;}if(mode==='redirect'){res.writeHead(302,{location:'https://foreign.invalid'});res.end();return;}
  if(mode==='numericdeleted'&&body.action==='delete'){res.end(JSON.stringify({schemaVersion:1,contract:room.contract,studioId:room.studioId,name:room.name,deleted:1}));return;}
  if(mode==='duplicate'){res.end('{"schemaVersion":1,"schemaVersion":1}');return;}if(mode==='oversized'){res.end(' '.repeat(17000));return;}
  if(mode==='replacement'&&body.action==='delete'){res.statusCode=409;res.end('{}');return;}
  if(req.url==='/api/invites')res.end(JSON.stringify({path:`/room?studioId=${room.studioId}&name=${room.name}#invite=${privateGrant}`}));else res.end(JSON.stringify(body.action==='create'?room:{schemaVersion:1,contract:room.contract,studioId:room.studioId,name:room.name,deleted:true}));
  }catch{res.destroy();}
 });});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const binding={installationId,nodeId,origin:`https://localhost:${server.address().port}`,studioId:room.studioId,runId,caddyContainerId:caddy,caddyImageId:caddyImage,caSHA:sha(cert),targetSessionFile:{path:session,dev:s.dev,ino:s.ino,mode:384,sha256:sha(privateCookie)}};
 const guard={operation:{schemaVersion:1,kind:'owner',root,installationId,engine:'fixture-engine',epoch:0,principal:process.getuid(),scope:path.join(home,'.castlink-target-operations')},endpoint:'unix:///fixture',fileHashes,containerId:web,containerImage:image,project:'fixture',configHash};
 const authority={run:null,room:null,artifacts:{}};
 function execute(language,family,payload,epoch=guard.operation.epoch){
  const source=family==='http'?(language==='node'?nodeMediaHttpTarget:pythonMediaHttpTarget):(language==='node'?nodeMediaFilesTarget:pythonMediaFilesTarget);
  const prefix=language==='node'?`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});`:`import os,pwd\nclass Principal: pw_uid=os.getuid();pw_dir=${JSON.stringify(home)}\npwd.getpwuid=lambda _:Principal()\n`;
  const p=spawn(language==='node'?process.execPath:'python3',language==='node'?['-e',prefix+source]:['-c',prefix+source],{env:{...process.env,PATH:bin+':'+process.env.PATH},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);p.stdin.end(JSON.stringify({binding,guard:{...guard,operation:{...guard.operation,epoch}},authority:structuredClone(authority),...payload}));const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));});return{p,done};
 }
 const initialize=language=>execute(language,'files',{action:'initialize',name:null,content:null,association:null});
 const create=language=>execute(language,'http',{route:'/api/rooms',body:{action:'create',name:room.name,password:'f'.repeat(64),studioId:room.studioId,diagnostic:true}});
 const invite=language=>execute(language,'http',{route:'/api/invites',body:{action:'create',room:room.name,studioId:room.studioId,diagnostic:true,expectedDiagnosticAssociation:room.association}});
 const remove=language=>execute(language,'http',{route:'/api/rooms',body:{action:'delete',name:room.name,studioId:room.studioId,expectedDiagnosticAssociation:room.association}});
 async function success(operation){const result=await operation.done;assert.equal(result.code,0,result.stderr+' '+result.stdout);assert.equal(result.stderr,'');assert.doesNotMatch(result.stdout,new RegExp(privateCookie+'|'+privateGrant));guard.operation.epoch++;assert.equal(JSON.parse(await readFile(path.join(guard.operation.scope,'epoch.json'),'utf8')).epoch,guard.operation.epoch);const value=JSON.parse(result.stdout);
  if(value.contract==='castlink-media-files-v1'&&value.action==='initialize')authority.run=structuredClone(value.association);
  if(value.contract==='castlink-media-created-v1'){authority.room=structuredClone({receipt:value.receipt,association:value.association});return value.receipt;}
  if(value.contract==='castlink-media-invited-v1'){authority.artifacts['guest-entry.txt']=structuredClone({association:value.artifact.association,ledgerAssociation:value.ledgerAssociation,present:true});return value.artifact;}
  if(value.contract==='castlink-media-files-v1'&&value.action==='write')authority.artifacts[value.name]=structuredClone({association:value.association,ledgerAssociation:value.ledgerAssociation,present:true});
  if(value.contract==='castlink-media-files-v1'&&value.action==='remove')authority.artifacts[value.name].present=false;
  if(value.deleted===true&&authority.artifacts['guest-entry.txt'])authority.artifacts['guest-entry.txt'].present=false;return value;}
 function executor(remote=false,dropReply=false){let dropped=false;return{run:async request=>{
  assert.equal(request.sensitive,true);assert.doesNotMatch(request.args.join(' '),new RegExp(privateCookie+'|'+privateGrant+'|'+'f'.repeat(64)));if(request.input)assert.doesNotMatch(Buffer.from(request.input).toString(),new RegExp(privateCookie+'|'+privateGrant));
  const prefix=remote?`import os,pwd\nclass Principal: pw_uid=os.getuid();pw_dir=${JSON.stringify(home)}\npwd.getpwuid=lambda _:Principal()\n`:`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});`;
  const previous=process.env.PATH;process.env.PATH=bin+':'+previous;let pending;try{pending=new LocalExecutor(30000).run({...request,args:[request.args[0],prefix+request.args[1]]});}finally{process.env.PATH=previous;}const {code,stdout,stderr}=await pending;assert.doesNotMatch(stdout+stderr,new RegExp(privateCookie+'|'+privateGrant));
  const input=request.input?JSON.parse(Buffer.from(request.input).toString()):{};if(dropReply&&!dropped&&code===0&&((dropReply===true&&input.route==='/api/rooms'&&input.body?.action==='create')||(dropReply==='invite'&&input.route==='/api/invites'))){dropped=true;return{code:1,stdout:'',stderr:''};}return{code,stdout,stderr};
 }};}
 const profile={schemaVersion:1,installationId,request:{profile:'media-test',target:{kind:'local'},network:'loopback',root,release:'test'},currentRelease:'test',secretFilePaths:{}};
 const contract={schemaVersion:1,installationId,composePath:root+'/compose.yaml',project:'fixture',hashes:{web:configHash},images:{},composeSHA256:fileHashes['compose.yaml']};
 const resources={containers:[container(web,image,'web'),container(caddy,caddyImage,'caddy')].map(c=>({...c,Labels:c.Config.Labels})),volumes:[],networks:[]};
 try{await fn({home,bin,root,binding,guard,room,posts,initialize,create,invite,remove,execute,success,executor,profile,contract,resources,setMode:x=>mode=x,setOnPost:x=>onPost=x});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(home,{recursive:true,force:true});}
}
const pin={contract:'castlink-diagnostic-browser-runtime-v1',image:'fixture/browser@sha256:'+'8'.repeat(64),imageId:'sha256:'+'9'.repeat(64),nodeSHA:'a'.repeat(64),chromiumSHA:'b'.repeat(64),chromiumVersion:'Chromium 151.0.7922.173'};
async function browserFixture(fn){return fixture(async f=>{
 const id='1'.repeat(64),original=path.join(f.bin,'docker-original');await rename(path.join(f.bin,'docker'),original);
 const python=String.raw`#!/usr/bin/python3
import os,sys,json,subprocess,signal,time
h=HOME_PLACEHOLDER;cid=ID_PLACEHOLDER;p=PIN_PLACEHOLDER;a=sys.argv[1:]
meta=h+'/browser.json';trace=h+'/browser.trace';pidfile=h+'/profile-pid';modefile=h+'/browser-mode'
def mode():
 try:return open(modefile).read()
 except FileNotFoundError:return 'normal'
def log(value):
 with open(trace,'a') as f:f.write(value+'\n')
def reap():
 try:os.kill(int(open(pidfile).read()),signal.SIGTERM)
 except (FileNotFoundError,ProcessLookupError):pass
if a[:2]==['image','inspect'] and a[-1]==p['image']:print(json.dumps([{'Id':p['imageId'],'Os':'linux','Architecture':'amd64'}]));sys.exit()
if a[0]=='create':
 labels={};i=1
 while i<len(a):
  if a[i]=='--label':k,v=a[i+1].split('=',1);labels[k]=v;i+=1
  i+=1
 c={'Id':cid,'Image':p['imageId'],'Config':{'Labels':labels},'State':{'Running':False},'HostConfig':{'NetworkMode':a[a.index('--network')+1],'ReadonlyRootfs':True,'Privileged':False,'CapDrop':['ALL'],'CapAdd':None,'SecurityOpt':['no-new-privileges'],'PortBindings':None,'Tmpfs':{'/tmp':'rw,noexec,nosuid,nodev,mode=1777','/root':'rw,nosuid,nodev,mode=0700'}},'Mounts':[]}
 json.dump(c,open(meta,'w'));log('create');print(cid);sys.exit()
if a[0]=='start' and a[-1]==cid:
 c=json.load(open(meta));c['State']['Running']=True;json.dump(c,open(meta,'w'));log('start');print(cid);sys.exit()
if a[0]=='inspect' and a[-1]==cid:
 if not os.path.exists(meta):print('[]');print('Error: No such object: '+cid,file=sys.stderr);sys.exit(1)
 print(json.dumps([json.load(open(meta))]));sys.exit()
if a[0]=='rm' and a[-1]==cid:
 reap();os.unlink(meta);log('remove');print(cid);sys.exit()
if a[0]=='exec' and cid in a:
 action=a[-1]
 if action=='--prepare':
  v=json.load(sys.stdin);log('prepare');print(json.dumps({'contract':p['contract'],'prepared':True,'caSHA':v['caSHA']},separators=(',',':')));sys.exit()
 if action=='--inspect':print(json.dumps({'contract':p['contract'],'node':'v22.23.3','nodeSHA':p['nodeSHA'],'chromium':p['chromiumVersion'],'chromiumSHA':p['chromiumSHA'],'architecture':'linux/x64'},separators=(',',':')));sys.exit()
 if action=='--browser':
  guarded=os.path.exists(h+'/.castlink-target-operations/active/owner.json');log('browser-start-'+('held' if guarded else 'UNLEASED'))
  program="import os,time\nh="+repr(h)+"\nn=0\nwhile True:\n n+=1\n open(h+'/profile-count','w').write(str(n))\n if not os.path.exists(h+'/.castlink-target-operations/active/owner.json'):open(h+'/unleased-profile','w').write('effect')\n time.sleep(.02)\n"
  profile=subprocess.Popen([sys.executable,'-c',program],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True);open(pidfile,'w').write(str(profile.pid))
  def finish():
   if mode()!='survive-profile':profile.terminate();profile.wait(timeout=2)
  signal.signal(signal.SIGTERM,lambda *_:(finish(),sys.exit(4)))
  context=0;samples=0;b=bytearray()
  def sample(i,n,screen=False):
   def rtp(direction,source,kind):return {'id':direction+'-'+source,'kind':kind,'source':source,'bytes':n,'packets':n,'frames':n if kind=='video' else 0,'at':n}
   inbound=[rtp('i','microphone','audio'),rtp('i','camera','video')];outbound=[rtp('o','microphone','audio'),rtp('o','camera','video')];videos=[{'source':'camera','width':640,'height':480,'frames':n}]
   if screen and i==1:outbound.append(rtp('o','screen_share','video'))
   if screen and i==2:inbound.append(rtp('i','screen_share','video'));videos.append({'source':'screen_share','width':1280,'height':720,'frames':n})
   return {'identity':'guest-'+str(i),'inbound':inbound,'outbound':outbound,'videos':videos,'candidates':[{'selected':True,'state':'succeeded','localType':'host','remoteType':'host','protocol':'udp'}]}
  while True:
   chunk=sys.stdin.buffer.read(1)
   if not chunk:finish();sys.exit(4)
   if chunk!=b'\0':b.extend(chunk);continue
   v=json.loads(b);b=bytearray();method=v['method'];result={}
   if method=='Browser.getVersion':result={'product':'Chrome/151.0.7922.173'}
   if method=='Target.createBrowserContext':context+=1;result={'browserContextId':'c'+str(context)}
   if method=='Target.createTarget':result={'targetId':'t'+str(context)}
   if method=='Target.attachToTarget':result={'sessionId':'s'+str(context)}
   if method=='Page.navigate':log('navigate')
   if method=='Runtime.evaluate':
    value=True
    if v['params']['expression']=='window.__castlinkMediaSample()':phase=samples//2;samples+=1;value=sample(int(v['sessionId'][1:]),100*(phase+1),phase>=2)
    result={'result':{'value':value}}
   sys.stdout.buffer.write(json.dumps({'id':v['id'],'result':result},separators=(',',':')).encode()+b'\0');sys.stdout.buffer.flush()
   if method=='Browser.close':finish();sys.exit()
os.execv(h+'/bin/docker-original',[h+'/bin/docker-original']+a)
`.replace('HOME_PLACEHOLDER',JSON.stringify(f.home)).replace('ID_PLACEHOLDER',JSON.stringify(id)).replace('PIN_PLACEHOLDER',JSON.stringify(pin));
 await writeFile(path.join(f.bin,'docker'),python,{mode:0o700});
 const executor=f.executor(),cursor=await openSetupTargetCursor(executor,false);await cursor.attach(f.home,f.profile,true);
 const options={executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding};
 const transport=createGuardedMediaTransport(options),request=(route,body)=>({origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route,body});
 const receipt=await transport.execute(request('/api/rooms',{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true})),artifact=await transport.execute(request('/api/invites',{action:'create',room:f.room.name,studioId:f.room.studioId,diagnostic:true,expectedDiagnosticAssociation:receipt.association}));
 const authority=transportModule.captureLocalMediaBrowserAuthority?await transportModule.captureLocalMediaBrowserAuthority(transport):null;
 const dist=fileURLToPath(new URL('../dist/',import.meta.url)),prefix=`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(f.home)}});`;
 const competitor=nodeTargetLease+`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(f.home)}});const a=${JSON.stringify(f.guard.operation)};a.epoch=targetOperationEpoch(a.scope);const l=acquireTargetOperation(a);dispatchTargetOperation(l);releaseTargetOperation(l,true);`;
 await writeFile(path.join(f.home,'competitor.cjs'),competitor,{mode:0o600});
 let targetSource=await readFile(path.join(dist,'media-browser-target.js'),'utf8'),driverSource=await readFile(path.join(dist,'media-browser-driver.js'),'utf8');const productionTarget=targetSource,productionDriver=driverSource;
 const pinFunction=/function compiledRuntimePin\(\) \{ return [^\n]+; \}/;assert.match(targetSource,pinFunction);targetSource=targetSource.replace(pinFunction,`function compiledRuntimePin() { return ${JSON.stringify(pin)}; }`);
 // PRIVATE fixture compilation instruments its real process creation, not the
 // production pin/launcher or source-provenance namespace.
 driverSource=driverSource.replace('{ syntheticDevices: true }','{ syntheticDevices: true, sampleMs: 100 }');
 const hook=`\nconst fixtureHome=${JSON.stringify(f.home)},fixturePrefix=${JSON.stringify(prefix)};\nfunction fixtureSpawn(executable,args,options){let m='normal';try{m=requireMode();}catch{}if(m==='compete-launch'){execFileSync(process.execPath,[fixtureHome+'/competitor.cjs'],{env:{...process.env,PATH:fixtureHome+'/bin:'+process.env.PATH},stdio:'pipe'});}const child=spawn(executable,[args[0],fixturePrefix+args[1],...args.slice(2)],{...options,env:{...process.env,PATH:fixtureHome+'/bin:'+process.env.PATH}});if(m==='drop-terminal'&&child.stdio[5]){const output=child.stdio[5],emit=output.emit.bind(output);let b=Buffer.alloc(0);output.emit=function(event,...values){if(event!=='data')return emit(event,...values);b=Buffer.concat([b,values[0]]);for(let i=b.indexOf(0);i>=0;i=b.indexOf(0)){const frame=b.subarray(0,i);b=b.subarray(i+1);if(JSON.parse(frame).type!=='terminal')emit('data',Buffer.concat([frame,Buffer.from([0])]));}return true;};}return child;}\nfunction requireMode(){return readFileSync(fixtureHome+'/browser-mode','utf8');}\n`;
 targetSource=targetSource.replace("import { spawn } from 'node:child_process';","import { spawn,execFileSync } from 'node:child_process';\nimport {readFileSync} from 'node:fs';");
 assert.ok(targetSource.includes('import { spawn,execFileSync }'));targetSource=targetSource.replaceAll('spawn(process.execPath,','fixtureSpawn(process.execPath,')+hook;
 const absoluteImports=source=>source.replace(/from '(\.\/[^']+)'/g,(_,file)=>`from '${pathToFileURL(path.join(dist,file)).href}'`);
 targetSource=absoluteImports(targetSource);const targetFile=path.join(f.home,'target-fixture.mjs'),driverFile=path.join(f.home,'driver-fixture.mjs');await writeFile(targetFile,targetSource,{mode:0o600});
 driverSource=driverSource.replace("from './media-browser-target.js'",`from '${pathToFileURL(targetFile).href}'`);await writeFile(driverFile,absoluteImports(driverSource),{mode:0o600});
 const record=path.resolve('.superpowers/sdd/2026-10-05-self-hosted-cli/media-browser/fixture-source',f.binding.runId);await mkdir(record,{recursive:true,mode:0o700});
 for(const [name,bytes] of [['production-target.mjs',productionTarget],['fixture-target.mjs',targetSource],['production-driver.mjs',productionDriver],['fixture-driver.mjs',await readFile(driverFile)],['fixture-docker.py',python]])await writeFile(path.join(record,name),bytes,{mode:0o600});
 await writeFile(path.join(record,'manifest.json'),JSON.stringify({schemaVersion:1,contract:'private-fixture-only-no-product-pin-no-browser-proof',runId:f.binding.runId,productionPin:'compiled-source-pin-saved-in-production-target',fixturePin:pin,hashes:{productionTarget:sha(productionTarget),fixtureTarget:sha(targetSource),productionDriver:sha(productionDriver),fixtureDriver:sha(await readFile(driverFile))},patches:['immutable fixture runtime constant','private imports and os.userInfo prefix','canonical competitor-before-launch hook','drop-terminal-control-frame hook','fixture sample interval 100ms']},null,2),{mode:0o600});
 const requiresAuthority=targetSource.includes('authority,binding,contract');
 const targetModule=await import(pathToFileURL(targetFile).href),driverModule=await import(pathToFileURL(driverFile).href),handles=[];
 const input={origin:f.binding.origin,studioId:f.binding.studioId,room:f.room.name,runId:f.binding.runId,inviteArtifact:artifact};
 async function create(){const o={...options,syntheticContainerPreview:true,...(requiresAuthority&&authority?{authority}:{})};const target=await targetModule.createGuardedMediaBrowserTarget(o);handles.push(target);return target;}
 try{await fn({...f,options,cursor,transport,authority,receipt,artifact,input,create,driverModule,setBrowserMode:mode=>writeFile(path.join(f.home,'browser-mode'),mode,{mode:0o600}),trace:async()=>readFile(path.join(f.home,'browser.trace'),'utf8').catch(()=>''),fixtureHashes:{target:sha(targetSource),driver:sha(driverSource)}});}finally{
  for(const target of handles){try{target.child.kill('SIGKILL');}catch{}try{await target.closeTarget();}catch{}}
  try{process.kill(Number(await readFile(path.join(f.home,'profile-pid'),'utf8')),'SIGKILL');}catch{}
 }
});}
async function replacement(f,foreignRoot=false){
 const guest=foreignRoot?path.join(f.home,'foreign','.castlink-media',f.binding.runId,'guest-entry.txt'):f.artifact.path;
 if(foreignRoot)await mkdir(path.dirname(guest),{recursive:true,mode:0o700});else await rename(guest,guest+'.original');
 const bytes=`/room?studioId=${f.room.studioId}&name=${f.room.name}#invite=OPERATOR-REPLACEMENT`;await writeFile(guest,bytes,{mode:0o600});const s=await stat(guest),association={dev:s.dev,ino:s.ino,mode:384,sha256:sha(bytes)};
 if(!foreignRoot){const ledger=path.join(path.dirname(guest),'invite-artifact.json');await rename(ledger,ledger+'.original');await writeFile(ledger,JSON.stringify(association),{mode:0o600});}
 return {...f.input,inviteArtifact:{...f.artifact,path:guest,association}};
}
for(const foreignRoot of [false,true])test(`builtin original authority rejects ${foreignRoot?'foreign same-suffix root':'paired replacement and fresh supplied association'} before navigation`,()=>browserFixture(async f=>{
 const supplied=await replacement(f,foreignRoot);let target,driver;
 await assert.rejects(async()=>{target=await f.create();driver=f.driverModule.createBuiltinMediaBrowserDriver(target);await driver.run(supplied);});
 assert.doesNotMatch(await f.trace(),foreignRoot?/navigate/:/create|prepare|browser-start|navigate/);
 if(driver)try{await driver.close();}catch{}
}));
test('competing canonical mutation before private launch performs zero Chromium/profile effects',()=>browserFixture(async f=>{
 await f.setBrowserMode('compete-launch');await assert.rejects(f.create());assert.doesNotMatch(await f.trace(),/browser-start/);assert.equal(await stat(path.join(f.home,'profile-count')).then(()=>true,()=>false),false);
}));
test('terminal ACK loss keeps observations unverified and retained cursor UNKNOWN',()=>browserFixture(async f=>{
 await f.setBrowserMode('drop-terminal');const target=await f.create(),driver=f.driverModule.createBuiltinMediaBrowserDriver(target),evidence=await driver.run(f.input);assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),false);await assert.rejects(driver.close());assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),false);await assert.rejects(f.cursor.assert());
}));

test('normal full-lifetime operation holds lease until all profile children are reaped and terminal generation ACK',()=>browserFixture(async f=>{
 await f.setBrowserMode('survive-profile');const before=f.cursor.binding.epoch,target=await f.create(),driver=f.driverModule.createBuiltinMediaBrowserDriver(target);
 assert.equal(f.cursor.binding.epoch,before+2);assert.ok(await stat(path.join(f.guard.operation.scope,'active','owner.json')));
 const evidence=await driver.run(f.input);assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),false);assert.equal(f.cursor.binding.epoch,before+2);
 const competitor=spawn(process.execPath,[path.join(f.home,'competitor.cjs')],{env:{...process.env,PATH:f.bin+':'+process.env.PATH},stdio:['ignore','pipe','pipe']});const result=await new Promise(resolve=>competitor.on('close',code=>resolve(code)));assert.notEqual(result,0);
 await driver.close();assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),true);assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,structuredClone(evidence)),false);
 assert.equal(f.cursor.binding.epoch,before+3);await f.cursor.assert();assert.equal(await stat(path.join(f.guard.operation.scope,'active')).then(()=>true,()=>false),false);
 assert.equal(await stat(path.join(f.home,'unleased-profile')).then(()=>true,()=>false),false);assert.match(await f.trace(),/browser-start-held/);assert.match(await f.trace(),/remove/);
 const count=await readFile(path.join(f.home,'profile-count'),'utf8');await new Promise(r=>setTimeout(r,120));assert.equal(await readFile(path.join(f.home,'profile-count'),'utf8'),count);
}));
test('original room receipt inode replacement cannot become browser authority',()=>browserFixture(async f=>{
 const room=path.join(path.dirname(f.artifact.path),'room.json'),bytes=await readFile(room);await rename(room,room+'.original');await writeFile(room,bytes,{mode:0o600});await assert.rejects(f.create());assert.equal(await f.trace(),'');
}));
test('artifact drift after collection fails held terminal POST and never certifies evidence',()=>browserFixture(async f=>{
 const target=await f.create(),driver=f.driverModule.createBuiltinMediaBrowserDriver(target),evidence=await driver.run(f.input);assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),false);await replacement(f);await assert.rejects(driver.close());assert.equal(f.driverModule.isBuiltinBrowserEvidence(driver,evidence),false);await assert.rejects(f.cursor.assert());assert.ok(await stat(path.join(f.guard.operation.scope,'active','owner.json')));
}));

test('plain JSON and arbitrary callbacks cannot mint original browser authority',()=>browserFixture(async f=>{
 let invoked=0;const fake={contract:'castlink-media-browser-authority-v1',snapshot:{artifact:f.artifact},verify:()=>{invoked++;}};
 const targetFile=path.join(f.home,'target-fixture.mjs'),module=await import(pathToFileURL(targetFile).href);
 await assert.rejects(module.createGuardedMediaBrowserTarget({...f.options,syntheticContainerPreview:true,authority:fake}));assert.equal(invoked,0);assert.equal(await f.trace(),'');
}));
test('interrupted private helper retains original authority and held lease while own profile child stops',()=>browserFixture(async f=>{
 const target=await f.create();assert.ok(await stat(path.join(f.guard.operation.scope,'active','owner.json')));target.child.kill('SIGTERM');let failure;try{await target.closeTarget();}catch(e){failure=e;}assert.ok(failure);
 const module=await import(pathToFileURL(path.join(f.home,'target-fixture.mjs')).href),receipt=module.retainedBrowserTargetAuthority(failure);assert.equal(receipt.runId,f.binding.runId);assert.equal(receipt.containerId,'1'.repeat(64));assert.ok(await stat(path.join(f.guard.operation.scope,'active','owner.json')));await assert.rejects(f.cursor.assert());
 const count=await readFile(path.join(f.home,'profile-count'),'utf8');await new Promise(r=>setTimeout(r,120));assert.equal(await readFile(path.join(f.home,'profile-count'),'utf8'),count);assert.doesNotMatch(await f.trace(),/remove/);
}));
