import path from 'node:path';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {renderBundle,validateReleaseManifest,type BundleInput,type ReleaseManifest} from './bundle.js';
import {CliError,type Profile,type Executor,type StateStore} from './types.js';
import {FileStateStore} from './state.js';
import {observeInstallation} from './status.js';
import {observeTargetGeneration} from './target-operation-observer.js';
import {verifyColdBackup} from './backup.js';
import {parseStrictJson} from './strict-json.js';
import {updateTarget} from './update-target.js';
const failure=()=>new CliError('Cold release transaction refused or unverified; retain its private checkpoint and target-operation owner. Before profile commit the profile is unchanged; a lost response after commit is committed-or-unknown. Automatic rollback and retry are not performed.',4);
const unsupported=()=>new CliError('Cold update and rollback preview requires local Unix and a private FileStateStore.',2);
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function require(v:unknown):asserts v {if(!v)throw failure();}
export function prepareColdUpdate(input:BundleInput,next:unknown){
 const release=validateReleaseManifest(next,(next as ReleaseManifest)?.release,input.architecture);
 require(release.release!==input.release.release&&release.nodeVersion===input.release.nodeVersion&&['postgres','livekit','caddy'].every(s=>isDeepStrictEqual(release.images[s as keyof ReleaseManifest['images']],input.release.images[s as keyof ReleaseManifest['images']])));
 const rendered=renderBundle({...input,release}),prior=renderBundle(input);require(!isDeepStrictEqual(rendered.composeModel,prior.composeModel));
 return {...rendered,release};
}
export type ColdUpdateOptions={release:ReleaseManifest;backupDirectory:string;attemptDirectory:string;targetEpoch:number};
export type ColdRollbackOptions={checkpointDirectory:string;attemptDirectory:string;targetEpoch:number};
export type ColdReleaseResult={schemaVersion:1;contract:'castlink-cold-release-v1';status:'updated-cold'|'rolled-back-cold';installationId:string;release:string;authPreserved:true;servicesStopped:true;targetEpoch:number;checkpointDirectory:string};
async function privateFile(file:string){require(await realpath(file)===file);const s=await lstat(file);require(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid?.()&&(s.mode&511)===384&&s.size<=1048576);const b=await readFile(file),a=await lstat(file);require(s.dev===a.dev&&s.ino===a.ino&&s.size===b.length&&s.mtimeMs===a.mtimeMs&&s.ctimeMs===a.ctimeMs);return b;}
function absolute(p:string){require(typeof p==='string'&&path.isAbsolute(p)&&path.resolve(p)===p&&p!==path.parse(p).root&&!/[\x00-\x1f\x7f]/.test(p));return p;}
async function run(action:'update'|'rollback',profile:Profile,options:ColdUpdateOptions|ColdRollbackOptions,executor:Executor,store:StateStore):Promise<ColdReleaseResult>{
 if(profile?.request?.target?.kind!=='local'||process.platform==='win32')throw unsupported();if(!(store instanceof FileStateStore))throw unsupported();
 let unlock:(()=>Promise<void>)|undefined;
 try{
  const p=structuredClone(profile),o=structuredClone(options);require(Number.isSafeInteger(o.targetEpoch)&&o.targetEpoch>=0);absolute(o.attemptDirectory);unlock=await store.lock(p.request.profile);require(isDeepStrictEqual(await store.load(p.request.profile),p));
  const source=await observeInstallation(p,executor,store),generation=await observeTargetGeneration(executor,false);require(generation.epoch===o.targetEpoch&&generation.engine===source.engine&&source.resources.containers.length===4&&source.resources.containers.every(c=>c.Running===false));
  let next:ReleaseManifest,backupDirectory:string,priorCheckpoint:string|null=null;
  if(action==='update'){require(Object.keys(o).sort().join(',')==='attemptDirectory,backupDirectory,release,targetEpoch');next=(o as ColdUpdateOptions).release;backupDirectory=absolute((o as ColdUpdateOptions).backupDirectory);prepareColdUpdate(source.input,next)}
  else{require(Object.keys(o).sort().join(',')==='attemptDirectory,checkpointDirectory,targetEpoch');priorCheckpoint=absolute((o as ColdRollbackOptions).checkpointDirectory);const c=parseStrictJson((await privateFile(path.join(priorCheckpoint,'checkpoint.json'))).toString(),1048576) as {priorInput:BundleInput;backupDirectory:string;resultProfile:Profile};require(isDeepStrictEqual(c.resultProfile,p));next=c.priorInput.release;backupDirectory=absolute(c.backupDirectory);prepareColdUpdate(source.input,next)}
  const manifest=await verifyColdBackup(backupDirectory);require(manifest.installationId===p.installationId&&manifest.engine===source.engine&&(action==='rollback'||manifest.release===p.currentRelease));
  const extraCheckpoint=priorCheckpoint?[path.join(priorCheckpoint,'checkpoint.json'),path.join(priorCheckpoint,'receipt.json')]:[];
  const files:Record<string,{sha256:string;bytes:string}>={};for(const file of [path.join(store.root,p.request.profile,'profile.json'),path.join(store.root,p.request.profile,'.lock'),...source.retained.keys(),...Object.values(p.secretFilePaths),...extraCheckpoint,...['owner-attempt.json','owner-receipt.json','setup-completion.json','owner-invite.txt'].map(n=>path.join(source.directory,n))]){const b=await privateFile(file);files[file]={sha256:hash(b),bytes:b.toString('base64')}}
  const payload={schemaVersion:1,action,profile:p,profilePath:path.join(store.root,p.request.profile,'profile.json'),input:source.input,preparation:source.preparation,contract:source.contract,resources:source.resources,rendered:renderBundle(source.input),candidate:prepareColdUpdate(source.input,next),generation,files,next,backupDirectory,backupManifest:manifest,attemptDirectory:o.attemptDirectory,priorCheckpoint};const encoded=Buffer.from(JSON.stringify(payload));require(encoded.length<=1048576);
  const response=await executor.run({executable:process.execPath,args:['-e',updateTarget],input:encoded,sensitive:true});require(response.code===0&&response.stderr==='');const result=parseStrictJson(response.stdout,2048) as ColdReleaseResult;require(isDeepStrictEqual(result,{schemaVersion:1,contract:'castlink-cold-release-v1',status:action==='update'?'updated-cold':'rolled-back-cold',installationId:p.installationId,release:next.release,authPreserved:true,servicesStopped:true,targetEpoch:generation.epoch+1,checkpointDirectory:o.attemptDirectory}));
  const after=await store.load(p.request.profile);require(after?.currentRelease===next.release&&after.request.release===next.release&&after.installationId===p.installationId&&isDeepStrictEqual(after.secretFilePaths,p.secretFilePaths));await observeInstallation(after,executor,store);return result;
 }catch(error){if(error instanceof CliError&&error.code===2)throw error;throw failure()}finally{await unlock?.()}
}
export const runColdUpdate=(p:Profile,o:ColdUpdateOptions,e:Executor,s:StateStore)=>run('update',p,o,e,s);
export const runColdRollback=(p:Profile,o:ColdRollbackOptions,e:Executor,s:StateStore)=>run('rollback',p,o,e,s);
