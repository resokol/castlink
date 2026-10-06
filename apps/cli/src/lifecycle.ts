import {SshExecutor} from './executors/ssh.js';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {observeInstallation} from './status.js';
import {resourceIdentity} from './services.js';
import {openSetupTargetCursor} from './setup-target-guard.js';
import {TargetOperationObservationError,nativeWindowsLeaseDiagnosis} from './target-operation-observer.js';
import {runServiceTarget} from './service-target-runner.js';
import {type Profile,type Executor,type StateStore,type CheckResult} from './types.js';
const fail=():CheckResult=>({id:'lifecycle-association',state:'fail',message:'Lifecycle association, operation lock or retained target identities could not be verified; retain private artifacts and diagnose before retry.'});
const barrier=():CheckResult[]=>[{id:'admission_barrier_unavailable',state:'fail',message:'STOP requires an authoritative private admission barrier; no service was stopped.'},{id:'activeSessions',state:'unverified',message:'Active sessions are unknown; a sampled participant count cannot authorize STOP.'}];
// START never promises application, browser, media or admission readiness.
export async function runLifecycle(action:'start'|'stop',profile:Profile|null,executor:Executor,store?:StateStore,options:{dryRun?:boolean}={}):Promise<CheckResult[]>{
 if(action==='stop')return barrier();
 if(action!=='start'||!profile||!store)return[fail()];
 let unlock:(()=>Promise<void>)|undefined;
 try{
  const p=structuredClone(profile),dryRun=options.dryRun===true;
  if(!dryRun)unlock=await store.lock(p.request.profile);
  if(!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();
  const remote=p.request.target.kind==='remote';
  const selected=remote?new SshExecutor(p.request.target as Extract<Profile['request']['target'],{kind:'remote'}>,executor):executor;
  const cursor=await openSetupTargetCursor(selected,remote,dryRun);
  await cursor.attach(path.dirname(p.secretFilePaths.journal!),p);
  await cursor.assert();
  // Freeze before mutable target observations; later reads may only reject it.
  const observation=await observeInstallation(p,executor,store);
  const {directory,retained,resources,input,contract}=observation;
  const journal=retained.get(p.secretFilePaths.journal!) as {steps:Record<string,string>};
  if(journal.steps.services!=='verified'||resources.containers.length!==4||resources.volumes.length!==4||resources.networks.length!==1||!retained.has(path.join(directory,'services-attempt.json'))||!retained.has(path.join(directory,'services-resources.json'))||!['images-attempt.json',...['postgres','web','livekit','caddy'].map(s=>'images-'+s+'.json')].every(name=>retained.has(path.join(directory,name))))throw Error();
  if(cursor.binding.engine!==observation.engine)throw Error();
  await cursor.assert();
  if(!isDeepStrictEqual(profile,p))throw Error();
  if(dryRun)return[{id:'start',state:'unverified',message:'Dry run: validate and start only these four existing owned Compose services under a target operation lease; no target mutation was performed.'},...observation.checks];
  if(observation.ready)return[{id:'start',state:'pass',message:'All four existing owned services are already running; no START effect was needed.'},...observation.checks];
  const snapshot=observation.bundleSnapshot as {hashes?:Record<string,string>;fingerprints?:Record<string,string>};
  const files={...(snapshot.hashes??snapshot.fingerprints)};
  if(Object.keys(files).sort().join(',')!=='compose.yaml,livekit.yaml,postgres.env,web.env')throw Error();
  if(!isDeepStrictEqual(profile,p)||!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();
  const binding=cursor.binding;
  await cursor.effect(()=>runServiceTarget('start',input,contract,resources,files,observation.engine,remote,observation.executor,binding.epoch,binding.endpoint,binding.principal,binding.scope));
  const after=await observeInstallation(p,executor,store);
  await cursor.assert();
  if(!after.ready||after.engine!==observation.engine||!isDeepStrictEqual(after.contract,contract)||!isDeepStrictEqual(after.bundleSnapshot,observation.bundleSnapshot)||!isDeepStrictEqual(resourceIdentity(after.resources),resourceIdentity(resources))||!isDeepStrictEqual(after.retained,retained)||!isDeepStrictEqual(profile,p))throw Error();
  return[{id:'start',state:'pass',message:'The same four existing owned services were observed running after scoped Compose START; application, browser and media readiness remain unverified.'},...after.checks];
 }catch(error){if(error instanceof TargetOperationObservationError&&error.message===nativeWindowsLeaseDiagnosis)return[{id:'target_operation_lock_unavailable',state:'fail',message:nativeWindowsLeaseDiagnosis}];return[fail()];}finally{if(unlock)try{await unlock();}catch{return[fail()];}}
}
