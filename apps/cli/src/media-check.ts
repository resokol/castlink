import {randomBytes,randomUUID} from 'node:crypto';
import {request} from 'node:https';
import {constants} from 'node:fs';
import {open,lstat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {verifyProtectedPath} from './setup.js';
import {writeSecretFile} from './secrets.js';
import {parseStrictJson} from './strict-json.js';
import {validateBrowserMeasurements} from './media-evidence.js';
import type {MediaPrivateArtifact} from './media-target-common.js';
import type {CheckResult} from './types.js';

export type GuidedMediaOptions={origin:string;studioId:string;cookieFile:string;outputDirectory:string;runId?:string};
export type MediaAssociation={creationId:string;revision:string};
export type MediaRoomReceipt={schemaVersion:1;contract:'castlink-media-room-v2';studioId:string;name:string;association:MediaAssociation};
// Implemented by the fixed target lease adapter. Its private request must never
// be logged or placed in argv; each mutation requires fresh PRE/effect/POST.
export type MediaMutationRequest={origin:string;studioId:string;route:'/api/rooms'|'/api/invites';body:unknown;cookie:string};
export interface MediaMutationTransport {execute(request:MediaMutationRequest):Promise<unknown>;}
export interface MediaClient {
 inspect():Promise<void>;
 create(name:string,password:string):Promise<MediaRoomReceipt>;
 invite(room:MediaRoomReceipt):Promise<MediaPrivateArtifact>;
 delete(room:MediaRoomReceipt):Promise<void>;
}
export interface GuidedBrowserProbe {
 // Only a future built-in runner can establish trusted browser provenance. This
 // injectable transport gathers private evidence but never grants a media PASS.
 run(input:{origin:string;studioId:string;room:string;inviteArtifact:MediaPrivateArtifact;runId:string}):Promise<unknown>;
 close():Promise<void>;
}
const contract='castlink-media-room-v2';
const fail=()=>new Error('Media diagnostic scope or response refused.');
function equal(value:unknown,expected:unknown){if(!isDeepStrictEqual(value,expected))throw fail();}
function scope(o:GuidedMediaOptions){
 const u=new URL(o.origin);if(u.protocol!=='https:'||u.origin!==o.origin||u.username||u.password||!/^studio-[a-z0-9][a-z0-9-]{0,120}$/.test(o.studioId))throw fail();
 for(const file of [o.cookieFile,o.outputDirectory])if(!path.isAbsolute(file)||file.split(/[\\/]/).includes('..')||/[\x00-\x1f\x7f]/.test(file))throw fail();
}
async function cookie(o:GuidedMediaOptions):Promise<string>{
 scope(o);await verifyProtectedPath(o.cookieFile,false,false,true);await verifyProtectedPath(path.dirname(o.cookieFile),true,false,true);
 const before=await lstat(o.cookieFile);if(before.size<1||before.size>4096)throw fail();
 const fd=await open(o.cookieFile,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{const actual=await fd.stat();if(actual.ino!==before.ino||actual.dev!==before.dev||actual.size!==before.size)throw fail();const raw=await fd.readFile('utf8');const after=await fd.stat();if(actual.size!==after.size||actual.mtimeMs!==after.mtimeMs||actual.ctimeMs!==after.ctimeMs||! /^(?:studiolink-studio|castlink-studio-owner-[a-f0-9]{24})=[A-Za-z0-9._~-]{1,4000}$/.test(raw))throw fail();await verifyProtectedPath(o.cookieFile,false,false,true);return raw;}finally{await fd.close();}
}
function association(value:unknown):asserts value is MediaAssociation {
 if(!value||typeof value!=='object'||Array.isArray(value)||!isDeepStrictEqual(Object.keys(value).sort(),['creationId','revision'])||!Object.values(value).every(x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)))throw fail();
}
// TLS remains validated, redirects are refused, responses bounded and duplicate
// JSON keys rejected. CA is an explicit trust root for an operator-managed LAN.
export async function createMediaHttpClient(o:GuidedMediaOptions,ca?:string,mutations?:MediaMutationTransport):Promise<MediaClient>{
 o=Object.freeze({...o});
 const secret=await cookie(o);
 async function call(route:string,body?:unknown):Promise<unknown>{
  const bytes=body===undefined?undefined:JSON.stringify(body);
  return await new Promise((resolve,reject)=>{
   const req=request(new URL(route,o.origin),{method:bytes===undefined?'GET':'POST',ca,signal:AbortSignal.timeout(5000),headers:{Cookie:secret,Origin:o.origin,'Content-Type':'application/json',...(bytes?{'Content-Length':Buffer.byteLength(bytes)}:{})}},res=>{
    if(res.statusCode!==200){res.resume();reject(fail());return;}
    const parts:Buffer[]=[];let size=0;
    res.on('data',(part:Buffer)=>{size+=part.length;if(size>16384){res.destroy();reject(fail());return;}parts.push(part);});
    res.on('error',()=>reject(fail()));res.on('end',()=>{try{resolve(parseStrictJson(Buffer.concat(parts).toString('utf8'),16384));}catch{reject(fail());}});
   });req.on('error',()=>reject(fail()));req.end(bytes);
  });
 }
 async function mutate(route:'/api/rooms'|'/api/invites',body:unknown):Promise<unknown>{
  if(!mutations)throw fail();
  return mutations.execute({origin:o.origin,studioId:o.studioId,route,body,cookie:secret});
 }
 function receipt(value:unknown,name:string):MediaRoomReceipt {
  const v=value as MediaRoomReceipt;association(v?.association);equal(v,{schemaVersion:1,contract,studioId:o.studioId,name,association:v.association});return v;
 }
 return {
  inspect:async()=>{equal(await call('/api/rooms?diagnostic=true&studioId='+encodeURIComponent(o.studioId)),{schemaVersion:1,contract,studioId:o.studioId,conditionalCleanup:true});},
  create:async(name,password)=>receipt(await mutate('/api/rooms',{action:'create',name,password,studioId:o.studioId,diagnostic:true}),name),
  invite:async room=>{const v=await mutate('/api/invites',{action:'create',room:room.name,studioId:o.studioId,diagnostic:true,expectedDiagnosticAssociation:room.association}) as MediaPrivateArtifact;const runId=room.name.slice('cli-media-'.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId)||!v||v.schemaVersion!==1||v.contract!=='castlink-media-private-v1'||!['local','remote'].includes(v.target)||v.runId!==runId||v.studioId!==o.studioId||v.room!==room.name||typeof v.path!=='string'||!path.posix.isAbsolute(v.path)||path.posix.normalize(v.path)!==v.path||/[\x00-\x1f\x7f]/.test(v.path)||!v.path.endsWith('/.castlink-media/'+runId+'/guest-entry.txt')||!v.association||!Number.isSafeInteger(v.association.dev)||v.association.dev<0||!Number.isSafeInteger(v.association.ino)||v.association.ino<0||v.association.mode!==384||!/^[a-f0-9]{64}$/.test(v.association.sha256))throw fail();equal(v,{schemaVersion:1,contract:'castlink-media-private-v1',target:v.target,runId,studioId:o.studioId,room:room.name,path:v.path,association:{dev:v.association.dev,ino:v.association.ino,mode:384,sha256:v.association.sha256}});return v;},
  delete:async room=>{equal(await mutate('/api/rooms',{action:'delete',name:room.name,studioId:o.studioId,expectedDiagnosticAssociation:room.association}),{schemaVersion:1,contract,studioId:o.studioId,name:room.name,deleted:true});}
 };
}
export async function inspectMediaScope(o:GuidedMediaOptions):Promise<void>{await(await createMediaHttpClient(o)).inspect();}

export async function diagnoseGuidedMedia(o:GuidedMediaOptions,provided?:MediaClient,browser?:GuidedBrowserProbe):Promise<CheckResult[]> {
 o=Object.freeze({...o});
 const checks:CheckResult[]=[{id:'media',state:'unverified',message:'Media requires a trusted real browser measurement of two guest clients; API health and operator assertions do not establish media delivery.'},{id:'relay',state:'unverified',message:'TURN-only delivery requires a separate browser run with measured relay candidates.'},{id:'independence',state:'unverified',message:'Independent operation requires separate outbound-destination and blocked-creator evidence.'}];
 let room:MediaRoomReceipt|undefined,client:MediaClient|undefined,directory:string|undefined,browserStarted=false,measurementStructureValid=false,phase='preflight',cleanup='not-needed';
 const runId=o.runId??randomUUID(),name='cli-media-'+runId;
 try{
  scope(o);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId))throw fail();await verifyProtectedPath(o.outputDirectory,true,false,true);
  directory=path.join(o.outputDirectory,'media-'+runId);await mkdir(directory,{mode:0o700});await verifyProtectedPath(directory,true,false,true);
  client=provided??await createMediaHttpClient(o);await client.inspect();checks.push({id:'media-api',state:'pass',message:'The scoped owner API acknowledged the conditional diagnostic room contract; media remains unverified.'});
  // No browser runner means no ephemeral resources or credentials are created.
  if(!browser){checks.push({id:'media-browser',state:'unverified',message:'A guided browser runner is not available. Use the existing /room guest flow with two independent clients and collect actual audio/video statistics and selected ICE candidates.'});return checks;}
  phase='create';room=await client.create(name,randomBytes(32).toString('hex'));cleanup='pending';phase='invite';const inviteArtifact=await client.invite(room);
  phase='browser';browserStarted=true;
  const evidence=await browser.run({origin:o.origin,studioId:o.studioId,room:name,inviteArtifact,runId});measurementStructureValid=validateBrowserMeasurements(evidence,{runId,studioId:o.studioId,room:name});const raw=JSON.stringify(evidence);if(Buffer.byteLength(raw)>65536)throw fail();await writeSecretFile(path.join(directory,'browser-evidence.json'),raw);
  checks.push({id:'media-browser',state:'unverified',message:'Private browser transport evidence was retained; this adapter is not a built-in verified measurement runner.'});
 }catch{checks.push({id:'media-operation',state:'fail',message:'The guided media operation could not establish its scoped contract. Inspect the protected diagnostic report; no media PASS is inferred.'});if(phase==='create'&&!room)cleanup='create-acknowledgement-unknown';}
 finally{
  let closed=!browserStarted;
  if(browserStarted)try{await browser!.close();closed=true;}catch{cleanup='browser-close-unknown';}
  if(room&&client&&closed)try{await client.delete(room);cleanup='deleted';}catch{cleanup='conditional-delete-unknown';}
  if(directory){try{await writeSecretFile(path.join(directory,'report.json'),JSON.stringify({schemaVersion:1,contract,runId,origin:o.origin,studioId:o.studioId,room:room?.name??null,association:room?.association??null,phase,cleanup,measurementStructureValid,instructions:'Do not infer media from HTTP success. Collect two actual /room guest clients audio/video byte and frame deltas, exact scope and selected candidates; test relay-only separately. Conditional cleanup must match the retained association; never delete by room name after drift or lost acknowledgement.'}));}catch{checks.push({id:'media-artifacts',state:'fail',message:'Private diagnostic artifacts could not be retained or transient guest links removed.'});}}
  checks.push({id:'media-cleanup',state:cleanup==='deleted'||cleanup==='not-needed'?'pass':'unverified',message:cleanup==='deleted'?'Browser clients closed and the exact acknowledged room association was deleted.':cleanup==='not-needed'?'No temporary room or grant was created.':'Cleanup is incomplete or ambiguous; use the protected report to diagnose the exact scope and never adopt or delete a replacement room.'});
 }
 return checks;
}
