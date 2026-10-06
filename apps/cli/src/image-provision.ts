import {publisherWebImage} from './windows-local-preview-image.js';
import {windowsLocalPreviewSources,isWindowsLocalPreviewRelease,windowsLocalPreviewOfficialAliases} from './windows-local-preview.js';
import {observeWindowsRoot,WindowsRootObservationError} from './windows-root-observer.js';
import type {WindowsRootGuard} from './windows-native-root.js';
import {privateVolumeArtifact} from './private-volume-capability.js';
import {publisherVolumeImage,type PublisherVolumeImage} from './private-volume-image.js';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor,type ExecutionRequest} from './types.js';
export class ImagesPhaseError extends CliError {readonly imageCause:number;readonly observationStage:number;constructor(message:string,code=2,cause=0,observation=0){super(message,code);this.imageCause=Number.isInteger(cause)&&[0,1,2,3,4,5,60,61,62,63,64].includes(cause)?cause:0;this.observationStage=Number.isInteger(observation)&&observation>=0&&observation<=52?observation:0;}}
type DigestImageIdentity={Id:string;Os:string;Architecture:string;Variant:string;RepoDigests:string[];Volumes:Record<string,unknown>|null};
export type ImageIdentity=DigestImageIdentity|PublisherVolumeImage;
export type WindowsImageObservation={guard:WindowsRootGuard;service:'web'|'postgres'|'livekit'|'caddy';release?:unknown};
const failureMessage='Selected engine image identity, digest, Linux platform or volume declarations cannot be verified; diagnose the retained private image attempt before retry.';
const failed=(cause=0,error?:unknown)=>new ImagesPhaseError(failureMessage,4,cause,error instanceof WindowsRootObservationError?error.observationStage:0);
export function imageFailureContext(error:unknown,phase:1|2|3|4,service:0|1|2|3|4):never {if(!(error instanceof ImagesPhaseError))throw error;if(process.platform!=='win32'||![1,2,3,4].includes(phase)||![0,1,2,3,4].includes(service))throw error;const safe=new ImagesPhaseError(failureMessage,error.code,error.imageCause,error.observationStage);throw new ImagesPhaseError(failureMessage+'\n'+JSON.stringify({schemaVersion:1,imagePhase:phase,service,imageCause:safe.imageCause,observationStage:safe.observationStage}),safe.code,safe.imageCause,safe.observationStage);}

function reference(ref:string):void {
 const component='[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*';
 if(typeof ref!=='string'||!new RegExp('^(?:localhost|[a-z0-9]+(?:[.-][a-z0-9]+)+)(?::[1-9][0-9]{0,4})?/'+component+'(?:/'+component+')*@sha256:[a-f0-9]{64}$').test(ref)||Number(ref.split('/')[0]!.split(':')[1]??'1')>65535)throw failed();
}
// Constructs argv only; the protected orchestrator owns every mutation.
export function imagePullRequest(ref:string,architecture:'amd64'|'arm64'):ExecutionRequest {
 reference(ref);if(architecture!=='amd64'&&architecture!=='arm64')throw failed();
 return{executable:'docker',args:['image','pull','--platform','linux/'+architecture,ref],sensitive:true};
}
export async function selectedImageEngine(executor:Executor,remote?:boolean):Promise<string>{
 let cause=0;try{if(remote===false&&process.platform==='win32'){cause=1;const hook=(globalThis as typeof globalThis&{__castlinkWindowsNativeEngine?:(r:unknown)=>unknown}).__castlinkWindowsNativeEngine;if(typeof hook!=='function')throw Error();cause=5;const reply=hook({action:'observe'}) as {status?:unknown;stdout?:unknown};cause=2;if(!reply||Object.keys(reply).sort().join(',')!=='status,stdout'||reply.status!=='ok'||typeof reply.stdout!=='string')throw Error();cause=3;const value=parseStrictJson(reply.stdout,2048) as {engine?:unknown;endpoint?:unknown};cause=4;if(!value||Object.keys(value).sort().join(',')!=='endpoint,engine'||typeof value.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(value.engine)||value.endpoint!=='npipe:////./pipe/dockerDesktopLinuxEngine')throw Error();return value.engine;}const r=await executor.run({executable:'docker',args:['info','--format','{"ID":{{json .ID}}}'],sensitive:true});if(r.code!==0||r.stderr!=='')throw Error();const data=parseStrictJson(r.stdout,65536) as {ID:string};if(!data||Object.keys(data).join(',')!=='ID'||typeof data.ID!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(data.ID))throw Error();return data.ID;}catch{throw failed(cause);}
}
export async function observePinnedImage(ref:string,architecture:'amd64'|'arm64',targets:string[],executor:Executor,native?:WindowsImageObservation,remote=false):Promise<ImageIdentity|null>{
 const localWindows=!remote&&process.platform==='win32';
 let cause=60;if(localWindows&&!native)throw failed(cause);
 if(localWindows&&native!.service==='web'&&ref===windowsLocalPreviewSources.web.imageId){try{if(architecture!=='amd64')throw Error();cause=61;const raw=await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!.guard,service:'web'});cause=62;const value=parseStrictJson(raw,1048576);cause=63;return publisherWebImage(value);}catch(error){throw failed(cause,error)}}
 if(localWindows&&native!.service==='livekit'&&privateVolumeArtifact&&ref===privateVolumeArtifact.imageId){try{if(architecture!=='amd64')throw Error();cause=61;const raw=await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!.guard,service:'livekit'});cause=62;const value=parseStrictJson(raw,1048576);cause=63;return publisherVolumeImage(value);}catch(error){throw failed(cause,error)}}
 imagePullRequest(ref,architecture);
 try{
  cause=61;const r=localWindows?{code:0,stderr:'',stdout:await observeWindowsRoot({operation:'cache-image-inspect-v1',guard:native!.guard,service:native!.service})}:await executor.run({executable:'docker',args:['image','inspect','--format','{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Variant":{{if index . "Variant"}}{{json (index . "Variant")}}{{else}}""{{end}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json (index .Config "Volumes")}}}',ref],sensitive:true});
  // Failed lookup is never completion evidence. A pull may subsequently repair
  // the cache, but only after fresh registry proof and protected ownership.
  if(r.code===1&&(r.stdout===''||r.stdout==='\n')&&r.stderr==='Error response from daemon: No such image: '+ref+'\n')return null;
  if(r.code!==0||r.stderr!=='')throw Error();
  if(localWindows&&r.stdout==='{"cache":"missing"}\n')return null;
  const localOfficial=localWindows&&isWindowsLocalPreviewRelease(native!.release)&&['postgres','caddy'].includes(native!.service);
  cause=62;const image=parseStrictJson(r.stdout,65536) as DigestImageIdentity;
  cause=64;if(!image||!isDeepStrictEqual(Object.keys(image).sort(),['Id','Os','Architecture','Variant','RepoDigests','Volumes'].sort())||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Os!=='linux'||image.Architecture!==architecture||!(image.Variant===''||(architecture==='arm64'&&image.Variant==='v8'))||!Array.isArray(image.RepoDigests)||image.RepoDigests.length>128||image.RepoDigests.some(d=>typeof d!=='string')||!(localOfficial?windowsLocalPreviewOfficialAliases(ref,image.RepoDigests):image.RepoDigests.includes(ref))||new Set(image.RepoDigests).size!==image.RepoDigests.length||image.Volumes!==null&&(!image.Volumes||typeof image.Volumes!=='object'||Array.isArray(image.Volumes)||Object.entries(image.Volumes).some(([v,value])=>!targets.includes(v)||!isDeepStrictEqual(value,{}))))throw Error();
  // Other RepoDigests are shared cache aliases, not part of this association.
  if(localOfficial&&native!.service==='postgres'&&image.Volumes===null)throw Error();
  return{...image,RepoDigests:localOfficial?[...image.RepoDigests]:[ref]};
 }catch(error){throw failed(cause,error);}
}
