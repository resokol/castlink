import path from 'node:path';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {CliError,type Profile,type Executor,type StateStore} from './types.js';
import {validateRequest} from './plan.js';
import {validateReleaseManifest,renderBundle} from './bundle.js';
import {validateRemoteScope,observeRemoteBundle} from './remote-bundle.js';
import {verifyProtectedPath,type ConfigOptions} from './setup.js';
import {FileStateStore} from './state.js';
import {SshExecutor} from './executors/ssh.js';
import {parseStrictJson} from './strict-json.js';
import {selectedImageEngine,observePinnedImage} from './image-provision.js';
import {serviceContract,inventory,ownedResources,resourceIdentity} from './services.js';
import {remoteBackupTarget} from './remote-backup-target.js';
import type {BackupManifest} from './backup.js';
const failure=()=>new CliError('Remote cold backup scope, identity, private files or content cannot be verified; diagnose retained private partial files before retry using a new output directory.',4);
function require(v:unknown):asserts v {if(!v)throw failure();}
async function record(file:string):Promise<unknown>{
 await verifyProtectedPath(file,false,false,true);const before=await lstat(file);require(before.size<=65536&&before.nlink===1);
 const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await h.stat();require(s.ino===before.ino&&s.dev===before.dev);const b=await h.readFile();const a=await h.stat(),current=await lstat(file);require(b.length<=65536&&b.length===s.size&&s.size===a.size&&s.mtimeMs===a.mtimeMs&&s.ctimeMs===a.ctimeMs&&s.mode===a.mode&&s.uid===a.uid&&a.nlink===1&&s.dev===current.dev&&s.ino===current.ino&&s.mtimeMs===current.mtimeMs&&s.ctimeMs===current.ctimeMs);return parseStrictJson(b.toString(),65536);}finally{await h.close();}
}
export type RemoteBackupManifest=Omit<BackupManifest,'kind'>&{kind:'castlink-remote-cold-backup-v1'};
export type RemoteBackupResult={target:Extract<Profile['request']['target'],{kind:'remote'}>;manifestPath:string;manifest:RemoteBackupManifest};
async function helper(executor:Executor,payload:Record<string,unknown>):Promise<any>{
 const input=Buffer.from(JSON.stringify(payload));require(input.length<=131072);
 const r=await executor.run({executable:'python3',args:['-c',remoteBackupTarget],input,sensitive:true});require(r.code===0&&r.stderr==='');return parseStrictJson(r.stdout,16384);
}
export async function createRemoteColdBackup(profile:Profile,options:{preparation:ConfigOptions;outputDirectory:string},localExecutor:Executor,store:StateStore):Promise<RemoteBackupResult>{
 let unlock:(()=>Promise<void>)|undefined;
 try{
 const p=structuredClone(profile),o=structuredClone(options),prep=o.preparation;
 if(p.request.target.kind!=='remote')throw new CliError('Remote cold backup requires an explicit remote profile.',2);
 require(Object.keys(p).sort().join(',')==='currentRelease,installationId,request,schemaVersion,secretFilePaths');validateRequest(p.request);
 require(p.schemaVersion===1&&p.currentRelease===p.request.release&&Object.keys(prep).sort().join(',')===(prep.internet===undefined?'architecture,bindIPv4,journalDirectory,release,remoteScope':'architecture,bindIPv4,internet,journalDirectory,release,remoteScope')&&(prep.internet===undefined||isDeepStrictEqual(prep.internet,p.request.internet)));
 const scopeRoot=prep.remoteScope!,root=p.request.root,output=o.outputDirectory,journal=prep.journalDirectory;
 validateRemoteScope({scopeRoot,directory:root});validateRemoteScope({scopeRoot,directory:output});
 require(root!==output&&!output.startsWith(root+'/')&&!root.startsWith(output+'/'));
 require(path.isAbsolute(journal)&&path.resolve(journal)===journal&&path.dirname(journal)!==journal);
 const release=validateReleaseManifest(prep.release,p.currentRelease,prep.architecture),secretFiles={webEnv:root+'/web.env',postgresEnv:root+'/postgres.env',livekitConfig:root+'/livekit.yaml'};
 require(isDeepStrictEqual(p.secretFilePaths,{...secretFiles,compose:root+'/compose.yaml',receipt:root+'/receipt.json',journal:path.join(journal,'journal.json')}));
 unlock=await store.lock(p.request.profile);const executor=new SshExecutor(p.request.target,localExecutor);
 const retained=new Map<string,unknown>();async function retain(name:string){const file=path.join(journal,name),v=await record(file);retained.set(file,v);return v;}
 await verifyProtectedPath(journal,true,false,true);
 require(isDeepStrictEqual(await retain('owner.json'),{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep}));
 const j=await retain('journal.json') as any;require(j?.schemaVersion===1&&Object.keys(j).sort().join(',')==='schemaVersion,steps'&&Object.keys(j.steps).sort().join(',')==='config,migrations,owner,preflight,release,runtime,seed,services,verify'&&Object.values(j.steps).every(v=>['pending','running','verified'].includes(String(v)))&&j.steps.services==='verified');
 require(isDeepStrictEqual(await store.load(p.request.profile),p));
 if(store instanceof FileStateStore){await verifyProtectedPath(store.root,true,false,true);await verifyProtectedPath(path.join(store.root,p.request.profile),true,false,true);const file=path.join(store.root,p.request.profile,'profile.json');require(isDeepStrictEqual(await record(file),p));retained.set(file,p);}
 const input={release,installationId:p.installationId,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,...(p.request.internet===undefined?{}:{internet:p.request.internet}),secretFiles},rendered=renderBundle(input);
 const config=()=>observeRemoteBundle({release,installationId:p.installationId,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,...(p.request.internet===undefined?{}:{internet:p.request.internet})},{scopeRoot,directory:root},executor);
 const bundle=await config(),engine=await selectedImageEngine(executor),contract=await serviceContract(input,root+'/compose.yaml',executor);
 require(isDeepStrictEqual(await retain('images-attempt.json'),{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep,engine}));
 const images:Record<string,unknown>={};
 for(const service of ['postgres','web','livekit','caddy'] as const){const image=await observePinnedImage(release.images[service].reference,prep.architecture,rendered.composeModel.services[service].volumes?.map(m=>m.target)??[],executor);require(image);images[service]=image;require(isDeepStrictEqual(await retain('images-'+service+'.json'),{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep,engine,service,reference:release.images[service].reference,image}));const {Variant:_variant,...compatible}=image;require(isDeepStrictEqual({...contract.images[service],RepoDigests:[release.images[service].reference]},compatible));}
 require(isDeepStrictEqual(await retain('services-attempt.json'),{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}}));
 async function observe(){const r=(await ownedResources(input,contract,await inventory(executor),executor,true,true)).owned;require(r.containers.length===4&&r.volumes.length===4&&r.networks.length===1&&r.containers.every(c=>c.Labels['com.docker.compose.service']==='postgres'?c.Running===true&&c.Health==='healthy':c.Running===false));r.containers.sort((a,b)=>a.Id.localeCompare(b.Id));r.volumes.sort((a,b)=>a.Name.localeCompare(b.Name));r.networks.sort((a,b)=>a.Id.localeCompare(b.Id));for(const c of r.containers)c.Mounts.sort((a,b)=>a.Destination.localeCompare(b.Destination));return r;}
 const resources=await observe();require(isDeepStrictEqual(await retain('services-resources.json'),{schemaVersion:1,installationId:p.installationId,resources:resourceIdentity(resources)}));
 const manifest:RemoteBackupManifest={schemaVersion:1,kind:'castlink-remote-cold-backup-v1',installationId:p.installationId,release:p.currentRelease,engine,contract,resources:resourceIdentity(resources),files:[],restoreVerified:false};
 const payload={schemaVersion:1,action:'inspect',scopeRoot,directory:root,root,manifest,containers:resources.containers,volumes:resources.volumes,networks:resources.networks,references:Object.fromEntries(Object.entries(release.images).map(([s,v])=>[s,v.reference])),fingerprints:bundle.fingerprints,receiptHash:'',ownerHash:''};
 const hashes=await helper(executor,payload);require(hashes.schemaVersion===1&&Object.keys(hashes).sort().join(',')==='ownerHash,receiptHash,schemaVersion'&&[hashes.ownerHash,hashes.receiptHash].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)));payload.receiptHash=hashes.receiptHash;payload.ownerHash=hashes.ownerHash;payload.directory=output;
 async function reverify(){require(isDeepStrictEqual(profile,p)&&isDeepStrictEqual(await store.load(p.request.profile),p)&&isDeepStrictEqual(await config(),bundle)&&await selectedImageEngine(executor)===engine&&isDeepStrictEqual(await serviceContract(input,root+'/compose.yaml',executor),contract)&&isDeepStrictEqual(await observe(),resources));for(const service of ['postgres','web','livekit','caddy'] as const)require(isDeepStrictEqual(await observePinnedImage(release.images[service].reference,prep.architecture,rendered.composeModel.services[service].volumes?.map(m=>m.target)??[],executor),images[service]));for(const [file,v]of retained)require(isDeepStrictEqual(await record(file),v));}
 await reverify();payload.action='capture';const captured=await helper(executor,payload);require(captured.schemaVersion===1&&Object.keys(captured).sort().join(',')==='files,schemaVersion');manifest.files=captured.files;
 require(Array.isArray(manifest.files)&&manifest.files.length===10&&manifest.files.every(f=>Number.isInteger(f.bytes)&&f.bytes>=0&&f.bytes<=64*1024*1024&&/^[a-f0-9]{64}$/.test(f.sha256)));
 await reverify();payload.action='finalize';require(isDeepStrictEqual(await helper(executor,payload),captured));payload.action='verify';require(isDeepStrictEqual(await helper(executor,payload),captured));
 return{target:p.request.target,manifestPath:output+'/manifest.json',manifest};
 }catch(e){if(e instanceof CliError&&e.code===2)throw e;throw failure();}finally{if(unlock)try{await unlock();}catch{throw failure();}}
}
// Integrity, not authentication: caller supplies the retained metadata receipt.
export async function verifyRemoteColdBackup(result:RemoteBackupResult,scopeRoot:string,localExecutor:Executor):Promise<RemoteBackupManifest>{
 try{const r=structuredClone(result),directory=r.manifestPath.slice(0,-'/manifest.json'.length);require(r.manifestPath===directory+'/manifest.json');validateRemoteScope({scopeRoot,directory});require(r.target.kind==='remote'&&r.manifest.kind==='castlink-remote-cold-backup-v1'&&r.manifest.restoreVerified===false);
 const response=await helper(new SshExecutor(r.target,localExecutor),{schemaVersion:1,action:'verify',scopeRoot,directory,root:directory,manifest:r.manifest,containers:[],volumes:[],networks:[],references:{},fingerprints:{},receiptHash:'',ownerHash:''});require(isDeepStrictEqual(response,{schemaVersion:1,files:r.manifest.files}));return r.manifest;
 }catch{throw failure();}
}
