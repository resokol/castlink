import {validateBackupArchive} from './backup-archive.js';
export {validateBackupArchive} from './backup-archive.js';
import {guardedBackupTarget} from './backup-target.js';
import {observeUninstallContext} from './uninstall-context.js';
import {openSetupTargetCursor} from './setup-target-guard.js';
import {validateRequest} from './plan.js';
import path from 'node:path';
import {constants,type Stats} from 'node:fs';
import {lstat,readFile,mkdir,readdir,open} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {CliError,type Executor,type Profile,type StateStore} from './types.js';
import {renderBundle,validateReleaseManifest} from './bundle.js';
import type {PrepareOptions} from './setup.js';
import {serviceContract,inventory,ownedResources,resourceIdentity} from './services.js';
import {selectedImageEngine} from './image-provision.js';
import {FileStateStore} from './state.js';
import {protectPath,writeSecretFile} from './secrets.js';
import {parseStrictJson} from './strict-json.js';
import {backupTarget} from './backup-target.js';
const execute=promisify(execFile),limit=64*1024*1024;
const bundleNames=['compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json'] as const;
const archiveNames=['web-data.tar','caddy-data.tar','caddy-config.tar'] as const;
const filenames=['postgres.dump',...archiveNames,...bundleNames];
const failure=()=>new CliError('Cold backup scope, identity, private files or content cannot be verified; diagnose retained private partial files before retry using a new output directory.',4);
function absolute(p:string):string{if(typeof p!=='string'||!path.isAbsolute(p)||path.resolve(p)!==p||/[\x00-\x1f\x7f]/.test(p)||p.split(/[\\/]/).includes('..')||path.dirname(p)===p)throw failure();return p;}
function inside(a:string,b:string):boolean{const r=path.relative(a,b);return r===''||r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);}
async function privatePath(p:string,directory:boolean):Promise<void>{
 let current=p,first=true;for(;;){const info=await lstat(current);if(info.isSymbolicLink()||(first&&!directory?!info.isFile():!info.isDirectory()))throw failure();if(first){if(!directory&&info.nlink!==1)throw failure();if(process.platform!=='win32'){if((info.mode&0o777)!==(directory?0o700:0o600)||info.uid!==process.getuid?.())throw failure();}else{
 const script=`$ErrorActionPreference='Stop'
$item=Get-Item -Force -LiteralPath $env:CASTLINK_PRIVATE_PATH
$acl=$item.GetAccessControl()
$owner=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if (!$acl.AreAccessRulesProtected -or $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $owner) { exit 1 }
$rules=@($acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
if ($rules.Count -ne 2) { exit 1 }
$seen=@{}
foreach ($rule in $rules) {
 $sid=$rule.IdentityReference.Value
 if (($sid -ne $owner -and $sid -ne 'S-1-5-18') -or $seen.ContainsKey($sid) -or $rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl' -or $rule.PropagationFlags -ne 'None') { exit 1 }
 $seen[$sid]=$true
 $inheritance='None'
 if ($env:CASTLINK_PRIVATE_DIRECTORY -eq '1') { $inheritance='ContainerInherit, ObjectInherit' }
 if ($rule.InheritanceFlags.ToString() -ne $inheritance) { exit 1 }
}`;
 await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,CASTLINK_PRIVATE_PATH:p,CASTLINK_PRIVATE_DIRECTORY:directory?'1':'0'}});
 }}const parent=path.dirname(current);if(parent===current)break;current=parent;first=false;}
}
const stableFile=(a:Stats,b:Stats)=>['dev','ino','uid','mode','nlink','size','mtimeMs','ctimeMs'].every(key=>a[key as keyof Stats]===b[key as keyof Stats]);
async function bytes(file:string,max=limit):Promise<Buffer>{
 await privatePath(file,false);const named=await lstat(file);
 if(!Number.isSafeInteger(max)||max<0||max>limit||!named.isFile()||named.nlink!==1||named.size>max||process.platform!=='win32'&&(named.uid!==process.getuid?.()||(named.mode&0o777)!==0o600))throw failure();
 const h=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const before=await h.stat();if(!before.isFile()||!stableFile(named,before))throw failure();
  const buffer=Buffer.alloc(before.size+1);let size=0;while(size<buffer.length){const r=await h.read(buffer,size,buffer.length-size,size);if(!r.bytesRead)break;size+=r.bytesRead;}
  const after=await h.stat();await privatePath(file,false);const actual=await lstat(file);
  if(size!==before.size||!after.isFile()||!stableFile(before,after)||!stableFile(before,actual))throw failure();return buffer.subarray(0,size);
 }finally{await h.close();}
}
async function json(file:string):Promise<any>{return parseStrictJson((await bytes(file,1024*1024)).toString('utf8'),1024*1024);}
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
// Docker cp archives are retained, never extracted. Bound names, types and payloads.
export type BackupManifest={schemaVersion:1;kind:'castlink-cold-backup-v1';installationId:string;release:string;engine:string;contract:unknown;resources:unknown;files:{path:string;bytes:number;sha256:string}[];restoreVerified:false};
async function content(directory:string):Promise<BackupManifest['files']>{const out=[];for(const name of filenames){const value=await bytes(path.join(directory,name));if(archiveNames.includes(name as typeof archiveNames[number]))validateBackupArchive(value);if(name==='postgres.dump'&&(value.length<32||value.subarray(0,5).toString()!=='PGDMP'))throw failure();out.push({path:name,bytes:value.length,sha256:sha(value)});}return out;}
export async function verifyColdBackup(directory:string):Promise<BackupManifest>{try{absolute(directory);await privatePath(directory,true);const m=await json(path.join(directory,'manifest.json')) as BackupManifest;if(!m||m.schemaVersion!==1||m.kind!=='castlink-cold-backup-v1'||m.restoreVerified!==false||!isDeepStrictEqual(Object.keys(m).sort(),['schemaVersion','kind','installationId','release','engine','contract','resources','files','restoreVerified'].sort())||!isDeepStrictEqual((await readdir(directory)).sort(),[...filenames,'manifest.json'].sort())||!isDeepStrictEqual(m.files,await content(directory)))throw failure();const c=m.contract as any,r=m.resources as any,receipt=await json(path.join(directory,'receipt.json'));if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(m.installationId)||typeof m.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(m.engine)||!c||c.schemaVersion!==1||c.installationId!==m.installationId||c.project!=='castlink-'+m.installationId.replaceAll('-','')||c.composeSHA256!==sha(await bytes(path.join(directory,'compose.yaml')))||!r||!Array.isArray(r.containers)||r.containers.length!==4||!Array.isArray(r.volumes)||r.volumes.length!==4||!Array.isArray(r.networks)||r.networks.length!==1||new Set(r.containers.map((v:any)=>v.id)).size!==4||!isDeepStrictEqual(r.containers.map((v:any)=>v.service).sort(),['caddy','livekit','postgres','web'])||r.containers.some((v:any)=>typeof v.id!=='string'||!/^[a-f0-9]{64}$/.test(v.id))||receipt.installationId!==m.installationId||receipt.release.release!==m.release)throw failure();const release=validateReleaseManifest(receipt.release,m.release,receipt.architecture);for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml'])if(receipt.hashes[name]!==sha(await bytes(path.join(directory,name))))throw failure();for(const service of ['postgres','web','livekit','caddy'])if(!c.images?.[service]||!/^sha256:[a-f0-9]{64}$/.test(c.images[service].Id)||!c.images[service].RepoDigests.includes(release.images[service as keyof typeof release.images].reference)||!/^([a-f0-9]{64})$/.test(c.hashes?.[service]))throw failure();return m;}catch{throw failure();}}
// Local library only. Caller explicitly supplies a fresh child of an existing
// private directory. Stops are an operator precondition, never an effect here.
// Each artifact is limited to 64 MiB; archives to 10,000 regular/directory entries.
// verifyColdBackup checks retained structure/checksums, not a production restore.
export async function createColdBackup(profile:Profile,options:{preparation:PrepareOptions;outputDirectory:string},executor:Executor,store:StateStore):Promise<BackupManifest>{
 let unlock:(()=>Promise<void>)|undefined;try{
 const p=structuredClone(profile),o=structuredClone(options),prep=o.preparation;
 if(p.request.target.kind!=='local')throw new CliError('Cold backup remote transport is not implemented; no remote backup was created.',2);
 const root=absolute(p.request.root),journal=absolute(prep.journalDirectory),output=absolute(o.outputDirectory);
 const scopes=[root,journal,...(store instanceof FileStateStore?[absolute(store.root)]:[])];if(scopes.some(s=>inside(s,output)||inside(output,s)))throw failure();await privatePath(path.dirname(output),true);
 const release=validateReleaseManifest(prep.release,p.currentRelease,prep.architecture),secretFiles={webEnv:path.join(root,'web.env'),postgresEnv:path.join(root,'postgres.env'),livekitConfig:path.join(root,'livekit.yaml')};
 const refs={...secretFiles,compose:path.join(root,'compose.yaml'),receipt:path.join(root,'receipt.json'),journal:path.join(journal,'journal.json')};if(p.schemaVersion!==1||p.currentRelease!==p.request.release||!isDeepStrictEqual(p.secretFilePaths,refs))throw failure();
 unlock=await store.lock(p.request.profile);
 const input={release,installationId:p.installationId,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,...(p.request.internet===undefined?{}:{internet:p.request.internet}),secretFiles};
 const rendered=renderBundle(input),retained=new Map<string,Buffer>();
 async function retain(file:string){const value=await bytes(file,1024*1024);retained.set(file,value);return value;}
 await privatePath(root,true);await privatePath(journal,true);
 for(const name of bundleNames)await retain(path.join(root,name));for(const name of ['owner.json','journal.json','services-attempt.json','services-resources.json'])await retain(path.join(journal,name));
 const owner=await json(path.join(journal,'owner.json'));if(!isDeepStrictEqual(owner,{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep}))throw failure();
 if(store instanceof FileStateStore){await privatePath(store.root,true);await privatePath(path.join(store.root,p.request.profile),true);await retain(path.join(store.root,p.request.profile,'profile.json'));}
 const texts=Object.fromEntries(bundleNames.map(n=>[n,retained.get(path.join(root,n))!.toString('utf8')]));if(texts['compose.yaml']!==rendered.composeText)throw failure();
 const hashes=Object.fromEntries(bundleNames.filter(n=>n!=='receipt.json').map(n=>[n,sha(retained.get(path.join(root,n))!)]));if(!isDeepStrictEqual(await json(refs.receipt),{schemaVersion:1,installationId:p.installationId,release,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,...(p.request.internet===undefined?{}:{internet:p.request.internet}),hashes}))throw failure();
 const parseEnv=(s:string)=>{if(!s.endsWith('\n'))throw failure();const out:Record<string,string>={};for(const line of s.slice(0,-1).split('\n')){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!m||Object.hasOwn(out,m[1]!))throw failure();out[m[1]!]=m[2]!;}return out;};
 const pg=parseEnv(texts['postgres.env']!),web=parseEnv(texts['web.env']!);if(Object.keys(pg).sort().join(',')!=='POSTGRES_DB,POSTGRES_PASSWORD,POSTGRES_USER'||pg.POSTGRES_USER!=='castlink'||pg.POSTGRES_DB!=='castlink'||!/^[a-f0-9]{64}$/.test(pg.POSTGRES_PASSWORD!)||web.DATABASE_URL!==`postgresql://castlink:${pg.POSTGRES_PASSWORD}@postgres:5432/castlink`||web.STUDIOLINK_INSTALLATION_ID!==p.installationId||web.CASTLINK_NODE_ID!==rendered.nodeId||web.STUDIOLINK_DATA_DIR!=='/data')throw failure();
 for(const key of ['LIVEKIT_API_SECRET','CASTLINK_SESSION_SECRET','CASTLINK_DATA_ENCRYPTION_KEY','CASTLINK_SETUP_TOKEN','CASTLINK_NODE_SECRET'])if(!/^[a-f0-9]{64}$/.test(web[key]??''))throw failure();if(!/^lk_[a-f0-9]{32}$/.test(web.LIVEKIT_API_KEY??''))throw failure();
 const expectedWeb={NODE_ENV:'production',CASTLINK_DEPLOYMENT_MODEL:'self-hosted',CASTLINK_STORAGE_BACKEND:'json',DATABASE_URL:`postgresql://castlink:${pg.POSTGRES_PASSWORD}@postgres:5432/castlink`,LIVEKIT_SERVER_URL:'http://livekit:7880',LIVEKIT_API_KEY:web.LIVEKIT_API_KEY,LIVEKIT_API_SECRET:web.LIVEKIT_API_SECRET,CASTLINK_SESSION_SECRET:web.CASTLINK_SESSION_SECRET,CASTLINK_DATA_ENCRYPTION_KEY:web.CASTLINK_DATA_ENCRYPTION_KEY,CASTLINK_SETUP_TOKEN:web.CASTLINK_SETUP_TOKEN,STUDIOLINK_DATA_DIR:'/data',STUDIOLINK_INSTALLATION_ID:p.installationId,STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_NODE_ID:rendered.nodeId,CASTLINK_SERVER_ID:rendered.nodeId,CASTLINK_NODE_SECRET:web.CASTLINK_NODE_SECRET,CASTLINK_NODE_TYPE:'self-hosted',CASTLINK_ENFORCE_NODE_ADMISSION:'1',CASTLINK_LICENSE_ENFORCE:'0',CASTLINK_CONTROL_PLANE_URL:'',CASTLINK_LICENSE_SERVICE_URL:''};
 if(!isDeepStrictEqual(web,expectedWeb)||texts['livekit.yaml']!==JSON.stringify({port:7880,log_level:'info',rtc:{tcp_port:7881,port_range_start:61000,port_range_end:61100,use_external_ip:false,node_ip:prep.bindIPv4,enable_loopback_candidate:prep.bindIPv4==='127.0.0.1'},keys:{[web.LIVEKIT_API_KEY!]:web.LIVEKIT_API_SECRET}},null,2)+'\n')throw failure();
 const contract=await serviceContract(input,refs.compose,executor),engine=await selectedImageEngine(executor);
 if(!isDeepStrictEqual(await json(path.join(journal,'services-attempt.json')),{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}}))throw failure();
 const observe=async()=>{const resources=(await ownedResources(input,contract,await inventory(executor),executor,false,true)).owned;if(resources.containers.length!==4||resources.volumes.length!==4||resources.networks.length!==1||resources.containers.some(c=>c.Labels['com.docker.compose.service']==='postgres'?c.Running!==true||c.Health!=='healthy':c.Running!==false))throw failure();resources.containers.sort((a,b)=>a.Id.localeCompare(b.Id));resources.volumes.sort((a,b)=>a.Name.localeCompare(b.Name));resources.networks.sort((a,b)=>a.Id.localeCompare(b.Id));for(const c of resources.containers)c.Mounts.sort((a,b)=>a.Destination.localeCompare(b.Destination));return resources;};
 const resources=await observe();if(!isDeepStrictEqual(await json(path.join(journal,'services-resources.json')),{schemaVersion:1,installationId:p.installationId,resources:resourceIdentity(resources)}))throw failure();
 const reverify=async()=>{if(!isDeepStrictEqual(await store.load(p.request.profile),p)||await selectedImageEngine(executor)!==engine||!isDeepStrictEqual(await serviceContract(input,refs.compose,executor),contract)||!isDeepStrictEqual(await observe(),resources))throw failure();for(const [file,value] of retained)if(!(await bytes(file,1024*1024)).equals(value))throw failure();};
 await reverify();await mkdir(output,{mode:0o700});await protectPath(output,true);await privatePath(output,true);
 const id=(s:string)=>resources.containers.find(c=>c.Labels['com.docker.compose.service']===s)!.Id;
 const response=await executor.run({executable:process.execPath,args:['-e',backupTarget],input:Buffer.from(JSON.stringify({directory:output,engine,containers:resources.containers,installationId:p.installationId,postgres:id('postgres'),web:id('web'),caddy:id('caddy')})),sensitive:true});
 if(response.code!==0||response.stderr!=='')throw failure();const helper=parseStrictJson(response.stdout,4096) as {schemaVersion:number;files:BackupManifest['files']};if(helper.schemaVersion!==1||Object.keys(helper).sort().join(',')!=='files,schemaVersion')throw failure();
 for(const name of ['postgres.dump',...archiveNames])await protectPath(path.join(output,name),false);
 for(const name of bundleNames)await writeSecretFile(path.join(output,name),texts[name]!);
 const files=await content(output);if(!isDeepStrictEqual(helper.files,files.slice(0,4)))throw failure();await reverify();
 const manifest:BackupManifest={schemaVersion:1,kind:'castlink-cold-backup-v1',installationId:p.installationId,release:p.currentRelease,engine,contract,resources:resourceIdentity(resources),files,restoreVerified:false};
 await writeSecretFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return await verifyColdBackup(output);
 }catch(error){if(error instanceof CliError&&error.code===2)throw error;throw failure();}finally{if(unlock)try{await unlock();}catch{throw failure();}}
}

// Public capture requires shared exclusion for its entire PRE/capture/POST.
// Historical createColdBackup remains an internal preview and is not dispatched.
export type GuardedBackupResult={schemaVersion:1;status:'backup-created'|'backup-planned';restoreVerified:false};
export async function createGuardedColdBackup(profile:Profile,options:{outputDirectory:string;dryRun?:boolean},executor:Executor,store:StateStore):Promise<GuardedBackupResult>{
 let unlock:(()=>Promise<void>)|undefined;try{
 const p=structuredClone(profile),o=structuredClone(options);
 if(!p||Object.keys(p).sort().join(',')!=='currentRelease,installationId,request,schemaVersion,secretFilePaths'||p.schemaVersion!==1||p.currentRelease!==p.request.release||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(p.installationId))throw failure();validateRequest(p.request);
 if(p.request.target.kind!=='local'||process.platform!=='linux')throw new CliError('Guarded public backup currently supports local Linux only. SSH, Windows and macOS capture require a separately verified shared-exclusion adapter.',2);
 if(Object.keys(o).some(k=>!['outputDirectory','dryRun'].includes(k))||o.dryRun!==undefined&&typeof o.dryRun!=='boolean')throw failure();const output=absolute(o.outputDirectory);
 if(o.dryRun)return{schemaVersion:1,status:'backup-planned',restoreVerified:false};
 unlock=await store.lock(p.request.profile);if(!isDeepStrictEqual(await store.load(p.request.profile),p))throw failure();
 const context=await observeUninstallContext(p,executor,store),prep=context.preparation,root=absolute(p.request.root),journal=absolute(prep.journalDirectory);
 const identity=resourceIdentity(context.resources);if(!isDeepStrictEqual(context.retained.get(path.join(journal,'services-attempt.json')),{schemaVersion:1,contract:context.contract,initialResources:{containers:[],volumes:[],networks:[]}})||!isDeepStrictEqual(context.retained.get(path.join(journal,'services-resources.json')),{schemaVersion:1,installationId:p.installationId,resources:identity}))throw failure();
 const scopes=[root,journal,...(store instanceof FileStateStore?[absolute(store.root)]:[])];if(scopes.some(s=>inside(s,output)||inside(output,s)))throw failure();await privatePath(path.dirname(output),true);
 const cursor=await openSetupTargetCursor(executor,false);await cursor.attach(journal,p);await cursor.assert();const binding=cursor.binding;if(binding.engine!==context.engine)throw failure();
 const protectedFiles:Record<string,string>={};for(const [file,value]of context.retained){const b=await bytes(file,65536);if(!isDeepStrictEqual(parseStrictJson(b.toString(),65536),value))throw failure();protectedFiles[file]=sha(b);}
 for(const name of bundleNames){const b=await bytes(path.join(root,name),1048576);if(name==='receipt.json'&&!isDeepStrictEqual(parseStrictJson(b.toString(),65536),context.bundleSnapshot))throw failure();protectedFiles[path.join(root,name)]=sha(b);}
 if(store instanceof FileStateStore)protectedFiles[path.join(store.root,p.request.profile,'profile.json')]=sha(await bytes(path.join(store.root,p.request.profile,'profile.json'),65536));
 const rendered=renderBundle(context.input),files=Object.fromEntries(bundleNames.map(name=>[name,protectedFiles[path.join(root,name)]!])),manifest={schemaVersion:1,kind:'castlink-cold-backup-v1',installationId:p.installationId,release:p.currentRelease,engine:context.engine,contract:context.contract,resources:identity,files:[],restoreVerified:false};
 const payload={schemaVersion:1,root,installationId:p.installationId,...binding,directory:output,files,protectedFiles,project:context.contract.project,model:rendered.composeModel,caddySHA256:sha(Buffer.from(rendered.caddyText)),contract:context.contract,resources:identity,containers:context.resources.containers,manifest};
 const input=Buffer.from(JSON.stringify(payload));if(input.length>262144)throw failure();
 await cursor.effect(async()=>{const reply=await executor.run({executable:process.execPath,args:['-e',guardedBackupTarget],input,sensitive:true});if(reply.code!==0||reply.stderr)throw failure();const result=parseStrictJson(reply.stdout,1024);if(!isDeepStrictEqual(result,{schemaVersion:1,status:'backup-created',restoreVerified:false}))throw failure();return result;});
 const actual=await verifyColdBackup(output);if(actual.installationId!==p.installationId||actual.release!==p.currentRelease||actual.engine!==context.engine||!isDeepStrictEqual(actual.contract,context.contract)||!isDeepStrictEqual(actual.resources,manifest.resources)||!isDeepStrictEqual(await store.load(p.request.profile),p))throw failure();await cursor.assert();
 return{schemaVersion:1,status:'backup-created',restoreVerified:false};
 }catch(error){if(error instanceof CliError&&error.code===2)throw error;throw failure();}finally{if(unlock)try{await unlock()}catch{throw failure()}}
}
