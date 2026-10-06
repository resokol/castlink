import {publisherWebImage} from './windows-local-preview-image.js';
import {windowsLocalPreviewSources,isWindowsLocalPreviewRelease,windowsLocalPreviewOfficialAliases} from './windows-local-preview.js';
import {observeWindowsRoot} from './windows-root-observer.js';
import type {WindowsRootGuard} from './windows-native-root.js';
import {privateVolumeArtifact} from './private-volume-capability.js';
import {publisherVolumeImage,type PublisherVolumeImage} from './private-volume-image.js';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor,type ExecutionRequest} from './types.js';
export class ImagesPhaseError extends CliError {}
type DigestImageIdentity={Id:string;Os:string;Architecture:string;Variant:string;RepoDigests:string[];Volumes:Record<string,unknown>|null};
export type ImageIdentity=DigestImageIdentity|PublisherVolumeImage;
export type WindowsImageObservation={guard:WindowsRootGuard;service:'web'|'postgres'|'livekit'|'caddy';release?:unknown};
const failed=()=>new ImagesPhaseError('Selected engine image identity, digest, Linux platform or volume declarations cannot be verified; diagnose the retained private image attempt before retry.',4);
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
 try{if(remote===false&&process.platform==='win32'){const hook=(globalThis as typeof globalThis&{__castlinkWindowsNativeEngine?:(r:unknown)=>unknown}).__castlinkWindowsNativeEngine;if(typeof hook!=='function')throw Error();const reply=hook({action:'observe'}) as {status?:unknown;stdout?:unknown};if(!reply||Object.keys(reply).sort().join(',')!=='status,stdout'||reply.status!=='ok'||typeof reply.stdout!=='string')throw Error();const value=parseStrictJson(reply.stdout,2048) as {engine?:unknown;endpoint?:unknown};if(!value||Object.keys(value).sort().join(',')!=='endpoint,engine'||typeof value.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(value.engine)||value.endpoint!=='npipe:////./pipe/dockerDesktopLinuxEngine')throw Error();return value.engine;}const r=await executor.run({executable:'docker',args:['info','--format','{"ID":{{json .ID}}}'],sensitive:true});if(r.code!==0||r.stderr!=='')throw Error();const data=parseStrictJson(r.stdout,65536) as {ID:string};if(!data||Object.keys(data).join(',')!=='ID'||typeof data.ID!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(data.ID))throw Error();return data.ID;}catch{throw failed();}
}
export async function observePinnedImage(ref:string,architecture:'amd64'|'arm64',targets:string[],executor:Executor,native?:WindowsImageObservation,remote=false):Promise<ImageIdentity|null>{
 const localWindows=!remote&&process.platform==='win32';
 if(localWindows&&!native)throw failed();
 if(localWindows&&native!.service==='web'&&ref===windowsLocalPreviewSources.web.imageId){try{if(architecture!=='amd64')throw Error();return publisherWebImage(parseStrictJson(await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!.guard,service:'web'}),1048576));}catch{throw failed()}}
 if(localWindows&&native!.service==='livekit'&&privateVolumeArtifact&&ref===privateVolumeArtifact.imageId){try{if(architecture!=='amd64')throw Error();return publisherVolumeImage(parseStrictJson(await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!.guard,service:'livekit'}),1048576));}catch{throw failed()}}
 imagePullRequest(ref,architecture);
 try{
  const r=localWindows?{code:0,stderr:'',stdout:await observeWindowsRoot({operation:'cache-image-inspect-v1',guard:native!.guard,service:native!.service})}:await executor.run({executable:'docker',args:['image','inspect','--format','{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Variant":{{if index . "Variant"}}{{json (index . "Variant")}}{{else}}""{{end}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json .Config.Volumes}}}',ref],sensitive:true});
  // Failed lookup is never completion evidence. A pull may subsequently repair
  // the cache, but only after fresh registry proof and protected ownership.
  if(r.code===1&&(r.stdout===''||r.stdout==='\n')&&r.stderr==='Error response from daemon: No such image: '+ref+'\n')return null;
  if(r.code!==0||r.stderr!=='')throw Error();
  if(localWindows&&r.stdout==='{"cache":"missing"}\n')return null;
  const localOfficial=localWindows&&isWindowsLocalPreviewRelease(native!.release)&&['postgres','caddy'].includes(native!.service);
  const image=parseStrictJson(r.stdout,65536) as DigestImageIdentity;
  if(!image||!isDeepStrictEqual(Object.keys(image).sort(),['Id','Os','Architecture','Variant','RepoDigests','Volumes'].sort())||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Os!=='linux'||image.Architecture!==architecture||!(image.Variant===''||(architecture==='arm64'&&image.Variant==='v8'))||!Array.isArray(image.RepoDigests)||image.RepoDigests.length>128||image.RepoDigests.some(d=>typeof d!=='string')||!(localOfficial?windowsLocalPreviewOfficialAliases(ref,image.RepoDigests):image.RepoDigests.includes(ref))||new Set(image.RepoDigests).size!==image.RepoDigests.length||image.Volumes!==null&&(!image.Volumes||typeof image.Volumes!=='object'||Array.isArray(image.Volumes)||Object.entries(image.Volumes).some(([v,value])=>!targets.includes(v)||!isDeepStrictEqual(value,{}))))throw Error();
  // Other RepoDigests are shared cache aliases, not part of this association.
  if(localOfficial&&image.Volumes===null)throw Error();
  return{...image,RepoDigests:localOfficial?[...image.RepoDigests]:[ref]};
 }catch{throw failed();}
}
