import {createHash} from 'node:crypto';
import path from 'node:path';
import {constants} from 'node:fs';
import {open,lstat} from 'node:fs/promises';
import {verifyProtectedPath} from './setup.js';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import type {Executor} from './types.js';
import type {ServiceContract,Inventory} from './services.js';
import type {SetupTargetCursor} from './setup-target-guard.js';
import {nativeWindowsLeaseDiagnosis} from './target-operation-observer.js';
import type {MediaMutationTransport,MediaMutationRequest,MediaRoomReceipt} from './media-check.js';
import type {MediaTargetBinding,MediaPrivateArtifact,MediaFileAssociation,MediaAuthority} from './media-target-common.js';
import {nodeMediaHttpTarget,pythonMediaHttpTarget,nodeMediaAdmissionTarget,pythonMediaAdmissionTarget} from './media-http-target.js';
import {nodeMediaFilesTarget,pythonMediaFilesTarget} from './media-files-target.js';
export type GuardedMediaTargetOptions={executor:Executor;cursor:SetupTargetCursor;contract:ServiceContract;resources:Inventory;fileHashes:Record<string,string>;binding:MediaTargetBinding};
export interface GuardedMediaTransport extends MediaMutationTransport {
 readonly binding:MediaTargetBinding;
 writePrivate(name:'report.json'|'browser-evidence.json',content:string):Promise<MediaFileAssociation>;
 removePrivate(name:'report.json'|'browser-evidence.json'|'guest-entry.txt',association:MediaFileAssociation):Promise<void>;
 // Local owned browser code consumes the protected target path directly. There
 // is no remote secret export or generic stdout transport of invitation bytes.
 localBrowserArtifact(artifact:MediaPrivateArtifact):Promise<MediaPrivateArtifact>;
}
export type MediaBrowserAuthority={readonly contract:'castlink-media-browser-authority-v1'};
export type MediaBrowserAuthoritySnapshot={binding:MediaTargetBinding;root:string;authority:MediaAuthority;artifact:MediaPrivateArtifact;receipt:MediaRoomReceipt};
const browserTransports=new WeakMap<GuardedMediaTransport,()=>Promise<{snapshot:MediaBrowserAuthoritySnapshot;verify:()=>Promise<void>;matches:(options:GuardedMediaTargetOptions)=>boolean}>>();
const browserAuthority=new WeakMap<MediaBrowserAuthority,{snapshot:MediaBrowserAuthoritySnapshot;verify:()=>Promise<void>;matches:(options:GuardedMediaTargetOptions)=>boolean}>();
export async function captureLocalMediaBrowserAuthority(transport:GuardedMediaTransport):Promise<MediaBrowserAuthority>{
 const capture=browserTransports.get(transport);if(!capture)throw refused();const original=await capture(),handle=Object.freeze({contract:'castlink-media-browser-authority-v1' as const});browserAuthority.set(handle,original);return handle;
}
export function mediaBrowserAuthoritySnapshot(handle:MediaBrowserAuthority):MediaBrowserAuthoritySnapshot {const original=browserAuthority.get(handle);if(!original)throw refused();return structuredClone(original.snapshot);}
export function assertMediaBrowserAuthorityTarget(handle:MediaBrowserAuthority,options:GuardedMediaTargetOptions):void {const original=browserAuthority.get(handle);if(!original||!original.matches(options))throw refused();}
export async function verifyOriginalMediaBrowserAuthority(handle:MediaBrowserAuthority):Promise<MediaPrivateArtifact>{const original=browserAuthority.get(handle);if(!original)throw refused();await original.verify();return structuredClone(original.snapshot.artifact);}
const refused=()=>new Error('Guarded media target operation is unverified; retain private cursor and target lock. No automatic retry or remote credential export is available.');
function fileAssociation(a:unknown):asserts a is MediaFileAssociation {
 const v=a as MediaFileAssociation;if(!v||Object.keys(v).sort().join(',')!=='dev,ino,mode,sha256'||!Number.isSafeInteger(v.dev)||v.dev<0||!Number.isSafeInteger(v.ino)||v.ino<0||v.mode!==384||!/^[a-f0-9]{64}$/.test(v.sha256))throw refused();
}
export function createGuardedMediaTransport(options:GuardedMediaTargetOptions):GuardedMediaTransport {
 const {executor,cursor}=options,contract=structuredClone(options.contract),resources=structuredClone(options.resources),fileHashes=structuredClone(options.fileHashes),binding=structuredClone(options.binding);
 if(!cursor.remote&&process.platform==='win32')throw new Error(nativeWindowsLeaseDiagnosis);
 let initialized=false,busy=false,roomClosed=false;
 // Original authority is populated only after a definitive effect/cursor ACK.
 // It is never loaded from mutable target ledgers or exposed by this adapter.
 const authority:MediaAuthority={run:null,room:null,artifacts:{}};
 async function exclusive<T>(operation:()=>Promise<T>):Promise<T>{if(busy)throw refused();busy=true;try{return await operation();}finally{busy=false;}}
 const name='cli-media-'+binding.runId;
 async function fixed(family:'http'|'files',payload:Record<string,unknown>,validate:(v:unknown)=>void):Promise<unknown>{
  let guard;try{guard=cursor.sqlGuard('owner',contract,resources,fileHashes);}catch{throw refused();}const e={binding,guard,authority:structuredClone(authority),...payload},input=Buffer.from(JSON.stringify(e));if(input.length>131072)throw refused();
  return cursor.effect(async()=>{
   const source=family==='http'?(cursor.remote?pythonMediaHttpTarget:nodeMediaHttpTarget):(cursor.remote?pythonMediaFilesTarget:nodeMediaFilesTarget);
   const result=await executor.run({executable:cursor.remote?'python3':process.execPath,args:cursor.remote?['-c',source]:['-e',source],input,sensitive:true});
   if(result.code!==0||result.stderr)throw refused();const v=parseStrictJson(result.stdout,16384);validate(v);return v;
  });
 }
 function exact(v:unknown,expected:unknown){if(!isDeepStrictEqual(v,expected))throw refused();}
 async function files(action:'initialize'|'write'|'remove',file:string|null,content:string|null,a:MediaFileAssociation|null){return fixed('files',{action,name:file,content,association:a},v=>{
  const base={schemaVersion:1,contract:'castlink-media-files-v1',action,runId:binding.runId},value=v as {association:unknown;ledgerAssociation:unknown};
  if(action==='initialize'){fileAssociation(value?.association);exact(v,{...base,association:value.association});}
  else if(action==='remove')exact(v,{...base,name:file});
  else{fileAssociation(value?.association);fileAssociation(value?.ledgerAssociation);exact(v,{...base,name:file,association:value.association,ledgerAssociation:value.ledgerAssociation});}
 });}
 function artifact(v:unknown):MediaPrivateArtifact {
  const value=v as Omit<MediaPrivateArtifact,'target'>;fileAssociation(value?.association);exact(v,{schemaVersion:1,contract:'castlink-media-private-v1',runId:binding.runId,studioId:binding.studioId,room:name,path:path.posix.join(contract.composePath.slice(0,-'/compose.yaml'.length),'.castlink-media',binding.runId,'guest-entry.txt'),association:value.association});return{...value,target:cursor.remote?'remote':'local'};
 }
 const result:GuardedMediaTransport={
  get binding(){return structuredClone(binding);},
  async execute(request:MediaMutationRequest){return exclusive(async()=>{
   const input=structuredClone(request),body=input.body as Record<string,unknown>;
   if(input.origin!==binding.origin||input.studioId!==binding.studioId||createHash('sha256').update(input.cookie).digest('hex')!==binding.targetSessionFile.sha256||!body||body.studioId!==binding.studioId||(body.name??body.room)!==name)throw refused();
   const create=input.route==='/api/rooms'&&body.action==='create',invite=input.route==='/api/invites'&&body.action==='create',remove=input.route==='/api/rooms'&&body.action==='delete';
   if(create){if(Object.keys(body).sort().join(',')!=='action,diagnostic,name,password,studioId'||body.diagnostic!==true||typeof body.password!=='string'||!/^[a-f0-9]{64}$/.test(body.password))throw refused();}
   else if(invite||remove){const keys=invite?'action,diagnostic,expectedDiagnosticAssociation,room,studioId':'action,expectedDiagnosticAssociation,name,studioId';if(Object.keys(body).sort().join(',')!==keys||invite&&body.diagnostic!==true)throw refused();const a=body.expectedDiagnosticAssociation;if(!a||typeof a!=='object'||Object.keys(a).sort().join(',')!=='creationId,revision'||!Object.values(a).every(x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x)))throw refused();}
   else throw refused();
   if(!initialized&&!create)throw refused();
   if(create){if(initialized)throw refused();await cursor.assert();const guard=cursor.sqlGuard('owner',contract,resources,fileHashes),source=cursor.remote?pythonMediaAdmissionTarget:nodeMediaAdmissionTarget;
    try{const result=await executor.run({executable:cursor.remote?'python3':process.execPath,args:cursor.remote?['-c',source]:['-e',source],input:Buffer.from(JSON.stringify({binding,guard,action:'inspect'})),sensitive:true});if(result.code!==0||result.stderr)throw refused();exact(parseStrictJson(result.stdout,1024),{schemaVersion:1,contract:'castlink-media-admission-v1',runId:binding.runId});await cursor.assert();}catch{throw refused();}
    const ack=await files('initialize',null,null,null) as {association:MediaFileAssociation};authority.run=structuredClone(ack.association);initialized=true;}
   if(!create){if(roomClosed||!authority.room)throw refused();exact(body.expectedDiagnosticAssociation,authority.room.receipt.association);}
   const result=await fixed('http',{route:input.route,body},v=>{
    if(input.route==='/api/invites'){const ack=v as {artifact:unknown;ledgerAssociation:unknown};artifact(ack?.artifact);fileAssociation(ack?.ledgerAssociation);exact(v,{schemaVersion:1,contract:'castlink-media-invited-v1',artifact:ack.artifact,ledgerAssociation:ack.ledgerAssociation});return;}
    if(create){const ack=v as {receipt:MediaRoomReceipt;association:MediaFileAssociation};fileAssociation(ack?.association);const r=ack.receipt;if(!r?.association||Object.keys(r.association).sort().join(',')!=='creationId,revision'||!Object.values(r.association).every(x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x)))throw refused();exact(r,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:binding.studioId,name,association:r.association});exact(v,{schemaVersion:1,contract:'castlink-media-created-v1',receipt:r,association:ack.association});}
    else exact(v,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:binding.studioId,name,deleted:true});
   });
   if(create){const ack=result as {receipt:MediaRoomReceipt;association:MediaFileAssociation};authority.room=structuredClone({receipt:ack.receipt,association:ack.association});return structuredClone(ack.receipt);}
   if(invite){const ack=result as {artifact:Omit<MediaPrivateArtifact,'target'>;ledgerAssociation:MediaFileAssociation};authority.artifacts['guest-entry.txt']=structuredClone({association:ack.artifact.association,ledgerAssociation:ack.ledgerAssociation,present:true});return artifact(ack.artifact);}
   roomClosed=true;if(authority.artifacts['guest-entry.txt'])authority.artifacts['guest-entry.txt']!.present=false;return result;
  });},
  async writePrivate(name,content){return exclusive(async()=>{if(!initialized||authority.artifacts[name])throw refused();const v=await files('write',name,content,null) as {association:MediaFileAssociation;ledgerAssociation:MediaFileAssociation};authority.artifacts[name]=structuredClone({association:v.association,ledgerAssociation:v.ledgerAssociation,present:true});return structuredClone(v.association);});},
  async removePrivate(name,association){return exclusive(async()=>{const own=authority.artifacts[name];if(!initialized||!own?.present)throw refused();exact(association,own.association);await files('remove',name,null,own.association);own.present=false;});},
  async localBrowserArtifact(value){try{
   if(busy||cursor.remote||roomClosed||!authority.room||!authority.run||value.target!=='local'||!authority.artifacts['guest-entry.txt']?.present)throw refused();exact(value.association,authority.artifacts['guest-entry.txt']!.association);const {target:_,...metadata}=value;artifact(metadata);await cursor.assert();
   await originalFiles(value);
   await cursor.assert();return structuredClone(value);
  }catch{throw refused();}}
 };
 async function originalFiles(value:MediaPrivateArtifact){
   await verifyProtectedPath(path.dirname(value.path),true,false,true);await verifyProtectedPath(value.path,false,false,true);
   for(const [file,expected] of [[value.path,value.association],[path.join(path.dirname(value.path),'invite-artifact.json'),authority.artifacts['guest-entry.txt']!.ledgerAssociation],[path.join(path.dirname(value.path),'room.json'),authority.room!.association],[path.join(path.dirname(value.path),'binding.json'),authority.run!]] as const){await verifyProtectedPath(file,false,false,true);const before=await lstat(file),fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   try{const held=await fd.stat();if(held.dev!==before.dev||held.ino!==before.ino||held.size>8192||held.nlink!==1)throw refused();const bytes=Buffer.alloc(8193);let size=0;while(size<bytes.length){const n=await fd.read(bytes,size,bytes.length-size,size);if(!n.bytesRead)break;size+=n.bytesRead;}const after=await lstat(file);if(size!==held.size||after.dev!==held.dev||after.ino!==held.ino||after.mtimeMs!==held.mtimeMs||after.ctimeMs!==held.ctimeMs)throw refused();exact(expected,{dev:held.dev,ino:held.ino,mode:held.mode&511,sha256:createHash('sha256').update(bytes.subarray(0,size)).digest('hex')});}finally{await fd.close();}}

 }
 browserTransports.set(result,async()=>{
  if(cursor.remote||busy||roomClosed||!initialized||!authority.run||!authority.room||!authority.artifacts['guest-entry.txt']?.present)throw refused();
  const original=structuredClone(authority),root=contract.composePath.slice(0,-'/compose.yaml'.length),guest=original.artifacts['guest-entry.txt']!;
  const value=artifact({schemaVersion:1,contract:'castlink-media-private-v1',runId:binding.runId,studioId:binding.studioId,room:name,path:path.posix.join(root,'.castlink-media',binding.runId,'guest-entry.txt'),association:guest.association});
  await result.localBrowserArtifact(value);
  const snapshot:MediaBrowserAuthoritySnapshot={binding:structuredClone(binding),root,authority:original,artifact:structuredClone(value),receipt:structuredClone(original.room!.receipt)};
  return {snapshot,matches(o){return o.cursor===cursor&&o.executor===executor&&isDeepStrictEqual(o.binding,binding)&&isDeepStrictEqual(o.contract,contract)&&isDeepStrictEqual(o.resources,resources)&&isDeepStrictEqual(o.fileHashes,fileHashes);},async verify(){
   if(cursor.remote||busy||roomClosed||!initialized||!authority.artifacts['guest-entry.txt']?.present||!isDeepStrictEqual(authority.run,original.run)||!isDeepStrictEqual(authority.room,original.room)||!isDeepStrictEqual(authority.artifacts['guest-entry.txt'],guest))throw refused();
   await originalFiles(value);
  }};
 });
 return result;
}
