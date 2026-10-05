import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor,type ExecutionRequest} from './types.js';
export class ImagesPhaseError extends CliError {}
export type ImageIdentity={Id:string;Os:string;Architecture:string;Variant:string;RepoDigests:string[];Volumes:Record<string,unknown>|null};
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
export async function selectedImageEngine(executor:Executor):Promise<string>{
 try{const r=await executor.run({executable:'docker',args:['info','--format','{"ID":{{json .ID}}}'],sensitive:true});if(r.code!==0||r.stderr!=='')throw Error();const data=parseStrictJson(r.stdout,65536) as {ID:string};if(!data||Object.keys(data).join(',')!=='ID'||typeof data.ID!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(data.ID))throw Error();return data.ID;}catch{throw failed();}
}
export async function observePinnedImage(ref:string,architecture:'amd64'|'arm64',targets:string[],executor:Executor):Promise<ImageIdentity|null>{
 imagePullRequest(ref,architecture);
 try{
  const r=await executor.run({executable:'docker',args:['image','inspect','--format','{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Variant":{{if index . "Variant"}}{{json (index . "Variant")}}{{else}}""{{end}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json .Config.Volumes}}}',ref],sensitive:true});
  // Failed lookup is never completion evidence. A pull may subsequently repair
  // the cache, but only after fresh registry proof and protected ownership.
  if(r.code===1&&(r.stdout===''||r.stdout==='\n')&&r.stderr==='Error response from daemon: No such image: '+ref+'\n')return null;
  if(r.code!==0||r.stderr!=='')throw Error();
  const image=parseStrictJson(r.stdout,65536) as ImageIdentity;
  if(!image||!isDeepStrictEqual(Object.keys(image).sort(),['Id','Os','Architecture','Variant','RepoDigests','Volumes'].sort())||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Os!=='linux'||image.Architecture!==architecture||!(image.Variant===''||(architecture==='arm64'&&image.Variant==='v8'))||!Array.isArray(image.RepoDigests)||image.RepoDigests.length>128||image.RepoDigests.some(d=>typeof d!=='string')||!image.RepoDigests.includes(ref)||new Set(image.RepoDigests).size!==image.RepoDigests.length||image.Volumes!==null&&(!image.Volumes||typeof image.Volumes!=='object'||Array.isArray(image.Volumes)||Object.entries(image.Volumes).some(([v,value])=>!targets.includes(v)||!isDeepStrictEqual(value,{}))))throw Error();
  // Other RepoDigests are shared cache aliases, not part of this association.
  return{...image,RepoDigests:[ref]};
 }catch{throw failed();}
}
