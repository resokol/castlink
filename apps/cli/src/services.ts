import {isWindowsLocalPreviewRelease,windowsLocalPreviewOfficialAliases} from './windows-local-preview.js';
import {publisherWebImage} from './windows-local-preview-image.js';
import {publisherVolumeImage,type PublisherVolumeImage} from './private-volume-image.js';
import {observeWindowsRoot} from './windows-root-observer.js';
import type {WindowsRootGuard} from './windows-native-root.js';
import {WindowsNativeTargetError} from './windows-native-target.js';
import {observeWindowsVolumeTarget} from './private-volume-observer.js';
import {isPrivateVolumeCapability} from './private-volume-capability.js';
import {servicePortBindings} from './compose-port-bindings.js';
import {serviceInspectionFormats,observeComposeHashes} from './services-protocol.js';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {renderBundle,type BundleInput} from './bundle.js';
import {internetTurnTlsDiagnosis} from './internet-network.js';
import {observeCaddyConfig} from './services-observer.js';
import {CliError,type Executor} from './types.js';
export const serviceNames=['postgres','web','livekit','caddy'] as const;
const resourceConflict=()=>new CliError('Compose resources conflict or their actual ownership is unverified; diagnose containers, volumes and networks before retry.',4);
const label='com.docker.compose.';
export class ServicesPhaseError extends CliError {}
type DigestImage={Id:string;Os:string;Architecture:string;RepoDigests:string[];Volumes:Record<string,unknown>|null};type Image=DigestImage|PublisherVolumeImage;
export type ServiceContract={schemaVersion:1;installationId:string;composePath:string;project:string;hashes:Record<string,string>;images:Record<string,Image>;composeSHA256:string};
async function docker(executor:Executor,args:string[]):Promise<string>{try{const response=await executor.run({executable:'docker',args,sensitive:true});if(response.code!==0)throw Error();return response.stdout;}catch{throw resourceConflict();}}
export async function serviceContract(input:BundleInput,composePath:string,executor:Executor,native?:WindowsRootGuard,remote=false):Promise<ServiceContract>{
 if(process.platform==='win32'&&!remote&&!native)throw new WindowsNativeTargetError();
 const rendered=renderBundle(input),images:Record<string,Image>={};
 if(input.network==='internet')throw new ServicesPhaseError(internetTurnTlsDiagnosis,4);
 for(const service of serviceNames){
  try{
   if(!remote&&process.platform==='win32'&&service==='web'&&isWindowsLocalPreviewRelease(input.release)){images[service]=publisherWebImage(parseStrictJson(await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!,service}),1048576));continue;}
   if(!remote&&process.platform==='win32'&&service==='livekit'&&isWindowsLocalPreviewRelease(input.release)){images[service]=publisherVolumeImage(parseStrictJson(await observeWindowsRoot({operation:'service-image-raw-inspect-v1',guard:native!,service}),1048576));continue;}
   const raw=process.platform==='win32'&&!remote?await observeWindowsRoot({operation:'service-image-inspect-v1',guard:native!,service}):await docker(executor,['image','inspect','--format','{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json (index .Config "Volumes")}}}',input.release.images[service].reference]);
   const observed=parseStrictJson(raw,65536) as DigestImage&{Variant?:unknown};
   if(process.platform==='win32'&&!remote&&(Object.keys(observed??{}).sort().join(',')!=='Architecture,Id,Os,RepoDigests,Variant,Volumes'||!['',null].includes(observed.Variant as never)))throw Error();
   const image:Image=process.platform==='win32'&&!remote?{Id:observed.Id,Os:observed.Os,Architecture:observed.Architecture,RepoDigests:observed.RepoDigests,Volumes:observed.Volumes}:observed;
   const targets=rendered.composeModel.services[service].volumes?.map(m=>m.target)??[];
   if(!image||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Os!=='linux'||image.Architecture!==input.architecture||!Array.isArray(image.RepoDigests)||!(isWindowsLocalPreviewRelease(input.release)&&['postgres','caddy'].includes(service)?windowsLocalPreviewOfficialAliases(input.release.images[service].reference,image.RepoDigests):image.RepoDigests.includes(input.release.images[service].reference))||image.Volumes!==null&&(!image.Volumes||typeof image.Volumes!=='object'||Array.isArray(image.Volumes)||Object.keys(image.Volumes).some(v=>!targets.includes(v))))throw Error();
   if(isWindowsLocalPreviewRelease(input.release)&&service==='postgres'&&image.Volumes===null)throw Error();
   images[service]=image;
  }catch(error){if(error instanceof WindowsNativeTargetError)throw error;throw new ServicesPhaseError('All pinned Linux images must already be cached on the selected Docker runtime with the requested architecture and expected volume declarations; use explicit setup --provision-images before starting services.',3);}
 }
 const hashes=await observeComposeHashes(rendered.projectName,composePath.slice(0,-'/compose.yaml'.length),executor,native,remote);
 return{schemaVersion:1,installationId:input.installationId,composePath,project:rendered.projectName,hashes,images,composeSHA256:createHash('sha256').update(rendered.composeText).digest('hex')};
}

type Container={Id:string;Name:string;Image:string;ConfigImage:string;Labels:Record<string,string>;Mounts:{Type:string;Name?:string;Driver?:string;Source?:string;Destination:string;RW:boolean}[];PortBindings:unknown;Privileged:boolean;NetworkMode:string;Networks:Record<string,{NetworkID:string}>;Running:boolean;Health:string};
type Volume={Name:string;Driver:string;Scope:string;Labels:Record<string,string>;Options:unknown;CreatedAt:string};
type Network={Id:string;Name:string;Driver:string;Labels:Record<string,string>;Internal:boolean;Attachable:boolean;EnableIPv6:boolean;Options:unknown};
export type Inventory={containers:Container[];volumes:Volume[];networks:Network[]};

export async function inventory(executor:Executor,native?:WindowsRootGuard,remote=false):Promise<Inventory>{
 if(process.platform==='win32'&&!remote&&!native)throw new WindowsNativeTargetError();
 const result:Inventory={containers:[],volumes:[],networks:[]};
 for(const kind of ['container','volume','network'] as const){
  const raw=process.platform==='win32'&&!remote?await observeWindowsRoot({operation:'resource-list-v1',guard:native!,kind}):await docker(executor,[kind,'ls',...(kind==='container'?['--all']:[]),'--quiet',...(kind!=='volume'?['--no-trunc']:[])]);
  const names=raw.trim()?raw.trim().split('\n'):[];
  if(names.length>128||new Set(names).size!==names.length||names.some(name=>!(kind==='volume'?/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$/:/^[a-f0-9]{64}$/).test(name)))throw resourceConflict();
  for(const name of names){const value=parseStrictJson(process.platform==='win32'&&!remote?await observeWindowsRoot({operation:'resource-inspect-v1',guard:native!,kind,name}):await docker(executor,[kind,'inspect','--format',serviceInspectionFormats[kind],name]),1024*1024) as Container&Volume&Network;if(!value||typeof value!=='object'||Array.isArray(value)||(kind==='volume'?value.Name:value.Id)!==name)throw resourceConflict();(result[kind==='container'?'containers':kind==='volume'?'volumes':'networks'] as unknown[]).push(value);}
 }
 return result;
}
const empty=(value:unknown)=>value===null||isDeepStrictEqual(value,{});
// Every inventory is actual selected-runtime observation. Names only identify
// collisions; labels, config hashes, pinned image IDs and mounts bind ownership.
export async function ownedResources(input:BundleInput,contract:ServiceContract,all:Inventory,executor:Executor,remote:boolean,attempted:boolean,native?:WindowsRootGuard):Promise<{owned:Inventory;ready:boolean;ownedPorts:('https'|'ice')[]}>{
 const rendered=renderBundle(input),project=contract.project,networkName=project+'_castlink',volumeNames=Object.keys(rendered.composeModel.volumes).map(v=>project+'_'+v);
 const owned:Inventory={containers:[],volumes:[],networks:[]};
 for(const v of all.volumes){const touched=v.Name.startsWith(project+'_')||v.Labels?.[label+'project']===project;if(!touched)continue;if(!attempted||!volumeNames.includes(v.Name)||v.Driver!=='local'||v.Scope!=='local'||!empty(v.Options)||v.Labels?.[label+'project']!==project||v.Labels?.[label+'volume']!==v.Name.slice(project.length+1)||typeof v.CreatedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v.CreatedAt))throw resourceConflict();owned.volumes.push(v);}
 for(const n of all.networks){const touched=n.Name===networkName||n.Labels?.[label+'project']===project;if(!touched)continue;if(!attempted||n.Name!==networkName||n.Driver!=='bridge'||n.Internal!==false||n.Attachable!==false||n.EnableIPv6!==false||!empty(n.Options)||n.Labels?.[label+'project']!==project||n.Labels?.[label+'network']!=='castlink')throw resourceConflict();owned.networks.push(n);}
 if(owned.networks.length>1||new Set(owned.volumes.map(v=>v.Name)).size!==owned.volumes.length)throw resourceConflict();
 for(const c of all.containers){
  if(!Array.isArray(c.Mounts)||!c.Networks||typeof c.Networks!=='object')throw resourceConflict();
  const touched=c.Name.startsWith('/'+project+'-')||c.Labels?.[label+'project']===project;
  if(!touched){if(c.Mounts.some(m=>volumeNames.includes(m.Name??''))||Object.hasOwn(c.Networks,networkName))throw resourceConflict();continue;}
  const service=c.Labels?.[label+'service'] as typeof serviceNames[number],model=rendered.composeModel.services[service];
  if(!attempted||!model||!serviceNames.includes(service)||c.Name!=='/'+project+'-'+service+'-1'||c.Labels[label+'project']!==project||c.Labels[label+'config-hash']!==contract.hashes[service]||c.Labels[label+'project.config_files']!==contract.composePath||c.Labels[label+'project.working_dir']!==contract.composePath.slice(0,-'/compose.yaml'.length)||c.Labels[label+'container-number']!=='1'||c.Labels[label+'oneoff']!=='False'||c.Labels[label+'image']!==contract.images[service]!.Id||c.Image!==contract.images[service]!.Id||c.ConfigImage!==model.image||c.Privileged!==false||c.NetworkMode!==networkName||Object.keys(c.Networks).length!==1||c.Networks[networkName]?.NetworkID!==owned.networks[0]?.Id||typeof c.Running!=='boolean'||typeof c.Health!=='string')throw resourceConflict();
  const mounts=model.volumes??[];if(c.Mounts.length!==mounts.length)throw resourceConflict();
  for(const m of mounts){const actual=c.Mounts.find(x=>x.Destination===m.target);if(!actual||actual.Type!==m.type||actual.RW!==(m.read_only!==true))throw resourceConflict();if(m.type==='volume'){if(actual.Name!==project+'_'+m.source||actual.Driver!=='local'||!owned.volumes.some(v=>v.Name===actual.Name))throw resourceConflict();}else if(actual.Source!==m.source&&!(input.release.schemaVersion===2&&isPrivateVolumeCapability(input.release.privateControl)&&!remote&&process.platform==='win32'&&await observeWindowsVolumeTarget('bind',input,contract,c,executor)))throw new ServicesPhaseError('Protected LiveKit bind source does not match the selected host path. Docker Desktop path mapping is unverified; diagnose the actual mount before retry, without rewriting protected artifacts.',4);}
  const ports=servicePortBindings(model.ports??[]);if(!isDeepStrictEqual(c.PortBindings??{},ports))throw resourceConflict();
  if(service==='caddy'){let digest:string;try{digest=!remote&&process.platform==='win32'?await observeWindowsRoot({operation:'caddy-config-capture-v1',guard:native!,containerId:c.Id,imageId:contract.images.caddy!.Id,configHash:contract.hashes.caddy!}):await observeCaddyConfig(c.Id,executor,remote);}catch{throw new ServicesPhaseError('Actual Caddy configuration cannot be safely observed. Missing inline config injection or an unsupported Docker archive format requires diagnosis before retry.',4);}if(digest!==createHash('sha256').update(rendered.caddyText).digest('hex'))throw resourceConflict();}
  owned.containers.push(c);
 }
 if(new Set(owned.containers.map(c=>c.Labels[label+'service'])).size!==owned.containers.length)throw resourceConflict();
 const ready=owned.containers.length===4&&owned.volumes.length===(input.release.schemaVersion===2&&isPrivateVolumeCapability(input.release.privateControl)?5:4)&&owned.networks.length===1&&owned.containers.every(c=>c.Running&&(c.Labels[label+'service']==='postgres'?c.Health==='healthy':c.Health===''||c.Health==='healthy'));
 const ownedPorts:('https'|'ice')[]=[];for(const c of owned.containers)if(c.Running){if(c.Labels[label+'service']==='caddy')ownedPorts.push('https');if(c.Labels[label+'service']==='livekit')ownedPorts.push('ice');}
 return{owned,ready,ownedPorts};
}
export function resourceIdentity(owned:Inventory):unknown{return{containers:owned.containers.map(c=>({id:c.Id,service:c.Labels[label+'service']})).sort((a,b)=>a.id.localeCompare(b.id)),volumes:owned.volumes.map(v=>({name:v.Name,createdAt:v.CreatedAt})).sort((a,b)=>a.name.localeCompare(b.name)),networks:owned.networks.map(n=>({id:n.Id,name:n.Name})).sort((a,b)=>a.id.localeCompare(b.id))};}
