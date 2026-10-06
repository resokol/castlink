import {isWindowsLocalPreviewRelease} from './windows-local-preview.js';
import {createHash} from 'node:crypto';
import {validateReleaseManifest} from './bundle.js';
import {CliError, type CheckResult, type Executor} from './types.js';

const names=['web','postgres','livekit','caddy'] as const;
const oci='application/vnd.oci.image.',docker='application/vnd.docker.distribution.';
const singles=[oci+'manifest.v1+json',docker+'manifest.v2+json'];
const indexes=[oci+'index.v1+json',docker+'manifest.list.v2+json'];
const digestPattern=/^sha256:[a-f0-9]{64}$/;
const maxBytes=256*1024;
// Only protected platform metadata, never .Image.config (Env, labels, history).
const platformTemplate='{"manifest":{{json .Manifest}},"platform":{"architecture":{{json .Image.Architecture}},"os":{{json .Image.OS}},"variant":{{json .Image.Variant}}}}';
type ObjectValue=Record<string,unknown>;
type Descriptor={mediaType:string;digest:string;size:number;platform?:ObjectValue};
function object(value:unknown,required:string[],optional:string[]=[]):ObjectValue {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
 const result=value as ObjectValue;
 if(required.some(key=>!Object.hasOwn(result,key))||Object.keys(result).some(key=>!required.includes(key)&&!optional.includes(key)))throw Error();
 return result;
}
function strings(value:unknown):void {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(v=>typeof v!=='string'))throw Error();
}
function platform(value:unknown):ObjectValue {
 const p=object(value,['architecture','os'],['variant','os.version','os.features']);
 if(typeof p.architecture!=='string'||!p.architecture||typeof p.os!=='string'||!p.os||('variant' in p&&typeof p.variant!=='string')||('os.version' in p&&typeof p['os.version']!=='string')||('os.features' in p&&(!Array.isArray(p['os.features'])||p['os.features'].some(v=>typeof v!=='string'))))throw Error();
 return p;
}
function supported(p:ObjectValue,architecture:string):boolean {
 return p.os==='linux'&&p.architecture===architecture&&(p.variant===undefined||p.variant===''||(architecture==='arm64'&&p.variant==='v8'))&&(!p['os.version'])&&(!p['os.features']||(p['os.features'] as string[]).length===0);
}
function descriptor(value:unknown):Descriptor {
 // Remote URLs, embedded data and artifacts are deliberately unsupported.
 const d=object(value,['mediaType','digest','size'],['platform','annotations']);
 if(typeof d.mediaType!=='string'||typeof d.digest!=='string'||!digestPattern.test(d.digest)||!Number.isSafeInteger(d.size)||(d.size as number)<=0)throw Error();
 if(d.platform!==undefined)platform(d.platform);
 if(d.annotations!==undefined)strings(d.annotations);
 return d as Descriptor;
}
function parse(raw:string):unknown {
 if(Buffer.byteLength(raw)>maxBytes||raw.includes('\uFFFD'))throw Error();
 const value:unknown=JSON.parse(raw);
 // JSON.parse loses duplicate keys; decode string tokens to reject escaped aliases.
 const stack:({keys:Set<string>;key:boolean}|null)[]=[];
 for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){
  const token=match[0];
  if(token==='{')stack.push({keys:new Set(),key:true});
  else if(token==='[')stack.push(null);
  else if(token==='}'||token===']')stack.pop();
  else {const current=stack.at(-1);if(!current)continue;if(token===',')current.key=true;else if(current.key){const key=JSON.parse(token) as string;if(current.keys.has(key))throw Error();current.keys.add(key);current.key=false;}}
 }
 return value;
}
function rawManifest(raw:string,expected:string):ObjectValue {
 if('sha256:'+createHash('sha256').update(raw,'utf8').digest('hex')!==expected)throw Error();
 const m=object(parse(raw),['schemaVersion','mediaType'],['config','layers','manifests','annotations']);
 if(m.schemaVersion!==2||typeof m.mediaType!=='string')throw Error();
 if(m.annotations!==undefined)strings(m.annotations);
 if(singles.includes(m.mediaType)){
  object(m,['schemaVersion','mediaType','config','layers'],['annotations']);
  const config=descriptor(m.config);
  const isOci=m.mediaType===singles[0];
  if(config.mediaType!==(isOci?oci+'config.v1+json':'application/vnd.docker.container.image.v1+json')||config.platform||!Array.isArray(m.layers)||m.layers.length>4096)throw Error();
  const layerTypes=isOci?[oci+'layer.v1.tar',oci+'layer.v1.tar+gzip',oci+'layer.v1.tar+zstd']:['application/vnd.docker.image.rootfs.diff.tar.gzip'];
  for(const layer of m.layers){const d=descriptor(layer);if(!layerTypes.includes(d.mediaType)||d.platform)throw Error();}
 }else if(indexes.includes(m.mediaType)){
  object(m,['schemaVersion','mediaType','manifests'],['annotations']);
  if(!Array.isArray(m.manifests)||!m.manifests.length||m.manifests.length>1024)throw Error();
  const seen=new Set<string>();
  for(const item of m.manifests){const d=descriptor(item);if(!singles.includes(d.mediaType)||seen.has(d.digest))throw Error();seen.add(d.digest);}
 }else throw Error();
 return m;
}
async function metadata(executor:Executor,reference:string,args:string[]):Promise<string> {
 const response=await executor.run({executable:'docker',args:['buildx','imagetools','inspect',...args,reference],sensitive:false});
 if(!response||response.code!==0||typeof response.stdout!=='string'||typeof response.stderr!=='string'||response.stderr!==''||Buffer.byteLength(response.stdout)>maxBytes)throw Error();
 return response.stdout;
}
async function available(reference:string,architecture:string,executor:Executor):Promise<boolean> {
 try{
  const [repository,rootDigest]=reference.split('@') as [string,string];
  let selectedReference=reference,raw=await metadata(executor,reference,['--raw']);
  let manifest=rawManifest(raw,rootDigest);
  if(indexes.includes(manifest.mediaType as string)){
   const candidates=(manifest.manifests as unknown[]).map(descriptor).filter(d=>d.platform&&supported(d.platform,architecture));
   if(candidates.length!==1)throw Error();
   const selected=candidates[0]!;
   selectedReference=repository+'@'+selected.digest;
   raw=await metadata(executor,selectedReference,['--raw']);
   manifest=rawManifest(raw,selected.digest);
   if(manifest.mediaType!==selected.mediaType||Buffer.byteLength(raw)!==selected.size)throw Error();
  }
  if(!singles.includes(manifest.mediaType as string))throw Error();
  const result=object(parse(await metadata(executor,selectedReference,['--format',platformTemplate])),['manifest','platform']);
  const resolved=descriptor(result.manifest);
  if(resolved.digest!==selectedReference.split('@')[1]||resolved.mediaType!==manifest.mediaType||resolved.size!==Buffer.byteLength(raw))throw Error();
  const observed=platform(object(result.platform,['architecture','os','variant']));
  if(resolved.platform&&!supported(resolved.platform,architecture))throw Error();
  return supported(observed,architecture);
 }catch{return false;} // Fixed results only: no registry/SSH stdout, stderr or errors.
}
export async function releaseAvailabilityChecks(input:{manifest:unknown;release:string;architecture:'amd64'|'arm64'},executor:Executor):Promise<CheckResult[]> {
 let architecture:'amd64'|'arm64',references:string[];
 try{
  const {manifest,release}=input;architecture=input.architecture;
  if(architecture!=='amd64'&&architecture!=='arm64')throw Error();
  const validated=validateReleaseManifest(manifest,release,architecture);
  if(isWindowsLocalPreviewRelease(validated)){if(process.platform!=='win32'||architecture!=='amd64')throw Error();return names.map(name=>({id:'local-component-'+name,state:'pass' as const,message:'Publisher-pinned Windows preview component selected; actual cache identity is required in the protected images phase. Portable graph, service readiness and public release availability remain unverified.'}));}
  references=names.map(name=>validated.images[name].reference);
  // Fully qualified repositories only: no credentials, tags, options or aliases.
  const component='[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*';
  const referencePattern=new RegExp('^(?:localhost|[a-z0-9]+(?:[.-][a-z0-9]+)+)(?::[1-9][0-9]{0,4})?/'+component+'(?:/'+component+')*@sha256:[a-f0-9]{64}$');
  if(references.some(ref=>!referencePattern.test(ref)||Number(ref.split('/')[0]!.split(':')[1]??'1')>65535))throw Error();
 }catch{throw new CliError('Некорректные параметры проверки registry: нужны проверенный release, Linux amd64/arm64 и полные digest-pinned repository refs.');}
 const checks:CheckResult[]=[];
 for(const [i,name] of names.entries()){
  const pass=await available(references[i]!,architecture,executor);
  checks.push({id:'registry-'+name,state:pass?'pass':'fail',message:pass?'Registry metadata подтверждает pinned digest и выбранную Linux-платформу; layers, запуск и media не проверены.':'Не удалось подтвердить registry metadata, pinned digest и Linux-платформу: проверь доступ, Docker Buildx и совместимость metadata.'});
 }
 return checks;
}
