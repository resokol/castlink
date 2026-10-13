import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodeMediaHttpTarget,pythonMediaHttpTarget} from '../dist/media-http-target.js';
import {nodeMediaFilesTarget,pythonMediaFilesTarget} from '../dist/media-files-target.js';
import {LocalExecutor} from '../dist/executors/local.js';
import {openSetupTargetCursor} from '../dist/setup-target-guard.js';
import {createGuardedMediaTransport} from '../dist/media-target-transport.js';
test('media target families embed the canonical target guard and never accept executable input',()=>{
 for(const source of [nodeMediaHttpTarget,nodeMediaFilesTarget])assert.match(source,/sqlGuardCheck/);
 for(const source of [pythonMediaHttpTarget,pythonMediaFilesTarget])assert.match(source,/sql_guard_check/);
 assert.equal(typeof createGuardedMediaTransport,'function');
});
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,symlink,rename} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {randomUUID,createHash} from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';import {createServer} from 'node:https';
const sha=x=>createHash('sha256').update(x).digest('hex');
const privateCookie='studiolink-studio=PRIVATE-TARGET-SESSION';
const privateGrant='PRIVATE-GUEST-GRANT';
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
 try{await fn({home,root,binding,guard,room,posts,initialize,create,invite,remove,execute,success,executor,profile,contract,resources,setMode:x=>mode=x,setOnPost:x=>onPost=x});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(home,{recursive:true,force:true});}
}
for(const language of ['node','python']){
 test(`${language} actual TLS effects preserve private grants, perform guarded files and conditional cleanup`,()=>fixture(async f=>{
  await f.success(f.initialize(language));const receipt=await f.success(f.create(language));assert.deepEqual(receipt,f.room);const artifact=await f.success(f.invite(language));assert.equal(artifact.path,path.join(f.root,'.castlink-media',f.binding.runId,'guest-entry.txt'));assert.equal((await stat(artifact.path)).mode&0o777,0o600);assert.match(await readFile(artifact.path,'utf8'),new RegExp(privateGrant));
  const report=await f.success(f.execute(language,'files',{action:'write',name:'report.json',content:'{"media":"unverified"}',association:null}));assert.equal(report.association.mode,384);await f.success(f.execute(language,'files',{action:'remove',name:'report.json',content:null,association:report.association}));await f.success(f.remove(language));assert.equal(await stat(artifact.path).then(()=>true,()=>false),false);assert.equal(f.posts.length,3);
 }));
 test(`${language} real action ACK loss retains UNKNOWN and blocks replay without adopting the acknowledged server room`,()=>fixture(async f=>{
  await f.success(f.initialize(language));f.setMode('lost');const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,1);assert.ok(await stat(path.join(f.guard.operation.scope,'active','owner.json')));assert.doesNotMatch(result.stdout+result.stderr,new RegExp(privateCookie+'|'+privateGrant));const retry=await f.create(language).done;assert.equal(retry.code,3);assert.equal(f.posts.length,1);assert.equal(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'room.json')).then(()=>true,()=>false),false);
 }));
 test(`${language} changed operator association refuses cleanup and preserves private receipt`,()=>fixture(async f=>{
  await f.success(f.initialize(language));await f.success(f.create(language));f.setMode('replacement');const result=await f.remove(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,2);assert.ok(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'room.json')));assert.equal(f.guard.operation.epoch,2);
 }));
 test(`${language} post-effect config drift never releases target lease or reports success`,()=>fixture(async f=>{
  await f.success(f.initialize(language));f.setOnPost(()=>writeFile(path.join(f.root,'compose.yaml'),'operator changed\n',{mode:0o600}));const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,1);assert.ok(await stat(path.join(f.guard.operation.scope,'active')));assert.equal(f.guard.operation.epoch,1);
 }));
 test(`${language} stale CA or replaced protected session prevents every HTTP effect`,()=>fixture(async f=>{
  await f.success(f.initialize(language));await writeFile(f.binding.targetSessionFile.path,'studiolink-studio=OTHER',{mode:0o600});const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,0);
 }));
 test(`${language} old v1 capability has zero POST effects and cannot mint new grants`,()=>fixture(async f=>{
  await f.success(f.initialize(language));f.setMode('old');const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,0);
 }));
}
test('actual Node HTTP owner blocks a Python private-files contender under the same canonical lease',()=>fixture(async f=>{
 await f.success(f.initialize('node'));let entered,release;const observed=new Promise(r=>entered=r),blocked=new Promise(r=>release=r);f.setOnPost(()=>{entered();return blocked;});const first=f.create('node');await observed;
 try{const second=await f.execute('python','files',{action:'write',name:'report.json',content:'unsafe',association:null}).done;assert.equal(second.code,3);assert.equal(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'report.json')).then(()=>true,()=>false),false);}finally{release();}await f.success(first);
}));
for(const remote of [false,true])test(`${remote?'Python fixed remote program in local process fixture':'Node LocalExecutor'} typed adapter advances only its own attached cursor and retains uncertainty after lost outer reply`,()=>fixture(async f=>{
 const executor=f.executor(remote,true),cursor=await openSetupTargetCursor(executor,remote);const dir=path.join(f.home,'profile');await mkdir(dir,{mode:0o700});await cursor.attach(dir,f.profile,true);
 const transport=createGuardedMediaTransport({executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding});
 const input={origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route:'/api/rooms',body:{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true}};
 await assert.rejects(transport.execute(input),/unverified/);const retained=JSON.parse(await readFile(path.join(dir,'target-cursor.json'),'utf8'));assert.equal(retained.uncertain,true);assert.equal(retained.generation.epoch,1);assert.equal(f.posts.length,1);assert.equal(JSON.parse(await readFile(path.join(f.guard.operation.scope,'epoch.json'),'utf8')).epoch,2);
 await assert.rejects(transport.execute(input));assert.equal(f.posts.length,1);const fresh=await openSetupTargetCursor(executor,remote);await assert.rejects(fresh.attach(dir,f.profile));
}));
test('actual local typed artifact is privately accessible without returning grant bytes; replacements fail association checks',()=>fixture(async f=>{
 const executor=f.executor(),cursor=await openSetupTargetCursor(executor,false),dir=path.join(f.home,'profile');await mkdir(dir,{mode:0o700});await cursor.attach(dir,f.profile,true);const transport=createGuardedMediaTransport({executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding});
 const request=(route,body)=>({origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route,body});const receipt=await transport.execute(request('/api/rooms',{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true}));const artifact=await transport.execute(request('/api/invites',{action:'create',room:f.room.name,studioId:f.room.studioId,diagnostic:true,expectedDiagnosticAssociation:receipt.association}));assert.equal(artifact.target,'local');assert.deepEqual(await transport.localBrowserArtifact(artifact),artifact);assert.doesNotMatch(JSON.stringify(artifact),new RegExp(privateGrant));
 await writeFile(artifact.path,'operator replacement',{mode:0o600});await assert.rejects(transport.localBrowserArtifact(artifact));await assert.rejects(transport.execute(request('/api/rooms',{action:'delete',name:f.room.name,studioId:f.room.studioId,expectedDiagnosticAssociation:receipt.association})));assert.equal(await readFile(artifact.path,'utf8'),'operator replacement');
}));
for(const language of ['node','python']){
 test(`${language} caller-provided replacement artifact association cannot authorize foreign file cleanup`,()=>fixture(async f=>{
  await f.success(f.initialize(language));const receipt=await f.success(f.execute(language,'files',{action:'write',name:'report.json',content:'owned',association:null}));const file=path.join(f.root,'.castlink-media',f.binding.runId,'report.json');await writeFile(file,'foreign',{mode:0o600});const s=await stat(file),foreign={dev:s.dev,ino:s.ino,mode:384,sha256:sha('foreign')};assert.notDeepEqual(foreign,receipt.association);
  const result=await f.execute(language,'files',{action:'remove',name:'report.json',content:null,association:foreign}).done;assert.equal(result.code,3);assert.equal(await readFile(file,'utf8'),'foreign');
 }));
 test(`${language} unvalidated redirects do not release lease or produce credentials`,()=>fixture(async f=>{
  await f.success(f.initialize(language));f.setMode('redirect');const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,1);assert.ok(await stat(path.join(f.guard.operation.scope,'active')));
 }));
 test(`${language} run-name collision never adopts existing protected output`,()=>fixture(async f=>{
  await f.success(f.initialize(language));const result=await f.initialize(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,0);assert.ok(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'binding.json')));
 }));
}
for(const language of ['node','python'])test(`${language} numeric booleans cannot certify conditional DELETE ACK`,()=>fixture(async f=>{
 await f.success(f.initialize(language));await f.success(f.create(language));f.setMode('numericdeleted');const result=await f.remove(language).done;assert.equal(result.code,3);assert.ok(await stat(path.join(f.guard.operation.scope,'active')));
}));
for(const mode of ['duplicate','oversized'])for(const language of ['node','python'])test(`${language} strict bounded ${mode} action ACK remains UNKNOWN`,()=>fixture(async f=>{
 await f.success(f.initialize(language));f.setMode(mode);const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,1);assert.ok(await stat(path.join(f.guard.operation.scope,'active')));
}));
for(const language of ['node','python'])test(`${language} actual Caddy CA archive drift prevents target effects`,()=>fixture(async f=>{
 await f.success(f.initialize(language));await writeFile(path.join(f.home,'ca.tar'),Buffer.alloc(1536));const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,0);
}));
test('native Windows adapter diagnoses unsupported private lease before executing or mutating',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(process,'platform');Object.defineProperty(process,'platform',{value:'win32'});
 try{assert.throws(()=>createGuardedMediaTransport({executor:{run(){throw Error('unexpected');}},cursor:{remote:false},contract:{},resources:{},fileHashes:{},binding:{}}),/Native private target operation locking is unavailable on this Windows runtime; no target mutation ran/);}finally{Object.defineProperty(process,'platform',descriptor);}
});
for(const language of ['node','python'])test(`${language} HTTPS response timeout retains UNKNOWN without credential replay`,()=>fixture(async f=>{
 await f.success(f.initialize(language));f.setOnPost(()=>new Promise(resolve=>setTimeout(resolve,6000)));const result=await f.create(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,1);assert.ok(await stat(path.join(f.guard.operation.scope,'active')));assert.equal((await f.create(language).done).code,3);assert.equal(f.posts.length,1);
}));
for(const language of ['node','python'])test(`${language} a fingerprint-matched non-CA certificate cannot authorize private target output`,()=>fixture(async f=>{
 const result=await f.initialize(language).done;assert.equal(result.code,3);assert.equal(f.posts.length,0);assert.equal(await stat(path.join(f.root,'.castlink-media')).then(()=>true,()=>false),false);
},false));
for(const remote of [false,true])test(`${remote?'Python':'Node'} strict adapter rejects old capability with zero target mutations or cursor uncertainty`,()=>fixture(async f=>{
 const executor=f.executor(remote),cursor=await openSetupTargetCursor(executor,remote),dir=path.join(f.home,'profile');await mkdir(dir,{mode:0o700});await cursor.attach(dir,f.profile,true);const transport=createGuardedMediaTransport({executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding});f.setMode('old');
 await assert.rejects(transport.execute({origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route:'/api/rooms',body:{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true}}));
 assert.equal(f.posts.length,0);assert.equal(await stat(path.join(f.root,'.castlink-media')).then(()=>true,()=>false),false);assert.equal(await stat(f.guard.operation.scope).then(()=>true,()=>false),false);const retained=JSON.parse(await readFile(path.join(dir,'target-cursor.json'),'utf8'));assert.equal(retained.uncertain,false);assert.equal(retained.generation.epoch,0);
}));
test('one typed adapter rejects concurrent effects before touching the retained cursor',()=>fixture(async f=>{
 const executor=f.executor(),cursor=await openSetupTargetCursor(executor,false),dir=path.join(f.home,'profile');await mkdir(dir,{mode:0o700});await cursor.attach(dir,f.profile,true);const transport=createGuardedMediaTransport({executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding});let entered,release;const observed=new Promise(resolve=>entered=resolve),blocked=new Promise(resolve=>release=resolve);f.setOnPost(()=>{entered();return blocked;});const first=transport.execute({origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route:'/api/rooms',body:{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true}});await observed;
 try{await assert.rejects(transport.writePrivate('report.json','unsafe'));}finally{release();}assert.deepEqual(await first,f.room);const receipt=JSON.parse(await readFile(path.join(dir,'target-cursor.json'),'utf8'));assert.equal(receipt.uncertain,false);assert.equal(receipt.generation.epoch,2);assert.equal(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'report.json')).then(()=>true,()=>false),false);
}));
async function guardedFixture(f,remote,dropReply=false){const executor=f.executor(remote,dropReply),cursor=await openSetupTargetCursor(executor,remote),dir=path.join(f.home,'profile');await mkdir(dir,{mode:0o700});await cursor.attach(dir,f.profile,true);const transport=createGuardedMediaTransport({executor,cursor,contract:f.contract,resources:f.resources,fileHashes:f.guard.fileHashes,binding:f.binding});const call=(route,body)=>transport.execute({origin:f.binding.origin,studioId:f.binding.studioId,cookie:privateCookie,route,body});const created=await call('/api/rooms',{action:'create',name:f.room.name,password:'f'.repeat(64),studioId:f.room.studioId,diagnostic:true});return{transport,created,call,dir};}
async function replaceProtected(file,bytes){const temp=file+'.replacement-'+randomUUID();await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);const s=await stat(file);return{dev:s.dev,ino:s.ino,mode:384,sha256:sha(bytes)};}
for(const remote of [false,true]){
 test(`${remote?'Python':'Node'} I1 paired guest and ledger replacement refuses BEFORE automatic DELETE`,()=>fixture(async f=>{
  const {transport,created,call}=await guardedFixture(f,remote);const artifact=await call('/api/invites',{action:'create',room:created.name,studioId:created.studioId,diagnostic:true,expectedDiagnosticAssociation:created.association});const replacement=await replaceProtected(artifact.path,'operator-owned-replacement');await replaceProtected(path.join(path.dirname(artifact.path),'invite-artifact.json'),JSON.stringify(replacement));
  await assert.rejects(call('/api/rooms',{action:'delete',name:created.name,studioId:created.studioId,expectedDiagnosticAssociation:created.association}));assert.equal(f.posts.length,2);assert.equal(await readFile(artifact.path,'utf8'),'operator-owned-replacement');assert.equal((await stat(artifact.path)).ino,replacement.ino);
 }));
 test(`${remote?'Python':'Node'} I1 replaced room receipt and caller tuple cannot become new cleanup authority`,()=>fixture(async f=>{
  const {created,call}=await guardedFixture(f,remote);const foreign={...created,association:{creationId:randomUUID(),revision:randomUUID()}};await replaceProtected(path.join(f.root,'.castlink-media',f.binding.runId,'room.json'),JSON.stringify(foreign));
  await assert.rejects(call('/api/rooms',{action:'delete',name:created.name,studioId:created.studioId,expectedDiagnosticAssociation:foreign.association}));assert.equal(f.posts.length,1);assert.deepEqual(JSON.parse(await readFile(path.join(f.root,'.castlink-media',f.binding.runId,'room.json'),'utf8')),foreign);
 }));
 test(`${remote?'Python':'Node'} I1 paired report and ledger replacement cannot be removed with current caller association`,()=>fixture(async f=>{
  const {transport}=await guardedFixture(f,remote);await transport.writePrivate('report.json','owned-report');const file=path.join(f.root,'.castlink-media',f.binding.runId,'report.json'),replacement=await replaceProtected(file,'operator-report');await replaceProtected(path.join(path.dirname(file),'report-artifact.json'),JSON.stringify(replacement));
  await assert.rejects(transport.removePrivate('report.json',replacement));assert.equal(await readFile(file,'utf8'),'operator-report');
 }));
 test(`${remote?'Python':'Node'} I1 byte-identical room receipt replacement still loses original inode authority`,()=>fixture(async f=>{
  const {created,call}=await guardedFixture(f,remote);const file=path.join(f.root,'.castlink-media',f.binding.runId,'room.json');await replaceProtected(file,await readFile(file));await assert.rejects(call('/api/rooms',{action:'delete',name:created.name,studioId:created.studioId,expectedDiagnosticAssociation:created.association}));assert.equal(f.posts.length,1);
 }));
}
for(const remote of [false,true]){
 test(`${remote?'Python':'Node'} I1 room receipt replacement refuses invite issuance with the original caller tuple`,()=>fixture(async f=>{
  const {created,call}=await guardedFixture(f,remote);const foreign={...created,association:{creationId:randomUUID(),revision:randomUUID()}};await replaceProtected(path.join(f.root,'.castlink-media',f.binding.runId,'room.json'),JSON.stringify(foreign));await assert.rejects(call('/api/invites',{action:'create',room:created.name,studioId:created.studioId,diagnostic:true,expectedDiagnosticAssociation:created.association}));assert.equal(f.posts.length,1);assert.equal(await stat(path.join(f.root,'.castlink-media',f.binding.runId,'guest-entry.txt')).then(()=>true,()=>false),false);
 }));
 test(`${remote?'Python':'Node'} I1 original ACK authority preserves ordinary private removal and room cleanup`,()=>fixture(async f=>{
  const {transport,created,call,dir}=await guardedFixture(f,remote);const artifact=await call('/api/invites',{action:'create',room:created.name,studioId:created.studioId,diagnostic:true,expectedDiagnosticAssociation:created.association});const report=await transport.writePrivate('report.json','owned');await transport.removePrivate('report.json',report);await transport.removePrivate('guest-entry.txt',artifact.association);await call('/api/rooms',{action:'delete',name:created.name,studioId:created.studioId,expectedDiagnosticAssociation:created.association});assert.equal(f.posts.length,3);assert.equal(await stat(artifact.path).then(()=>true,()=>false),false);const receipt=JSON.parse(await readFile(path.join(dir,'target-cursor.json'),'utf8'));assert.equal(receipt.uncertain,false);assert.equal(receipt.generation.epoch,7);
 }));
}
for(const remote of [false,true])test(`${remote?'Python':'Node'} I1 lost invite ACK never reconstructs original authority from current target files`,()=>fixture(async f=>{
 const {transport,created,call,dir}=await guardedFixture(f,remote,'invite');await assert.rejects(call('/api/invites',{action:'create',room:created.name,studioId:created.studioId,diagnostic:true,expectedDiagnosticAssociation:created.association}));const file=path.join(f.root,'.castlink-media',f.binding.runId,'guest-entry.txt'),s=await stat(file);const fabricated={schemaVersion:1,contract:'castlink-media-private-v1',target:remote?'remote':'local',runId:f.binding.runId,studioId:created.studioId,room:created.name,path:file,association:{dev:s.dev,ino:s.ino,mode:384,sha256:sha(await readFile(file))}};
 await assert.rejects(transport.localBrowserArtifact(fabricated));await assert.rejects(call('/api/rooms',{action:'delete',name:created.name,studioId:created.studioId,expectedDiagnosticAssociation:created.association}));await assert.rejects(call('/api/invites',{action:'create',room:created.name,studioId:created.studioId,diagnostic:true,expectedDiagnosticAssociation:created.association}));assert.equal(f.posts.length,2);const receipt=JSON.parse(await readFile(path.join(dir,'target-cursor.json'),'utf8'));assert.equal(receipt.uncertain,true);assert.equal(receipt.generation.epoch,2);assert.equal(JSON.parse(await readFile(path.join(f.guard.operation.scope,'epoch.json'),'utf8')).epoch,3);assert.ok(await stat(file));
}));
