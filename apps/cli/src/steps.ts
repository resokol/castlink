import {recoverPreparedWindowsImageCache} from './image-target-runner.js';
import {isWindowsLocalPreviewRelease,windowsLocalPreviewSources,assertWindowsPreviewVersion} from './windows-local-preview.js';
import {TargetOperationObservationError,blockedTargetGenerationDiagnosis} from './target-operation-observer.js';
import {openSetupTargetCursor,type SetupTargetCursor} from './setup-target-guard.js';
import path from 'node:path';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {CliError,type InstallPlan,type Executor,type StateStore,type Profile,type CheckResult} from './types.js';
import {validateRequest} from './plan.js';
import {initializeWindowsSetupTarget,WindowsSetupInitializationError,windowsSetupDiagnosis,prepareConfig,provisionPreparedImages,startPreparedServices,preparePreparedDatabase,preparePreparedOwner,verifyProtectedPath,inspectProtectedBundle,type ConfigOptions} from './setup.js';
import {FileStateStore} from './state.js';
import {FileJournal,syncDirectory} from './journal.js';
import {writeSecretFile} from './secrets.js';
import {parseStrictJson} from './strict-json.js';
import {validateReleaseManifest,renderBundle,type BundleInput} from './bundle.js';
import {validateBundleNetwork} from './network.js';
import {observeRemoteBundle} from './remote-bundle.js';
import {serviceContract,inventory,ownedResources,resourceIdentity} from './services.js';
import {selectedImageEngine,observePinnedImage} from './image-provision.js';
import {captureSetupAssociations,observeSetupTarget,completeSetupTarget,type SetupVerificationRequest,type FileAssociation,type SetupAssociations} from './setup-verification.js';
import type {OwnerMetadata} from './owner.js';
const ids=['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
class SetupExecutionError extends CliError {}
const conflict=()=>new SetupExecutionError('Retained setup association conflicts or is incomplete; retain private files and diagnose actual target state before retry.',4);
async function exists(file:string){try{await lstat(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function privateRecord(file:string):Promise<{value:unknown;text:string;association:FileAssociation}>{
 await verifyProtectedPath(file,false,false,true);const before=await lstat(file);if(before.size>65536)throw conflict();
 const fd=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const held=await fd.stat();if(held.dev!==before.dev||held.ino!==before.ino||!held.isFile()||held.nlink!==1)throw conflict();
  const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const r=await fd.read(bytes,size,bytes.length-size,size);if(!r.bytesRead)break;size+=r.bytesRead;}
  const after=await lstat(file);if(size>65536||after.dev!==held.dev||after.ino!==held.ino||after.mtimeMs!==held.mtimeMs||after.ctimeMs!==held.ctimeMs||after.mode!==held.mode||after.nlink!==1||after.size!==size)throw conflict();
  const raw=bytes.subarray(0,size),text=raw.toString('utf8');return{value:parseStrictJson(text,65536),text,association:{dev:held.dev,ino:held.ino,mode:0o600,sha256:createHash('sha256').update(raw).digest('hex')}};
 }finally{await fd.close();}
}
async function record(file:string):Promise<unknown>{return(await privateRecord(file)).value;}

async function durable(file:string,value:unknown){await writeSecretFile(file,JSON.stringify(value,null,2)+'\n');await syncDirectory(path.dirname(file));}
// The target file is exclusive, private and synced before its fingerprint can
// authorize POST. A retry only accepts the exact retained intent bytes.
const remoteAttempt=String.raw`import os,sys,json,stat,hashlib
try:
 r=json.loads(sys.stdin.buffer.read(65537));p=r['path'];b=r['text'].encode();d=os.path.dirname(p)
 if not os.path.isabs(p) or os.path.normpath(p)!=p or os.path.basename(p)!='setup-completion.json' or len(b)>16384: raise ValueError()
 a=d
 while True:
  s=os.lstat(a)
  if not stat.S_ISDIR(s.st_mode) or stat.S_ISLNK(s.st_mode): raise ValueError()
  if a==d and (s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o700): raise ValueError()
  parent=os.path.dirname(a)
  if parent==a: break
  a=parent
 s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.geteuid() or s.st_nlink!=1 or stat.S_IMODE(s.st_mode)!=0o600 or s.st_size!=len(b): raise ValueError()
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  held=os.fstat(fd);actual=os.read(fd,16385);after=os.lstat(p)
  if actual!=b or (held.st_dev,held.st_ino,held.st_mtime_ns)!=(s.st_dev,s.st_ino,s.st_mtime_ns) or (after.st_dev,after.st_ino,after.st_mtime_ns)!=(s.st_dev,s.st_ino,s.st_mtime_ns): raise ValueError()
 finally: os.close(fd)
 print(json.dumps({'path':p,'dev':s.st_dev,'ino':s.st_ino,'mode':384,'sha256':hashlib.sha256(b).hexdigest()},separators=(',',':')))
except BaseException: sys.exit(4)
`;
async function completionFile(file:string,value:unknown,executor:Executor,remote:boolean):Promise<{path:string}&FileAssociation>{
 const text=JSON.stringify(value,null,2)+'\n';
 if(remote){const r=await executor.run({executable:'python3',args:['-c',remoteAttempt],input:Buffer.from(JSON.stringify({path:file,text})),sensitive:true});if(r.code!==0||r.stderr)throw conflict();const a=parseStrictJson(r.stdout,2048) as {path:string}&FileAssociation;if(a.path!==file||a.mode!==0o600||!Number.isSafeInteger(a.dev)||!Number.isSafeInteger(a.ino)||a.dev<0||a.ino<0||a.sha256!==createHash('sha256').update(text).digest('hex')||!isDeepStrictEqual(a,{path:file,dev:a.dev,ino:a.ino,mode:0o600,sha256:a.sha256}))throw conflict();return a;}
 const retained=await privateRecord(file);if(!isDeepStrictEqual(retained.value,value)||retained.text!==text)throw conflict();return{path:file,...retained.association};
}
export type SetupResult={profile:Profile;checks:CheckResult[];owner:OwnerMetadata;applicationReady:true;browserTrust:'unverified'};
// Fourth argument is required for first use; omitted options recover the exact
// protected preparation from the saved profile, without rewriting a manifest.
export async function executeSetup(plan:InstallPlan,executor:Executor,store:StateStore,retainedConfigOptions?:ConfigOptions):Promise<SetupResult>{
 const p=structuredClone(plan);let o=retainedConfigOptions&&structuredClone(retainedConfigOptions);
 try{
  if(!p||p.schemaVersion!==1||!isDeepStrictEqual(p.steps,ids)||!isDeepStrictEqual(p.blockers,[]))throw new SetupExecutionError('Setup requires a compatible unblocked nine-step plan.',2);try{validateRequest(p.request);}catch{throw new SetupExecutionError('Setup request is invalid.',2);}
  async function stage(action:()=>Promise<unknown>){try{await action();}catch(e){throw new SetupExecutionError(e instanceof CliError?e.message:'Guarded setup stage was interrupted; retain private artifacts before retry.',e instanceof CliError?e.code:3);}}
  const loaded=await store.load(p.request.profile),profile=loaded&&structuredClone(loaded);
  if(!o){if(!profile?.secretFilePaths.journal)throw new SetupExecutionError('Setup requires exact release manifest, architecture, bind IPv4 and private journal directory.',2);const retained=await record(path.join(path.dirname(profile.secretFilePaths.journal),'owner.json')) as {preparation:ConfigOptions};o=structuredClone(retained.preparation);}
  if(!o)throw conflict();const journal=new FileJournal(o.journalDirectory);
  if(profile&&!isDeepStrictEqual(profile.request,p.request))throw conflict();
  let state=profile&&profile.secretFilePaths.journal?await journal.read():null;
  const knownCompleted=state?.steps.verify==='verified'||await exists(path.join(o.journalDirectory,'setup-observed-completion.json'));
  if(!knownCompleted&&!profile&&!state&&p.request.target.kind==='local'&&process.platform==='win32'&&!await exists(p.request.root)&&!await exists(o.journalDirectory)){
   if(Object.keys(o).sort().join(',')!=='architecture,bindIPv4,journalDirectory,release'||typeof o.journalDirectory!=='string'||!path.isAbsolute(o.journalDirectory)||path.resolve(o.journalDirectory)!==o.journalDirectory||/[\x00-\x1f\x7f]/.test(o.journalDirectory))throw new SetupExecutionError('First setup preparation options are invalid.',2);
   validateReleaseManifest(o.release,p.request.release,o.architecture);validateBundleNetwork(p.request.network,o.bindIPv4);
   await initializeWindowsSetupTarget(executor,store);
  }
  if(!knownCompleted&&profile&&state?.steps.config==='verified'&&state.steps.runtime==='pending'&&state.steps.services==='pending')await stage(()=>recoverPreparedWindowsImageCache(p,o!,executor,store));
  const cursor=await openSetupTargetCursor(executor,p.request.target.kind==='remote',knownCompleted);
  // Retained completion authorizes only current read-only verification. Never
  // replay seed or owner initialization against a consumed owner session.
  if(knownCompleted)return await verifySetup(p,o,executor,store,cursor);
  if(!state||state.steps.config!=='verified')await stage(()=>prepareConfig(p,o!,executor,store,cursor));
  state=await journal.read();
  // Helpers validate actual effects on interrupted boundaries; completed later
  // stages are inspected together below rather than replayed or regenerated.
  if(state.steps.runtime==='pending'&&state.steps.services==='pending')await stage(()=>provisionPreparedImages(p,o!,executor,store,cursor));
  if(state.steps.services!=='verified')await stage(()=>startPreparedServices(p,o!,executor,store,cursor));
  state=await journal.read();if(state.steps.migrations!=='verified'||state.steps.seed!=='verified')await stage(()=>preparePreparedDatabase(p,o!,executor,store,cursor));
  state=await journal.read();if(state.steps.owner!=='verified')await stage(()=>preparePreparedOwner(p,o!,executor,store,cursor));
  return await verifySetup(p,o,executor,store,cursor);
 }catch(e){if(e instanceof SetupExecutionError||e instanceof WindowsSetupInitializationError)throw e;if(e instanceof TargetOperationObservationError)throw new TargetOperationObservationError(p.request.target.kind==='local'&&process.platform==='win32'?windowsSetupDiagnosis:blockedTargetGenerationDiagnosis,4);throw new CliError('Setup was interrupted or refused; retain the private journal and inspect actual target state before retry.',e instanceof CliError?e.code:3);}
}
async function verifySetup(p:InstallPlan,o:ConfigOptions,executor:Executor,store:StateStore,cursor:SetupTargetCursor):Promise<SetupResult>{
 const unlock=await store.lock(p.request.profile);
 try{
  const loaded=await store.load(p.request.profile),profile=loaded&&structuredClone(loaded);if(!profile||!isDeepStrictEqual(profile.request,p.request)||profile.currentRelease!==p.request.release)throw conflict();
  const remote=p.request.target.kind==='remote',directory=o.journalDirectory,journal=new FileJournal(directory),state=await journal.read();
  if(ids.filter(id=>id!=='verify').some(id=>state.steps[id as keyof typeof state.steps]!=='verified'))throw conflict();
  await verifyProtectedPath(directory,true,false,true);await cursor.attach(directory,profile);await cursor.assert();
  const retained=new Map<string,unknown>();
  async function retain(name:string){const file=path.join(directory,name),v=await record(file);retained.set(file,v);return v;}
  const ownerScope=await retain('owner.json');if(!isDeepStrictEqual(ownerScope,{schemaVersion:1,installationId:profile.installationId,request:p.request,preparation:o}))throw conflict();
  retained.set(profile.secretFilePaths.journal!,state);
  if(store instanceof FileStateStore){await verifyProtectedPath(store.root,true,false,true);await verifyProtectedPath(path.join(store.root,p.request.profile),true,false,true);const file=path.join(store.root,p.request.profile,'profile.json');if(!isDeepStrictEqual(await record(file),profile))throw conflict();retained.set(file,profile);}
  const paths=remote?path.posix:path,root=p.request.root,secretFiles={webEnv:paths.join(root,'web.env'),postgresEnv:paths.join(root,'postgres.env'),livekitConfig:paths.join(root,'livekit.yaml')};
  if(!isDeepStrictEqual(profile.secretFilePaths,{...secretFiles,compose:paths.join(root,'compose.yaml'),receipt:paths.join(root,'receipt.json'),journal:path.join(directory,'journal.json')}))throw conflict();
  const release=validateReleaseManifest(o.release,p.request.release,o.architecture),input:BundleInput={release,installationId:profile.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,secretFiles};
  async function bundle(){
   if(remote)return(await observeRemoteBundle({release,installationId:profile!.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4},{scopeRoot:o.remoteScope!,directory:root},executor)).fingerprints;
   const hashes=await inspectProtectedBundle(input,root),value=await record(profile!.secretFilePaths.receipt!);
   if(!isDeepStrictEqual(value,{schemaVersion:1,release,installationId:profile!.installationId,architecture:o.architecture,network:p.request.network,bindIPv4:o.bindIPv4,hashes}))throw conflict();return hashes;
  }
  const hashes=await bundle();
  function serviceRoot(){return !remote&&process.platform==='win32'?cursor.rootGuard('services',renderBundle(input).projectName,hashes):undefined;}
  const contract=await serviceContract(input,profile.secretFilePaths.compose!,executor,serviceRoot(),remote),engine=await selectedImageEngine(executor,remote),rendered=renderBundle(input);
  const imageAssociation={schemaVersion:1,installationId:profile.installationId,request:p.request,preparation:o,engine};if(!isDeepStrictEqual(await retain('images-attempt.json'),imageAssociation))throw conflict();
  async function images(){for(const service of ['web','postgres','livekit','caddy'] as const){const image=await observePinnedImage(rendered.composeModel.services[service].image,o.architecture,rendered.composeModel.services[service].volumes?.map(m=>m.target)??[],executor,!remote&&process.platform==='win32'?{guard:serviceRoot()!,service,release}:undefined,remote);if(!image||!isDeepStrictEqual(await record(path.join(directory,'images-'+service+'.json')),{...imageAssociation,service,reference:rendered.composeModel.services[service].image,image}))throw conflict();}}
  for(const service of ['web','postgres','livekit','caddy'])await retain('images-'+service+'.json');await images();
  if(!isDeepStrictEqual(await retain('services-attempt.json'),{schemaVersion:1,contract,initialResources:{containers:[],volumes:[],networks:[]}}))throw conflict();
  const resources=await ownedResources(input,contract,await inventory(executor,serviceRoot(),remote),executor,remote,true,serviceRoot()),identity=resourceIdentity(resources.owned);if(!resources.ready)throw conflict();
  if(!isDeepStrictEqual(await retain('services-resources.json'),{schemaVersion:1,installationId:profile.installationId,resources:identity}))throw conflict();
  for(const phase of ['migrations','seed'])if(!isDeepStrictEqual(await retain(phase+'-attempt.json'),{schemaVersion:1,installationId:profile.installationId,contract,resources:identity}))throw conflict();
  const origin=validateBundleNetwork(p.request.network,o.bindIPv4).origin,outputDirectory=remote?path.posix.join(o.remoteScope!,'owner-'+profile.installationId):directory;
  if(!isDeepStrictEqual(await retain('owner-attempt.json'),{schemaVersion:1,installationId:profile.installationId,contract,resources:identity,origin,outputDirectory}))throw conflict();
  const owner=await retain('owner-receipt.json') as OwnerMetadata,nodeId=rendered.nodeId,ownerFile=paths.join(outputDirectory,'owner-invite.txt');
  if(!isDeepStrictEqual(owner,{schemaVersion:1,contract:'castlink-owner-host-v1',installationId:profile.installationId,nodeId,filePath:ownerFile,origin,status:'verified',expiresAt:owner.expiresAt})||!Number.isSafeInteger(owner.expiresAt))throw conflict();
  const associationFile=path.join(directory,'setup-associations.json'),intentFile=path.join(directory,'setup-completion-intent.json'),receiptFile=path.join(directory,'setup-completion-receipt.json'),observedFile=path.join(directory,'setup-observed-completion.json');
  let associations:SetupAssociations;
  if(await exists(associationFile)){associations=await record(associationFile) as SetupAssociations;retained.set(associationFile,associations);}else{if(state.steps.verify!=='pending'||await exists(intentFile)||await exists(receiptFile)||await exists(observedFile))throw conflict();associations=await captureSetupAssociations({schemaVersion:1,installationId:profile.installationId,nodeId,origin,root,fileHashes:hashes,ownerFile,ownerSHA:null},executor,remote);await durable(associationFile,associations);retained.set(associationFile,associations);}
  let targetCompletion:{file:string;value:unknown;association:{path:string}&FileAssociation}|undefined;
  async function reverify(){
   await cursor.assert();
   if(!isDeepStrictEqual(await store.load(p.request.profile),profile)||!isDeepStrictEqual(await bundle(),hashes)||await selectedImageEngine(executor,remote)!==engine||!isDeepStrictEqual(await serviceContract(input,profile!.secretFilePaths.compose!,executor,serviceRoot(),remote),contract))throw conflict();await images();
   const r=await ownedResources(input,contract,await inventory(executor,serviceRoot(),remote),executor,remote,true,serviceRoot());if(!r.ready||!isDeepStrictEqual(resourceIdentity(r.owned),identity))throw conflict();
   for(const [file,value] of retained)if(!isDeepStrictEqual(await record(file),value))throw conflict();
   if(targetCompletion&&!isDeepStrictEqual(await completionFile(targetCompletion.file,targetCompletion.value,executor,remote),targetCompletion.association))throw conflict();
   if(!isDeepStrictEqual(await captureSetupAssociations({schemaVersion:1,installationId:profile!.installationId,nodeId,origin,root,fileHashes:hashes,ownerFile,ownerSHA:associations.ownerAssociation.sha256},executor,remote),associations))throw conflict();
  }
  const web=resources.owned.containers.find(c=>c.Labels['com.docker.compose.service']==='web'),caddy=resources.owned.containers.find(c=>c.Labels['com.docker.compose.service']==='caddy');if(!web||!caddy)throw conflict();
  const request:SetupVerificationRequest={schemaVersion:1,installationId:profile.installationId,nodeId,origin,serverName:p.request.profile,release:isWindowsLocalPreviewRelease(release)?windowsLocalPreviewSources.web.buildId:p.request.release,root,files:associations.files,ownerFile,ownerAssociation:associations.ownerAssociation,webContainerId:web.Id,caddyContainerId:caddy.Id,webImageId:web.Image,caddyImageId:caddy.Image,complete:false,attempt:null};
  function nativeContext(){if(remote||process.platform!=='win32')return undefined;const g=cursor.sqlGuard('completion',contract,resources.owned,hashes);if(!contract.hashes.caddy)throw conflict();return{web:g,caddy:{...g,containerId:caddy!.Id,containerImage:caddy!.Image,configHash:contract.hashes.caddy}};}
  const intent={schemaVersion:1,installationId:profile.installationId,nodeId,origin,serverName:request.serverName,release:request.release,webContainerId:web.Id,caddyContainerId:caddy.Id,files:associations.files,ownerAssociation:associations.ownerAssociation};
  const attempted=await exists(intentFile),awaitedReceipt=await exists(receiptFile);
  if(attempted){if(!isDeepStrictEqual(await record(intentFile),intent))throw conflict();retained.set(intentFile,intent);}else if(await exists(receiptFile)||await exists(observedFile)||state.steps.verify!=='pending')throw conflict();
  let observedCompletion:unknown;
  if(await exists(observedFile)){observedCompletion=await record(observedFile);retained.set(observedFile,observedCompletion);}
  const knownComplete=state.steps.verify==='verified'||observedCompletion!==undefined;
  await reverify();const before=await observeSetupTarget(request,executor,remote,nativeContext());assertWindowsPreviewVersion(release,before);
  if(knownComplete&&before.setup!=='complete')throw conflict();
  if(before.setup==='complete'&&(!attempted||!await exists(receiptFile)))throw conflict();
  if(!attempted){await durable(intentFile,intent);retained.set(intentFile,intent);}
  const targetAttempt=paths.join(outputDirectory,'setup-completion.json');await reverify();
  let attempt:{path:string}&FileAssociation;
  if(before.setup==='pending'){
   if(cursor.readOnly)throw conflict();
   await journal.mark('verify','running');state.steps.verify='running';await reverify();
   const completed=await cursor.effect(()=>completeSetupTarget(request,cursor.sqlGuard('completion',contract,resources.owned,hashes),targetAttempt,!knownComplete&&!awaitedReceipt,executor,remote,nativeContext()));
   assertWindowsPreviewVersion(release,completed.observation);attempt=completed.attempt;
  }else attempt=await completionFile(targetAttempt,intent,executor,remote);
  targetCompletion={file:targetAttempt,value:intent,association:attempt};
  if(await exists(receiptFile)){if(!isDeepStrictEqual(await record(receiptFile),attempt))throw conflict();}else await durable(receiptFile,attempt);retained.set(receiptFile,attempt);
  const completionProof={schemaVersion:1,intent,attempt,setup:'complete'};
  if(observedCompletion!==undefined&&!isDeepStrictEqual(observedCompletion,completionProof))throw conflict();
  if(observedCompletion===undefined){await durable(observedFile,completionProof);observedCompletion=completionProof;retained.set(observedFile,completionProof);}
  if(state.steps.verify!=='running'){await journal.mark('verify','running');state.steps.verify='running';}
  await reverify();
  // Known completion is never repaired by later observations.
  const final=await observeSetupTarget(request,executor,remote,nativeContext());assertWindowsPreviewVersion(release,final);if(final.setup!=='complete')throw conflict();
  await reverify();await journal.mark('verify','verified');state.steps.verify='verified';await reverify();
  return{profile,owner,applicationReady:true,browserTrust:'unverified',checks:[{id:'setup',state:'pass',message:'Actual SQL, pinned release, protected owner access, setup completion and CA-validated target HTTPS observed.'},{id:'browser-trust',state:'unverified',message:'Operator OS/browser acceptance of the local CA is required before browser access is ready.'},{id:'media',state:'unverified',message:'Real browser ICE and relay media acceptance remains unverified.'}]};
 }finally{await unlock();}
}
