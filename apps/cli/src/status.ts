import path from 'node:path';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {CliError,type Profile,type Executor,type CheckResult,type StateStore} from './types.js';
import {validateRequest} from './plan.js';
import {validateReleaseManifest,renderBundle,type BundleInput} from './bundle.js';
import {validateBundleNetwork} from './network.js';
import {validateRemoteScope,observeRemoteBundle} from './remote-bundle.js';
import {verifyProtectedPath,inspectProtectedBundle,type ConfigOptions} from './setup.js';
import {parseStrictJson} from './strict-json.js';
import {prerequisiteChecks} from './probe.js';
import {SshExecutor} from './executors/ssh.js';
import {serviceContract,inventory,ownedResources,resourceIdentity} from './services.js';
import {FileStateStore} from './state.js';
import {selectedImageEngine,observePinnedImage,type ImageIdentity} from './image-provision.js';
const steps=['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
const unknown=():CheckResult[]=>['migrations','seed','owner','setup','api','proxy','tls','dns','ice','relay','media','independence'].map(id=>({id,state:'unverified',message:'Current readiness requires a separate read-only observation; journal history does not establish this result.'}));
const failed=():CheckResult=>({id:'association',state:'fail',message:'Protected installation association is invalid, incomplete or changed during observation; diagnose private artifacts and selected resources.'});
function require(value:unknown):asserts value {if(!value)throw new CliError('Invalid status association.',4);}
function fields(value:unknown,keys:string[]):asserts value is Record<string,unknown>{require(value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),keys.sort()));}
function absolute(value:unknown):asserts value is string {require(typeof value==='string'&&path.isAbsolute(value)&&path.dirname(value)!==value&&!/[\x00-\x1f\x7f]/.test(value)&&!value.split(/[\\/]/).includes('..'));}
// No locks or repair: every retained record is read bounded, with no symlink,
// private permissions, stable file identity and a second complete comparison.
async function privateRecord(file:string):Promise<unknown>{
 await verifyProtectedPath(file,false,false,true);
 const before=await lstat(file);require(before.size<=65536);
 const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{const actual=await handle.stat();require(actual.dev===before.dev&&actual.ino===before.ino&&actual.size===before.size);const raw=await handle.readFile('utf8');require(Buffer.byteLength(raw)<=65536);const after=await handle.stat();require(actual.size===after.size&&actual.mtimeMs===after.mtimeMs&&actual.ctimeMs===after.ctimeMs);return parseStrictJson(raw,65536);}finally{await handle.close();}
}
export async function getStatus(profile:Profile|null,localExecutor:Executor,store?:Pick<StateStore,'load'>):Promise<CheckResult[]>{
 if(profile===null)return[{id:'profile',state:'unverified',message:'No saved installation profile is selected.'},...unknown()];
 const checks:CheckResult[]=[];
 try{
  const p=structuredClone(profile);
  fields(p,['schemaVersion','installationId','request','currentRelease','secretFilePaths']);
  require(p.schemaVersion===1&&typeof p.installationId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.installationId));
  fields(p.request,p.request.domain===undefined?['profile','target','root','release','network']:['profile','target','root','release','network','domain']);validateRequest(p.request);require(p.currentRelease===p.request.release);
  const remote=p.request.target.kind==='remote';fields(p.request.target,remote?['kind','host','user','port']:['kind']);
  const executor=remote?new SshExecutor(p.request.target as Extract<Profile['request']['target'],{kind:'remote'}>,localExecutor):localExecutor;
  fields(p.secretFilePaths,['webEnv','postgresEnv','livekitConfig','compose','receipt','journal']);absolute(p.secretFilePaths.journal);
  const directory=path.dirname(p.secretFilePaths.journal),ownerPath=path.join(directory,'owner.json');require(path.basename(p.secretFilePaths.journal)==='journal.json');
  await verifyProtectedPath(directory,true,false,true);
  const owner=await privateRecord(ownerPath);fields(owner,['schemaVersion','installationId','request','preparation']);require(owner.schemaVersion===1&&owner.installationId===p.installationId&&isDeepStrictEqual(owner.request,p.request));
  const o=owner.preparation as ConfigOptions;fields(o,remote?['release','architecture','bindIPv4','journalDirectory','remoteScope']:['release','architecture','bindIPv4','journalDirectory']);require(o.journalDirectory===directory);absolute(o.journalDirectory);
  require(o.architecture==='amd64'||o.architecture==='arm64');validateBundleNetwork(p.request.network,o.bindIPv4);
  const release=validateReleaseManifest(o.release,p.request.release,o.architecture),paths=remote?path.posix:path,root=p.request.root;
  if(remote)validateRemoteScope({scopeRoot:o.remoteScope!,directory:root});else{absolute(root);require(path.resolve(root)===root&&!root.startsWith(directory+path.sep)&&!directory.startsWith(root+path.sep)&&root!==directory);}
  const secretFiles={webEnv:paths.join(root,'web.env'),postgresEnv:paths.join(root,'postgres.env'),livekitConfig:paths.join(root,'livekit.yaml')};
  require(isDeepStrictEqual(p.secretFilePaths,{...secretFiles,compose:paths.join(root,'compose.yaml'),receipt:paths.join(root,'receipt.json'),journal:path.join(directory,'journal.json')}));
  const retained=new Map<string,unknown>([[ownerPath,owner]]);
  if(store){require(isDeepStrictEqual(await store.load(p.request.profile),p));if(store instanceof FileStateStore){await verifyProtectedPath(store.root,true,false,true);await verifyProtectedPath(path.join(store.root,p.request.profile),true,false,true);const file=path.join(store.root,p.request.profile,'profile.json');require(isDeepStrictEqual(await privateRecord(file),p));retained.set(file,p);}}
  const journal=await privateRecord(p.secretFilePaths.journal);fields(journal,['schemaVersion','steps']);fields(journal.steps,steps);require(journal.schemaVersion===1&&Object.values(journal.steps).every(v=>['pending','running','verified'].includes(String(v))));retained.set(p.secretFilePaths.journal,journal);
  const input:BundleInput={release,installationId:p.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,secretFiles};
  async function config(){if(remote)return observeRemoteBundle({release,installationId:p.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4},{scopeRoot:o.remoteScope!,directory:root},executor);const receipt=await privateRecord(p.secretFilePaths.receipt!);require(isDeepStrictEqual(receipt,{schemaVersion:1,release,installationId:p.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,hashes:await inspectProtectedBundle(input,root)}));return receipt;}
  const bundleSnapshot=await config();
  const prerequisites=(await prerequisiteChecks(executor,remote,{architecture:o.architecture})).filter(c=>!['services','tls','media'].includes(c.id));checks.push(...prerequisites);
  require(['platform','docker-context','docker','compose'].every(id=>prerequisites.some(c=>c.id===id&&c.state==='pass')));
  const engine=await selectedImageEngine(executor),rendered=renderBundle(input),images:Record<string,ImageIdentity>={};
  for(const service of ['postgres','web','livekit','caddy'] as const){const image=await observePinnedImage(release.images[service].reference,o.architecture,rendered.composeModel.services[service].volumes?.map(m=>m.target)??[],executor);require(image);images[service]=image;}
  const imageAttempt=path.join(directory,'images-attempt.json');
  let imageAssociation:unknown=null;try{await lstat(imageAttempt);imageAssociation=await privateRecord(imageAttempt);require(isDeepStrictEqual(imageAssociation,{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:o,engine}));retained.set(imageAttempt,imageAssociation);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const imageFiles=[];for(const service of ['web','postgres','livekit','caddy'] as const){const file=path.join(directory,'images-'+service+'.json');imageFiles.push(file);try{await lstat(file);const value=await privateRecord(file);require(imageAssociation!==null&&isDeepStrictEqual(value,{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:o,engine,service,reference:release.images[service].reference,image:images[service]}));retained.set(file,value);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  const contract=await serviceContract(input,p.secretFilePaths.compose!,executor),attemptPath=path.join(directory,'services-attempt.json'),resourcePath=path.join(directory,'services-resources.json');
  for(const service of ['postgres','web','livekit','caddy'] as const){const {Variant:_variant,...compatible}=images[service]!;require(isDeepStrictEqual({...contract.images[service],RepoDigests:[release.images[service].reference]},compatible));}
  async function optional(file:string){try{await lstat(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}const value=await privateRecord(file);retained.set(file,value);return value;}
  const attempt=await optional(attemptPath),receipt=await optional(resourcePath);if(attempt!==null)require(isDeepStrictEqual(attempt,{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}}));else require(receipt===null&&(journal.steps as Record<string,string>).services==='pending');
  const observed=await ownedResources(input,contract,await inventory(executor),executor,remote,attempt!==null);
  if(receipt!==null)require(isDeepStrictEqual(receipt,{schemaVersion:1,installationId:p.installationId,resources:resourceIdentity(observed.owned)}));
  // Never bless incomplete resources recorded as a completed installation.
  if(attempt!==null)require(receipt!==null&&observed.owned.volumes.length===4&&observed.owned.networks.length===1);
  require(isDeepStrictEqual(await config(),bundleSnapshot)&&await selectedImageEngine(executor)===engine&&isDeepStrictEqual(await serviceContract(input,p.secretFilePaths.compose!,executor),contract));
  const after=await ownedResources(input,contract,await inventory(executor),executor,remote,attempt!==null);require(isDeepStrictEqual(after.owned,observed.owned)&&after.ready===observed.ready);
  for(const service of ['postgres','web','livekit','caddy'] as const)require(isDeepStrictEqual(await observePinnedImage(release.images[service].reference,o.architecture,rendered.composeModel.services[service].volumes?.map(m=>m.target)??[],executor),images[service]));
  require(isDeepStrictEqual(profile,p));if(store)require(isDeepStrictEqual(await store.load(p.request.profile),p));
  for(const [file,value] of retained)require(isDeepStrictEqual(await privateRecord(file),value));
  // Absence is also retained evidence: new attempts during observation are drift.
  for(const file of [attemptPath,resourcePath,imageAttempt,...imageFiles])if(!retained.has(file)){try{await lstat(file);throw Error();}catch(e){require((e as NodeJS.ErrnoException).code==='ENOENT');}}
  checks.push({id:'profile',state:store?'pass':'unverified',message:store?'Saved profile association was observed before and after status reads.':'Saved profile storage was not observed; only the supplied profile association was checked.'},{id:'config',state:'pass',message:'Current protected configuration and private preparation association match.'},{id:'images',state:'pass',message:'All pinned Linux images currently match the selected runtime and architecture.'},{id:'services',state:observed.ready&&receipt!==null?'pass':'unverified',message:observed.ready&&receipt!==null?'All four running owned services and retained resource identities were observed; application readiness remains unverified.':'Running owned services are not established by the current observation.'});
  return [...checks,...unknown()];
 }catch{return [...checks,failed(),...unknown()];}
}
