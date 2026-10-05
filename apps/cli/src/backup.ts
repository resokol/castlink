import path from 'node:path';
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
async function bytes(file:string,max=limit):Promise<Buffer>{await privatePath(file,false);const h=await open(file,'r');try{const before=await h.stat();if(before.size>max||!before.isFile()||before.nlink!==1)throw failure();const value=await h.readFile();const after=await h.stat(),actual=await lstat(file);if(value.length!==before.size||before.ino!==actual.ino||before.dev!==actual.dev||before.mtimeMs!==after.mtimeMs||after.size!==before.size)throw failure();return value;}finally{await h.close();}}
async function json(file:string):Promise<any>{return parseStrictJson((await bytes(file,1024*1024)).toString('utf8'),1024*1024);}
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
// Docker cp archives are retained, never extracted. Bound names, types and payloads.
export function validateBackupArchive(b:Buffer):void{
 if(b.length>limit||b.length<1024||b.length%512)throw failure();let pos=0,ended=false,paxPath:string|undefined;const seen=new Set<string>();
 const field=(h:Buffer,a:number,n:number)=>h.subarray(a,a+n).toString('ascii').replace(/\0.*$/s,'');
 const oct=(h:Buffer,a:number,n:number)=>{const s=field(h,a,n).trim();if(!/^[0-7]+$/.test(s))throw failure();return parseInt(s,8);};
 while(pos+512<=b.length){const h=b.subarray(pos,pos+512);pos+=512;if(h.every(x=>x===0)){if(b.length-pos<512||!b.subarray(pos).every(x=>x===0)||paxPath)throw failure();ended=true;break;}let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:h[i]!;if(h.some(x=>x>127)||sum!==oct(h,148,8)||field(h,257,6)!=='ustar')throw failure();const n=oct(h,124,12),type=field(h,156,1);if(n>limit||pos+Math.ceil(n/512)*512>b.length)throw failure();const body=b.subarray(pos,pos+n);if(!b.subarray(pos+n,pos+Math.ceil(n/512)*512).every(x=>x===0))throw failure();pos+=Math.ceil(n/512)*512;
 if(type==='x'){if(paxPath!==undefined)throw failure();let offset=0;while(offset<body.length){const space=body.indexOf(32,offset),size=Number(body.subarray(offset,space).toString());if(space<offset||!Number.isInteger(size)||size<5||offset+size>body.length||body[offset+size-1]!==10)throw failure();const line=body.subarray(space+1,offset+size-1).toString('utf8'),eq=line.indexOf('='),key=line.slice(0,eq),value=line.slice(eq+1);if(!['path','mtime','atime','ctime'].includes(key)||key==='path'&&paxPath!==undefined||key!=='path'&&!/^\d+(\.\d+)?$/.test(value))throw failure();if(key==='path')paxPath=value;offset+=size;}continue;}
 const prefix=field(h,345,155);let name=paxPath??(prefix?prefix+'/':'')+field(h,0,100);paxPath=undefined;name=name.replace(/^\.\//,'').replace(/\/$/,'');if(name==='.')name='';if(name&&(/^[\/\\]/.test(name)||/[\\\x00-\x1f\x7f]/.test(name)||name.split('/').some(x=>!x||x==='.'||x==='..')||Buffer.byteLength(name)>1024)||!['','0','5'].includes(type)||field(h,157,100)!==''||type==='5'&&n!==0||type!=='5'&&!name||seen.has(name)||seen.size>=10000)throw failure();seen.add(name);
 }if(!ended)throw failure();
}
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
 const input={release,installationId:p.installationId,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,secretFiles};
 const rendered=renderBundle(input),retained=new Map<string,Buffer>();
 async function retain(file:string){const value=await bytes(file,1024*1024);retained.set(file,value);return value;}
 await privatePath(root,true);await privatePath(journal,true);
 for(const name of bundleNames)await retain(path.join(root,name));for(const name of ['owner.json','journal.json','services-attempt.json','services-resources.json'])await retain(path.join(journal,name));
 const owner=await json(path.join(journal,'owner.json'));if(!isDeepStrictEqual(owner,{schemaVersion:1,installationId:p.installationId,request:p.request,preparation:prep}))throw failure();
 if(store instanceof FileStateStore){await privatePath(store.root,true);await privatePath(path.join(store.root,p.request.profile),true);await retain(path.join(store.root,p.request.profile,'profile.json'));}
 const texts=Object.fromEntries(bundleNames.map(n=>[n,retained.get(path.join(root,n))!.toString('utf8')]));if(texts['compose.yaml']!==rendered.composeText)throw failure();
 const hashes=Object.fromEntries(bundleNames.filter(n=>n!=='receipt.json').map(n=>[n,sha(retained.get(path.join(root,n))!)]));if(!isDeepStrictEqual(await json(refs.receipt),{schemaVersion:1,installationId:p.installationId,release,architecture:prep.architecture,network:p.request.network,bindIPv4:prep.bindIPv4,hashes}))throw failure();
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
