import path from 'node:path';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {CliError,type Profile,type Executor,type StateStore} from './types.js';
import {validateRequest} from './plan.js';
import {validateBundleNetwork} from './network.js';
import {verifyColdBackup} from './backup.js';
import {verifyProtectedPath,inspectProtectedBundle,type PrepareOptions} from './setup.js';
import {validateReleaseManifest,renderBundle} from './bundle.js';
import {FileStateStore} from './state.js';
import {serviceContract,inventory,ownedResources,resourceIdentity} from './services.js';
import {selectedImageEngine} from './image-provision.js';
import {parseStrictJson} from './strict-json.js';
import {restoreTarget} from './restore-target.js';
import {openSetupTargetCursor} from './setup-target-guard.js';
class UnsupportedRestore extends CliError{}
const refused=()=>new CliError('Limited cold restore refused or incomplete; diagnose the retained private attempt and target-operation owner. Automatic rollback, retry and service startup are not performed.',4);
function require(v:unknown):asserts v{if(!v)throw refused();}
function absolute(p:string):string{require(typeof p==='string'&&path.isAbsolute(p)&&path.resolve(p)===p&&path.dirname(p)!==p&&!/[\x00-\x1f\x7f]/.test(p)&&!p.split(/[\\/]/).includes('..'));return p;}
function overlap(a:string,b:string){const r=path.relative(a,b);return r===''||r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);}
async function bytes(file:string,max=1024*1024):Promise<Buffer>{await verifyProtectedPath(file,false,false,true);const before=await lstat(file);require(before.size<=max&&before.nlink===1);const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const a=await h.stat();require(a.dev===before.dev&&a.ino===before.ino&&a.size===before.size);const b=await h.readFile(),z=await h.stat(),n=await lstat(file);require(b.length===a.size&&a.size===z.size&&a.mtimeMs===z.mtimeMs&&a.ctimeMs===z.ctimeMs&&a.dev===n.dev&&a.ino===n.ino&&a.mtimeMs===n.mtimeMs&&a.ctimeMs===n.ctimeMs);return b;}finally{await h.close();}}
export type ColdRestoreOptions={preparation:PrepareOptions;backupDirectory:string;attemptDirectory:string;targetEpoch:number};
export type ColdRestoreResult={schemaVersion:1;status:'restored-cold';installationId:string;release:string;authPreserved:true;servicesStarted:false;targetEpoch:number;receiptPath:string};
// Preview library: same installation, source resources and release only. Every
// security/operator snapshot must match the current authority. This is not lost-DB
// disaster recovery. Unix local transport only until target coverage is proven.
export async function createColdRestore(profile:Profile,options:ColdRestoreOptions,executor:Executor,store:StateStore):Promise<ColdRestoreResult>{
 let unlock:(()=>Promise<void>)|undefined;try{
 const p=structuredClone(profile),o=structuredClone(options);
 if(p.request.target.kind!=='local'||process.platform==='win32')throw new UnsupportedRestore('Limited cold restore currently supports local Unix targets only; Windows and remote restore are not implemented.',2);
 require(Object.keys(p).sort().join(',')==='currentRelease,installationId,request,schemaVersion,secretFilePaths'&&Object.keys(o).sort().join(',')==='attemptDirectory,backupDirectory,preparation,targetEpoch');validateRequest(p.request);const prep=o.preparation;require(Object.keys(prep).sort().join(',')==='architecture,bindIPv4,journalDirectory,release'&&Number.isSafeInteger(o.targetEpoch)&&o.targetEpoch>=0);
 const root=absolute(p.request.root),journal=absolute(prep.journalDirectory),backup=absolute(o.backupDirectory),attempt=absolute(o.attemptDirectory),scopes=[root,journal,backup,attempt,...(store instanceof FileStateStore?[absolute(store.root)]:[])];for(let i=0;i<scopes.length;i++)for(let j=i+1;j<scopes.length;j++)require(!overlap(scopes[i]!,scopes[j]!)&&!overlap(scopes[j]!,scopes[i]!));
 await verifyProtectedPath(path.dirname(attempt),true,false,true);unlock=await store.lock(p.request.profile);require(isDeepStrictEqual(await store.load(p.request.profile),p));
 const cursor=await openSetupTargetCursor(executor,false);await cursor.attach(journal,p);await cursor.assert();require(cursor.binding.epoch===o.targetEpoch);
 const manifest=await verifyColdBackup(backup),release=validateReleaseManifest(prep.release,p.currentRelease,prep.architecture);require(manifest.installationId===p.installationId&&manifest.release===p.currentRelease&&p.request.release===p.currentRelease);
 const secretFiles={webEnv:path.join(root,'web.env'),postgresEnv:path.join(root,'postgres.env'),livekitConfig:path.join(root,'livekit.yaml')},refs={...secretFiles,compose:path.join(root,'compose.yaml'),receipt:path.join(root,'receipt.json'),journal:path.join(journal,'journal.json')};require(isDeepStrictEqual(p.secretFilePaths,refs));
 const input={release,installationId:p.installationId,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,secretFiles},rendered=renderBundle(input),retained=new Map<string,Buffer>();
 async function retain(file:string,max=1024*1024){const b=await bytes(file,max);retained.set(file,b);return b;}
 async function record(name:string){return parseStrictJson((await retain(path.join(journal,name),65536)).toString(),65536) as any;}
 await verifyProtectedPath(root,true,false,true);await verifyProtectedPath(journal,true,false,true);
 require(isDeepStrictEqual(await record('owner.json'),{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep}));
 const j=await record('journal.json');require(j?.schemaVersion===1&&Object.keys(j.steps).sort().join(',')==='config,migrations,owner,preflight,release,runtime,seed,services,verify'&&['config','services','migrations','seed','owner'].every(s=>j.steps[s]==='verified'));
 const hashes=await inspectProtectedBundle(input,root);for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json']){const b=await retain(path.join(root,name));require(b.equals(await retain(path.join(backup,name))));}require(isDeepStrictEqual(parseStrictJson(retained.get(refs.receipt)!.toString(),65536),{schemaVersion:1,installationId:p.installationId,release,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,hashes}));
 await retain(path.join(backup,'manifest.json'));if(store instanceof FileStateStore){await verifyProtectedPath(store.root,true,false,true);await verifyProtectedPath(path.join(store.root,p.request.profile),true,false,true);await retain(path.join(store.root,p.request.profile,'profile.json'));}
 const contract=await serviceContract(input,refs.compose,executor),engine=await selectedImageEngine(executor);require(engine===cursor.binding.engine&&engine===manifest.engine&&isDeepStrictEqual(contract,manifest.contract));
 const observe=async()=>{const r=(await ownedResources(input,contract,await inventory(executor),executor,false,true)).owned;require(r.containers.length===4&&r.volumes.length===4&&r.networks.length===1&&r.containers.every(c=>c.Labels['com.docker.compose.service']==='postgres'?c.Running===true&&c.Health==='healthy':c.Running===false));r.containers.sort((a,b)=>a.Id.localeCompare(b.Id));r.volumes.sort((a,b)=>a.Name.localeCompare(b.Name));r.networks.sort((a,b)=>a.Id.localeCompare(b.Id));for(const c of r.containers)c.Mounts.sort((a,b)=>a.Destination.localeCompare(b.Destination));return r;};
 const resources=await observe(),identity=resourceIdentity(resources);require(isDeepStrictEqual(identity,manifest.resources)&&isDeepStrictEqual(await record('services-attempt.json'),{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}})&&isDeepStrictEqual(await record('services-resources.json'),{schemaVersion:1,installationId:p.installationId,resources:identity}));
 const ownerAttempt=await record('owner-attempt.json'),ownerReceipt=await record('owner-receipt.json');const origin=validateBundleNetwork(p.request.network,prep.bindIPv4).origin,ownerFile=path.join(journal,'owner-invite.txt');require(isDeepStrictEqual(ownerAttempt,{schemaVersion:1,installationId:p.installationId,contract,resources:identity,origin,outputDirectory:journal})&&isDeepStrictEqual(ownerReceipt,{schemaVersion:1,contract:'castlink-owner-host-v1',installationId:p.installationId,nodeId:rendered.nodeId,filePath:ownerFile,origin,status:'verified',expiresAt:ownerReceipt.expiresAt})&&Number.isSafeInteger(ownerReceipt.expiresAt));await retain(ownerFile,65536);
 const reverify=async()=>{await cursor.assert();require(isDeepStrictEqual(await store.load(p.request.profile),p)&&await selectedImageEngine(executor)===engine&&isDeepStrictEqual(await serviceContract(input,refs.compose,executor),contract)&&isDeepStrictEqual(await observe(),resources)&&isDeepStrictEqual(await verifyColdBackup(backup),manifest));for(const [file,b]of retained)require((await bytes(file)).equals(b));};
 await reverify();const protectedFiles=Object.fromEntries([...retained].map(([file,b])=>[file,createHash('sha256').update(b).digest('hex')]));const payload={root,backupDirectory:backup,attemptDirectory:attempt,installationId:p.installationId,engine,epoch:o.targetEpoch,endpoint:cursor.binding.endpoint,principal:cursor.binding.principal,scope:cursor.binding.scope,manifest,containers:resources.containers,volumes:resources.volumes,networks:resources.networks,protectedFiles};const encoded=Buffer.from(JSON.stringify(payload));require(encoded.length<=262144);
 const result=await cursor.effect(async()=>{const response=await executor.run({executable:process.execPath,args:['-e',restoreTarget],input:encoded,sensitive:true});require(response.code===0&&response.stderr==='');const result=parseStrictJson(response.stdout,2048) as Omit<ColdRestoreResult,'receiptPath'>;require(isDeepStrictEqual(result,{schemaVersion:1,status:'restored-cold',installationId:p.installationId,release:p.currentRelease,authPreserved:true,servicesStarted:false,targetEpoch:o.targetEpoch+1}));return result;});await reverify();require(isDeepStrictEqual(parseStrictJson((await bytes(path.join(attempt,'receipt.json'))).toString(),2048),result));return{...result,receiptPath:path.join(attempt,'receipt.json')};
 }catch(error){if(error instanceof UnsupportedRestore)throw error;throw refused();}finally{if(unlock)try{await unlock();}catch{throw refused();}}
}
