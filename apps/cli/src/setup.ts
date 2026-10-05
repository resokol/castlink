import path from 'node:path';
import {lstat, readFile, mkdir, readdir, unlink, rmdir} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CliError, type Executor, type InstallPlan, type StateStore, type Profile, type CheckResult} from './types.js';
import {validateRequest} from './plan.js';
import {renderBundle, materializeBundle, validateReleaseManifest, type ReleaseManifest, type MaterializedBundle, type BundleInput} from './bundle.js';
import {bundlePrerequisiteChecks} from './bundle-preflight.js';
import {validateBundleNetwork} from './network.js';
import {materializeRemoteBundle, validateRemoteScope, inspectRemoteScope} from './remote-bundle.js';
import {releaseAvailabilityChecks} from './release-availability.js';
import {FileStateStore} from './state.js';
import {FileJournal,syncDirectory} from './journal.js';
import {protectPath, writeSecretFile} from './secrets.js';
import {prerequisiteChecks} from './probe.js';
import {serviceContract,inventory,ownedResources,resourceIdentity,activateServices,ServicesPhaseError} from './services.js';

export type PrepareOptions={release:ReleaseManifest;architecture:'amd64'|'arm64';bindIPv4:string;journalDirectory:string};
export type ConfigOptions=PrepareOptions&{remoteScope?:string};
export type PreparedConfig={profile:Profile;bundle:MaterializedBundle;checks:CheckResult[]};
const steps=['preflight','runtime','release','config','services','migrations','seed','owner','verify'] as const;
const names=['compose.yaml','web.env','postgres.env','livekit.yaml'] as const;
const execute=promisify(execFile);
const conflict=()=>new CliError('Protected configuration conflicts or is incomplete; diagnose private artifacts before retry.',4);
function fields(value:unknown,keys:readonly string[]):void {
 if(!value || typeof value!=='object' || Array.isArray(value) || !isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort()))throw conflict();
}
async function exists(file:string):Promise<boolean>{try{await lstat(file);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
// Check every ancestor before any filesystem mutation; never follow a symlink.
async function pathCheck(file:string,directory:boolean,optional=false,privatePath=false):Promise<void>{
 let current=file,first=true;
 for(;;){
  let info;
  try{info=await lstat(current);}catch(error){if(first&&optional&&(error as NodeJS.ErrnoException).code==='ENOENT'){first=false;current=path.dirname(current);continue;}throw error;}
  if(info.isSymbolicLink() || (first&&!directory?!info.isFile():!info.isDirectory()))throw conflict();
  if(first&&privatePath){
   if(info.nlink!==1&&!directory)throw conflict();
   if(process.platform!=='win32'){
    if((info.mode&0o777)!==(directory?0o700:0o600) || info.uid!==process.getuid?.())throw conflict();
   }else {
    // Read the existing DACL, rather than repairing unsafe artifacts during recovery.
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
 if ($sid -ne $owner -and $sid -ne 'S-1-5-18') { exit 1 }
 if ($seen.ContainsKey($sid) -or $rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl' -or $rule.PropagationFlags -ne 'None') { exit 1 }
 $seen[$sid]=$true
 $inheritance='None'
 if ($env:CASTLINK_PRIVATE_DIRECTORY -eq '1') { $inheritance='ContainerInherit, ObjectInherit' }
 if ($rule.InheritanceFlags.ToString() -ne $inheritance) { exit 1 }
}`;
    await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,CASTLINK_PRIVATE_PATH:file,CASTLINK_PRIVATE_DIRECTORY:directory?'1':'0'}});
   }
  }
  const parent=path.dirname(current);if(parent===current)break;current=parent;first=false;
 }
}
function absolute(value:string):string {
 if(typeof value!=='string' || !path.isAbsolute(value) || /[\x00-\x1f\x7f]/.test(value) || value.split(/[\\/]/).includes('..') || path.dirname(value)===value)throw conflict();
 return path.resolve(value);
}
function nested(a:string,b:string):boolean{const relative=path.relative(a,b);return relative==='' || (!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));}
function env(raw:string):Record<string,string>{
 if(!raw.endsWith('\n'))throw conflict();
 const result:Record<string,string>={};
 for(const line of raw.slice(0,-1).split('\n')){const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!match||Object.hasOwn(result,match[1]!))throw conflict();result[match[1]!]=match[2]!;}
 return result;
}
// This checks actual file content and permissions, even when the journal says verified.
async function inspect(input:BundleInput,root:string):Promise<Record<string,string>>{
 await pathCheck(root,true,false,true);
 const contents:Record<string,string>={};
 for(const name of names){const file=path.join(root,name);await pathCheck(file,false,false,true);if((await lstat(file)).size>1024*1024)throw conflict();contents[name]=await readFile(file,'utf8');}
 const rendered=renderBundle(input);
 if(contents['compose.yaml']!==rendered.composeText)throw conflict();
 const pg=env(contents['postgres.env']!),web=env(contents['web.env']!);
 fields(pg,['POSTGRES_USER','POSTGRES_DB','POSTGRES_PASSWORD']);
 if(pg.POSTGRES_USER!=='castlink'||pg.POSTGRES_DB!=='castlink'||!/^[a-f0-9]{64}$/.test(pg.POSTGRES_PASSWORD!))throw conflict();
 for(const key of ['LIVEKIT_API_SECRET','CASTLINK_SESSION_SECRET','CASTLINK_DATA_ENCRYPTION_KEY','CASTLINK_SETUP_TOKEN','CASTLINK_NODE_SECRET'])if(!/^[a-f0-9]{64}$/.test(web[key]??''))throw conflict();
 if(!/^lk_[a-f0-9]{32}$/.test(web.LIVEKIT_API_KEY??''))throw conflict();
 const expected={
  NODE_ENV:'production',CASTLINK_DEPLOYMENT_MODEL:'self-hosted',CASTLINK_STORAGE_BACKEND:'json',
  DATABASE_URL:`postgresql://castlink:${pg.POSTGRES_PASSWORD}@postgres:5432/castlink`,LIVEKIT_SERVER_URL:'http://livekit:7880',
  LIVEKIT_API_KEY:web.LIVEKIT_API_KEY,LIVEKIT_API_SECRET:web.LIVEKIT_API_SECRET,
  CASTLINK_SESSION_SECRET:web.CASTLINK_SESSION_SECRET,CASTLINK_DATA_ENCRYPTION_KEY:web.CASTLINK_DATA_ENCRYPTION_KEY,CASTLINK_SETUP_TOKEN:web.CASTLINK_SETUP_TOKEN,
  STUDIOLINK_DATA_DIR:'/data',STUDIOLINK_INSTALLATION_ID:input.installationId.toLowerCase(),STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default',
  CASTLINK_NODE_ID:rendered.nodeId,CASTLINK_SERVER_ID:rendered.nodeId,CASTLINK_NODE_SECRET:web.CASTLINK_NODE_SECRET,CASTLINK_NODE_TYPE:'self-hosted',
  CASTLINK_ENFORCE_NODE_ADMISSION:'1',CASTLINK_LICENSE_ENFORCE:'0',CASTLINK_CONTROL_PLANE_URL:'',CASTLINK_LICENSE_SERVICE_URL:'',
 };
 if(!isDeepStrictEqual(web,expected))throw conflict();
 const livekit=JSON.stringify({port:7880,log_level:'info',rtc:{tcp_port:7881,port_range_start:61000,port_range_end:61100,use_external_ip:false,node_ip:input.bindIPv4,enable_loopback_candidate:input.bindIPv4==='127.0.0.1'},keys:{[web.LIVEKIT_API_KEY!]:web.LIVEKIT_API_SECRET}},null,2)+'\n';
 if(contents['livekit.yaml']!==livekit)throw conflict();
 return Object.fromEntries(names.map(name=>[name,createHash('sha256').update(contents[name]!).digest('hex')]));
}

// Library-only local preparation. No runtime install, service start, migration or owner issuance.
export async function prepareLocalConfig(plan:InstallPlan,options:PrepareOptions,executor:Executor,store:StateStore):Promise<PreparedConfig>{
 return prepareProtectedConfig(plan,options,executor,store,false);
}
export async function prepareConfig(plan:InstallPlan,options:ConfigOptions,executor:Executor,store:StateStore):Promise<PreparedConfig>{
 return prepareProtectedConfig(plan,options,executor,store,true);
}
async function prepareProtectedConfig(plan:InstallPlan,options:ConfigOptions,executor:Executor,store:StateStore,orchestrate:boolean):Promise<PreparedConfig>{
 let releaseLock:(()=>Promise<void>)|undefined;
 try {
  // Snapshot every caller-owned value before the first await.
  const p=structuredClone(plan),o=structuredClone(options);
  fields(p,['schemaVersion','request','steps','blockers']);
  if(p.schemaVersion!==1||!isDeepStrictEqual(p.steps,steps)||!Array.isArray(p.blockers)||p.blockers.length!==0)throw new CliError('Plan is blocked or incompatible with protected preparation.',2);
  fields(p.request,p.request.domain===undefined?['profile','target','network','root','release']:['profile','target','network','root','release','domain']);
  validateRequest(p.request);
  const remote=p.request.target.kind==='remote';
  if(remote&&!orchestrate)throw new CliError('Protected remote config writer is not implemented.',2);
  fields(p.request.target,remote?['kind','host','user','port']:['kind']);fields(o,remote?['release','architecture','bindIPv4','journalDirectory','remoteScope']:['release','architecture','bindIPv4','journalDirectory']);
  if(remote)validateRemoteScope({scopeRoot:o.remoteScope!,directory:p.request.root});
  const root=remote?p.request.root:absolute(p.request.root),journalDirectory=absolute(o.journalDirectory);
  if(root!==p.request.root||(!remote&&(nested(root,journalDirectory)||nested(journalDirectory,root))))throw conflict();
  validateBundleNetwork(p.request.network,o.bindIPv4);
  if(o.architecture!=='amd64'&&o.architecture!=='arm64')throw conflict();
  const release=validateReleaseManifest(o.release,p.request.release,o.architecture);
  if(!remote)await pathCheck(root,true,true,true);await pathCheck(journalDirectory,true,true,true);
  if(store instanceof FileStateStore){
   await pathCheck(absolute(store.root),true,true,true);
   if(await exists(store.root)){const directory=path.join(store.root,p.request.profile);await pathCheck(directory,true,true,true);if(await exists(directory))await pathCheck(path.join(directory,'profile.json'),false,true,true);}
  }
  if(await exists(journalDirectory))await pathCheck(path.join(journalDirectory,'journal.json'),false,true,true);
  const checks=await bundlePrerequisiteChecks({network:p.request.network,bindIPv4:o.bindIPv4,architecture:o.architecture},executor,remote);
  if(!['platform','docker-context','docker','compose','bind-address','ports'].every(id=>checks.some(check=>check.id===id&&check.state==='pass')))throw new CliError('Bundle preflight failed; protected configuration was not prepared.',3);
  let releaseChecks:CheckResult[]=[];
  if(orchestrate){
   releaseChecks=await releaseAvailabilityChecks({manifest:release,release:p.request.release,architecture:o.architecture},executor);
   if(releaseChecks.length!==4||releaseChecks.some(c=>c.state!=='pass'))throw new CliError('Bundle release metadata failed; configuration was not prepared.',3);
  }
  const targetExists=remote?await inspectRemoteScope({scopeRoot:o.remoteScope!,directory:root},executor):false;
  if(targetExists&&!await store.load(p.request.profile))throw conflict();
  releaseLock=await store.lock(p.request.profile);
  // Repeat path checks under the profile lock before writing.
  if(!remote)await pathCheck(root,true,true,true);await pathCheck(journalDirectory,true,true,true);
  if(store instanceof FileStateStore){
   await pathCheck(absolute(store.root),true,true,true);
   if(await exists(store.root)){const directory=path.join(store.root,p.request.profile);await pathCheck(directory,true,true,true);if(await exists(directory))await pathCheck(path.join(directory,'profile.json'),false,true,true);}
  }
  if(await exists(journalDirectory))await pathCheck(path.join(journalDirectory,'journal.json'),false,true,true);
  const targetPath=remote?path.posix:path;
  const secretFiles={webEnv:targetPath.join(root,'web.env'),postgresEnv:targetPath.join(root,'postgres.env'),livekitConfig:targetPath.join(root,'livekit.yaml')};
  const receiptPath=targetPath.join(root,'receipt.json');
  const references={...secretFiles,compose:targetPath.join(root,'compose.yaml'),receipt:receiptPath,journal:path.join(journalDirectory,'journal.json')};
  let profile=await store.load(p.request.profile);
  const ownerPath=path.join(journalDirectory,'owner.json');
  const ownership=(id:string)=>({schemaVersion:1,installationId:id,request:p.request,...(orchestrate?{preparation:o}:{})});
  if(profile){
   fields(profile,['schemaVersion','installationId','request','currentRelease','secretFilePaths']);
   const identityOnly=isDeepStrictEqual(profile.secretFilePaths,{});
   if(profile.schemaVersion!==1||!isDeepStrictEqual(profile.request,p.request)||profile.currentRelease!==p.request.release||(!identityOnly&&!isDeepStrictEqual(profile.secretFilePaths,references)))throw conflict();
   // A profile or private permissions alone cannot identify this journal.
   await pathCheck(ownerPath,false,false,true);
   if((await lstat(ownerPath)).size>65536 || !isDeepStrictEqual(JSON.parse(await readFile(ownerPath,'utf8')),ownership(profile.installationId)))throw conflict();
   if(!remote&&identityOnly&&await exists(root))throw conflict();
  }else{
   if((!remote&&await exists(root))||await exists(journalDirectory))throw conflict();
   profile={schemaVersion:1,installationId:randomUUID(),request:p.request,currentRelease:p.request.release,secretFilePaths:{}};
   // Exclusive directory creation reserves this resource across profile locks.
   try{await mkdir(journalDirectory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw conflict();throw error;}
   await protectPath(journalDirectory,true);
   const ownerText=JSON.stringify(ownership(profile.installationId),null,2)+'\n';
   await writeSecretFile(ownerPath,ownerText);await syncDirectory(journalDirectory);await syncDirectory(path.dirname(journalDirectory));
   try{await store.save(profile);}catch(error){
    // A failed initial save may not have persisted identity. Remove only our
    // unchanged reservation with no journal or foreign files, never recursively.
    if(!await store.load(p.request.profile) && isDeepStrictEqual(await readdir(journalDirectory),['owner.json']) && await readFile(ownerPath,'utf8')===ownerText){await unlink(ownerPath);await rmdir(journalDirectory);}
    throw error;
   }
  }
  const journal=new FileJournal(journalDirectory),observed=await journal.read();
  if(steps.some(step=>step!=='config'&&!(orchestrate&&['preflight','release'].includes(step))&&observed.steps[step]!=='pending'))throw conflict();
  if(isDeepStrictEqual(profile.secretFilePaths,{})&&observed.steps.config!=='pending')throw conflict();
  const input={release,installationId:profile.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4};
  const rendered=renderBundle({...input,secretFiles});
  const receipt=(hashes:Record<string,string>)=>({schemaVersion:1,installationId:input.installationId,release,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,hashes});
  let bundle:MaterializedBundle;
  if(remote){
   const attempted=!isDeepStrictEqual(profile.secretFilePaths,{})||observed.steps.config!=='pending';
   if(!attempted){await journal.mark('config','running');profile={...profile,secretFilePaths:references};await store.save(profile);}
   else if(isDeepStrictEqual(profile.secretFilePaths,{}))throw conflict();
   bundle=await materializeRemoteBundle(input,{scopeRoot:o.remoteScope!,directory:root},executor,attempted);
  }else if(await exists(root)){
   await pathCheck(receiptPath,false,false,true);
   if((await lstat(receiptPath)).size>65536)throw conflict();
   const hashes=await inspect({...input,secretFiles},root);
   if(!isDeepStrictEqual(JSON.parse(await readFile(receiptPath,'utf8')),receipt(hashes)))throw conflict();
   bundle={composePath:references.compose,secretFiles,projectName:rendered.projectName,nodeId:rendered.nodeId,requirements:rendered.requirements,checks:rendered.checks};
  }else{
   // A removed bundle after a recorded attempt must never regenerate credentials.
   if(observed.steps.config!=='pending'||!isDeepStrictEqual(profile.secretFilePaths,{}))throw conflict();
   await journal.mark('config','running');
   // Persist that artifact creation was attempted, so deleting both bundle and
   // journal cannot make a retry silently generate a second set of credentials.
   profile={...profile,secretFilePaths:references};await store.save(profile);
   bundle=await materializeBundle(input,root);
   const hashes=await inspect({...input,secretFiles},root);
   await writeSecretFile(receiptPath,JSON.stringify(receipt(hashes),null,2)+'\n');
  }
  // Recheck the receipt and real artifacts before the final journal boundary.
  if(!remote){await pathCheck(receiptPath,false,false,true);
  if(!isDeepStrictEqual(JSON.parse(await readFile(receiptPath,'utf8')),receipt(await inspect({...input,secretFiles},root))))throw conflict();}
  if(orchestrate)for(const step of ['preflight','release'] as const){await journal.mark(step,'running');await journal.mark(step,'verified');}
  await journal.mark('config','running');await journal.mark('config','verified');
  return {profile,bundle,checks:[...checks,...releaseChecks].map(check=>check.id==='config'?{id:'config',state:'pass',message:'Protected candidate configuration and identity match; services and installation readiness remain unverified.'}:check)};
 }catch(error){
  const code=error instanceof CliError&&[1,2,3,4].includes(error.code)?error.code:1;
  // Dependency errors, including CliError messages, are untrusted and can contain secrets.
  throw new CliError(code===3?'Bundle preflight or release metadata failed; protected configuration was not prepared.':code===4?'Protected configuration conflicts or is incomplete; diagnose private artifacts before retry.':'Protected config preparation failed; diagnose the plan and private artifacts before retry.',code);
 }finally{
  if(releaseLock)try{await releaseLock();}catch{throw new CliError('Protected preparation lock release failed; diagnose lock ownership before retry.',4);}
 }
}

// Services consume an exact completed preparation; they never prepare or repair
// artifacts, upgrade receipts, issue owner access or claim installation readiness.
export async function startPreparedServices(plan:InstallPlan,options:ConfigOptions,executor:Executor,store:StateStore):Promise<PreparedConfig>{
 let unlock:(()=>Promise<void>)|undefined;
 try{
  const p=structuredClone(plan),o=structuredClone(options);
  fields(p,['schemaVersion','request','steps','blockers']);if(p.schemaVersion!==1||!isDeepStrictEqual(p.steps,steps)||!isDeepStrictEqual(p.blockers,[]))throw conflict();
  validateRequest(p.request);const remote=p.request.target.kind==='remote';
  fields(p.request,p.request.domain===undefined?['profile','target','network','root','release']:['profile','target','network','root','release','domain']);fields(p.request.target,remote?['kind','host','user','port']:['kind']);
  fields(o,remote?['release','architecture','bindIPv4','journalDirectory','remoteScope']:['release','architecture','bindIPv4','journalDirectory']);
  const root=remote?p.request.root:absolute(p.request.root),directory=absolute(o.journalDirectory);
  if(remote)validateRemoteScope({scopeRoot:o.remoteScope!,directory:root});else if(root!==p.request.root||nested(root,directory)||nested(directory,root))throw conflict();
  validateBundleNetwork(p.request.network,o.bindIPv4);const release=validateReleaseManifest(o.release,p.request.release,o.architecture);
  async function privateState(){await pathCheck(directory,true,false,true);for(const name of ['owner.json','journal.json'])await pathCheck(path.join(directory,name),false,false,true);if(store instanceof FileStateStore){await pathCheck(absolute(store.root),true,false,true);await pathCheck(path.join(store.root,p.request.profile),true,false,true);await pathCheck(path.join(store.root,p.request.profile,'profile.json'),false,false,true);}}
  await privateState();unlock=await store.lock(p.request.profile);await privateState();
  const profile=await store.load(p.request.profile);if(!profile)throw conflict();fields(profile,['schemaVersion','installationId','request','currentRelease','secretFilePaths']);
  const targetPath=remote?path.posix:path,secretFiles={webEnv:targetPath.join(root,'web.env'),postgresEnv:targetPath.join(root,'postgres.env'),livekitConfig:targetPath.join(root,'livekit.yaml')},compose=targetPath.join(root,'compose.yaml');
  const refs={...secretFiles,compose,receipt:targetPath.join(root,'receipt.json'),journal:path.join(directory,'journal.json')};
  if(!isDeepStrictEqual(profile.request,p.request)||profile.currentRelease!==p.request.release||!isDeepStrictEqual(profile.secretFilePaths,refs))throw conflict();
  const owner=path.join(directory,'owner.json');if((await lstat(owner)).size>65536||!isDeepStrictEqual(JSON.parse(await readFile(owner,'utf8')),{schemaVersion:1,installationId:profile.installationId,request:p.request,preparation:o}))throw conflict();
  const journal=new FileJournal(directory),observed=await journal.read();
  if(['preflight','release','config'].some(step=>observed.steps[step as keyof typeof observed.steps]!=='verified')||['migrations','seed','owner','verify'].some(step=>observed.steps[step as keyof typeof observed.steps]!=='pending'))throw conflict();
  const input={release,installationId:profile.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4};
  const rendered=renderBundle({...input,secretFiles});let bundle:MaterializedBundle;
  if(remote)bundle=await materializeRemoteBundle(input,{scopeRoot:o.remoteScope!,directory:root},executor,true);
  else{const receipt=path.join(root,'receipt.json');await pathCheck(receipt,false,false,true);if((await lstat(receipt)).size>65536||!isDeepStrictEqual(JSON.parse(await readFile(receipt,'utf8')),{schemaVersion:1,...input,hashes:await inspect({...input,secretFiles},root)}))throw conflict();bundle={composePath:compose,secretFiles,projectName:rendered.projectName,nodeId:rendered.nodeId,requirements:rendered.requirements,checks:rendered.checks};}
  const checks=await prerequisiteChecks(executor,remote,{architecture:o.architecture});
  if(!['platform','docker-context','docker','compose'].every(id=>checks.some(c=>c.id===id&&c.state==='pass')))throw new ServicesPhaseError('Selected target runtime, architecture, Docker endpoint or Compose compatibility is unverified; correct runtime prerequisites before starting services.',3);
  const contract=await serviceContract({...input,secretFiles},compose,executor),attemptFile=path.join(directory,'services-attempt.json'),resourcesFile=path.join(directory,'services-resources.json');
  const attempted=await exists(attemptFile);
  if(attempted){await pathCheck(attemptFile,false,false,true);if((await lstat(attemptFile)).size>65536||!isDeepStrictEqual(JSON.parse(await readFile(attemptFile,'utf8')),{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}}))throw conflict();}
  else if(observed.steps.services!=='pending'||await exists(resourcesFile))throw conflict();
  let resources=await ownedResources({...input,secretFiles},contract,await inventory(executor),executor,remote,attempted);
  // With a persisted attempt, absence cannot distinguish never-created from
  // created-then-deleted data. Never silently recreate a potentially lost DB/CA.
  if(attempted&&(resources.owned.volumes.length!==4||resources.owned.networks.length!==1))throw new ServicesPhaseError('A recorded service attempt has missing critical volumes or network; automatic retry cannot distinguish incomplete creation from data loss. Diagnose retained resources before retry.',4);
  if(await exists(resourcesFile)){await pathCheck(resourcesFile,false,false,true);if((await lstat(resourcesFile)).size>65536||!isDeepStrictEqual(JSON.parse(await readFile(resourcesFile,'utf8')),{schemaVersion:1,installationId:profile.installationId,resources:resourceIdentity(resources.owned)}))throw conflict();}
  const portChecks=await bundlePrerequisiteChecks({network:p.request.network,bindIPv4:o.bindIPv4,architecture:o.architecture},executor,remote,resources.ownedPorts);
  if(!['platform','docker-context','docker','compose','bind-address','ports'].every(id=>portChecks.some(c=>c.id===id&&c.state==='pass')))throw new ServicesPhaseError('Selected runtime or unowned HTTPS/ICE ports failed preflight; diagnose the selected bind address and foreign listeners before retry.',3);
  // Repeat private artifacts under the lock immediately before mutation.
  await privateState();if(remote)await materializeRemoteBundle(input,{scopeRoot:o.remoteScope!,directory:root},executor,true);else{const receipt=path.join(root,'receipt.json');await pathCheck(receipt,false,false,true);if(!isDeepStrictEqual(JSON.parse(await readFile(receipt,'utf8')),{schemaVersion:1,...input,hashes:await inspect({...input,secretFiles},root)}))throw conflict();}
  resources=await ownedResources({...input,secretFiles},contract,await inventory(executor),executor,remote,attempted);
  if(attempted&&(resources.owned.volumes.length!==4||resources.owned.networks.length!==1))throw conflict();
  if(await exists(resourcesFile)&&!isDeepStrictEqual(JSON.parse(await readFile(resourcesFile,'utf8')),{schemaVersion:1,installationId:profile.installationId,resources:resourceIdentity(resources.owned)}))throw conflict();
  await journal.mark('runtime','running');await journal.mark('runtime','verified');
  if(!attempted){await writeSecretFile(attemptFile,JSON.stringify({schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}},null,2)+'\n');await syncDirectory(directory);}
  await journal.mark('services','running');
  if(!resources.ready)await activateServices(contract,executor);
  resources=await ownedResources({...input,secretFiles},contract,await inventory(executor),executor,remote,true);
  if(!resources.ready)throw new ServicesPhaseError('Services were attempted but expected owned containers are not all running/healthy; inspect the private journal. SQL, seed, owner and readiness remain pending.',3);
  if(await exists(resourcesFile)){if(!isDeepStrictEqual(JSON.parse(await readFile(resourcesFile,'utf8')),{schemaVersion:1,installationId:profile.installationId,resources:resourceIdentity(resources.owned)}))throw conflict();}
  else{await writeSecretFile(resourcesFile,JSON.stringify({schemaVersion:1,installationId:profile.installationId,resources:resourceIdentity(resources.owned)},null,2)+'\n');await syncDirectory(directory);}
  await journal.mark('services','verified');
  return{profile,bundle,checks:[...portChecks.filter(c=>c.id!=='services'),{id:'services',state:'pass',message:'Expected pinned services and actual owned resources observed running; SQL, seed, owner, API/TLS/media and installation readiness remain unverified.'}]};
 }catch(error){const code=error instanceof CliError&&[2,3,4].includes(error.code)?error.code:1;const trusted=error instanceof ServicesPhaseError;throw new ServicesPhaseError(trusted?error.message:code===4?'Protected services scope conflicts or is incomplete; diagnose private artifacts and resource ownership before retry.':'Guarded services failed; inspect the private journal before retry.',code);}
 finally{if(unlock)try{await unlock();}catch{throw new ServicesPhaseError('Services profile lock release failed; diagnose lock ownership before retry.',4);}}
}
