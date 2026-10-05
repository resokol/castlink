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
import {FileJournal} from './journal.js';
import {protectPath, writeSecretFile} from './secrets.js';

export type PrepareOptions={release:ReleaseManifest;architecture:'amd64'|'arm64';bindIPv4:string;journalDirectory:string};
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
 let releaseLock:(()=>Promise<void>)|undefined;
 try {
  // Snapshot every caller-owned value before the first await.
  const p=structuredClone(plan),o=structuredClone(options);
  fields(p,['schemaVersion','request','steps','blockers']);
  if(p.schemaVersion!==1||!isDeepStrictEqual(p.steps,steps)||!Array.isArray(p.blockers)||p.blockers.length!==0)throw new CliError('Plan is blocked or incompatible with protected preparation.',2);
  fields(p.request,p.request.domain===undefined?['profile','target','network','root','release']:['profile','target','network','root','release','domain']);
  validateRequest(p.request);
  if(p.request.target.kind!=='local')throw new CliError('Protected remote config writer is not implemented.',2);
  fields(p.request.target,['kind']);fields(o,['release','architecture','bindIPv4','journalDirectory']);
  const root=absolute(p.request.root),journalDirectory=absolute(o.journalDirectory);
  if(root!==p.request.root||nested(root,journalDirectory)||nested(journalDirectory,root))throw conflict();
  validateBundleNetwork(p.request.network,o.bindIPv4);
  if(o.architecture!=='amd64'&&o.architecture!=='arm64')throw conflict();
  const release=validateReleaseManifest(o.release,p.request.release,o.architecture);
  await pathCheck(root,true,true,true);await pathCheck(journalDirectory,true,true,true);
  if(await exists(journalDirectory))await pathCheck(path.join(journalDirectory,'journal.json'),false,true,true);
  const checks=await bundlePrerequisiteChecks({network:p.request.network,bindIPv4:o.bindIPv4,architecture:o.architecture},executor,false);
  if(!['platform','docker-context','docker','compose','bind-address','ports'].every(id=>checks.some(check=>check.id===id&&check.state==='pass')))throw new CliError('Bundle preflight failed; protected configuration was not prepared.',3);
  releaseLock=await store.lock(p.request.profile);
  // Repeat path checks under the profile lock before writing.
  await pathCheck(root,true,true,true);await pathCheck(journalDirectory,true,true,true);
  if(await exists(journalDirectory))await pathCheck(path.join(journalDirectory,'journal.json'),false,true,true);
  const secretFiles={webEnv:path.join(root,'web.env'),postgresEnv:path.join(root,'postgres.env'),livekitConfig:path.join(root,'livekit.yaml')};
  const receiptPath=path.join(root,'receipt.json');
  const references={...secretFiles,compose:path.join(root,'compose.yaml'),receipt:receiptPath,journal:path.join(journalDirectory,'journal.json')};
  let profile=await store.load(p.request.profile);
  const ownerPath=path.join(journalDirectory,'owner.json');
  const ownership=(id:string)=>({schemaVersion:1,installationId:id,request:p.request});
  if(profile){
   fields(profile,['schemaVersion','installationId','request','currentRelease','secretFilePaths']);
   const identityOnly=isDeepStrictEqual(profile.secretFilePaths,{});
   if(profile.schemaVersion!==1||!isDeepStrictEqual(profile.request,p.request)||profile.currentRelease!==p.request.release||(!identityOnly&&!isDeepStrictEqual(profile.secretFilePaths,references)))throw conflict();
   // A profile or private permissions alone cannot identify this journal.
   await pathCheck(ownerPath,false,false,true);
   if((await lstat(ownerPath)).size>65536 || !isDeepStrictEqual(JSON.parse(await readFile(ownerPath,'utf8')),ownership(profile.installationId)))throw conflict();
   if(identityOnly&&await exists(root))throw conflict();
  }else{
   if(await exists(root)||await exists(journalDirectory))throw conflict();
   profile={schemaVersion:1,installationId:randomUUID(),request:p.request,currentRelease:p.request.release,secretFilePaths:{}};
   // Exclusive directory creation reserves this resource across profile locks.
   try{await mkdir(journalDirectory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw conflict();throw error;}
   await protectPath(journalDirectory,true);
   const ownerText=JSON.stringify(ownership(profile.installationId),null,2)+'\n';
   await writeSecretFile(ownerPath,ownerText);
   try{await store.save(profile);}catch(error){
    // A failed initial save may not have persisted identity. Remove only our
    // unchanged reservation with no journal or foreign files, never recursively.
    if(!await store.load(p.request.profile) && isDeepStrictEqual(await readdir(journalDirectory),['owner.json']) && await readFile(ownerPath,'utf8')===ownerText){await unlink(ownerPath);await rmdir(journalDirectory);}
    throw error;
   }
  }
  const journal=new FileJournal(journalDirectory),observed=await journal.read();
  if(steps.some(step=>step!=='config'&&observed.steps[step]!=='pending'))throw conflict();
  if(isDeepStrictEqual(profile.secretFilePaths,{})&&observed.steps.config!=='pending')throw conflict();
  const input={release,installationId:profile.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4};
  const rendered=renderBundle({...input,secretFiles});
  const receipt=(hashes:Record<string,string>)=>({schemaVersion:1,installationId:input.installationId,release,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,hashes});
  let bundle:MaterializedBundle;
  if(await exists(root)){
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
  await pathCheck(receiptPath,false,false,true);
  if(!isDeepStrictEqual(JSON.parse(await readFile(receiptPath,'utf8')),receipt(await inspect({...input,secretFiles},root))))throw conflict();
  await journal.mark('config','running');await journal.mark('config','verified');
  return {profile,bundle,checks:checks.map(check=>check.id==='config'?{id:'config',state:'pass',message:'Protected local candidate configuration and identity match; services and installation readiness remain unverified.'}:check)};
 }catch(error){
  const code=error instanceof CliError&&[1,2,3,4].includes(error.code)?error.code:1;
  // Dependency errors, including CliError messages, are untrusted and can contain secrets.
  throw new CliError(code===3?'Bundle preflight failed; protected configuration was not prepared.':code===4?'Protected configuration conflicts or is incomplete; diagnose private artifacts before retry.':'Protected config preparation failed; diagnose the plan and private artifacts before retry.',code);
 }finally{
  if(releaseLock)try{await releaseLock();}catch{throw new CliError('Protected preparation lock release failed; diagnose lock ownership before retry.',4);}
 }
}
