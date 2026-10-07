import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {nodeWindowsImageRecoveryWorker} from '../dist/windows-image-worker-catalog.js';
import {encodeWindowsRootRequest} from '../dist/windows-native-root.js';
import {windowsLocalPreviewRelease,windowsLocalPreviewSources} from '../dist/windows-local-preview.js';
import {privateVolumeArtifact} from '../dist/private-volume-capability.js';
import {publisherWebImage} from '../dist/windows-local-preview-image.js';
import {publisherVolumeImage} from '../dist/private-volume-image.js';
const require=createRequire(import.meta.url),wp=path.win32,hash=b=>createHash('sha256').update(b).digest('hex');

// Execute the complete emitted publisher program: real private readers, lease
// checks, PID adoption, fixed native request encoding and normal lease release.
// Only OS filesystem/bridge primitives and Docker response bytes are simulated.
function execute(mode='ok',program=nodeWindowsImageRecoveryWorker){
 const events=[],output=[],nodes=new Map(),handles=new Map();let serial=0,fdSerial=0,adopted=false;
 const root='D:\\private\\bundle',journal='D:\\private\\journal',scope='D:\\private\\.castlink-target-operations',active=wp.join(scope,'active'),iid='12345678-1234-1234-1234-123456789abc',sid='S-1-5-21-1',endpoint='npipe:////./pipe/dockerDesktopLinuxEngine',engine='engine',pid=9002,oldPid=9001;
 const err=code=>Object.assign(Error('private fixture detail must never be printed'),{code});
 function put(p,bytes,dir=false){const n={bytes:Buffer.from(bytes??''),dir,ino:++serial};nodes.set(p,n);return n;}
 function node(p){if(!nodes.has(p))throw err('ENOENT');return nodes.get(p);}
 function stat(n){return{dev:1,ino:n.ino,nlink:1,size:n.bytes.length,mtimeMs:1,ctimeMs:1,isFile:()=>!n.dir,isDirectory:()=>n.dir,isSymbolicLink:()=>false};}
 function identity(p){return '00000001:'+node(p).ino.toString(16).toUpperCase().padStart(16,'0');}
 const json=(p,v)=>put(p,JSON.stringify(v)+'\n'),read=p=>JSON.parse(node(p).bytes),inspect=p=>({path:p,identity:identity(p)});
 for(const p of ['D:\\','D:\\private',root,journal,scope,active])put(p,'',true);
 const request={target:{kind:'local'},network:'loopback',root,profile:'local-fixture',release:windowsLocalPreviewRelease.release};
 const generation={schemaVersion:1,principal:{kind:'windows-sid',sid},scope,engine,endpoint,epoch:1,active:false};
 const cursor={schemaVersion:1,installationId:iid,request,generation,uncertain:true},cursorFile=wp.join(journal,'target-cursor.json');json(cursorFile,cursor);
 json(wp.join(scope,'epoch.json'),{epoch:1});
 const owner={schemaVersion:1,kind:'images',root,installationId:iid,engine,epoch:1,principal:sid,scope,protocol:'castlink-windows-target-operation-v1',nonce:'e'.repeat(64),pid:oldPid,endpoint,scopeIdentity:identity(scope),rootIdentity:identity(root)};
 if(mode==='wrong-kind')owner.kind='services';if(mode==='wrong-root')owner.root='D:\\foreign';if(mode==='wrong-engine')owner.engine='foreign';if(mode==='wrong-iid')owner.installationId='99999999-1234-1234-1234-123456789abc';if(mode==='wrong-nonce')owner.nonce='invalid';
 const ownerFile=wp.join(active,'owner.json');json(ownerFile,owner);const originalOwner={...owner};
 for(const name of ['compose.yaml','livekit.yaml','postgres.env','web.env'])put(wp.join(root,name),'fixture '+name+'\n');
 json(wp.join(root,'receipt.json'),{schemaVersion:1,installationId:iid});
 const files=Object.fromEntries([...nodes].filter(([p,n])=>wp.dirname(p)===root&&!n.dir).map(([p,n])=>[wp.basename(p),hash(n.bytes)]));
 const webRaw=[{Id:windowsLocalPreviewSources.web.imageId,Os:'linux',Architecture:'amd64',RepoDigests:[],Config:{Cmd:['pnpm','--filter','web','start'],Entrypoint:['docker-entrypoint.sh'],Env:['STUDIOLINK_RELEASE='+windowsLocalPreviewSources.web.buildId]}}],lkRaw=[{Id:privateVolumeArtifact.imageId,Os:'linux',Architecture:'amd64',RepoDigests:[],Config:{User:'1000:1000',Entrypoint:['/usr/local/bin/livekit-server-private']}}];
 const official=(name,Volumes)=>({Id:'sha256:'+('b'.repeat(64)),Os:'linux',Architecture:'amd64',Variant:'',RepoDigests:[name+windowsLocalPreviewRelease.images[name].reference.slice(windowsLocalPreviewRelease.images[name].reference.indexOf('@'))],Volumes});
 const pg=official('postgres',{'/var/lib/postgresql/data':{}}),caddy=official('caddy',null),images={web:publisherWebImage(webRaw),livekit:publisherVolumeImage(lkRaw),postgres:pg};
 const receipts={};for(const name of ['web','postgres','livekit']){const p=wp.join(journal,'images-'+name+'.json');json(p,{schemaVersion:1,installationId:iid,request,engine,service:name,reference:windowsLocalPreviewRelease.images[name].reference,image:images[name]});receipts[name]=hash(node(p).bytes);}
 const r={schemaVersion:1,root,installationId:iid,engine,endpoint,epoch:1,principal:{kind:'windows-sid',sid},scope,files,project:'castlink-'+iid.replaceAll('-',''),reference:windowsLocalPreviewRelease.images.caddy.reference,architecture:'amd64',targets:['/data','/config'],release:windowsLocalPreviewRelease,service:'caddy',journal,cursorSHA256:hash(node(cursorFile).bytes),receiptSHA256:receipts,evidenceName:'images-cache-recovery-12345678-1234-1234-1234-123456789abc.json'};
 const evidence=wp.join(journal,r.evidenceName),originalCursor=node(cursorFile).bytes.toString();
 const fs={constants:{O_RDONLY:0,O_NOFOLLOW:0},lstatSync:p=>stat(node(p)),realpathSync:p=>{node(p);return p},openSync:p=>{const fd=++fdSerial;handles.set(fd,node(p));return fd},fstatSync:fd=>stat(handles.get(fd)),readSync:(fd,b,o,l,pos)=>{const src=handles.get(fd).bytes;const n=Math.max(0,Math.min(l,src.length-pos));src.copy(b,o,pos,pos+n);return n},closeSync:fd=>handles.delete(fd),readdirSync:p=>[...nodes.keys()].filter(q=>wp.dirname(q)===p).map(q=>wp.basename(q)),renameSync:(a,b)=>{events.push('rename:'+wp.basename(b));if(b===ownerFile){assert(nodes.has(evidence),'private evidence must precede PID adoption');assert.deepEqual(read(evidence).oldOwner,originalOwner);const next=read(a);assert.deepEqual(next,{...originalOwner,pid});adopted=true;}if(mode==='release-failure'&&b===wp.join(scope,'epoch.json'))throw err('EIO');const moving=[...nodes].filter(([p])=>p===a||p.startsWith(a+'\\'));assert(moving.length);nodes.delete(b);for(const[p,n]of moving){nodes.delete(p);nodes.set(b+p.slice(a.length),n)}},unlinkSync:p=>{node(p);nodes.delete(p)},rmdirSync:p=>{node(p);assert(![...nodes.keys()].some(q=>wp.dirname(q)===p));nodes.delete(p)}};
 const process={platform:'win32',pid,exitCode:0,kill:(p,signal)=>{assert.equal(p,oldPid);assert.equal(signal,0);events.push('old-pid-check');if(mode==='live-old-pid')return true;throw err('ESRCH')}};
 const context=vm.createContext({Buffer,process,console:{log:v=>output.push(v)},require:n=>n==='node:fs'?fs:n==='node:path'?wp:n==='node:child_process'?{spawnSync(){assert.fail('recovery may not spawn Docker')}}:require(n),winTargetInput:()=>JSON.stringify(r),__castlinkWindowsNativeBridge:q=>{
  let value;if(q.action==='identity')value={principal:sid,scope,scopeIdentity:identity(scope)};
  else if(q.action==='inspect'){assert.equal(q.principal,sid);assert.equal(q.scope,scope);assert.equal(node(q.path).dir,q.directory);value=inspect(q.path)}
  else if(q.action==='write'){assert.equal(q.principal,sid);assert.equal(q.scope,scope);assert(!nodes.has(q.path),'all writes must be exclusive');assert(node(wp.dirname(q.path)).dir);put(q.path,Buffer.from(q.bytes,'base64'));events.push('write:'+wp.basename(q.path));value=inspect(q.path);if(q.path.includes('owner-adoption-')){if(mode==='cursor-race')node(cursorFile).bytes=Buffer.from(originalCursor+' ');if(mode==='owner-race')put(ownerFile,node(ownerFile).bytes);}}
  else assert.fail('recovery may not create a lease/directory');return{status:'ok',stdout:JSON.stringify(value)};
 },__castlinkWindowsNativeEngine:()=>({status:'ok',stdout:JSON.stringify({engine,endpoint})}),__castlinkWindowsNativeRoot:q=>{
  assert(adopted,'protected native reads must follow PID adoption');assert.equal(read(ownerFile).pid,pid);assert.equal(q.lease.ownerIdentity,identity(ownerFile));assert.equal(q.lease.nonce,owner.nonce);const packet=encodeWindowsRootRequest(q);assert([29,30,35].includes(packet[8]),'no pull/start or other effect opcode');events.push('native:'+q.operation+':'+(q.service??q.kind));
  if(mode==='native-failure'||mode==='caddy-native-failure'&&q.operation==='service-image-inspect-v1')throw err('EIO');let value;
  if(q.operation==='resource-list-v1')value=mode==='own-resource'&&q.kind==='volume'?r.project+'_data\n':'\n';
  else if(q.operation==='resource-inspect-v1')value=JSON.stringify({Name:q.name,Labels:{'com.docker.compose.project':r.project}});
  else if(q.operation==='service-image-inspect-v1'){value=JSON.stringify(q.service==='postgres'?(mode==='pg-drift'?{...pg,Id:'sha256:'+'c'.repeat(64)}:pg):mode==='foreign-caddy'?{...caddy,RepoDigests:['foreign@sha256:'+'a'.repeat(64)]}:mode==='caddy-mount'?{...caddy,Volumes:{'/foreign':{}}}:caddy)}
  else if(q.operation==='service-image-raw-inspect-v1')value=JSON.stringify(q.service==='web'?webRaw:lkRaw);
  else assert.fail('unexpected recovery route');return{status:'ok',bytes:Buffer.from(value)};
 }});
 new vm.Script(program).runInContext(context,{timeout:3000});
 return{code:process.exitCode,output:output.map(JSON.parse),events,nodes,r,ownerFile,cursorFile,originalCursor,receipts,evidence,scope,active,adopted};
}

test('actual emitted recovery worker durably binds old owner, adopts only PID, proves four images and no own resources, and normally retires only the held images lease',()=>{
 const t=execute();assert.equal(t.code,0,JSON.stringify(t.output));assert.equal(t.output.length,1);assert.equal(t.output[0].status,'image-lease-retired');assert.equal(t.output[0].epoch,2);assert.equal(t.output[0].cursorSHA256,t.r.cursorSHA256);assert(!t.nodes.has(t.active));assert.deepEqual(JSON.parse(t.nodes.get(wp.join(t.scope,'epoch.json')).bytes),{epoch:2});assert(t.nodes.has(t.evidence+'.terminal'));assert(t.nodes.has(t.evidence+'.completed'));assert.equal(t.nodes.get(t.cursorFile).bytes.toString(),t.originalCursor,'worker does not advance parent cursor');for(const name of ['web','postgres','livekit'])assert.equal(hash(t.nodes.get(wp.join(wp.dirname(t.cursorFile),'images-'+name+'.json')).bytes),t.receipts[name]);assert.equal(t.events.filter(x=>x.startsWith('native:service-image-')).length,4);assert.equal(t.events.filter(x=>x==='old-pid-check').length,2);assert(!t.events.some(x=>x.includes('pull')));
});

test('actual recovery refuses live/reused old PID, wrong authority and pre-adoption cursor/physical owner races before protected reads',()=>{
 for(const mode of ['live-old-pid','wrong-kind','wrong-root','wrong-engine','wrong-iid','wrong-nonce','cursor-race','owner-race']){const t=execute(mode);assert.equal(t.code,4,mode);assert.equal(t.adopted,false,mode);assert.equal(t.events.filter(x=>x.startsWith('native:')).length,0,mode);assert(t.nodes.has(t.active),mode);assert.equal(JSON.parse(t.nodes.get(wp.join(t.scope,'epoch.json')).bytes).epoch,1,mode);assert.deepEqual(Object.keys(t.output[0]),['schemaVersion','status','stage']);assert(t.output[0].stage>=1&&t.output[0].stage<=15);}
});

test('failed terminal image/resource/native or release proof retains uncertain cursor, lease and private adoption evidence without pull or success',()=>{
 for(const mode of ['pg-drift','foreign-caddy','caddy-mount','own-resource','native-failure','release-failure']){const t=execute(mode);assert.equal(t.code,4,mode);assert.equal(t.output[0].status,'refused',mode);assert(t.nodes.has(t.active),mode);assert(t.nodes.has(t.evidence),mode);assert.equal(t.nodes.get(t.cursorFile).bytes.toString(),t.originalCursor,mode);assert.equal(JSON.parse(t.nodes.get(wp.join(t.scope,'epoch.json')).bytes).epoch,1,mode);assert(!t.nodes.has(t.evidence+'.completed'),mode);assert(!t.events.some(x=>x.includes('pull')),mode);}
});

test('a recovery source without the required publisher bridge fails stage1 before adoption (regression for actual emitted source assembly)',()=>{
 const start=nodeWindowsImageRecoveryWorker.indexOf("const winFs=require('node:fs')");assert(start>0);const t=execute('ok',nodeWindowsImageRecoveryWorker.slice(start));assert.equal(t.code,4);assert.deepEqual(t.output,[{schemaVersion:1,status:'refused',stage:1}]);assert.equal(t.adopted,false);
});

test('actual recovery retains the exact inventory/Caddy operation and hook versus payload boundary on stage9 refusal',()=>{
 for(const [mode,operation,phase,boundary] of [['native-failure',29,1,1],['caddy-native-failure',30,4,1],['foreign-caddy',30,4,3],['own-resource',29,5,3]]){const t=execute(mode);assert.equal(t.code,4);assert.deepEqual(t.output,[{schemaVersion:1,status:'refused',stage:9,operation,phase,boundary}],mode);assert(t.nodes.has(t.active));assert.equal(t.nodes.get(t.cursorFile).bytes.toString(),t.originalCursor);}
});
