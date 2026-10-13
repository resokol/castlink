import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {SshExecutor} from './executors/ssh.js';
import {observeUninstallContext} from './uninstall-context.js';
import {openSetupTargetCursor} from './setup-target-guard.js';
import {TargetOperationObservationError,nativeWindowsLeaseDiagnosis} from './target-operation-observer.js';
import {renderBundle} from './bundle.js';
import {nodeImageObservation,pythonImageObservation} from './image-target.js';
import {resourceIdentity} from './services.js';
import {parseStrictJson} from './strict-json.js';
import {runUninstallTarget,uninstallDiagnosis} from './uninstall-target.js';
import type {Profile,Executor,StateStore,CheckResult} from './types.js';
export type UninstallOptions={deleteData?:boolean;confirmation?:string;dryRun?:boolean};
const fail=(message=uninstallDiagnosis):CheckResult[]=>[{id:'uninstall',state:'fail',message}];
const unsupported='Cold uninstall currently requires a verified Linux Node/Python target and absence of an autonomous startup controller. Native Windows/macOS uninstall and ownership-aware registration disable are unavailable.';
function success(deleted:boolean):CheckResult[]{return[{id:'uninstall',state:'pass',message:'The same four identified cold containers were removed and a durable target uninstall receipt was observed.'},{id:'data',state:'pass',message:deleted?'Exactly four owned data volumes and the protected bundle were deleted. The network, private operator state and backup metadata were retained.':'All four data volumes, protected configuration, network, private operator state and backup metadata were retained.'},{id:'startup-registration',state:'pass',message:'Fixed system/user registration locations and native managers were observed without this installation controller; no registration was removed.'},...['application','browser-trust','media'].map(id=>({id,state:'unverified' as const,message:'Readiness is not established by uninstall.'}))]}
// Explicit store keeps client profile metadata under the profile lock. The
// authoritative target receipt lives at a fixed private scope path, never in a
// new Profile field. This library does not remove OS registrations by name.
export async function uninstall(profile:Profile|null,options:UninstallOptions,executor:Executor,store?:StateStore):Promise<CheckResult[]>{
 let unlock:(()=>Promise<void>)|undefined;
 try{
  if(!profile||!store)return fail();const p=structuredClone(profile),o=structuredClone(options);
  if(Object.keys(o).some(k=>!['deleteData','confirmation','dryRun'].includes(k))||o.deleteData!==undefined&&typeof o.deleteData!=='boolean'||o.dryRun!==undefined&&typeof o.dryRun!=='boolean')return fail();
  if(o.deleteData===true&&o.confirmation!==p.request.profile)return fail('Deleting installation data requires the exact profile name as confirmation. No target mutation ran.');
  const remote=p.request.target.kind==='remote',dryRun=o.dryRun===true;if(!remote&&!['linux'].includes(process.platform))return fail(unsupported);
  if(!dryRun)unlock=await store.lock(p.request.profile);
  if(!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();
  const selected=remote?new SshExecutor(p.request.target as Extract<Profile['request']['target'],{kind:'remote'}>,executor):executor;
  const cursor=await openSetupTargetCursor(selected,remote,dryRun);await cursor.attach(path.dirname(p.secretFilePaths.journal!),p);await cursor.assert();
  const profileSHA256=createHash('sha256').update(JSON.stringify(p)).digest('hex');
  const probe=()=>runUninstallTarget({schemaVersion:1,mode:'observe',root:p.request.root,installationId:p.installationId,...cursor.binding,profileSHA256},selected,remote);
  const before=await probe();await cursor.assert();if(before.epoch!==cursor.binding.epoch)throw Error();
  if(before.status!=='not-uninstalled'){
   if(dryRun)return[{id:'uninstall',state:'unverified',message:`Dry run: retained uninstall receipt and actual surviving resources were observed for profile ${p.request.profile}, installation ${p.installationId}; no effect ran.`}];
   if(!isDeepStrictEqual(profile,p)||!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();return success(before.status==='uninstalled-deleted');
  }
  const observed=await observeUninstallContext(p,executor,store);await cursor.assert();
  const {resources,contract,input,retained,directory}=observed,journal=retained.get(p.secretFilePaths.journal!) as {steps:Record<string,string>};
  if(journal.steps.services!=='verified'||resources.containers.length!==4||resources.volumes.length!==4||resources.networks.length!==1||resources.containers.some(c=>c.Running!==false)||!retained.has(path.join(directory,'services-attempt.json'))||!retained.has(path.join(directory,'services-resources.json'))||observed.engine!==cursor.binding.engine)throw Error();
  const capture=await selected.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonImageObservation]:['-e',nodeImageObservation],input:Buffer.from(JSON.stringify({root:p.request.root,installationId:p.installationId})),sensitive:true});if(capture.code!==0||capture.stderr)throw Error();
  const snapshot=parseStrictJson(capture.stdout,4096) as Record<string,unknown>&{files:Record<string,string>};const {schemaVersion,files,...binding}=snapshot;
  if(o.deleteData===true&&Object.hasOwn(files,'owner.json'))return fail('Delete-data with retained in-bundle operator metadata is unavailable; preserve owner.json and data until scoped deletion is verified.');
  if(schemaVersion!==1||!isDeepStrictEqual(Object.keys(snapshot).sort(),['active','endpoint','engine','epoch','files','principal','schemaVersion','scope'])||binding.active!==false||!isDeepStrictEqual(binding,{...cursor.binding,active:false})||!(o.deleteData===true?['compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env']:['compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env','compose.yaml,livekit.yaml,owner.json,postgres.env,receipt.json,web.env']).includes(Object.keys(files).sort().join(',')))throw Error();
  const expected=(observed.bundleSnapshot as {hashes?:Record<string,string>;fingerprints?:Record<string,string>}).hashes??(observed.bundleSnapshot as {fingerprints:Record<string,string>}).fingerprints;
  if(Object.entries(expected).some(([name,hash])=>files[name]!==hash))throw Error();await cursor.assert();
  if(!isDeepStrictEqual(profile,p)||!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();
  if(dryRun)return[{id:'uninstall',state:'unverified',message:`Dry run: profile ${p.request.profile}, installation ${p.installationId}, has four identified stopped containers. The mutating helper would verify actual restart state and controller absence under a shared lease; no effect ran.`}];
  const rendered=renderBundle(input),b=cursor.binding,deleted=o.deleteData===true;
  await cursor.effect(async()=>{const result=await runUninstallTarget({schemaVersion:1,mode:'remove',root:p.request.root,installationId:p.installationId,...b,profileSHA256,deleteData:deleted,files,project:contract.project,model:rendered.composeModel,contract,resources:resourceIdentity(resources),caddySHA256:createHash('sha256').update(rendered.caddyText).digest('hex')},selected,remote);if(result.epoch!==b.epoch+1||result.status!==(deleted?'uninstalled-deleted':'uninstalled-retained'))throw Error();return result});
  const after=await probe();await cursor.assert();if(after.epoch!==cursor.binding.epoch||after.status!==(deleted?'uninstalled-deleted':'uninstalled-retained')||!isDeepStrictEqual(profile,p)||!isDeepStrictEqual(structuredClone(await store.load(p.request.profile)),p))throw Error();return success(deleted);
 }catch(error){if(error instanceof TargetOperationObservationError&&error.message===nativeWindowsLeaseDiagnosis)return fail(nativeWindowsLeaseDiagnosis);return fail();}finally{if(unlock)try{await unlock()}catch{return fail()}}
}
