import {runWindowsServiceWorker} from './windows-service-worker.js';
import {fixedNodeArguments} from './fixed-node-program.js';
import type {TargetPrincipal} from './target-operation-observer.js';
import {isDeepStrictEqual} from 'node:util';
import {nodeImageObservation,pythonImageObservation,nodeImageTarget,pythonImageTarget} from './image-target.js';
import {createHash,randomUUID} from 'node:crypto';
import {parseStrictJson} from './strict-json.js';
import {renderBundle,type BundleInput} from './bundle.js';
import {imagePullRequest,ImagesPhaseError,type ImageIdentity} from './image-provision.js';
import {CliError,type Executor,type InstallPlan,type StateStore} from './types.js';
import path from 'node:path';
import {lstat,open,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isWindowsLocalPreviewRelease,windowsLocalPreviewRelease} from './windows-local-preview.js';
import {inspectProtectedBundle,verifyProtectedPath,type ConfigOptions} from './setup.js';
import {FileJournal,syncDirectory} from './journal.js';
import {writeSecretFile} from './secrets.js';
import {observeTargetGeneration,type TargetGeneration} from './target-operation-observer.js';
// Caller-local receipts record the result. Actual target authority belongs to the
// fixed helper's held PRE/effect/POST, never to the journal or this capture.
export async function pullPinnedImageTarget(input:BundleInput,root:string,reference:string,targets:string[],remote:boolean,executor:Executor,expectedEngine:string,expectedFiles:Record<string,string>,expectedEpoch:number,expectedEndpoint:string,expectedPrincipal:TargetPrincipal,expectedScope:string):Promise<ImageIdentity>{
 const principal=typeof expectedPrincipal==='number'?expectedPrincipal:{...expectedPrincipal};
 try{
  imagePullRequest(reference,input.architecture);
  const localWindows=!remote&&process.platform==='win32';const command=(source:string,data:unknown)=>localWindows?runWindowsServiceWorker(Buffer.from(JSON.stringify(data)),source===nodeImageObservation?'capture':'images'):executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',source]:fixedNodeArguments(source),input:Buffer.from(JSON.stringify(data)),sensitive:true});
  const captured=await command(remote?pythonImageObservation:nodeImageObservation,{root,installationId:input.installationId});
  if(captured.code!==0||captured.stderr)throw Error();
  const snapshot=parseStrictJson(captured.stdout,4096) as {schemaVersion:number;engine:string;endpoint:string;epoch:number;active:boolean;principal:TargetPrincipal;scope:string;files:Record<string,string>};
  if(Object.keys(snapshot).sort().join(',')!=='active,endpoint,engine,epoch,files,principal,schemaVersion,scope'||snapshot.schemaVersion!==1||snapshot.active!==false||snapshot.engine!==expectedEngine||snapshot.epoch!==expectedEpoch||snapshot.endpoint!==expectedEndpoint||!isDeepStrictEqual(snapshot.principal,principal)||snapshot.scope!==expectedScope||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||typeof snapshot.endpoint!=='string')throw Error();
  if(Object.keys(expectedFiles).sort().join(',')!=='compose.yaml,livekit.yaml,postgres.env,web.env'||Object.entries(expectedFiles).some(([n,h])=>snapshot.files[n]!==h)||snapshot.files['compose.yaml']!==createHash('sha256').update(renderBundle(input).composeText).digest('hex'))throw Error();
  const result=await command(remote?pythonImageTarget:nodeImageTarget,{schemaVersion:1,root,installationId:input.installationId,engine:expectedEngine,endpoint:snapshot.endpoint,epoch:snapshot.epoch,principal,scope:expectedScope,files:snapshot.files,project:renderBundle(input).projectName,reference,architecture:input.architecture,targets,...(localWindows?{release:input.release,service:(()=>{const services=Object.entries(renderBundle(input).composeModel.services).filter(([,v])=>v.image===reference).map(([n])=>n);if(services.length!==1)throw Error();return services[0]})()}:{})});
  if(result.code!==0||result.stderr)throw Error();
  const reply=parseStrictJson(result.stdout,65536) as {schemaVersion:number;pulled:boolean;image:ImageIdentity};
  if(Object.keys(reply).sort().join(',')!=='image,pulled,schemaVersion'||reply.schemaVersion!==1||typeof reply.pulled!=='boolean'||!reply.image)throw Error();
  return reply.image;
 }catch{throw new ImagesPhaseError(!remote&&process.platform==='win32'?'Windows image target identity, private file association or named-pipe engine is unverified; retain its lease and inspect the frozen target binding.':'Pinned image target operation is unverified or blocked; retain private artifacts and diagnose the target operation lease before retry.',4);}
}

const imageRecoveryDiagnosis='Own pinned Caddy cache completion is unverified; retain its image lease, cursor and private recovery evidence.';
// This path reconciles a completed immutable cache lookup. It grants no pull,
// service, database or arbitrary lease recovery authority.
export async function recoverPreparedWindowsImageCache(plan:InstallPlan,options:ConfigOptions,executor:Executor,store:StateStore):Promise<void>{
 if(process.platform!=='win32'||plan.request.target.kind!=='local'||!isWindowsLocalPreviewRelease(options.release))return;
 const cursorFile=path.join(options.journalDirectory,'target-cursor.json');if(!await recoveryExists(cursorFile))return;
 const initial=await imageRecoveryRecord(cursorFile),candidate=initial.value as ImageRecoveryCursor;if(candidate.uncertain!==true)return;
 const unlock=await store.lock(plan.request.profile);
 try{
  const current=await imageRecoveryRecord(cursorFile);if(current.sha256!==initial.sha256)throw Error();const retained=current.value as ImageRecoveryCursor;
  const profile=await store.load(plan.request.profile);if(!profile||profile.schemaVersion!==1||!isDeepStrictEqual(profile.request,plan.request)||profile.installationId!==retained.installationId||profile.currentRelease!==plan.request.release||profile.secretFilePaths.journal!==path.join(options.journalDirectory,'journal.json'))throw Error();
  if(Object.keys(retained).sort().join(',')!=='generation,installationId,request,schemaVersion,uncertain'||retained.schemaVersion!==1||retained.uncertain!==true||!isDeepStrictEqual(retained.request,plan.request)||plan.request.network!=='loopback'||options.architecture!=='amd64'||options.bindIPv4!=='127.0.0.1')throw Error();
  const generation=retained.generation;if(!generation||Object.keys(generation).sort().join(',')!=='active,endpoint,engine,epoch,principal,schemaVersion,scope'||generation.active!==false||typeof generation.principal!=='object'||generation.principal.kind!=='windows-sid'||!Number.isSafeInteger(generation.epoch)||generation.epoch<0||generation.epoch===Number.MAX_SAFE_INTEGER)throw Error();
  const owner=await imageRecoveryRecord(path.join(options.journalDirectory,'owner.json'));if(!isDeepStrictEqual(owner.value,{schemaVersion:1,installationId:profile.installationId,request:plan.request,preparation:options}))throw Error();
  const journal=await new FileJournal(options.journalDirectory).read();if(!['preflight','release','config'].every(k=>journal.steps[k as keyof typeof journal.steps]==='verified')||!['runtime','services','migrations','seed','owner','verify'].every(k=>journal.steps[k as keyof typeof journal.steps]==='pending')||await recoveryExists(path.join(options.journalDirectory,'services-resources.json'))||await recoveryExists(path.join(options.journalDirectory,'images-caddy.json')))throw Error();
  const input:Omit<BundleInput,'secretFiles'>={release:options.release,installationId:profile.installationId,architecture:options.architecture,network:plan.request.network,bindIPv4:options.bindIPv4,controlScope:generation.scope},files=await inspectProtectedBundle({...input,secretFiles:{webEnv:path.join(plan.request.root,'web.env'),postgresEnv:path.join(plan.request.root,'postgres.env'),livekitConfig:path.join(plan.request.root,'livekit.yaml')}},plan.request.root);
  const bundle=await imageRecoveryRecord(path.join(plan.request.root,'receipt.json'));if(!isDeepStrictEqual(bundle.value,{schemaVersion:1,...input,hashes:files}))throw Error();const snapshotFiles={...files,'receipt.json':bundle.sha256};
  const attempt=await imageRecoveryRecord(path.join(options.journalDirectory,'images-attempt.json')),association={schemaVersion:1,installationId:profile.installationId,request:plan.request,preparation:options,engine:generation.engine};if(!isDeepStrictEqual(attempt.value,association))throw Error();
  const receiptSHA256:Record<string,string>={};for(const name of ['web','postgres','livekit'] as const){const row=await imageRecoveryRecord(path.join(options.journalDirectory,'images-'+name+'.json')),v=row.value as {service:string;reference:string;image:ImageIdentity};if(!v.image||!isDeepStrictEqual(v,{...association,service:name,reference:windowsLocalPreviewRelease.images[name].reference,image:v.image}))throw Error();receiptSHA256[name]=row.sha256;}
  const rendered=renderBundle({...input,secretFiles:{webEnv:path.join(plan.request.root,'web.env'),postgresEnv:path.join(plan.request.root,'postgres.env'),livekitConfig:path.join(plan.request.root,'livekit.yaml')}}),evidenceName='images-cache-recovery-'+randomUUID()+'.json';const result=await runWindowsServiceWorker(Buffer.from(JSON.stringify({schemaVersion:1,root:plan.request.root,installationId:profile.installationId,engine:generation.engine,endpoint:generation.endpoint,epoch:generation.epoch,principal:generation.principal,scope:generation.scope,files:snapshotFiles,project:rendered.projectName,reference:windowsLocalPreviewRelease.images.caddy.reference,architecture:'amd64',targets:rendered.composeModel.services.caddy.volumes?.map(m=>m.target)??[],release:options.release,service:'caddy',journal:options.journalDirectory,cursorSHA256:current.sha256,receiptSHA256,evidenceName})),'image-recovery');
  if(result.code!==0||result.stderr){const failed=/^\{"schemaVersion":1,"status":"refused","stage":([1-9]|1[0-5])\}\n$/.exec(result.stdout);throw new CliError(imageRecoveryDiagnosis+(failed?'\n'+JSON.stringify({schemaVersion:1,imageRecoveryStage:Number(failed[1])}):''),4);}
  const answer=parseStrictJson(result.stdout,1024) as {schemaVersion:number;status:string;cursorSHA256:string;oldOwnerHash:string;epoch:number;evidenceName:string};if(Object.keys(answer).sort().join(',')!=='cursorSHA256,epoch,evidenceName,oldOwnerHash,schemaVersion,status'||answer.schemaVersion!==1||answer.status!=='image-lease-retired'||answer.cursorSHA256!==current.sha256||answer.epoch!==generation.epoch+1||answer.evidenceName!==evidenceName||!/^[a-f0-9]{64}$/.test(answer.oldOwnerHash))throw Error();
  const completed=await imageRecoveryRecord(path.join(options.journalDirectory,evidenceName+'.completed'));const terminal=completed.value as {image:ImageIdentity};if(!isDeepStrictEqual(terminal,{schemaVersion:1,status:'image-lease-retired',cursorSHA256:current.sha256,oldOwnerHash:answer.oldOwnerHash,installationId:profile.installationId,epoch:answer.epoch,image:terminal.image,receiptSHA256})||!terminal.image)throw Error();
  const observed=await observeTargetGeneration(executor,false);if(!isDeepStrictEqual(observed,{...generation,epoch:answer.epoch,active:false})||(await imageRecoveryRecord(cursorFile)).sha256!==current.sha256)throw Error();for(const name of ['web','postgres','livekit'])if((await imageRecoveryRecord(path.join(options.journalDirectory,'images-'+name+'.json'))).sha256!==receiptSHA256[name])throw Error();
  const temporary=path.join(options.journalDirectory,'.image-cursor-'+randomUUID()+'.tmp');await writeSecretFile(temporary,JSON.stringify({...retained,generation:observed,uncertain:false},null,2)+'\n');if((await imageRecoveryRecord(cursorFile)).sha256!==current.sha256)throw Error();await rename(temporary,cursorFile);await syncDirectory(options.journalDirectory);
 }catch(error){if(error instanceof CliError&&error.message.startsWith(imageRecoveryDiagnosis))throw error;throw new CliError(imageRecoveryDiagnosis,4);}finally{await unlock();}
}
type ImageRecoveryCursor={schemaVersion:1;installationId:string;request:InstallPlan['request'];generation:TargetGeneration;uncertain:boolean};
async function recoveryExists(file:string){try{await lstat(file);return true}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error}}
async function imageRecoveryRecord(file:string):Promise<{value:unknown;sha256:string}>{
 await verifyProtectedPath(file,false,false,true);const before=await lstat(file),fd=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const held=await fd.stat();if(!held.isFile()||held.nlink!==1||held.dev!==before.dev||held.ino!==before.ino||held.size>65536)throw Error();const bytes=await fd.readFile(),after=await fd.stat(),named=await lstat(file);if(bytes.length!==held.size||after.size!==held.size||after.mtimeMs!==held.mtimeMs||after.ctimeMs!==held.ctimeMs||named.dev!==held.dev||named.ino!==held.ino)throw Error();const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw Error();return{value:parseStrictJson(text,65536),sha256:createHash('sha256').update(bytes).digest('hex')}}finally{await fd.close()}
}
