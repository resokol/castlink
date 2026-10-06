#!/usr/bin/env node
// Artifact preparation only: no Docker, registry listener, network or setup effects.
import {constants} from 'node:fs';
import {open,lstat,mkdir,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const LIMITS=Object.freeze({blob:4*1024**3,total:16*1024**3,json:1024**2,notice:16*1024**2,files:4096});
const names=['web','postgres','livekit','caddy'];
const digestPattern=/^sha256:[a-f0-9]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const media={manifest:['application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'],config:['application/vnd.oci.image.config.v1+json','application/vnd.docker.container.image.v1+json'],layer:['application/vnd.oci.image.layer.v1.tar','application/vnd.oci.image.layer.v1.tar+gzip','application/vnd.docker.image.rootfs.diff.tar.gzip']};
function fields(value,required,optional=[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('Invalid offline metadata fields.');
 return value;
}
function relative(name){
 if(typeof name!=='string'||!name||name.length>4096||/[:\\\x00-\x1f]/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe relative path / archive path.');
 return name;
}
function strictJson(bytes){
 const raw=bytes.toString('utf8');if(raw.includes('\uFFFD'))throw Error('Invalid JSON encoding.');
 const value=JSON.parse(raw),stack=[];
 for(const m of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){
  const t=m[0];if(t==='{')stack.push({keys:new Set(),key:true});else if(t==='[')stack.push(null);else if(t==='}'||t===']')stack.pop();
  else {const c=stack.at(-1);if(!c)continue;if(t===',')c.key=true;else if(c.key){const k=JSON.parse(t);if(c.keys.has(k))throw Error('Duplicate JSON key.');c.keys.add(k);c.key=false;}}
 }
 return value;
}
async function noLinks(file){
 let p=path.resolve(file);
 for(;;){const s=await lstat(p);if(s.isSymbolicLink())throw Error('Source path symlink is forbidden.');const parent=path.dirname(p);if(parent===p)break;p=parent;}
}
async function heldFile(file,limit){
 let before;
 try{await noLinks(file);before=await lstat(file);}catch(error){if(error.code==='ENOENT')throw Error('Missing offline graph file.');throw error;}
 if(!before.isFile()||before.nlink!==1)throw Error('Source must be a regular file without hardlinks.');
 if(before.size>limit)throw Error('Offline artifact size exceeds bound.');
 const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW),held=await handle.stat();
 if(held.dev!==before.dev||held.ino!==before.ino||held.size!==before.size){await handle.close();throw Error('Source file changed.');}
 return {handle,before};
}
async function unchanged(file,handle,before){
 const after=await handle.stat(),named=await lstat(file);await noLinks(file);
 if(!named.isFile()||named.nlink!==1||['dev','ino','size','mtimeMs','ctimeMs'].some(k=>after[k]!==before[k]||named[k]!==before[k]))throw Error('Source file changed.');
}
async function snapshot(file,limit=LIMITS.json){
 const {handle,before}=await heldFile(file,limit);
 try {
  // Read at most the acquired size + one overflow byte, never a growing readFile().
  const buffer=Buffer.alloc(before.size+1);let length=0;
  while(length<buffer.length){const result=await handle.read(buffer,length,buffer.length-length,length);if(!result.bytesRead)break;length+=result.bytesRead;}
  if(length!==before.size||length>limit)throw Error('Source size changed or exceeds bound.');
  await unchanged(file,handle,before);const captured=buffer.subarray(0,length);
  return {buffer:captured,size:length,sha256:sha(captured)};
 }finally{await handle.close();}
}
async function bytes(file,limit=LIMITS.json){return (await snapshot(file,limit)).buffer;}
async function hashFile(file,limit=LIMITS.blob,destination){
 const {handle,before}=await heldFile(file,limit),hash=createHash('sha256');let total=0,out;
 try {
  if(destination){await noLinks(path.dirname(destination));out=await open(destination,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
  for await(const chunk of handle.createReadStream({autoClose:false,start:0,end:before.size})){
   total+=chunk.length;if(total>limit)throw Error('Offline artifact size exceeds bound.');hash.update(chunk);
   if(out){let at=0;while(at<chunk.length){const {bytesWritten}=await out.write(chunk,at);if(!bytesWritten)throw Error('Artifact copy failed.');at+=bytesWritten;}}
  }
  if(total!==before.size)throw Error('Source size changed.');await unchanged(file,handle,before);
  if(out)await out.sync();return {size:total,sha256:hash.digest('hex')};
 }finally{if(out)await out.close();await handle.close();}
}
async function list(root,prefix='',budget={entries:0}){
 await noLinks(root);let files=[];
 for(const entry of await readdir(root,{withFileTypes:true})){
  if(++budget.entries>LIMITS.files*2)throw Error('Offline graph entry limit exceeded.');
  const name=relative(prefix+entry.name),p=path.join(root,entry.name);
  if(entry.isSymbolicLink())throw Error('Source graph symlink is forbidden.');
  if(entry.isDirectory())files.push(...await list(p,name+'/',budget));else if(entry.isFile())files.push(name);else throw Error('Unsupported source graph entry.');
  if(files.length>LIMITS.files)throw Error('Offline graph file limit exceeded.');
 }
 return files.sort();
}
function annotations(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(v=>typeof v!=='string'))throw Error('Invalid OCI annotations.');}
function descriptor(d,allowed){
 fields(d,['mediaType','digest','size'],['platform','annotations']);
 if(!allowed.includes(d.mediaType)||!digestPattern.test(d.digest)||!Number.isSafeInteger(d.size)||d.size<=0||d.size>LIMITS.blob)throw Error('Invalid OCI descriptor size/digest/media type.');
 if(Object.hasOwn(d,'platform')){fields(d.platform,['os','architecture'],['variant']);if(d.platform.os!=='linux'||d.platform.architecture!=='amd64'||Object.hasOwn(d.platform,'variant')&&d.platform.variant!=='')throw Error('Unsupported descriptor platform.');}
 if(Object.hasOwn(d,'annotations'))annotations(d.annotations);
 return d;
}
function configPlatform(config,count){
 if(!config||typeof config!=='object'||Array.isArray(config)||config.os!=='linux'||config.architecture!=='amd64'||Object.hasOwn(config,'variant')&&config.variant!=='')throw Error('Unsupported config platform.');
 fields(config.rootfs,['type','diff_ids']);
 if(config.rootfs.type!=='layers'||!Array.isArray(config.rootfs.diff_ids)||config.rootfs.diff_ids.length!==count||config.rootfs.diff_ids.some(d=>!digestPattern.test(d)))throw Error('Invalid rootfs DiffID inventory.');
}
async function layerSnapshot(file,gzip){
 const {handle,before}=await heldFile(file,LIMITS.blob),raw=handle.createReadStream({autoClose:false,start:0,end:before.size});
 const compressedHash=createHash('sha256'),expandedHash=createHash('sha256');let size=0,expandedSize=0;
 const compressed=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>before.size||size>LIMITS.blob)return callback(Error('Source layer size changed or exceeds bound.'));compressedHash.update(chunk);callback(null,chunk);}});
 const expanded=new Writable({write(chunk,encoding,callback){expandedSize+=chunk.length;if(expandedSize>LIMITS.blob)return callback(Error('Expanded layer size exceeds bound.'));expandedHash.update(chunk);callback();}});
 try {
  await pipeline(raw,compressed,...(gzip?[createGunzip()]:[]),expanded);
  if(size!==before.size)throw Error('Source layer size changed.');await unchanged(file,handle,before);
  return {size,sha256:compressedHash.digest('hex'),expanded:{size:expandedSize,digest:'sha256:'+expandedHash.digest('hex')}};
 }catch(error){if(['Z_DATA_ERROR','Z_BUF_ERROR'].includes(error.code))throw Error('Layer checksum/compression validation failed.');throw error;
 }finally{raw.destroy();await handle.close();}
}
// Inspect only outer Docker-save members. Never extract any layer/archive path.
async function scanTarHeld(handle,before,capture){
 const members=new Map(),archiveHash=createHash('sha256');let offset=0,ended=false;
 async function read(length,position){const b=Buffer.alloc(length);let n=0;while(n<length){const r=await handle.read(b,n,length-n,position+n);if(!r.bytesRead)throw Error('Truncated bootstrap archive.');n+=r.bytesRead;}archiveHash.update(b);return b;}
 function text(b){const zero=b.indexOf(0);const raw=b.subarray(0,zero<0?b.length:zero).toString('utf8');if(raw.includes('\uFFFD'))throw Error('Invalid archive path encoding.');return raw;}
 function octal(b){const t=text(b).trim();if(!/^[0-7]+$/.test(t))throw Error('Unsupported archive number.');return parseInt(t,8);}
 while(offset<before.size){
  const header=await read(512,offset);offset+=512;
  if(header.every(b=>b===0)){ended=true;break;}
  if(!['ustar','ustar '].includes(text(header.subarray(257,263))))throw Error('Unsupported bootstrap archive format.');
  const expected=octal(header.subarray(148,156)),copy=Buffer.from(header);copy.fill(32,148,156);
  if([...copy].reduce((a,b)=>a+b,0)!==expected)throw Error('Bootstrap archive header checksum mismatch.');
  const prefix=text(header.subarray(345,500)),rawName=(prefix?prefix+'/':'')+text(header.subarray(0,100)),type=header[156];
  const directory=type===53,name=relative(directory?rawName.replace(/\/$/,''):rawName),size=octal(header.subarray(124,136));
  if(members.has(name)||size>LIMITS.blob||offset+size>before.size||members.size>=LIMITS.files)throw Error('Invalid bootstrap archive inventory/size.');
  if(![0,48,53].includes(type)||text(header.subarray(157,257))||directory&&size!==0)throw Error('Bootstrap archive link/unsupported member is forbidden.');
  if(directory){members.set(name,{directory:true,size:0});continue;}
  const hash=createHash('sha256'),chunks=[];let at=0;
  if(capture.has(name)&&size>LIMITS.json)throw Error('Bootstrap config/manifest size exceeds bound.');
  while(at<size){const b=await read(Math.min(64*1024,size-at),offset+at);hash.update(b);if(capture.has(name))chunks.push(b);at+=b.length;}
  members.set(name,{size,sha256:hash.digest('hex'),...(capture.has(name)?{bytes:Buffer.concat(chunks)}:{})});
  const padding=(512-size%512)%512;if(padding&&(await read(padding,offset+size)).some(v=>v!==0))throw Error('Bootstrap archive padding is not canonical.');offset+=size+padding;
 }
 if(!ended||before.size-offset<512)throw Error('Bootstrap archive lacks end markers.');
 while(offset<before.size){const b=await read(Math.min(64*1024,before.size-offset),offset);if(b.some(v=>v!==0))throw Error('Bootstrap archive trailing data.');offset+=b.length;}
 return {members,size:before.size,sha256:archiveHash.digest('hex')};
}
async function registrySnapshot(file,registry){
 const {handle,before}=await heldFile(file,LIMITS.blob);
 try {
  const first=await scanTarHeld(handle,before,new Set(['manifest.json']));await unchanged(file,handle,before);
  if(first.sha256!==registry.sha256)throw Error('Registry archive checksum mismatch.');
  const manifest=first.members.get('manifest.json');if(!manifest?.bytes)throw Error('Missing bootstrap manifest.');
  const manifests=strictJson(manifest.bytes);if(!Array.isArray(manifests)||manifests.length!==1)throw Error('One bootstrap image is required.');
  const item=fields(manifests[0],['Config','RepoTags','Layers']);relative(item.Config);
  if(item.RepoTags!==null&&(!Array.isArray(item.RepoTags)||item.RepoTags.length)||!Array.isArray(item.Layers)||!item.Layers.length||item.Layers.length>1024)throw Error('Bootstrap archive must have no mutable tags and one layered image.');
  const configMember=first.members.get(item.Config);if(!configMember||'sha256:'+configMember.sha256!==registry.configId)throw Error('Registry bootstrap config ID mismatch.');
  const second=await scanTarHeld(handle,before,new Set([item.Config]));await unchanged(file,handle,before);
  if(second.sha256!==first.sha256||second.size!==first.size)throw Error('Registry archive snapshot changed.');
  const captured=second.members.get(item.Config);if(!captured?.bytes||'sha256:'+sha(captured.bytes)!==registry.configId)throw Error('Registry bootstrap config capture checksum mismatch.');
  const config=strictJson(captured.bytes);configPlatform(config,item.Layers.length);
  const allowed=new Set(['manifest.json',item.Config]);let expandedSize=0;
  for(const [i,name] of item.Layers.entries()){relative(name);const member=second.members.get(name);if(!member||member.directory||'sha256:'+member.sha256!==config.rootfs.diff_ids[i])throw Error('Bootstrap layer DiffID mismatch.');expandedSize+=member.size;allowed.add(name);}
  for(const [name,member] of second.members)if(!member.directory&&!allowed.has(name))throw Error('Unreferenced bootstrap archive member.');
  return {size:first.size,sha256:first.sha256,expandedSize};
 }finally{await handle.close();}
}
// Version 1 retains the historical same-revision contract. Version 2 records
// distinct component sources; source assertions remain explicitly unattested.
export function validateOfflineProvenance(value,version=1){
 if(![1,2].includes(version))throw Error('Unsupported offline provenance version.');
 fields(value,['cli','web','livekit']);for(const name of ['cli','web']){fields(value[name],['commit','tree']);if(['commit','tree'].some(k=>typeof value[name][k]!=='string'||!/^[a-f0-9]{40}$/.test(value[name][k])))throw Error('Invalid provenance.');}
 if(version===1&&(value.cli.commit!==value.web.commit||value.cli.tree!==value.web.tree))throw Error('Canonical CLI/web provenance mismatch.');
 fields(value.livekit,['commit','tree','controlVersion','upstreamCommit','patchSha256']);
 const controls=version===1?['1.13.7+castlink-idleseal-private.2']:['1.13.7+castlink-idleseal-private.2','1.13.7+castlink-idleseal-private.3'];
 if(['commit','tree','upstreamCommit'].some(k=>typeof value.livekit[k]!=='string'||!/^[a-f0-9]{40}$/.test(value.livekit[k]))||typeof value.livekit.patchSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.livekit.patchSha256)||!controls.includes(value.livekit.controlVersion))throw Error('Invalid controlled LiveKit provenance for offline version.');
}
function componentWebSource(config,source){
 const labels=config.config?.Labels;if(!labels||typeof labels!=='object'||Array.isArray(labels)||labels['org.opencontainers.image.revision']!==source.commit||labels['com.castlink.source-tree']!==source.tree)throw Error('Web config source labels do not match recorded component provenance.');
}
export async function validateOfflineInput(inputPath){
 const root=path.dirname(path.resolve(inputPath)),inputSnapshot=await snapshot(inputPath),input=strictJson(inputSnapshot.buffer);
 fields(input,['schemaVersion','architecture','releaseManifest','provenance','images','registryBootstrap']);
 if(![1,2].includes(input.schemaVersion)||input.architecture!=='amd64')throw Error('Offline slice supports versioned Linux amd64 only.');validateOfflineProvenance(input.provenance,input.schemaVersion);fields(input.images,names);
 const files=[],observed=new Map();let total=0,expandedTotal=0;
 async function record(source,destination,limit=LIMITS.blob,expected,provided){
  relative(source);relative(destination);if(files.some(f=>f.path===destination))throw Error('Duplicate sidecar destination.');
  const absolute=path.join(root,source);let value=provided??observed.get(absolute);
  if(!value){try{value=await hashFile(absolute,limit);}catch(error){if(error.code==='ENOENT')throw Error('Missing offline graph file.');throw error;}observed.set(absolute,value);}
  total+=value.size;if(total>LIMITS.total||files.length>=LIMITS.files-1)throw Error('Offline aggregate size/file bound exceeded.');
  if(value.size>limit||expected&&(value.sha256!==expected.sha256||value.size!==expected.size))throw Error('Offline descriptor checksum/size mismatch.');
  files.push({source,absolute,path:destination,size:value.size,sha256:value.sha256});return value;
 }
 async function notices(list,name,livekit=false){
  if(!Array.isArray(list)||!list.length||list.length>64||!list.some(n=>n.kind==='license')||livekit&&['upstream-notice','modification-notice'].some(k=>!list.some(n=>n.kind===k)))throw Error('Original notices are required.');
  const result=[];let i=0;
  for(const n of list){fields(n,['path','sha256','origin','kind']);if(!/^[a-f0-9]{64}$/.test(n.sha256)||!['license','upstream-notice','modification-notice'].includes(n.kind))throw Error('Invalid notices metadata.');const url=new URL(n.origin);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)throw Error('Invalid notices origin.');
   const destination=`notices/${name}/${i++}/${path.posix.basename(relative(n.path))}`,value=await record(n.path,destination,LIMITS.notice);if(value.sha256!==n.sha256||value.size===0)throw Error('Original notices checksum mismatch.');result.push({...n,path:destination});
  }return result;
 }
 const releaseSnapshot=await snapshot(path.join(root,relative(input.releaseManifest))),release=strictJson(releaseSnapshot.buffer);
 fields(release,['schemaVersion','release','nodeVersion','architectures','images']);fields(release.images,names);
 if(release.schemaVersion!==1||typeof release.release!=='string'||release.release.length>128||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.release)||release.nodeVersion!=='22.23.3'||JSON.stringify(release.architectures)!=='["amd64"]')throw Error('Invalid actual amd64 release manifest.');
 await record(input.releaseManifest,'server/release.json',LIMITS.json,undefined,releaseSnapshot);
 const normalized={...input,releaseManifest:'server/release.json',images:{}};
 for(const name of names){
  const image=input.images[name];fields(image,['layout','rootDigest','sourceReference','notices']);relative(image.layout);
  if(typeof image.sourceReference!=='string'||image.sourceReference.length>512||!digestPattern.test(image.rootDigest)||!new RegExp('^[a-z0-9.-]+(?::[0-9]+)?/[a-z0-9._/-]+@'+image.rootDigest+'$').test(image.sourceReference)||/example\.invalid|NOT-INSTALLABLE|@sha256:0{64}$/.test(image.sourceReference))throw Error('Actual digest-pinned image reference required.');
  fields(release.images[name],['reference','architectures']);if(release.images[name].reference!==image.sourceReference||JSON.stringify(release.images[name].architectures)!=='["amd64"]')throw Error('Release/image reference or architecture mismatch.');
  const layout=path.join(root,image.layout);
  async function metadata(file){const value=await snapshot(path.join(layout,file));await record(image.layout+'/'+file,`images/${name}/${file}`,LIMITS.json,undefined,value);return value.buffer;}
  const layoutMeta=strictJson(await metadata('oci-layout'));fields(layoutMeta,['imageLayoutVersion']);if(layoutMeta.imageLayoutVersion!=='1.0.0')throw Error('Unsupported OCI layout.');
  const index=strictJson(await metadata('index.json'));fields(index,['schemaVersion','manifests'],['annotations','mediaType']);if(index.schemaVersion!==2||!Array.isArray(index.manifests)||index.manifests.length!==1)throw Error('One selected amd64 manifest is required.');
  if(Object.hasOwn(index,'annotations'))annotations(index.annotations);if(Object.hasOwn(index,'mediaType')&&index.mediaType!=='application/vnd.oci.image.index.v1+json')throw Error('Invalid OCI index media type.');
  const rootDescriptor=descriptor(index.manifests[0],media.manifest);if(rootDescriptor.digest!==image.rootDigest)throw Error('OCI root digest mismatch.');
  const wanted=new Set(['oci-layout','index.json']);
  const capturedBlobs=new Map();
  async function blob(d,allowed,layer=false){
   descriptor(d,allowed);const file='blobs/sha256/'+d.digest.slice(7);wanted.add(file);const gzip=d.mediaType.endsWith('gzip'),key=file+'|'+(layer?gzip:'metadata');
   let value=capturedBlobs.get(key);
   if(!value){value=layer?await layerSnapshot(path.join(layout,file),gzip):await snapshot(path.join(layout,file));capturedBlobs.set(key,value);}
   const existing=files.find(f=>f.path===`images/${name}/${file}`);
   if(value.size!==d.size||value.sha256!==d.digest.slice(7)||existing&&(existing.size!==value.size||existing.sha256!==value.sha256))throw Error('Offline descriptor checksum/size mismatch.');
   if(!existing)await record(image.layout+'/'+file,`images/${name}/${file}`,layer?LIMITS.blob:LIMITS.json,{size:d.size,sha256:d.digest.slice(7)},value);
   return value;
  }
  const manifest=strictJson((await blob(rootDescriptor,media.manifest)).buffer);fields(manifest,['schemaVersion','mediaType','config','layers'],['annotations']);
  if(manifest.schemaVersion!==2||manifest.mediaType!==rootDescriptor.mediaType||!Array.isArray(manifest.layers)||!manifest.layers.length||manifest.layers.length>1024)throw Error('Invalid server OCI manifest.');
  if(Object.hasOwn(manifest,'annotations'))annotations(manifest.annotations);
  if(manifest.config.platform)throw Error('Unexpected config descriptor platform.');
  const configIndex=media.manifest.indexOf(manifest.mediaType),config=strictJson((await blob(manifest.config,[media.config[configIndex]])).buffer);configPlatform(config,manifest.layers.length);if(input.schemaVersion===2&&name==='web')componentWebSource(config,input.provenance.web);
  for(const [i,layer] of manifest.layers.entries()){
   const value=await blob(layer,configIndex===0?media.layer.slice(0,2):media.layer.slice(2),true);
   if(layer.platform)throw Error('Unexpected layer platform metadata.');
   expandedTotal+=value.expanded.size;if(expandedTotal>LIMITS.total)throw Error('Expanded layer aggregate exceeds bound.');
   if(value.expanded.digest!==config.rootfs.diff_ids[i])throw Error('Layer rootfs DiffID mismatch.');
  }
  if(JSON.stringify(await list(layout))!==JSON.stringify([...wanted].sort()))throw Error('Unreferenced source OCI graph file.');
  normalized.images[name]={...image,layout:`images/${name}`,notices:await notices(image.notices,name,name==='livekit')};
 }
 const registry=input.registryBootstrap;fields(registry,['path','sha256','configId','architecture','notices']);
 if(!/^[a-f0-9]{64}$/.test(registry.sha256)||!digestPattern.test(registry.configId)||registry.architecture!=='amd64')throw Error('Invalid bootstrap config metadata.');
 const registryCaptured=await registrySnapshot(path.join(root,relative(registry.path)),registry);
 await record(registry.path,'bootstrap/registry.tar',LIMITS.blob,undefined,registryCaptured);
 expandedTotal+=registryCaptured.expandedSize;if(expandedTotal>LIMITS.total)throw Error('Expanded layer aggregate exceeds bound.');
 normalized.registryBootstrap={...registry,path:'bootstrap/registry.tar',notices:await notices(registry.notices,'registry')};
 return {input:normalized,release,files,totalBytes:total,inputSnapshot:{size:inputSnapshot.size,sha256:inputSnapshot.sha256}};
}
export async function packageServerOffline(options){
 if(options.development!==true)throw Error('Explicit development mode is required.');
 const validated=await validateOfflineInput(options.input),output=path.resolve(options.output);
 const normalized=Buffer.from(JSON.stringify(validated.input,null,2)+'\n');if(validated.totalBytes+normalized.length>LIMITS.total)throw Error('Offline aggregate size bound exceeded.');await noLinks(path.dirname(output));
 await mkdir(output,{mode:0o700});
 try {
  const inventory=[];
  for(const file of validated.files){const destination=path.join(output,file.path);await mkdir(path.dirname(destination),{recursive:true,mode:0o700});const copied=await hashFile(file.absolute,LIMITS.blob,destination);if(copied.size!==file.size||copied.sha256!==file.sha256)throw Error('Source checksum changed during copy.');inventory.push({path:file.path,...copied});}
  await writeFile(path.join(output,'source-input.json'),normalized,{flag:'wx',mode:0o600});inventory.push({path:'source-input.json',size:normalized.length,sha256:sha(normalized)});
  const manifest={schemaVersion:validated.input.schemaVersion,distribution:'development-only',installable:false,architectures:['amd64'],release:validated.release.release,provenance:validated.input.provenance,provenanceAttestation:'unverified',runtimeProof:'unverified',projectLicense:'missing',signing:'unverified',noticesReview:'supplied-original-bytes-unverified-legal-completeness',images:validated.input.images,registryBootstrap:validated.input.registryBootstrap,limits:LIMITS,files:inventory.sort((a,b)=>a.path.localeCompare(b.path))};
  const metadata=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await writeFile(path.join(output,'offline-server.json'),metadata,{flag:'wx',mode:0o600});await writeFile(path.join(output,'offline-server.json.sha256'),`${sha(metadata)}  offline-server.json\n`,{flag:'wx',mode:0o600});await verifyOfflineSidecar(output);
  return {output,distribution:'development-only',installable:false,manifestSha256:sha(metadata)};
 }catch(error){throw Error(`${error.message} Partial development sidecar retained; use a new output directory after diagnosis.`);}
}
export async function verifyOfflineSidecar(root){
 const raw=await bytes(path.join(root,'offline-server.json')),manifest=strictJson(raw);
 if(await bytes(path.join(root,'offline-server.json.sha256')).then(b=>b.toString())!==`${sha(raw)}  offline-server.json\n`)throw Error('Sidecar metadata checksum mismatch.');
 fields(manifest,['schemaVersion','distribution','installable','architectures','release','provenance','provenanceAttestation','runtimeProof','projectLicense','signing','noticesReview','images','registryBootstrap','limits','files']);
 if(![1,2].includes(manifest.schemaVersion)||manifest.distribution!=='development-only'||manifest.installable!==false||JSON.stringify(manifest.architectures)!=='["amd64"]'||['provenanceAttestation','runtimeProof','signing'].some(k=>manifest[k]!=='unverified')||manifest.projectLicense!=='missing'||manifest.noticesReview!=='supplied-original-bytes-unverified-legal-completeness'||JSON.stringify(manifest.limits)!==JSON.stringify(LIMITS)||!Array.isArray(manifest.files)||manifest.files.length>LIMITS.files)throw Error('Invalid sidecar metadata.');
 const paths=new Set();let total=0;
 for(const file of manifest.files){fields(file,['path','size','sha256']);relative(file.path);if(paths.has(file.path)||!Number.isSafeInteger(file.size)||file.size<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid sidecar inventory.');paths.add(file.path);const actual=await hashFile(path.join(root,file.path));total+=actual.size;if(total>LIMITS.total||actual.size!==file.size||actual.sha256!==file.sha256)throw Error('Sidecar file checksum/size mismatch.');}
 paths.add('offline-server.json');paths.add('offline-server.json.sha256');if(JSON.stringify(await list(root))!==JSON.stringify([...paths].sort()))throw Error('Sidecar inventory mismatch.');
 const checked=await validateOfflineInput(path.join(root,'source-input.json'));
 const expectedFiles=new Map(manifest.files.map(file=>[file.path,file]));
 for(const file of [...checked.files,{path:'source-input.json',...checked.inputSnapshot}]){const expected=expectedFiles.get(file.path);if(!expected||expected.size!==file.size||expected.sha256!==file.sha256)throw Error('Sidecar graph snapshot checksum drift.');}
 const graphFiles=[...checked.files.map(file=>file.path),'source-input.json'].sort();
 if(JSON.stringify(manifest.files.map(file=>file.path).sort())!==JSON.stringify(graphFiles))throw Error('Unreferenced sidecar payload.');
 if(checked.input.schemaVersion!==manifest.schemaVersion)throw Error('Sidecar input/manifest version mismatch.');
 if(JSON.stringify(checked.input.images)!==JSON.stringify(manifest.images)||JSON.stringify(checked.input.registryBootstrap)!==JSON.stringify(manifest.registryBootstrap)||JSON.stringify(checked.input.provenance)!==JSON.stringify(manifest.provenance)||checked.release.release!==manifest.release)throw Error('Sidecar graph metadata mismatch.');
 return true;
}
async function main(args){
 if(args.length===1&&args[0]==='--help'){console.log('Developer artifact-only: node scripts/package-server-offline.mjs --development --input PATH --output NEW_DIRECTORY');return;}
 if(args.length!==5||args[0]!=='--development'||args[1]!=='--input'||args[3]!=='--output')throw Error('Expected --development --input PATH --output NEW_DIRECTORY.');console.log(JSON.stringify(await packageServerOffline({development:true,input:args[2],output:args[4]}),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
