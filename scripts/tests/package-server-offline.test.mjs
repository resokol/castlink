import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,unlink,link} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const source=new URL('../package-server-offline.mjs',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(JSON.stringify(value));
const tempRoots=[];
after(async()=>{const {rm}=await import('node:fs/promises');await Promise.all(tempRoots.map(root=>rm(root,{recursive:true,force:true})));});
async function api(){assert.ok(existsSync(source),'offline sidecar implementation missing');return import(source);}
function tar(entries){
 const chunks=[];
 for(const [name,bytes] of entries){
  const h=Buffer.alloc(512);h.write(name);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(bytes.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
  chunks.push(h,bytes,Buffer.alloc((512-bytes.length%512)%512));
 }
 return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'castlink-offline-sidecar-'));
 tempRoots.push(root);
 const provenance={cli:{commit:'1'.repeat(40),tree:'2'.repeat(40)},web:{commit:'1'.repeat(40),tree:'2'.repeat(40)},livekit:{commit:'3'.repeat(40),tree:'4'.repeat(40),controlVersion:'1.13.7+castlink-idleseal-private.2',upstreamCommit:'5'.repeat(40),patchSha256:'6'.repeat(64)}};
 const release={schemaVersion:1,release:'0.1.0-dev-test',nodeVersion:'22.23.3',architectures:['amd64'],images:{}};
 const input={schemaVersion:1,architecture:'amd64',releaseManifest:'release.json',provenance,images:{},registryBootstrap:null};
 const states={};
 for(const name of ['web','postgres','livekit','caddy']){
  const layout=`oci-${name}`;await mkdir(path.join(root,layout,'blobs/sha256'),{recursive:true});
  await writeFile(path.join(root,layout,'oci-layout'),json({imageLayoutVersion:'1.0.0'}));
  const layer=tar([['fixture.txt',Buffer.from('synthetic test layer; no runnable server')]]),compressed=gzipSync(layer);
  const config={architecture:'amd64',os:'linux',config:{},rootfs:{type:'layers',diff_ids:['sha256:'+sha(layer)]},history:[]};
  states[name]={layout,layer,compressed,config};
  const notices=[];
  for(const kind of name==='livekit'?['license','upstream-notice','modification-notice']:['license']){
   const p=`notices/${name}-${kind}.txt`,bytes=Buffer.from(`Synthetic ${kind} fixture; not actual redistribution notices`);await mkdir(path.join(root,'notices'),{recursive:true});await writeFile(path.join(root,p),bytes);
   notices.push({path:p,sha256:sha(bytes),origin:`https://github.com/fixture/${name}/blob/${'7'.repeat(40)}/NOTICE`,kind});
  }
  input.images[name]={layout,rootDigest:'',sourceReference:'',notices};
 }
 const registryLayer=tar([['registry.txt',Buffer.from('synthetic registry fixture')]]);
 const registryConfig=json({architecture:'amd64',os:'linux',rootfs:{type:'layers',diff_ids:['sha256:'+sha(registryLayer)]}}),configName=sha(registryConfig)+'.json';
 const archive=tar([[configName,registryConfig],['layer/layer.tar',registryLayer],['manifest.json',json([{Config:configName,RepoTags:[],Layers:['layer/layer.tar']}])]]);
 await writeFile(path.join(root,'registry.tar'),archive);
 input.registryBootstrap={path:'registry.tar',sha256:sha(archive),configId:'sha256:'+sha(registryConfig),architecture:'amd64',notices:[input.images.caddy.notices[0]]};
 async function sync(){
  for(const [name,s] of Object.entries(states)){
   const cb=json(s.config),cd='sha256:'+sha(cb),ld='sha256:'+sha(s.compressed);
   const manifest=json({schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.oci.image.config.v1+json',digest:cd,size:cb.length},layers:[{mediaType:'application/vnd.oci.image.layer.v1.tar+gzip',digest:ld,size:s.compressed.length}]});
   const rootDigest='sha256:'+sha(manifest);
   // Replace graph entirely so platform/diffID mutations have valid descriptor hashes.
   const {rm}=await import('node:fs/promises');await rm(path.join(root,s.layout,'blobs'),{recursive:true});await mkdir(path.join(root,s.layout,'blobs/sha256'),{recursive:true});
   for(const b of [cb,s.compressed,manifest])await writeFile(path.join(root,s.layout,'blobs/sha256',sha(b)),b);
   await writeFile(path.join(root,s.layout,'index.json'),json({schemaVersion:2,manifests:[{mediaType:'application/vnd.oci.image.manifest.v1+json',digest:rootDigest,size:manifest.length,platform:{os:'linux',architecture:'amd64'}}]}));
   const reference=`ghcr.io/private-fixture/${name}@${rootDigest}`;
   Object.assign(input.images[name],{rootDigest,sourceReference:reference});release.images[name]={reference,architectures:['amd64']};
  }
  await writeFile(path.join(root,'release.json'),json(release));await writeFile(path.join(root,'input.json'),json(input));
 }
 await sync();return {root,input,release,states,sync,inputPath:path.join(root,'input.json')};
}
test('offline sidecar preserves descriptor graph and notice bytes while never claiming installability',async()=>{
 const {packageServerOffline,verifyOfflineSidecar}=await api(),f=await fixture();
 const output=path.join(f.root,'output');const result=await packageServerOffline({development:true,input:f.inputPath,output});
 assert.equal(result.installable,false);assert.equal(result.distribution,'development-only');
 const manifest=JSON.parse(await readFile(path.join(output,'offline-server.json'),'utf8'));
 const schema=JSON.parse(await readFile(new URL('../../infrastructure/self-hosted/offline-server.schema.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(manifest).sort(),schema.required.slice().sort());
 assert.equal(schema.properties.installable.const,false);
 assert.equal(manifest.installable,false);assert.equal(manifest.runtimeProof,'unverified');assert.equal(manifest.provenanceAttestation,'unverified');
 assert.equal(manifest.projectLicense,'MIT');assert.deepEqual(manifest.architectures,['amd64']);
 assert.deepEqual(Object.keys(manifest.images),['web','postgres','livekit','caddy']);
 for(const name of Object.keys(manifest.images))assert.equal(manifest.images[name].rootDigest,f.input.images[name].rootDigest);
 assert.equal(await verifyOfflineSidecar(output),true);
 const metadataPath=path.join(output,'offline-server.json'),sumPath=path.join(output,'offline-server.json.sha256'),originalMetadata=await readFile(metadataPath),originalSum=await readFile(sumPath);
 const legacyMetadata=json({...manifest,projectLicense:'missing'});
 await writeFile(metadataPath,legacyMetadata);await writeFile(sumPath,`${sha(legacyMetadata)}  offline-server.json\n`);
 assert.equal(await verifyOfflineSidecar(output),true,'historical development sidecars remain readable without relicensing their images');
 await writeFile(metadataPath,originalMetadata);await writeFile(sumPath,originalSum);
 const layer=manifest.files.find(file=>file.path.includes('/blobs/')&&file.sha256===sha(f.states.web.compressed));
 await writeFile(path.join(output,layer.path),'modified');await assert.rejects(verifyOfflineSidecar(output),/checksum|size/);
});
test('offline sidecar rejects platform and rootfs DiffID claims even when all descriptor hashes match',async()=>{
 const {validateOfflineInput}=await api();
 for(const mutation of [s=>{s.config.architecture='arm64';},s=>{s.config.os='windows';},s=>{s.config.rootfs.diff_ids=['sha256:'+'9'.repeat(64)];}]){
  const f=await fixture();mutation(f.states.web);await f.sync();await assert.rejects(validateOfflineInput(f.inputPath),/platform|DiffID/);
 }
});
test('offline sidecar rejects tampered missing and unreferenced graph files',async()=>{
 const {validateOfflineInput}=await api();
 for(const kind of ['tamper','missing','extra']){
  const f=await fixture(),p=path.join(f.root,'oci-web/blobs/sha256',sha(f.states.web.compressed));
  if(kind==='tamper')await writeFile(p,'bad');else if(kind==='missing')await unlink(p);else await writeFile(path.join(f.root,'oci-web/blobs/sha256','0'.repeat(64)),'unexpected');
  await assert.rejects(validateOfflineInput(f.inputPath),/checksum|size|missing|unreferenced/i);
 }
});
test('offline sidecar rejects mismatched canonical provenance duplicate JSON and absent actual notices',async()=>{
 const {validateOfflineInput}=await api();
 const f=await fixture();f.input.provenance.web.tree='9'.repeat(40);await f.sync();await assert.rejects(validateOfflineInput(f.inputPath),/provenance/);
 const g=await fixture();await writeFile(g.inputPath,(await readFile(g.inputPath,'utf8')).replace('"architecture":"amd64"','"architecture":"amd64","architec\\u0074ure":"arm64"'));await assert.rejects(validateOfflineInput(g.inputPath),/Duplicate/);
 const h=await fixture();h.input.images.livekit.notices=h.input.images.livekit.notices.filter(n=>n.kind!=='modification-notice');await h.sync();await assert.rejects(validateOfflineInput(h.inputPath),/notices/);
});
test('offline sidecar rejects path escape symlinks and source hardlinks',async()=>{
 const {validateOfflineInput}=await api();
 const f=await fixture();f.input.images.web.layout='../outside';await f.sync();await assert.rejects(validateOfflineInput(f.inputPath),/relative path/);
 for(const kind of ['symbolic','hard']){
  const g=await fixture(),p=path.join(g.root,'oci-web/blobs/sha256',sha(g.states.web.compressed)),other=path.join(g.root,'layer-original');await writeFile(other,g.states.web.compressed);await unlink(p);
  if(kind==='symbolic')await symlink(other,p);else await link(other,p);
  await assert.rejects(validateOfflineInput(g.inputPath),/link/);
 }
});
test('offline sidecar verifies actual bootstrap config ID and rejects unsafe archive members',async()=>{
 const {validateOfflineInput}=await api();
 const f=await fixture();f.input.registryBootstrap.configId='sha256:'+'9'.repeat(64);await f.sync();await assert.rejects(validateOfflineInput(f.inputPath),/bootstrap config/);
 const g=await fixture(),bad=tar([['../escaped',Buffer.from('bad')]]);await writeFile(path.join(g.root,'registry.tar'),bad);g.input.registryBootstrap.sha256=sha(bad);await g.sync();await assert.rejects(validateOfflineInput(g.inputPath),/archive path/);
});
test('offline sidecar rejects inconsistent duplicate layer descriptor sizes',async()=>{
 const {validateOfflineInput}=await api(),f=await fixture(),s=f.states.web;
 const layout=path.join(f.root,s.layout),config={...s.config,rootfs:{type:'layers',diff_ids:[...s.config.rootfs.diff_ids,...s.config.rootfs.diff_ids]}},cb=json(config),cd='sha256:'+sha(cb),ld='sha256:'+sha(s.compressed);
 const layer={mediaType:'application/vnd.oci.image.layer.v1.tar+gzip',digest:ld,size:s.compressed.length};
 const manifest=json({schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.oci.image.config.v1+json',digest:cd,size:cb.length},layers:[layer,{...layer,size:layer.size+1}]}),rootDigest='sha256:'+sha(manifest);
 const {rm}=await import('node:fs/promises');await rm(path.join(layout,'blobs'),{recursive:true});await mkdir(path.join(layout,'blobs/sha256'),{recursive:true});
 for(const b of [cb,s.compressed,manifest])await writeFile(path.join(layout,'blobs/sha256',sha(b)),b);
 await writeFile(path.join(layout,'index.json'),json({schemaVersion:2,manifests:[{mediaType:'application/vnd.oci.image.manifest.v1+json',digest:rootDigest,size:manifest.length}]}));
 const ref=`ghcr.io/private-fixture/web@${rootDigest}`;f.input.images.web.rootDigest=rootDigest;f.input.images.web.sourceReference=ref;f.release.images.web.reference=ref;
 await writeFile(path.join(f.root,'release.json'),json(f.release));await writeFile(f.inputPath,json(f.input));
 await assert.rejects(validateOfflineInput(f.inputPath),/descriptor checksum\/size/);
});
test('offline sidecar streams an uncompressed blob above the CLI 128 MiB inventory cap',async()=>{
 const {validateOfflineInput,LIMITS}=await api(),f=await fixture();
 const {open,rm,rename}=await import('node:fs/promises');
 const layout=path.join(f.root,'oci-web');await rm(path.join(layout,'blobs'),{recursive:true});await mkdir(path.join(layout,'blobs/sha256'),{recursive:true});
 const file=path.join(layout,'blobs/sha256/pending'),handle=await open(file,'wx');
 const size=129*1024*1024;await handle.truncate(size);await handle.close();
 const {createReadStream}=await import('node:fs');const hash=createHash('sha256');for await(const b of createReadStream(file))hash.update(b);
 const layerDigest=hash.digest('hex');await rename(file,path.join(layout,'blobs/sha256',layerDigest));
 const config=json({...f.states.web.config,rootfs:{type:'layers',diff_ids:['sha256:'+layerDigest]}});
 const manifest=json({schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.oci.image.config.v1+json',digest:'sha256:'+sha(config),size:config.length},layers:[{mediaType:'application/vnd.oci.image.layer.v1.tar',digest:'sha256:'+layerDigest,size}]}),rootDigest='sha256:'+sha(manifest);
 for(const b of [config,manifest])await writeFile(path.join(layout,'blobs/sha256',sha(b)),b);
 await writeFile(path.join(layout,'index.json'),json({schemaVersion:2,manifests:[{mediaType:'application/vnd.oci.image.manifest.v1+json',digest:rootDigest,size:manifest.length}]}));
 const ref=`ghcr.io/private-fixture/web@${rootDigest}`;Object.assign(f.input.images.web,{rootDigest,sourceReference:ref});f.release.images.web.reference=ref;
 await writeFile(path.join(f.root,'release.json'),json(f.release));await writeFile(f.inputPath,json(f.input));
 const result=await validateOfflineInput(f.inputPath);
 assert.equal(result.files.find(item=>item.sha256===layerDigest).size,size);assert.equal(LIMITS.blob,4*1024**3);
});
test('offline sidecar bounds artifact size before copying and rejects invalid gzip streams',async()=>{
 const {validateOfflineInput,LIMITS}=await api(),f=await fixture();
 const {open}=await import('node:fs/promises');const p=path.join(f.root,'oci-web/blobs/sha256',sha(f.states.web.compressed)),h=await open(p,'r+');await h.truncate(LIMITS.blob+1);await h.close();
 await assert.rejects(validateOfflineInput(f.inputPath),/size exceeds bound/);
 const g=await fixture();g.states.web.compressed=Buffer.from('not a valid gzip stream');await g.sync();await assert.rejects(validateOfflineInput(g.inputPath),/header|gzip|compression/i);
});
test('offline sidecar rejects extra payload even if its inventory and metadata checksum are rewritten',async()=>{
 const {packageServerOffline,verifyOfflineSidecar}=await api(),f=await fixture(),output=path.join(f.root,'output');
 await packageServerOffline({development:true,input:f.inputPath,output});
 const extra=Buffer.from('unreferenced payload');await writeFile(path.join(output,'extra.bin'),extra);
 const metadata=JSON.parse(await readFile(path.join(output,'offline-server.json'),'utf8'));metadata.files.push({path:'extra.bin',size:extra.length,sha256:sha(extra)});
 const raw=json(metadata);await writeFile(path.join(output,'offline-server.json'),raw);await writeFile(path.join(output,'offline-server.json.sha256'),`${sha(raw)}  offline-server.json\n`);
 await assert.rejects(verifyOfflineSidecar(output),/unreferenced sidecar payload/i);
});
async function interceptOpen(target,onHandle,work){
 const original=fs.promises.open;
 fs.promises.open=async(...args)=>{
  const handle=await original(...args);
  return path.resolve(String(args[0]))===path.resolve(target)?onHandle(handle):handle;
 };
 syncBuiltinESMExports();
 try{return await work();}finally{fs.promises.open=original;syncBuiltinESMExports();}
}
function handleProxy(handle,overrides){return new Proxy(handle,{get(object,key){return overrides[key]??(typeof object[key]==='function'?object[key].bind(object):object[key]);}});}
test('snapshot metadata growth after acquisition never captures more than ceiling plus one',async()=>{
 const {validateOfflineInput,LIMITS}=await api(),f=await fixture();let grown=false,captured=0,largestBuffer=0;
 const grow=async()=>{if(grown)return;grown=true;const writer=await fs.promises.open(f.inputPath,'r+');await writer.truncate(LIMITS.json+8*1024*1024);await writer.close();};
 await interceptOpen(f.inputPath,handle=>handleProxy(handle,{
  readFile:async(...args)=>{await grow();const value=await handle.readFile(...args);captured+=value.length;largestBuffer=Math.max(largestBuffer,value.length);return value;},
  read:async(...args)=>{await grow();largestBuffer=Math.max(largestBuffer,args[0].byteLength);const value=await handle.read(...args);captured+=value.bytesRead;return value;},
 }),async()=>{await assert.rejects(validateOfflineInput(f.inputPath),/size|changed|bound/i);});
 assert.ok(grown);assert.ok(captured>0);assert.ok(captured<=LIMITS.json+1,`captured ${captured} bytes beyond bounded metadata budget`);assert.ok(largestBuffer<=LIMITS.json+1,`allocated read buffer ${largestBuffer} beyond metadata ceiling`);
});
test('snapshot JSON descriptor hash and platform parsing use the same acquired bytes',async()=>{
 const {validateOfflineInput}=await api(),f=await fixture();f.states.web.config.architecture='arm64';await f.sync();
 const bad=json(f.states.web.config),good=Buffer.from(bad.toString().replace('arm64','amd64')),file=path.join(f.root,'oci-web/blobs/sha256',sha(bad));let opens=0;
 await interceptOpen(file,handle=>{const count=++opens;return handleProxy(handle,{close:async()=>{await handle.close();if(count===1)await writeFile(file,good);}});},async()=>{await assert.rejects(validateOfflineInput(f.inputPath),/platform|checksum|changed/i);});
 assert.equal(opens,1,'descriptor metadata must not reopen between hash and parse');
});
test('snapshot compressed SHA and expanded DiffID share one acquired layer stream',async()=>{
 const {validateOfflineInput}=await api(),f=await fixture(),good=f.states.web.compressed;
 f.states.web.compressed=gzipSync(tar([['fixture.txt',Buffer.from('different layer snapshot')]]));await f.sync();
 const file=path.join(f.root,'oci-web/blobs/sha256',sha(f.states.web.compressed));let opens=0;
 await interceptOpen(file,handle=>{const count=++opens;return handleProxy(handle,{close:async()=>{await handle.close();if(count===1)await writeFile(file,good);}});},async()=>{await assert.rejects(validateOfflineInput(f.inputPath),/DiffID|checksum|changed/i);});
 assert.equal(opens,1,'compressed hash and expansion must not reopen layer path');
});
test('snapshot registry config capture remains bound to the same held archive hash',async()=>{
 const {validateOfflineInput}=await api(),f=await fixture(),file=path.join(f.root,'registry.tar');
 const layer=tar([['registry.txt',Buffer.from('synthetic registry fixture')]]),bad=json({architecture:'arm64',os:'linux',rootfs:{type:'layers',diff_ids:['sha256:'+sha(layer)]}}),good=Buffer.from(bad.toString().replace('arm64','amd64')),name=sha(bad)+'.json';
 const archive=config=>tar([[name,config],['layer/layer.tar',layer],['manifest.json',json([{Config:name,RepoTags:[],Layers:['layer/layer.tar']}])]]);
 const a=archive(bad);await writeFile(file,a);f.input.registryBootstrap.sha256=sha(a);f.input.registryBootstrap.configId='sha256:'+sha(bad);await writeFile(f.inputPath,json(f.input));let opens=0;
 await interceptOpen(file,handle=>{const count=++opens;return handleProxy(handle,{close:async()=>{await handle.close();if(count===2)await writeFile(file,archive(good));}});},async()=>{await assert.rejects(validateOfflineInput(f.inputPath),/platform|checksum|changed/i);});
 assert.equal(opens,1,'tar scans must share a single acquired archive descriptor');
});
test('snapshot variants reject present null false zero and nonempty strings',async()=>{
 const {validateOfflineInput}=await api();
 for(const variant of [null,false,0,'v8']){
  const f=await fixture();f.states.web.config.variant=variant;await f.sync();await assert.rejects(validateOfflineInput(f.inputPath),/platform/);
  const g=await fixture(),file=path.join(g.root,'oci-web/index.json'),index=JSON.parse(await readFile(file,'utf8'));index.manifests[0].platform.variant=variant;await writeFile(file,json(index));await assert.rejects(validateOfflineInput(g.inputPath),/platform/);
 }
});
test('snapshot copied-sidecar metadata cannot drift after inventory hashing',async()=>{
 const {packageServerOffline,verifyOfflineSidecar}=await api(),f=await fixture(),output=path.join(f.root,'output');
 await packageServerOffline({development:true,input:f.inputPath,output});
 const file=path.join(output,'images/web/index.json'),a=JSON.parse(await readFile(file,'utf8'));a.annotations={'fixture-note':'stable replacement B'};let opens=0,swapped=false;
 await interceptOpen(file,handle=>{const count=++opens;return handleProxy(handle,{close:async()=>{await handle.close();if(count===1){await writeFile(file,json(a));swapped=true;}}});},async()=>{await assert.rejects(verifyOfflineSidecar(output),/drift|checksum|changed/i);});
 assert.ok(swapped);
});
test('snapshot named inode replacement and symlink substitution fail after acquired reads',async()=>{
 const {validateOfflineInput}=await api();
 for(const symbolic of [false,true]){
  const f=await fixture(),original=await readFile(f.inputPath);let swapped=false;
  const swap=async()=>{if(swapped)return;swapped=true;const {rename}=await import('node:fs/promises');await rename(f.inputPath,f.inputPath+'.held');if(symbolic){const target=path.join(f.root,'replacement');await writeFile(target,original);await symlink(target,f.inputPath);}else await writeFile(f.inputPath,original);};
  await interceptOpen(f.inputPath,handle=>handleProxy(handle,{read:async(...args)=>{const r=await handle.read(...args);await swap();return r;},readFile:async(...args)=>{const b=await handle.readFile(...args);await swap();return b;}}),async()=>{await assert.rejects(validateOfflineInput(f.inputPath),/changed|symlink/i);});
  assert.ok(swapped);
 }
});
